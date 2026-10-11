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

// A slot in campus time (Europe/Berlin): `daysAhead` days out, on a weekday
// (or a weekend day when `weekend` is true), starting at `hour`:00.
function berlinOffset(ts) {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    timeZoneName: "longOffset",
  }).format(new Date(ts));
  const m = label.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  return (
    (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) * 60000
  );
}
function berlinSlot(daysAhead, hour, minutes, weekend = false) {
  for (let d = daysAhead; d < daysAhead + 14; d++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Berlin",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
      })
        .formatToParts(new Date(Date.now() + d * 86400000))
        .map((p) => [p.type, p.value]),
    );
    const isWeekend = ["Sat", "Sun"].includes(parts.weekday);
    if (isWeekend !== weekend) continue;
    const guess = Date.UTC(+parts.year, +parts.month - 1, +parts.day, hour, 0);
    const start = guess - berlinOffset(guess);
    return [start, start + minutes * 60000];
  }
  throw Error("no slot");
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
    (await asUser(ids[3], "select public.roomly_access_status() as allowed"))
      .rows[0].allowed,
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
    (await asUser(ids[3], "select public.roomly_access_status() as allowed"))
      .rows[0].allowed,
    true,
  );
  assert.equal((await snapshot(ids[3])).userId, ids[3]);

  // Everyone enters the access code once, university addresses included, and
  // the code is accepted in any letter case.
  const cbsUser = "00000000-0000-4000-8000-0000000000c5";
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values ($1,'new.student@cbs-mail.de',now())",
    [cbsUser],
  );
  assert.equal(
    (await asUser(cbsUser, "select public.roomly_access_status() as allowed"))
      .rows[0].allowed,
    false,
    "a university address is not approved without the access code",
  );
  await asUser(cbsUser, "select public.roomly_claim_access($1)", [
    " test-campus-code ",
  ]);
  assert.equal(
    (await asUser(cbsUser, "select public.roomly_access_status() as allowed"))
      .rows[0].allowed,
    true,
  );
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
  // Free means free: check-in needs no "room is empty" confirmation.
  await command(ids[0], "checkIn", "118", 60, true);
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
  // Occupancy is anonymous for everyone: a count, never names.
  assert.equal(
    privateView.state.sessions[0].occupants,
    undefined,
    "snapshots never list occupant names",
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
  assert.equal(
    (await snapshot(ids[0])).state.sessions.find((s) => s.roomId === "118")
      .occupants,
    undefined,
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
    2,
    "a check-in that runs out frees the room and alerts watchers",
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
  const slotA = berlinSlot(2, 10, 120); // 10:00–12:00
  const slotB = berlinSlot(2, 11, 60); // overlaps slotA
  const rid = (
    await asUser(bk1, "select public.roomly_reserve('112',$1,$2) as id", slotA)
  ).rows[0].id;
  assert.ok(rid, "reserve returns a booking id");
  await assert.rejects(
    asUser(bk2, "select public.roomly_reserve('112',$1,$2)", slotB),
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
  // Other students see only that the slot is taken — never who took it.
  const calOther = (
    await asUser(bk2, "select public.roomly_bookings('112') as v")
  ).rows[0].v;
  assert.equal(
    calOther[0].by,
    "Booked",
    "other students see an anonymous label",
  );
  assert.equal(calOther[0].mine, false);
  assert.ok(
    !JSON.stringify(calOther).includes("@") &&
      !JSON.stringify(calOther).includes("Bk1") &&
      !JSON.stringify(calOther).includes(bk1),
    "the booking calendar never identifies the booker",
  );
  await assert.rejects(
    asUser(bk2, "select public.roomly_cancel_booking($1)", [rid]),
    /your own/,
    "only the owner can cancel a booking",
  );
  await asUser(bk1, "select public.roomly_cancel_booking($1)", [rid]);
  const cal2 = (await asUser(bk2, "select public.roomly_bookings('112') as v"))
    .rows[0].v;
  assert.ok(!cal2.some((b) => b.id === rid), "cancelled booking is removed");

  // Booking rules are enforced by the server: campus hours and 30 min – 2 h.
  await assert.rejects(
    asUser(
      bk2,
      "select public.roomly_reserve('114',$1,$2)",
      berlinSlot(2, 10, 60, true),
    ),
    /Monday to Friday/,
    "weekend bookings are rejected",
  );
  await assert.rejects(
    asUser(
      bk2,
      "select public.roomly_reserve('114',$1,$2)",
      berlinSlot(2, 19, 120),
    ),
    /Monday to Friday, 08:00/,
    "bookings past 20:00 are rejected",
  );
  await assert.rejects(
    asUser(
      bk2,
      "select public.roomly_reserve('114',$1,$2)",
      berlinSlot(2, 14, 20),
    ),
    /30 minutes and 2 hours/,
  );
  await assert.rejects(
    asUser(
      bk2,
      "select public.roomly_reserve('114',$1,$2)",
      berlinSlot(2, 9, 180),
    ),
    /30 minutes and 2 hours/,
  );

  // Check-in respects reservations. Reservations running right now are inserted
  // directly, because reserve() only accepts campus hours.
  const now = Date.now();
  await db.query(
    "insert into roomly_private.bookings(room_id,user_id,starts_at,ends_at,created_at) values('203',$1,$2,$3,$2)",
    [bk1, now - 600000, now + 3000000],
  );
  await assert.rejects(
    command(bk2, "checkIn", "203", 30, false, true),
    /reserved until/,
    "another student's reservation blocks check-in",
  );
  await command(bk1, "checkIn", "203", 30, false, true);
  await command(bk1, "leave", "203");
  await db.query(
    "insert into roomly_private.bookings(room_id,user_id,starts_at,ends_at,created_at) values('301',$1,$2,$3,$2)",
    [bk1, now + 1200000, now + 4800000],
  );
  await assert.rejects(
    command(bk2, "checkIn", "301", 60, false, true),
    /booked from/,
    "a stay that runs into a reservation is rejected",
  );
  await command(bk2, "checkIn", "301", 15, false, true);
  await assert.rejects(
    command(bk2, "update", "301", 60, false),
    /booked from/,
    "extending into a reservation is rejected",
  );
  await command(bk2, "leave", "301");

  // Reservations appear in snapshots, anonymously.
  const resPrivate = (await snapshot(bk2)).state.reservations;
  const r203 = resPrivate.find((r) => r.roomId === "203");
  assert.ok(
    r203 && r203.mine === false,
    "reservations are listed for the room",
  );
  assert.equal(
    (await snapshot(bk1)).state.reservations.find((r) => r.roomId === "203")
      .mine,
    true,
  );
  const resPublic = (await publicSnapshot()).state.reservations;
  assert.ok(resPublic.some((r) => r.roomId === "203"));
  assert.ok(resPublic.every((r) => r.mine === false));
  assert.ok(
    !JSON.stringify(resPublic).includes(bk1) &&
      !JSON.stringify(resPrivate).includes(bk1),
    "reservations never carry user ids",
  );

  // Reserve respects check-ins: someone checked in blocks the slot, unless it's you.
  const slotC = berlinSlot(3, 9, 60);
  await command(bk2, "checkIn", "302", 30, false, true);
  await db.query(
    "update roomly_private.sessions set expected_end=$1 where room_id='302'",
    [slotC[1] + 3600000],
  );
  await assert.rejects(
    asUser(bk1, "select public.roomly_reserve('302',$1,$2)", slotC),
    /checked in until/,
    "a check-in blocks reservations in that time",
  );
  await asUser(bk2, "select public.roomly_reserve('302',$1,$2)", slotC);
  await command(bk2, "leave", "302");

  // Time: a check-in takes the room out of Free and gives it back when it ends;
  // a running booking does the same until its end.
  const t1 = Date.now();
  await asUser(bk2, "select public.roomly_watch($1,true)", ["214"]);
  await asUser(bk2, "select public.roomly_watch($1,true)", ["216"]);
  const notices = async (room) =>
    (await snapshot(bk2)).notices.filter((n) => n.roomId === room).length;
  await command(bk1, "checkIn", "214", 30, false);
  let snap = await snapshot(bk2);
  assert.ok(
    snap.state.sessions.some((x) => x.roomId === "214" && !x.openToShare),
    "a check-in shows up as an active session",
  );
  await db.query(
    "update roomly_private.sessions set started_at=$1, expected_end=$2 where room_id='214'",
    [t1 - 1900000, t1 - 1000],
  );
  snap = await snapshot(bk2);
  assert.ok(
    !snap.state.sessions.some((x) => x.roomId === "214"),
    "an expired check-in disappears, so the room is Free again",
  );
  assert.equal(await notices("214"), 1, "watchers are alerted on expiry");
  assert.ok(
    !(await snapshot(bk1)).state.memberships.length,
    "the student is no longer checked in after expiry",
  );
  await db.query(
    "insert into roomly_private.bookings(room_id,user_id,starts_at,ends_at,created_at) values('216',$1,$2,$3,$2)",
    [bk1, t1 - 600000, t1 + 600000],
  );
  assert.ok(
    (await snapshot(bk2)).state.reservations.some(
      (r) => r.roomId === "216" && r.startsAt <= Date.now(),
    ),
  );
  await db.query(
    "update roomly_private.bookings set starts_at=$1, ends_at=$2 where room_id='216'",
    [t1 - 1900000, t1 - 1000],
  );
  assert.ok(
    !(await snapshot(bk2)).state.reservations.some((r) => r.roomId === "216"),
    "a finished booking no longer holds the room",
  );
  assert.equal(
    await notices("216"),
    1,
    "watchers are alerted when a booking ends",
  );
  await snapshot(bk2);
  assert.equal(await notices("216"), 1, "an ended booking alerts only once");

  // Shared bookings ("Others can join").
  await db.query(
    "insert into roomly_private.bookings(room_id,user_id,starts_at,ends_at,created_at,open_to_share) values('321',$1,$2,$3,$2,true)",
    [bk1, t1 - 600000, t1 + 3000000],
  );
  const r321 = (await snapshot(bk2)).state.reservations.find(
    (r) => r.roomId === "321",
  );
  assert.ok(r321 && r321.share === true && r321.mine === false);
  await assert.rejects(
    command(bk2, "checkIn", "321", 30, false),
    /booked as shared/,
    "during a shared booking a check-in must stay open to others",
  );
  await command(bk2, "checkIn", "321", 30, true);
  await assert.rejects(
    command(bk2, "update", "321", 30, false),
    /booked as shared/,
  );
  await command(bk1, "checkIn", "321", 30, false);
  const s321 = (await snapshot(bk1)).state.sessions.find(
    (x) => x.roomId === "321",
  );
  assert.equal(
    s321.occupantCount,
    2,
    "the booker arriving joins the student already in the shared room",
  );
  await asUser(bk2, "select public.roomly_watch($1,true)", ["321"]);
  await command(bk1, "leave", "321");
  await command(bk2, "leave", "321");
  assert.equal(
    await notices("321"),
    0,
    "leaving while a booking runs does not claim the room is free",
  );
  await db.query(
    "update roomly_private.bookings set starts_at=$1, ends_at=$2 where room_id='321'",
    [t1 - 1900000, Date.now() - 1000],
  );
  assert.equal(
    await notices("321"),
    1,
    "the alert comes when the booking ends",
  );

  // Reserve with p_share: next to an open session only a shared booking is allowed.
  const slotD = berlinSlot(4, 9, 60);
  await command(bk2, "checkIn", "303", 30, true);
  await db.query(
    "update roomly_private.sessions set expected_end=$1 where room_id='303'",
    [slotD[1] + 3600000],
  );
  await assert.rejects(
    asUser(bk1, "select public.roomly_reserve('303',$1,$2)", slotD),
    /checked in until/,
  );
  await asUser(bk1, "select public.roomly_reserve('303',$1,$2,true)", slotD);
  const cal303 = (
    await asUser(bk2, "select public.roomly_bookings('303') as v")
  ).rows[0].v;
  assert.ok(cal303.some((b) => b.share === true && b.by === "Booked"));
  const mine303 = (await asUser(bk1, "select public.roomly_my_bookings() as v"))
    .rows[0].v;
  assert.ok(mine303.some((b) => b.roomId === "303" && b.share === true));
  await command(bk2, "leave", "303");

  console.log(
    "PASS: public privacy projection, invite access, database authorization, private identities, capacity, conflicts, holder transfer, durable watches/notifications, expiration, validation, bookings (reserve, overlap, anonymity, cancel, campus hours, duration), reservations vs check-in, check-in without confirmation, Free again after expiry, shared bookings, one access-code flow for every email, alerts when a check-in or booking ends, no false alert on leave during a booking.",
  );
} finally {
  await db.close();
}
