-- Roomly — reservations respected by check-in, server-side booking rules, anonymity.
-- Apply in Supabase -> SQL Editor -> Run. Safe to re-run. No data is deleted.
--
-- 1. Anonymity: nobody sees other students' names. Bookings read back as "You"
--    (your own) or "Booked" (anyone else); snapshots carry no occupant names.
-- 2. Check-in and bookings know about each other: you cannot check into a room
--    that someone else has reserved for that time, and you cannot reserve a slot
--    while someone else is checked in. A room with a reservation running now is
--    reported as occupied (snapshots include anonymous reservations for 24 h).
-- 3. Booking rules are enforced by the server, not only the UI: Monday to Friday,
--    08:00–20:00 campus time (Europe/Berlin), 30 minutes to 2 hours.
--
-- Lock order everywhere: 724002 (bookings/occupancy) before 724001 (expiry).

create or replace function roomly_private.campus_time(ms bigint) returns text
language sql stable set search_path='' as $$
  select to_char(to_timestamp(ms / 1000.0) at time zone 'Europe/Berlin', 'HH24:MI')
$$;
revoke all on function roomly_private.campus_time(bigint) from public, anon, authenticated;

-- Anonymous reservations for the next 24 hours, for one university.
create or replace function roomly_private.reservations_json(university text, actor uuid, t bigint)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'roomId', bk.room_id, 'startsAt', bk.starts_at, 'endsAt', bk.ends_at,
      'mine', actor is not null and bk.user_id = actor)
      order by bk.starts_at), '[]'::jsonb)
  from roomly_private.bookings bk
  join roomly_private.rooms r on r.id = bk.room_id
  join roomly_private.floors f on f.id = r.floor_id
  join roomly_private.buildings b on b.id = f.building_id
  join roomly_private.campuses c on c.id = b.campus_id
  where r.enabled and c.university_id = university
    and bk.ends_at > t and bk.starts_at < t + 86400000
$$;
revoke all on function roomly_private.reservations_json(text, uuid, bigint) from public, anon, authenticated;

-- ============================================================
-- 1. Anonymous booking calendar
-- ============================================================
create or replace function public.roomly_bookings(target_room text, window_days integer default 14)
returns jsonb language plpgsql security definer set search_path='' as $$
declare university text; actor uuid := auth.uid(); t bigint; horizon bigint;
begin
  university := roomly_private.actor_university();
  t := floor(extract(epoch from clock_timestamp()) * 1000);
  horizon := t + (greatest(1, least(window_days, 31)))::bigint * 86400000;
  if not exists(select 1 from roomly_private.rooms r
      join roomly_private.floors f on f.id=r.floor_id
      join roomly_private.buildings b on b.id=f.building_id
      join roomly_private.campuses c on c.id=b.campus_id
      where r.id=target_room and r.enabled and c.university_id=university)
  then raise exception 'This room is unavailable.'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', bk.id, 'startsAt', bk.starts_at, 'endsAt', bk.ends_at,
      'mine', bk.user_id = actor,
      'by', case when bk.user_id = actor then 'You' else 'Booked' end)
      order by bk.starts_at)
    from roomly_private.bookings bk
    where bk.room_id = target_room and bk.ends_at > t and bk.starts_at < horizon), '[]'::jsonb);
end $$;

-- ============================================================
-- 2. Snapshots: no names, plus anonymous reservations
-- ============================================================
create or replace function public.roomly_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare university text; actor uuid := auth.uid(); t bigint;
begin
  university := roomly_private.actor_university();
  perform roomly_private.expire_sessions();
  t := floor(extract(epoch from clock_timestamp()) * 1000);
  return jsonb_build_object(
    'userId',actor,'now',t,
    'state',jsonb_build_object(
      'revision',(select revision from public.roomly_revision where id=1),
      'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'roomId',s.room_id,
        'holderId',case when s.holder_id=actor then actor::text else '' end,
        'startedAt',s.started_at,'expectedEnd',s.expected_end,'openToShare',s.open_to_share,
        'occupantCount',(select count(*) from roomly_private.memberships m where m.session_id=s.id)))
        from roomly_private.sessions s join roomly_private.rooms r on r.id=s.room_id
        join roomly_private.floors f on f.id=r.floor_id join roomly_private.buildings b on b.id=f.building_id
        join roomly_private.campuses c on c.id=b.campus_id where c.university_id=university and r.enabled),'[]'::jsonb),
      'memberships',coalesce((select jsonb_agg(jsonb_build_object('sessionId',session_id,'userId',user_id,'joinedAt',joined_at))
        from roomly_private.memberships where user_id=actor),'[]'::jsonb),
      'observations',coalesce((select jsonb_agg(jsonb_build_object('roomId',o.room_id,'status',o.status,'updatedAt',o.updated_at))
        from roomly_private.observations o join roomly_private.rooms r on r.id=o.room_id
        join roomly_private.floors f on f.id=r.floor_id join roomly_private.buildings b on b.id=f.building_id
        join roomly_private.campuses c on c.id=b.campus_id where c.university_id=university and r.enabled),'[]'::jsonb),
      'reservations',roomly_private.reservations_json(university, actor, t)),
    'watches',coalesce((select jsonb_agg(room_id) from roomly_private.watches where user_id=actor),'[]'::jsonb),
    'notices',coalesce((select jsonb_agg(jsonb_build_object('id',id,'roomId',room_id,'createdAt',created_at)) from
      (select * from roomly_private.notifications where user_id=actor order by created_at desc limit 50) n),'[]'::jsonb)
  );
end $$;

create or replace function public.roomly_public_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare t bigint;
begin
  perform roomly_private.expire_sessions();
  t := floor(extract(epoch from clock_timestamp()) * 1000);
  return jsonb_build_object(
    'now', t,
    'state', jsonb_build_object(
      'revision', (select revision from public.roomly_revision where id=1),
      'sessions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id, 'roomId', s.room_id, 'holderId', '',
          'startedAt', s.started_at, 'expectedEnd', s.expected_end,
          'openToShare', s.open_to_share,
          'occupantCount', (select count(*) from roomly_private.memberships m where m.session_id=s.id)))
        from roomly_private.sessions s
        join roomly_private.rooms r on r.id=s.room_id
        join roomly_private.floors f on f.id=r.floor_id
        join roomly_private.buildings b on b.id=f.building_id
        join roomly_private.campuses c on c.id=b.campus_id
        join roomly_private.universities u on u.id=c.university_id
        where r.enabled and u.public_browsable), '[]'::jsonb),
      'memberships', '[]'::jsonb,
      'observations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'roomId', o.room_id, 'status', o.status, 'updatedAt', o.updated_at))
        from roomly_private.observations o
        join roomly_private.rooms r on r.id=o.room_id
        join roomly_private.floors f on f.id=r.floor_id
        join roomly_private.buildings b on b.id=f.building_id
        join roomly_private.campuses c on c.id=b.campus_id
        join roomly_private.universities u on u.id=c.university_id
        where r.enabled and u.public_browsable), '[]'::jsonb),
      'reservations', coalesce((
        select jsonb_agg(x) from (
          select jsonb_array_elements(roomly_private.reservations_json(u.id, null, t)) as x
          from roomly_private.universities u where u.public_browsable) z), '[]'::jsonb)));
end $$;

-- ============================================================
-- 3. Check-in respects reservations
-- ============================================================
create or replace function public.roomly_command(action text, room_id text, minutes integer default null, share boolean default null, confirmed_empty boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare university text; actor uuid := auth.uid(); t bigint; target roomly_private.rooms; active roomly_private.sessions;
  n integer; next_holder uuid; blocking roomly_private.bookings;
begin
  university := roomly_private.actor_university();
  perform pg_advisory_xact_lock(724002);
  perform roomly_private.expire_sessions();
  t := floor(extract(epoch from clock_timestamp()) * 1000);
  select r.* into target from roomly_private.rooms r join roomly_private.floors f on f.id=r.floor_id
    join roomly_private.buildings b on b.id=f.building_id join roomly_private.campuses c on c.id=b.campus_id
    where r.id=roomly_command.room_id and r.enabled and c.university_id=university;
  if target.id is null then raise exception 'This room is unavailable.'; end if;
  if action is null or action not in ('checkIn','join','leave','update') then raise exception 'Unknown room command.'; end if;
  if action in ('checkIn','update') and (minutes is null or minutes<1 or minutes>480 or share is null) then
    raise exception 'Choose a duration between 1 and 480 minutes and a sharing preference.';
  end if;
  select * into active from roomly_private.sessions s where s.room_id=target.id;
  if action in ('checkIn','join') and exists(select 1 from roomly_private.memberships where user_id=actor) then
    raise exception 'Leave your current room before joining another.';
  end if;
  -- Another student's reservation inside the planned stay blocks check-in / extension.
  if action in ('checkIn','update') then
    select * into blocking from roomly_private.bookings bk
      where bk.room_id=target.id and bk.user_id<>actor
        and bk.ends_at>t and bk.starts_at<t+minutes::bigint*60000
      order by bk.starts_at limit 1;
    if blocking.id is not null then
      if blocking.starts_at<=t then
        raise exception 'This room is reserved until %.', roomly_private.campus_time(blocking.ends_at);
      end if;
      raise exception 'This room is booked from %. Choose a shorter stay.', roomly_private.campus_time(blocking.starts_at);
    end if;
  end if;
  if action='checkIn' then
    if active.id is not null then raise exception 'Someone has already checked in. Please review the updated room.'; end if;
    if confirmed_empty is not true and not exists(select 1 from roomly_private.observations o where o.room_id=target.id and o.status='free' and o.updated_at>t-1800000) then
      raise exception 'Confirm the room is empty in person before checking in.';
    end if;
    insert into roomly_private.sessions(room_id,holder_id,started_at,expected_end,open_to_share)
      values(target.id,actor,t,t+minutes::bigint*60000,share) returning * into active;
    insert into roomly_private.memberships values(actor,active.id,t);
    delete from roomly_private.observations o where o.room_id=target.id;
  elsif action='join' then
    if active.id is null or not active.open_to_share then raise exception 'This room is no longer open to sharing.'; end if;
    select count(*) into n from roomly_private.memberships where session_id=active.id;
    if n>=target.capacity then raise exception 'This room has reached its capacity.'; end if;
    insert into roomly_private.memberships values(actor,active.id,t);
  elsif action='update' then
    if active.id is null or active.holder_id<>actor then raise exception 'Only the current room holder can update this session.'; end if;
    update roomly_private.sessions set expected_end=t+minutes::bigint*60000,open_to_share=share where id=active.id;
  else
    if active.id is null or not exists(select 1 from roomly_private.memberships where user_id=actor and session_id=active.id) then raise exception 'You are not checked into this room.'; end if;
    delete from roomly_private.memberships where user_id=actor and session_id=active.id;
    select user_id into next_holder from roomly_private.memberships where session_id=active.id order by joined_at,user_id limit 1;
    if next_holder is null then
      delete from roomly_private.sessions where id=active.id;
      insert into roomly_private.observations values(target.id,'free',t)
        on conflict on constraint observations_pkey do update set status='free',updated_at=excluded.updated_at;
      insert into roomly_private.notifications(user_id,room_id,created_at)
        select w.user_id,target.id,t from roomly_private.watches w where w.room_id=target.id;
    elsif active.holder_id=actor then
      update roomly_private.sessions set holder_id=next_holder where id=active.id;
    end if;
  end if;
  update public.roomly_revision set revision=revision+1 where id=1;
end $$;

-- ============================================================
-- 4. Reserve: campus hours, 30 min – 2 h, respects check-ins
-- ============================================================
create or replace function public.roomly_reserve(target_room text, p_start bigint, p_end bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare university text; actor uuid := auth.uid(); t bigint; new_id uuid; dur bigint;
  s_local timestamp; e_local timestamp; active roomly_private.sessions;
begin
  university := roomly_private.actor_university();
  perform pg_advisory_xact_lock(724002);
  perform roomly_private.expire_sessions();
  t := floor(extract(epoch from clock_timestamp()) * 1000);

  if not exists(select 1 from roomly_private.rooms r
      join roomly_private.floors f on f.id=r.floor_id
      join roomly_private.buildings b on b.id=f.building_id
      join roomly_private.campuses c on c.id=b.campus_id
      where r.id=target_room and r.enabled and c.university_id=university)
  then raise exception 'This room is unavailable.'; end if;

  if p_start is null or p_end is null then raise exception 'Choose a start and end time.'; end if;
  dur := p_end - p_start;
  if dur < 1800000 or dur > 7200000 then raise exception 'A booking must be between 30 minutes and 2 hours.'; end if;
  if p_start < t - 60000 then raise exception 'That time has already passed.'; end if;
  if p_start > t + 31::bigint * 86400000 then raise exception 'You can only book up to a month ahead.'; end if;

  s_local := to_timestamp(p_start / 1000.0) at time zone 'Europe/Berlin';
  e_local := to_timestamp(p_end / 1000.0) at time zone 'Europe/Berlin';
  if extract(isodow from s_local) > 5 or s_local::date <> e_local::date
     or s_local::time < time '08:00' or e_local::time > time '20:00' then
    raise exception 'Rooms can be booked Monday to Friday, 08:00–20:00.';
  end if;

  if exists(select 1 from roomly_private.bookings b
      where b.room_id = target_room and b.ends_at > p_start and b.starts_at < p_end)
  then raise exception 'That slot is already booked.'; end if;

  if exists(select 1 from roomly_private.bookings b
      where b.user_id = actor and b.ends_at > p_start and b.starts_at < p_end)
  then raise exception 'You already have a booking at that time.'; end if;

  -- Someone else is checked in during the requested slot.
  select * into active from roomly_private.sessions s
    where s.room_id = target_room and s.expected_end > p_start and s.started_at < p_end;
  if active.id is not null and not exists(select 1 from roomly_private.memberships m
      where m.session_id = active.id and m.user_id = actor) then
    raise exception 'Someone is checked in until %.', roomly_private.campus_time(active.expected_end);
  end if;

  if (select count(*) from roomly_private.bookings b where b.user_id = actor and b.ends_at > t) >= 10
  then raise exception 'You have too many upcoming bookings.'; end if;

  insert into roomly_private.bookings(room_id, user_id, starts_at, ends_at, created_at)
    values(target_room, actor, p_start, p_end, t) returning id into new_id;
  update public.roomly_revision set revision = revision + 1 where id = 1;
  return new_id;
end $$;

-- Names are no longer derived anywhere.
drop function if exists roomly_private.display_name(text);

-- Re-assert the authorization surface.
revoke all on function public.roomly_bookings(text, integer) from public, anon;
revoke all on function public.roomly_snapshot() from public, anon;
revoke all on function public.roomly_public_snapshot() from public;
revoke all on function public.roomly_command(text,text,integer,boolean,boolean) from public, anon;
revoke all on function public.roomly_reserve(text, bigint, bigint) from public, anon;
grant execute on function public.roomly_bookings(text, integer) to authenticated;
grant execute on function public.roomly_snapshot() to authenticated;
grant execute on function public.roomly_public_snapshot() to anon, authenticated;
grant execute on function public.roomly_command(text,text,integer,boolean,boolean) to authenticated;
grant execute on function public.roomly_reserve(text, bigint, bigint) to authenticated;
