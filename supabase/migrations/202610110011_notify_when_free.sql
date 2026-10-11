-- Roomly — Update 09: "Notify me when free" also fires when a room frees up by
-- itself. Previously watchers were alerted only when the last person pressed
-- Leave Room; a check-in that simply ran out, or a booking that ended, turned the
-- room Free without any alert.
--
-- A room is free when no one is checked in and no booking is running. Expiry now:
--   * deletes ended check-ins and alerts watchers if the room is now free;
--   * marks ended bookings once (bookings.end_notified) and alerts watchers if the
--     room is now free.
-- Lock order: callers take 724002 first; this function takes 724001. Safe to re-run.

alter table roomly_private.bookings
  add column if not exists end_notified boolean not null default false;

-- Bookings that already ended before this migration must not alert anyone now.
update roomly_private.bookings
  set end_notified = true
  where not end_notified
    and ends_at <= floor(extract(epoch from clock_timestamp()) * 1000);

create or replace function roomly_private.room_is_free(target text, t bigint)
returns boolean language sql stable security definer set search_path='' as $$
  select not exists(select 1 from roomly_private.sessions s
                    where s.room_id = target and s.expected_end > t)
     and not exists(select 1 from roomly_private.bookings b
                    where b.room_id = target and b.starts_at <= t and b.ends_at > t)
$$;
revoke all on function roomly_private.room_is_free(text, bigint) from public, anon, authenticated;

create or replace function roomly_private.expire_sessions() returns void
language plpgsql security definer set search_path='' as $$
declare t bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  changed integer; stale integer; ended integer;
  freed text[];
begin
  perform pg_advisory_xact_lock(724001);

  -- Rooms whose check-in or booking ends now (each booking is handled once).
  select coalesce(array_agg(distinct room_id), '{}') into freed from (
    select s.room_id from roomly_private.sessions s where s.expected_end <= t
    union
    select b.room_id from roomly_private.bookings b
      where b.ends_at <= t and not b.end_notified
  ) x;

  insert into roomly_private.observations(room_id,status,updated_at)
    select room_id,'unknown',t from roomly_private.sessions where expected_end<=t
    on conflict on constraint observations_pkey do update set status='unknown',updated_at=excluded.updated_at;
  delete from roomly_private.sessions where expected_end<=t;
  get diagnostics changed = row_count;

  update roomly_private.bookings set end_notified = true
    where ends_at <= t and not end_notified;
  get diagnostics ended = row_count;

  -- Alert watchers of every room that is free after these changes.
  insert into roomly_private.notifications(user_id, room_id, created_at)
    select w.user_id, w.room_id, t
    from roomly_private.watches w
    where w.room_id = any(freed)
      and roomly_private.room_is_free(w.room_id, t);

  update roomly_private.observations set status='unknown' where status='free' and updated_at<=t-1800000;
  get diagnostics stale = row_count;
  if changed+stale+ended>0 then update public.roomly_revision set revision=revision+1 where id=1; end if;
  delete from roomly_private.notifications where created_at<t-2592000000;
end $$;
revoke all on function roomly_private.expire_sessions() from public, anon, authenticated;
