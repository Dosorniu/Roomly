-- No browser role has direct access to occupancy identities or email addresses.
create schema if not exists roomly_private;
revoke all on schema roomly_private from public, anon, authenticated;

create table roomly_private.universities (id text primary key, name text not null);
create table roomly_private.campuses (id text primary key, university_id text not null references roomly_private.universities, name text not null);
create table roomly_private.buildings (id text primary key, campus_id text not null references roomly_private.campuses, name text not null);
create table roomly_private.floors (id text primary key, building_id text not null references roomly_private.buildings, number integer not null);
create table roomly_private.rooms (id text primary key, floor_id text not null references roomly_private.floors, capacity integer not null check(capacity > 0), enabled boolean not null default true);
-- The project owner provisions permitted student emails. Email verification alone
-- is not proof of university membership. Never expose this table through the API.
create table roomly_private.allowed_students (email text primary key check(email = lower(email)), university_id text not null references roomly_private.universities);
create table roomly_private.sessions (
  id uuid primary key default gen_random_uuid(), room_id text unique not null references roomly_private.rooms,
  holder_id uuid not null references auth.users, started_at bigint not null,
  expected_end bigint not null check(expected_end > started_at), open_to_share boolean not null
);
create table roomly_private.memberships (
  user_id uuid primary key references auth.users on delete cascade,
  session_id uuid not null references roomly_private.sessions on delete cascade,
  joined_at bigint not null
);
create table roomly_private.observations (room_id text primary key references roomly_private.rooms, status text not null check(status in ('free','unknown')), updated_at bigint not null);
create table roomly_private.watches (user_id uuid references auth.users on delete cascade, room_id text references roomly_private.rooms, primary key(user_id, room_id));
create table roomly_private.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, room_id text not null references roomly_private.rooms, created_at bigint not null);
create index on roomly_private.memberships(session_id);
create index on roomly_private.notifications(user_id, created_at desc);

create table public.roomly_revision (id integer primary key check(id=1), revision bigint not null default 0);
insert into public.roomly_revision(id) values (1);
alter table public.roomly_revision enable row level security;
revoke all on public.roomly_revision from anon, authenticated;
grant select on public.roomly_revision to authenticated;
create policy revision_for_signed_in on public.roomly_revision for select to authenticated using ((select auth.uid()) is not null);
-- Only the revision counter is published; occupancy identities stay private.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.roomly_revision;
  end if;
end $$;

create function roomly_private.actor_university() returns text language plpgsql security definer set search_path='' as $$
declare result text;
begin
  select a.university_id into result from auth.users u join roomly_private.allowed_students a on a.email=lower(u.email)
    where u.id=auth.uid() and u.email_confirmed_at is not null;
  if result is null then raise exception 'Sign in with an approved, verified student email.' using errcode='42501'; end if;
  return result;
end $$;

create function roomly_private.expire_sessions() returns void language plpgsql security definer set search_path='' as $$
declare t bigint := floor(extract(epoch from clock_timestamp()) * 1000); changed integer; stale integer;
begin
  -- V1 serializes short occupancy transactions. Replace with ordered per-user /
  -- per-room locks if write throughput warrants it; uniqueness remains enforced.
  perform pg_advisory_xact_lock(724001);
  insert into roomly_private.observations(room_id,status,updated_at)
    select room_id,'unknown',t from roomly_private.sessions where expected_end<=t
    on conflict on constraint observations_pkey do update set status='unknown',updated_at=excluded.updated_at;
  delete from roomly_private.sessions where expected_end<=t;
  get diagnostics changed = row_count;
  update roomly_private.observations set status='unknown' where status='free' and updated_at<=t-1800000;
  get diagnostics stale = row_count;
  if changed+stale>0 then update public.roomly_revision set revision=revision+1 where id=1; end if;
  delete from roomly_private.notifications where created_at<t-2592000000;
end $$;

create function public.roomly_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
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
        join roomly_private.campuses c on c.id=b.campus_id where c.university_id=university and r.enabled),'[]'::jsonb)),
    'watches',coalesce((select jsonb_agg(room_id) from roomly_private.watches where user_id=actor),'[]'::jsonb),
    'notices',coalesce((select jsonb_agg(jsonb_build_object('id',id,'roomId',room_id,'createdAt',created_at)) from
      (select * from roomly_private.notifications where user_id=actor order by created_at desc limit 50) n),'[]'::jsonb)
  );
end $$;

create function public.roomly_command(action text, room_id text, minutes integer default null, share boolean default null, confirmed_empty boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare university text; actor uuid := auth.uid(); t bigint; target roomly_private.rooms; active roomly_private.sessions; n integer; next_holder uuid;
begin
  university := roomly_private.actor_university();
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

create function public.roomly_watch(room_id text, watching boolean) returns void language plpgsql security definer set search_path='' as $$
declare university text;
begin
  university := roomly_private.actor_university();
  if not exists(select 1 from roomly_private.rooms r join roomly_private.floors f on f.id=r.floor_id
    join roomly_private.buildings b on b.id=f.building_id join roomly_private.campuses c on c.id=b.campus_id
    where r.id=roomly_watch.room_id and r.enabled and c.university_id=university) then raise exception 'This room is unavailable.'; end if;
  if watching is null then raise exception 'Choose whether to watch this room.'; end if;
  if watching then insert into roomly_private.watches values(auth.uid(),room_id) on conflict do nothing;
  else delete from roomly_private.watches w where w.user_id=auth.uid() and w.room_id=roomly_watch.room_id; end if;
end $$;

revoke all on all tables in schema roomly_private from public, anon, authenticated;
revoke all on all functions in schema roomly_private from public, anon, authenticated;
revoke all on function public.roomly_snapshot() from public, anon;
revoke all on function public.roomly_command(text,text,integer,boolean,boolean) from public, anon;
revoke all on function public.roomly_watch(text,boolean) from public, anon;
grant execute on function public.roomly_snapshot() to authenticated;
grant execute on function public.roomly_command(text,text,integer,boolean,boolean) to authenticated;
grant execute on function public.roomly_watch(text,boolean) to authenticated;
-- Snapshot and every mutation enforce expiration using server time. The owner can
-- optionally schedule roomly_private.expire_sessions() with pg_cron every minute.
