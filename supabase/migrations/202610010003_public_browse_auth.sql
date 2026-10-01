-- Public room browsing and passwordless self-service campus access.
-- Anonymous visitors may read only a privacy-safe room projection. Mutations remain
-- authenticated and continue to derive the actor from auth.uid().

create table roomly_private.invite_codes (
  code text primary key,
  university_id text not null references roomly_private.universities,
  enabled boolean not null default true,
  expires_at timestamptz,
  max_uses integer check(max_uses is null or max_uses > 0),
  use_count integer not null default 0 check(use_count >= 0)
);
revoke all on roomly_private.invite_codes from public, anon, authenticated;

-- Realtime exposes only a monotonically increasing revision number. It contains
-- no identities, emails, memberships or private room data, so anonymous readers
-- may subscribe and then refetch the safe public projection.
grant select on public.roomly_revision to anon;
create policy revision_for_public on public.roomly_revision
  for select to anon using (true);

create function public.roomly_public_snapshot() returns jsonb
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
          'id', s.id,
          'roomId', s.room_id,
          'holderId', '',
          'startedAt', s.started_at,
          'expectedEnd', s.expected_end,
          'openToShare', s.open_to_share,
          'occupantCount', (
            select count(*) from roomly_private.memberships m
            where m.session_id=s.id
          )
        ))
        from roomly_private.sessions s
        join roomly_private.rooms r on r.id=s.room_id
        where r.enabled
      ), '[]'::jsonb),
      'memberships', '[]'::jsonb,
      'observations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'roomId', o.room_id,
          'status', o.status,
          'updatedAt', o.updated_at
        ))
        from roomly_private.observations o
        join roomly_private.rooms r on r.id=o.room_id
        where r.enabled
      ), '[]'::jsonb)
    )
  );
end $$;

create function public.roomly_access_status() returns boolean
language sql security definer set search_path='' stable as $$
  select exists(
    select 1
    from auth.users u
    join roomly_private.allowed_students a on a.email=lower(u.email)
    where u.id=auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

create function public.roomly_claim_access(invite_code text) returns void
language plpgsql security definer set search_path='' as $$
declare
  actor_email text;
  invite roomly_private.invite_codes;
begin
  select lower(u.email) into actor_email
  from auth.users u
  where u.id=auth.uid() and u.email_confirmed_at is not null;

  if actor_email is null then
    raise exception 'Verify your email before claiming campus access.'
      using errcode='42501';
  end if;

  if exists(
    select 1 from roomly_private.allowed_students
    where email=actor_email
  ) then
    return;
  end if;

  select * into invite
  from roomly_private.invite_codes i
  where i.code=roomly_claim_access.invite_code
  for update;

  if invite.code is null
    or invite.enabled is not true
    or (invite.expires_at is not null and invite.expires_at <= clock_timestamp())
    or (invite.max_uses is not null and invite.use_count >= invite.max_uses)
  then
    raise exception 'Invalid or expired campus access code.'
      using errcode='42501';
  end if;

  insert into roomly_private.allowed_students(email, university_id)
  values(actor_email, invite.university_id);

  update roomly_private.invite_codes
  set use_count=use_count+1
  where code=invite.code;
end $$;

revoke all on function public.roomly_public_snapshot() from public;
revoke all on function public.roomly_access_status() from public, anon;
revoke all on function public.roomly_claim_access(text) from public, anon;

grant execute on function public.roomly_public_snapshot() to anon, authenticated;
grant execute on function public.roomly_access_status() to authenticated;
grant execute on function public.roomly_claim_access(text) to authenticated;
