-- Roomly — non-anonymous names for signed-in students.
-- Product decision: inside the university, booking and Share are more useful when
-- classmates can see WHO booked a slot and who is already in a shared room. This is
-- shown only to verified campus accounts (every function here derives the actor from
-- auth.uid() and goes through actor_university()); the public projection in
-- roomly_public_snapshot stays fully anonymous and is deliberately left untouched.
--
-- There is no stored profile name, so a short, stable display name is derived from
-- the campus email local part ("mariia.romanko@cbs-mail.de" -> "M. Romanko"). Email
-- addresses themselves are never returned to the browser.

create function roomly_private.display_name(p_email text)
returns text language plpgsql immutable set search_path='' as $$
declare local text; parts text[]; first text; last text;
begin
  if p_email is null then return 'Student'; end if;
  local := split_part(p_email, '@', 1);
  parts := array(select p from unnest(regexp_split_to_array(local, '[._+-]+')) p where p <> '');
  if array_length(parts, 1) is null then return 'Student'; end if;
  if array_length(parts, 1) = 1 then
    first := parts[1];
    return upper(left(first, 1)) || lower(substr(first, 2));
  end if;
  first := parts[1];
  last := parts[array_length(parts, 1)];
  return upper(left(first, 1)) || '. ' || upper(left(last, 1)) || lower(substr(last, 2));
end $$;
revoke all on function roomly_private.display_name(text) from public, anon, authenticated;

-- Upcoming bookings for a room, within the actor's own university. Now also returns
-- a short display name per slot ("You" for the actor's own). Still authenticated-only.
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
      'by', case when bk.user_id = actor then 'You'
                 else roomly_private.display_name(u.email) end)
      order by bk.starts_at)
    from roomly_private.bookings bk
    join auth.users u on u.id = bk.user_id
    where bk.room_id = target_room and bk.ends_at > t and bk.starts_at < horizon), '[]'::jsonb);
end $$;

-- Authenticated snapshot: add occupant display names, but ONLY for rooms whose
-- holder opened them to sharing. Non-shared sessions keep just an occupant count,
-- and holder identity stays hidden exactly as before.
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
        'occupantCount',(select count(*) from roomly_private.memberships m where m.session_id=s.id),
        'occupants',case when s.open_to_share then coalesce((
            select jsonb_agg(roomly_private.display_name(u.email) order by m.joined_at)
            from roomly_private.memberships m join auth.users u on u.id=m.user_id
            where m.session_id=s.id),'[]'::jsonb) else '[]'::jsonb end))
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

-- Re-assert the authorization surface (CREATE OR REPLACE preserves grants, but we
-- make the intent explicit so a replay of this file is self-contained).
revoke all on function public.roomly_bookings(text, integer) from public, anon;
revoke all on function public.roomly_snapshot() from public, anon;
grant execute on function public.roomly_bookings(text, integer) to authenticated;
grant execute on function public.roomly_snapshot() to authenticated;
