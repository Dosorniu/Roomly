import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import pg from "pg";

// Execute the real migrations and RPCs in PostgreSQL (WASM). Supabase Auth is
// represented only by its users table, roles and auth.uid() claim reader.
// TEST_DATABASE_URL must point to a fresh disposable database, never a live one.
const databaseUrl = process.env.TEST_DATABASE_URL;
let db;
if (databaseUrl) {
  if (!new URL(databaseUrl).pathname.endsWith("/roomly_test"))
    throw Error("Refusing a non-test database.");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  db = {
    query: (...args) => client.query(...args),
    exec: (sql) => client.query(sql),
    close: () => client.end(),
  };
} else db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
await db.exec(
  readFileSync("supabase/migrations/202609210001_roomly.sql", "utf8"),
);
await db.exec(
  readFileSync("supabase/migrations/202609210002_catalog.sql", "utf8"),
);
await db.exec(
  readFileSync(
    "supabase/migrations/202610010003_public_browse_auth.sql",
    "utf8",
  ),
);
const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
];
for (let i = 0; i < 3; i++) {
  await db.query("insert into auth.users values($1,$2,now())", [
    ids[i],
    `student${i}@example.test`,
  ]);
  await db.query(
    "insert into roomly_private.allowed_students values($1,'cbs')",
    [`student${i}@example.test`],
  );
}
await db.query("insert into auth.users values($1,$2,now())", [
  ids[3],
  "newstudent@example.test",
]);

async function asUser(id, sql, args = []) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("set role authenticated");
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
async function asAnon(sql, args = []) {
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await db.exec("set role anon");
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}

const command = (
  id,
  action,
  room,
  minutes = null,
  share = null,
  confirmed = false,
) =>
  asUser(id, "select public.roomly_command($1,$2,$3,$4,$5)", [
    action,
    room,
    minutes,
    share,
    confirmed,
  ]);
const snapshot = async (id) =>
  (await asUser(id, "select public.roomly_snapshot() as value")).rows[0].value;
const publicSnapshot = async () =>
  (await asAnon("select public.roomly_public_snapshot() as value")).rows[0]
    .value;

try {
  const initialPublic = await publicSnapshot();
  assert.equal(initialPublic.state.sessions.length, 0);
  assert.equal(initialPublic.state.memberships.length, 0);
  assert.equal(initialPublic.state.observations.length, 0);

  assert.equal(
    (
      await asUser(
        ids[3],
        "select public.roomly_access_status() as allowed",
      )
    ).rows[0].allowed,
    false,
  );
  await assert.rejects(
    asUser(ids[3], "select public.roomly_claim_access($1)", ["WRONG-CODE"]),
    /Invalid or expired campus access code/,
  );
  await db.query(
    "insert into roomly_private.invite_codes(code,university_id,max_uses) values($1,'cbs',10)",
    ["TEST-CAMPUS-CODE"],
  );
  await asUser(ids[3], "select public.roomly_claim_access($1)", [
    "TEST-CAMPUS-CODE",
  ]);
  assert.equal(
    (
      await asUser(
        ids[3],
        "select public.roomly_access_status() as allowed",
      )
    ).rows[0].allowed,
    true,
  );
  assert.equal((await snapshot(ids[3])).userId, ids[3]);
  if (databaseUrl) {
    // Independent database connections genuinely race for the last available room.
    async function race(id) {
      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        await client.query(
          "select set_config('request.jwt.claim.sub',$1,false)",
          [id],
        );
        await client.query("set role authenticated");
        await client.query(
          "select public.roomly_command('checkIn','112',30,true,true)",
        );
      } finally {
        await client.end();
      }
    }
    const results = await Promise.allSettled([race(ids[0]), race(ids[1])]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const failure = results.find((r) => r.status === "rejected");
    assert.match(failure.reason.message, /already checked in/);
    await db.exec("delete from roomly_private.sessions");
    console.log(
      "PASS: two independent PostgreSQL connections cannot both check into the same room.",
    );
  }
  await assert.rejects(snapshot(null), /approved, verified/);
  await assert.rejects(
    asUser(ids[0], "select * from roomly_private.memberships"),
    /permission denied/,
  );
  await assert.rejects(
    asUser(ids[0], "update public.roomly_revision set revision=99"),
    /permission denied/,
  );
  await assert.rejects(
    command(ids[0], "checkIn", "118", 60, true),
    /Confirm the room is empty/,
  );
  await command(ids[0], "checkIn", "118", 60, true, true);
  await assert.rejects(
    command(ids[1], "checkIn", "118", 60, true, true),
    /already checked in/,
  );
  await command(ids[1], "join", "118");
  await assert.rejects(command(ids[2], "join", "118"), /capacity/);
  await assert.rejects(
    command(ids[1], "join", "112"),
    /Leave your current room/,
  );
  await assert.rejects(
    command(ids[1], "update", "118", 30, false),
    /Only the current room holder/,
  );
  const privateView = await snapshot(ids[2]);
  assert.equal(privateView.state.sessions[0].holderId, "");
  assert.equal(privateView.state.sessions[0].occupantCount, 2);
  assert.deepEqual(privateView.state.memberships, []);
  assert.ok(!JSON.stringify(privateView).includes(ids[0]));

  const publicView = await publicSnapshot();
  assert.equal(publicView.state.sessions[0].holderId, "");
  assert.equal(publicView.state.sessions[0].occupantCount, 2);
  assert.deepEqual(publicView.state.memberships, []);
  assert.ok(!JSON.stringify(publicView).includes(ids[0]));
  assert.ok(!JSON.stringify(publicView).includes("student0@example.test"));
  await asUser(ids[2], "select public.roomly_watch($1,true)", ["118"]);
  await command(ids[0], "leave", "118");
  assert.equal((await snapshot(ids[1])).state.sessions[0].holderId, ids[1]);
  await command(ids[1], "leave", "118");
  let view = await snapshot(ids[2]);
  assert.equal(view.notices.length, 1);
  assert.equal(view.notices[0].roomId, "118");
  assert.equal(
    view.state.observations.find((o) => o.roomId === "118").status,
    "free",
  );
  assert.equal((await snapshot(ids[0])).notices.length, 0);
  await command(ids[0], "checkIn", "118", 1, false);
  await assert.rejects(command(ids[1], "join", "118"), /no longer open/);
  await assert.rejects(command(ids[0], "update", "118", 481, true), /duration/);
  await assert.rejects(
    command(ids[0], "badAction", "118"),
    /Unknown room command/,
  );
  await db.exec(
    "update roomly_private.sessions set started_at=1,expected_end=2",
  );
  view = await snapshot(ids[0]);
  assert.equal(view.state.sessions.length, 0);
  assert.equal(view.state.memberships.length, 0);
  assert.equal(
    view.state.observations.find((o) => o.roomId === "118").status,
    "unknown",
  );
  assert.equal(
    (await snapshot(ids[2])).notices.length,
    1,
    "Expiration must not send a false Free alert",
  );
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    ids[0],
  ]);
  await assert.rejects(snapshot(ids[0]), /approved, verified/);
  await db.query("delete from roomly_private.allowed_students where email=$1", [
    "student1@example.test",
  ]);
  await assert.rejects(snapshot(ids[1]), /approved, verified/);
  console.log(
    "PASS: public privacy projection, invite access, database authorization, private identities, capacity, conflicts, holder transfer, durable watches/notifications, expiration, validation.",
  );
} finally {
  await db.close();
}
