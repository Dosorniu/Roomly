-- Roomly — "My bookings": the signed-in student's own reservations across rooms.
-- Mirrors the authorization model of roomly_bookings: security-definer, derives the
-- actor from auth.uid(), scopes to the actor's own university, and is granted to
-- authenticated only. It never returns other students' rows, so no display names are
-- needed here. Returns room_id so the client can resolve the room via the catalog.

create or replace function public.roomly_my_bookings(window_days integer default 31)
returns jsonb language plpgsql security definer set search_path='' as $$
declare university text; actor uuid := auth.uid(); t bigint; horizon bigint;
begin
  university := roomly_private.actor_university();
  t := floor(extract(epoch from clock_timestamp()) * 1000);
  horizon := t + (greatest(1, least(window_days, 31)))::bigint * 86400000;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', bk.id, 'roomId', bk.room_id,
      'startsAt', bk.starts_at, 'endsAt', bk.ends_at)
      order by bk.starts_at)
    from roomly_private.bookings bk
    join roomly_private.rooms r on r.id = bk.room_id
    join roomly_private.floors f on f.id = r.floor_id
    join roomly_private.buildings b on b.id = f.building_id
    join roomly_private.campuses c on c.id = b.campus_id
    where bk.user_id = actor and r.enabled and c.university_id = university
      and bk.ends_at > t and bk.starts_at < horizon), '[]'::jsonb);
end $$;

revoke all on function public.roomly_my_bookings(integer) from public, anon;
grant execute on function public.roomly_my_bookings(integer) to authenticated;
