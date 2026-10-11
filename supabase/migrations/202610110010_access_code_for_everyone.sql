-- Roomly — Update 08: one sign-in flow for everyone.
-- Any email receives a six-digit code; every new account then enters the campus
-- access code once. Automatic approval of @cbs-mail.de is removed: the university
-- mailbox (Microsoft 365) quarantines first-time Roomly emails, so students sign
-- in with any address. Accounts already approved stay approved. Safe to re-run.
-- The access code itself is data in roomly_private.invite_codes and is added in
-- the SQL Editor, never committed here.

create or replace function public.roomly_access_status() returns boolean
language plpgsql security definer set search_path='' as $$
declare actor_email text;
begin
  select lower(u.email) into actor_email
  from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;

  if actor_email is null then return false; end if;
  return exists(select 1 from roomly_private.allowed_students where email = actor_email);
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

  select * into invite from roomly_private.invite_codes i
  where i.code = upper(trim(roomly_claim_access.invite_code)) for update;

  if invite.code is null or invite.enabled is not true
    or (invite.expires_at is not null and invite.expires_at <= clock_timestamp())
    or (invite.max_uses is not null and invite.use_count >= invite.max_uses)
  then
    raise exception 'Invalid or expired campus access code.' using errcode='42501';
  end if;

  insert into roomly_private.allowed_students(email, university_id)
  values (actor_email, invite.university_id) on conflict do nothing;
  update roomly_private.invite_codes set use_count = use_count + 1 where code = invite.code;
end $$;

revoke all on function public.roomly_access_status() from public, anon;
revoke all on function public.roomly_claim_access(text) from public, anon;
grant execute on function public.roomly_access_status() to authenticated;
grant execute on function public.roomly_claim_access(text) to authenticated;
