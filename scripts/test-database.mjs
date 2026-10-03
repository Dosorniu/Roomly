import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
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
// Apply every migration in order, so CI exercises the full chain including
// later additions (auth hardening, bookings) exactly as the hosted project does.
for (const file of readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
}
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
  // 118 is open to sharing: signed-in students see WHO is there (display names,
  // never emails), ordered by join time.
  assert.deepEqual(
    privateView.state.sessions[0].occupants,
    ["Student0", "Student1"],
    "share rooms expose occupant display names to signed-in students",
  );
  assert.ok(!JSON.stringify(privateView).includes("@example.test"));

  const publicView = await publicSnapshot();
  assert.equal(publicView.state.sessions[0].holderId, "");
  assert.equal(publicView.state.sessions[0].occupantCount, 2);
  assert.deepEqual(publicView.state.memberships, []);
  assert.ok(!JSON.stringify(publicView).includes(ids[0]));
  assert.ok(!JSON.stringify(publicView).includes("student0@example.test"));
  // The public projection never carries occupant names, for shared rooms or otherwise.
  assert.ok(
    !JSON.stringify(publicView).includes("Student0"),
    "public snapshot never reveals occupant names",
  );
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
  // A non-shared session keeps occupancy anonymous — only a count, no names.
  assert.deepEqual(
    (await snapshot(ids[0])).state.sessions.find((s) => s.roomId === "118")
      .occupants,
    [],
    "non-shared rooms never list occupant names",
  );
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

  // Bookings: reserve, overlap rejection, privacy, ownership on cancel.
  const bk1 = "00000000-0000-4000-8000-0000000000b1";
  const bk2 = "00000000-0000-4000-8000-0000000000b2";
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values ($1,'bk1@example.test',now()),($2,'bk2@example.test',now())",
    [bk1, bk2],
  );
  await db.query(
    "insert into roomly_private.allowed_students(email,university_id) values ('bk1@example.test','cbs'),('bk2@example.test','cbs')",
  );
  const bh = (n) => Date.now() + n * 3600000;
  const rid = (
    await asUser(bk1, "select public.roomly_reserve('112',$1,$2) as id", [
      bh(24),
      bh(26),
    ])
  ).rows[0].id;
  assert.ok(rid, "reserve returns a booking id");
  await assert.rejects(
    asUser(bk2, "select public.roomly_reserve('112',$1,$2)", [bh(25), bh(27)]),
    /already booked/,
    "overlapping slot must be rejected",
  );
  await assert.rejects(
    asAnon("select public.roomly_bookings('112')"),
    /./,
    "anonymous users cannot read the booking calendar",
  );
  const cal = (await asUser(bk1, "select public.roomly_bookings('112') as v"))
    .rows[0].v;
  assert.ok(
    Array.isArray(cal) && cal.length === 1 && cal[0].mine === true,
    "calendar returns the student's own booking, flagged mine",
  );
  assert.equal(cal[0].by, "You", "the actor's own booking reads back as You");
  assert.ok(
    !JSON.stringify(cal).includes("example.test") &&
      !JSON.stringify(cal).includes("userId"),
    "booking payload exposes no identities",
  );
  // A different signed-in student sees the booker's derived display name, never email.
  const calOther = (
    await asUser(bk2, "select public.roomly_bookings('112') as v")
  ).rows[0].v;
  assert.equal(
    calOther[0].by,
    "Bk1",
    "other students see a short display name for the booker",
  );
  assert.equal(calOther[0].mine, false);
  assert.ok(
    !JSON.stringify(calOther).includes("@") &&
      !JSON.stringify(calOther).includes("example.test"),
    "display name never leaks the email address",
  );
  // Dotted campus emails derive a "F. Last" display name.
  const dot = "00000000-0000-4000-8000-0000000000d1";
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values ($1,'mariia.romanko@example.test',now())",
    [dot],
  );
  await db.query(
    "insert into roomly_private.allowed_students(email,university_id) values ('mariia.romanko@example.test','cbs')",
  );
  await asUser(dot, "select public.roomly_reserve('112',$1,$2)", [
    bh(48),
    bh(49),
  ]);
  const calDot = (await asUser(bk2, "select public.roomly_bookings('112') as v"))
    .rows[0].v;
  assert.ok(
    calDot.some((b) => b.by === "M. Romanko"),
    "dotted emails derive a First-initial Last display name",
  );
  await assert.rejects(
    asUser(bk2, "select public.roomly_cancel_booking($1)", [rid]),
    /your own/,
    "only the owner can cancel a booking",
  );
  await asUser(bk1, "select public.roomly_cancel_booking($1)", [rid]);
  const cal2 = (await asUser(bk2, "select public.roomly_bookings('112') as v"))
    .rows[0].v;
  assert.ok(
    !cal2.some((b) => b.id === rid),
    "cancelled booking is removed",
  );

  console.log(
    "PASS: public privacy projection, invite access, database authorization, private identities, capacity, conflicts, holder transfer, durable watches/notifications, expiration, validation, bookings (reserve, overlap, privacy, cancel).",
  );
} finally {
  await db.close();
}
