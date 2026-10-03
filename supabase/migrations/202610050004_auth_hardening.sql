-- Roomly — authentication & privacy hardening
-- Apply in Supabase -> SQL Editor -> Run. Safe to re-run.
-- Redefines functions and adds a public-browse flag. No data is deleted.

-- ============================================================
-- 1. Sign-in: university email passes automatically; everyone else
--    needs a single-use guest code. Shared campus password is retired.
-- ============================================================

create or replace function public.roomly_access_status() returns boolean
language plpgsql security definer set search_path='' as $$
declare actor_email text;
begin
  select lower(u.email) into actor_email
  from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;

  if actor_email is null then return false; end if;

  if exists(select 1 from roomly_private.allowed_students where email = actor_email) then
    return true;
  end if;

  if actor_email like '%@cbs-mail.de' then
    insert into roomly_private.allowed_students(email, university_id)
    values (actor_email, 'cbs') on conflict do nothing;
    return true;
  end if;

  return false;
end $$;

create or replace function public.roomly_claim_access(invite_code text) returns void
language plpgsql security definer set search_path='' as $$
declare actor_email text; invite roomly_private.invite_codes;
begin
  select lower(u.email) into actor_email
  from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;

  if actor_email is null then
    raise exception 'Verify your email before claiming campus access.' using errcode='42501';
  end if;

  if exists(select 1 from roomly_private.allowed_students where email = actor_email) then
    return;
  end if;

  -- University email: approve directly, no code.
  if actor_email like '%@cbs-mail.de' then
    insert into roomly_private.allowed_students(email, university_id)
    values (actor_email, 'cbs') on conflict do nothing;
    return;
  end if;

  -- Guest path: single-use, expiring codes (brute-force value is minimal;
  -- request-rate limiting is configured at the Supabase gateway, not here --
  -- a per-attempt counter in SQL would be rolled back by the reject below).
  select * into invite from roomly_private.invite_codes i
  where i.code = roomly_claim_access.invite_code for update;

  if invite.code is null or invite.enabled is not true
    or (invite.expires_at is not null and invite.expires_at <= clock_timestamp())
    or (invite.max_uses is not null and invite.use_count >= invite.max_uses)
  then
    raise exception 'Invalid or expired campus access code.' using errcode='42501';
  end if;

  insert into roomly_private.allowed_students(email, university_id)
  values (actor_email, invite.university_id);
  update roomly_private.invite_codes set use_count = use_count + 1 where code = invite.code;
end $$;

-- Retire the leaked shared code (kept, not deleted, so approved users stay).
update roomly_private.invite_codes set enabled = false where code = 'ROOMLY-CBS-7Q26';

-- ============================================================
-- 2. Public browse: expose only universities explicitly opted in.
--    New universities are private by default (no cross-campus leak).
-- ============================================================

alter table roomly_private.universities
  add column if not exists public_browsable boolean not null default false;
update roomly_private.universities set public_browsable = true where id = 'cbs';

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
        where r.enabled and u.public_browsable), '[]'::jsonb)));
end $$;

-- ============================================================
-- 3. Revoke access (owner-only; run from SQL Editor / service role).
--    Removes approval, frees the person's active room, bumps revision.
-- ============================================================

create or replace function public.roomly_revoke_access(target_email text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid; sid uuid; held roomly_private.sessions; next_holder uuid; t bigint;
begin
  t := floor(extract(epoch from clock_timestamp()) * 1000);
  select id into uid from auth.users where lower(email) = lower(target_email);
  if uid is null then return; end if;

  for sid in select session_id from roomly_private.memberships where user_id = uid loop
    delete from roomly_private.memberships where user_id = uid and session_id = sid;
    select * into held from roomly_private.sessions where id = sid;
    select user_id into next_holder from roomly_private.memberships
      where session_id = sid order by joined_at, user_id limit 1;
    if next_holder is null then
      delete from roomly_private.sessions where id = sid;
      insert into roomly_private.observations values (held.room_id, 'free', t)
        on conflict on constraint observations_pkey do update set status='free', updated_at=excluded.updated_at;
    elsif held.holder_id = uid then
      update roomly_private.sessions set holder_id = next_holder where id = sid;
    end if;
  end loop;

  delete from roomly_private.watches where user_id = uid;
  delete from roomly_private.allowed_students where email = lower(target_email);
  update public.roomly_revision set revision = revision + 1 where id = 1;
end $$;

revoke all on function public.roomly_revoke_access(text) from public, anon, authenticated;

-- ============================================================
-- Guest access (reviewers / team without a @cbs-mail.de address):
-- one personal code per person, single use, expires in a week.
--
--   insert into roomly_private.invite_codes(code, university_id, enabled, max_uses, expires_at)
--   values ('ROOMLY-GUEST-XXXX', 'cbs', true, 1, now() + interval '7 days');
--
-- Remove someone later:
--   select public.roomly_revoke_access('person@example.com');
-- ============================================================
