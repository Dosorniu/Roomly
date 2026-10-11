-- Roomly — Update 10: no false "now free" alert on Leave Room.
-- When the last person left a room while someone else's booking was running,
-- watchers were told the room is free although it was booked. Leave now alerts
-- only if the room is really free (roomly_private.room_is_free from Update 09);
-- the alert then comes when the booking ends. Everything else in roomly_command
-- is unchanged from 202610100009. Safe to re-run.

create or replace function public.roomly_command(action text, room_id text, minutes integer default null, share boolean default null, confirmed_empty boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare university text; actor uuid := auth.uid(); t bigint; target roomly_private.rooms; active roomly_private.sessions;
  n integer; next_holder uuid; blocking roomly_private.bookings; booked_here boolean;
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
  -- The booker arriving at their own running booking while someone already sits in
  -- the (shared) room joins that session instead of starting a new one.
  booked_here := exists(select 1 from roomly_private.bookings bk
    where bk.room_id=target.id and bk.user_id=actor and bk.starts_at<=t and bk.ends_at>t);
  if action='checkIn' and active.id is not null and booked_here then
    action := 'join';
  end if;
  -- Another student's booking inside the planned stay: a private one blocks,
  -- a shared one only requires this session to stay open to others.
  if action in ('checkIn','update') then
    select * into blocking from roomly_private.bookings bk
      where bk.room_id=target.id and bk.user_id<>actor and not bk.open_to_share
        and bk.ends_at>t and bk.starts_at<t+minutes::bigint*60000
      order by bk.starts_at limit 1;
    if blocking.id is not null then
      if blocking.starts_at<=t then
        raise exception 'This room is reserved until %.', roomly_private.campus_time(blocking.ends_at);
      end if;
      raise exception 'This room is booked from %. Choose a shorter stay.', roomly_private.campus_time(blocking.starts_at);
    end if;
    if share is not true and exists(select 1 from roomly_private.bookings bk
        where bk.room_id=target.id and bk.user_id<>actor and bk.open_to_share
          and bk.ends_at>t and bk.starts_at<t+minutes::bigint*60000) then
      raise exception 'This room is booked as shared. Keep it open to others.';
    end if;
  end if;
  if action='checkIn' then
    if active.id is not null then raise exception 'Someone has already checked in. Please review the updated room.'; end if;
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
      -- Alert watchers only if the room is really free (no booking running now).
      insert into roomly_private.notifications(user_id,room_id,created_at)
        select w.user_id,target.id,t from roomly_private.watches w
        where w.room_id=target.id and roomly_private.room_is_free(target.id, t);
    elsif active.holder_id=actor then
      update roomly_private.sessions set holder_id=next_holder where id=active.id;
    end if;
  end if;
  update public.roomly_revision set revision=revision+1 where id=1;
end $$;

revoke all on function public.roomly_command(text,text,integer,boolean,boolean) from public, anon;
grant execute on function public.roomly_command(text,text,integer,boolean,boolean) to authenticated;
