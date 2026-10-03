-- Roomly — advance room bookings.
-- Students reserve a time slot in a room ahead of the live check-in flow.
-- Viewing the calendar and reserving both require an approved, verified student;
-- the actor always comes from auth.uid(), never from the browser. Overlaps are
-- prevented inside one transaction under an advisory lock, matching the occupancy
-- model. Identities are never exposed — a booking reads back only as "mine" or not.

create table roomly_private.bookings (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references roomly_private.rooms,
  user_id uuid not null references auth.users on delete cascade,
  starts_at bigint not null,
  ends_at bigint not null,
  created_at bigint not null,
  check (ends_at > starts_at),
  check (ends_at - starts_at >= 900000),      -- at least 15 minutes
  check (ends_at - starts_at <= 14400000)     -- at most 4 hours
);
create index on roomly_private.bookings(room_id, starts_at);
create index on roomly_private.bookings(user_id, starts_at);
revoke all on roomly_private.bookings from public, anon, authenticated;

-- Upcoming bookings for a room, within the actor's own university. Returns time
-- ranges with a "mine" flag; it never reveals who booked the other slots.
create function public.roomly_bookings(target_room text, window_days integer default 14)
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
      'id', bk.id, 'startsAt', bk.starts_at, 'endsAt', bk.ends_at, 'mine', bk.user_id = actor)
      order by bk.starts_at)
    from roomly_private.bookings bk
    where bk.room_id = target_room and bk.ends_at > t and bk.starts_at < horizon), '[]'::jsonb);
end $$;

-- Reserve a slot. Enforces room validity, duration, the booking window, and both
-- room-level and per-user overlap, then bumps the shared revision counter.
create function public.roomly_reserve(target_room text, p_start bigint, p_end bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare university text; actor uuid := auth.uid(); t bigint; new_id uuid; dur bigint;
begin
  university := roomly_private.actor_university();
  perform pg_advisory_xact_lock(724002);
  t := floor(extract(epoch from clock_timestamp()) * 1000);

  if not exists(select 1 from roomly_private.rooms r
      join roomly_private.floors f on f.id=r.floor_id
      join roomly_private.buildings b on b.id=f.building_id
      join roomly_private.campuses c on c.id=b.campus_id
      where r.id=target_room and r.enabled and c.university_id=university)
  then raise exception 'This room is unavailable.'; end if;

  if p_start is null or p_end is null then raise exception 'Choose a start and end time.'; end if;
  dur := p_end - p_start;
  if dur < 900000 or dur > 14400000 then raise exception 'A booking must be between 15 minutes and 4 hours.'; end if;
  if p_start < t - 60000 then raise exception 'That time has already passed.'; end if;
  if p_start > t + 31::bigint * 86400000 then raise exception 'You can only book up to a month ahead.'; end if;

  if exists(select 1 from roomly_private.bookings b
      where b.room_id = target_room and b.ends_at > p_start and b.starts_at < p_end)
  then raise exception 'That slot is already booked.'; end if;

  if exists(select 1 from roomly_private.bookings b
      where b.user_id = actor and b.ends_at > p_start and b.starts_at < p_end)
  then raise exception 'You already have a booking at that time.'; end if;

  if (select count(*) from roomly_private.bookings b where b.user_id = actor and b.ends_at > t) >= 10
  then raise exception 'You have too many upcoming bookings.'; end if;

  insert into roomly_private.bookings(room_id, user_id, starts_at, ends_at, created_at)
    values(target_room, actor, p_start, p_end, t) returning id into new_id;
  update public.roomly_revision set revision = revision + 1 where id = 1;
  return new_id;
end $$;

-- Cancel your own booking. Only the owner can, and the approved-student gate still applies.
create function public.roomly_cancel_booking(booking_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); owner uuid;
begin
  perform roomly_private.actor_university();
  select user_id into owner from roomly_private.bookings where id = booking_id;
  if owner is null then raise exception 'Booking not found.'; end if;
  if owner <> actor then raise exception 'You can only cancel your own booking.'; end if;
  delete from roomly_private.bookings where id = booking_id;
  update public.roomly_revision set revision = revision + 1 where id = 1;
end $$;

revoke all on function public.roomly_bookings(text, integer) from public, anon;
revoke all on function public.roomly_reserve(text, bigint, bigint) from public, anon;
revoke all on function public.roomly_cancel_booking(uuid) from public, anon;
grant execute on function public.roomly_bookings(text, integer) to authenticated;
grant execute on function public.roomly_reserve(text, bigint, bigint) to authenticated;
grant execute on function public.roomly_cancel_booking(uuid) to authenticated;
