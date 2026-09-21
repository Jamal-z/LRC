-- ============================================================
-- 024 — Meeting rooms & the shared meetings calendar
--
-- The centre has one room of its own (the "center hall"). An
-- in-person meeting takes it when it is free; when it is already
-- taken the leader asks the committee to book another room
-- instead, and admins mark the request as booked (with the room's
-- name in `location`).
--
--   room = 'center_hall'        in the centre's own hall
--          'booking_requested'  hall was taken, waiting on admins
--          'booked'             admins booked another room
--          null                 online meetings (and older rows)
--
-- Every signed-in user can see *when* the hall and other meetings
-- are busy (meeting_calendar), even for booths they can't open,
-- so they can pick a free slot.
-- ============================================================

alter table booth_meetings
  add column if not exists room text
    check (room in ('center_hall', 'booking_requested', 'booked'));

create index if not exists booth_meetings_room_idx on booth_meetings (room, scheduled_at);

-- ------------------------------------------------------------
-- A) Guards: no double booking of the hall, and only admins can
--    say a room has been booked.
--    security definer so the clash check sees every booth's rows.
-- ------------------------------------------------------------
create or replace function guard_booth_meeting_room() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  clash_booth text;
  new_end timestamptz;
begin
  if new.mode = 'online' then
    new.room := null;
  end if;

  if new.room = 'booked'
     and (tg_op = 'INSERT' or old.room is distinct from 'booked')
     and not is_admin() then
    raise exception 'Only the committee can mark a room as booked';
  end if;

  if new.room = 'center_hall' and new.status <> 'cancelled' then
    new_end := new.scheduled_at + make_interval(mins => coalesce(new.planned_duration_minutes, 60));

    select coalesce(eb.name, 'another team') into clash_booth
    from booth_meetings m
    left join event_booths eb on eb.id = m.booth_id
    where m.id <> new.id
      and m.room = 'center_hall'
      and m.status <> 'cancelled'
      and m.scheduled_at < new_end
      and m.scheduled_at + make_interval(mins => coalesce(m.planned_duration_minutes, 60)) > new.scheduled_at
    limit 1;

    if found then
      raise exception 'The center hall is already taken at that time (%). Pick another time or request a room booking.', clash_booth
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_booth_meeting_room on booth_meetings;
create trigger trg_guard_booth_meeting_room
  before insert or update of room, scheduled_at, planned_duration_minutes, status, mode
  on booth_meetings
  for each row execute function guard_booth_meeting_room();

-- ------------------------------------------------------------
-- B) Calendar feed — busy slots across all booths for a date
--    range. Only what is needed to see who is where and when;
--    can_open says whether the viewer may open the meeting.
-- ------------------------------------------------------------
create or replace function meeting_calendar(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid,
  booth_id uuid,
  booth_name text,
  event_name text,
  title text,
  scheduled_at timestamptz,
  duration_minutes integer,
  mode text,
  room text,
  location text,
  status text,
  can_open boolean
)
language sql stable security definer set search_path = public as $$
  select
    m.id,
    m.booth_id,
    eb.name,
    ev.name,
    m.title,
    m.scheduled_at,
    coalesce(m.actual_duration_minutes, m.planned_duration_minutes, 60),
    m.mode,
    m.room,
    m.location,
    m.status,
    is_admin() or is_booth_leader(m.booth_id) or event_in_my_departments(m.event_id)
  from booth_meetings m
  left join event_booths eb on eb.id = m.booth_id
  left join events ev on ev.id = m.event_id
  where auth.uid() is not null
    and m.status <> 'cancelled'
    and m.scheduled_at < p_to
    and m.scheduled_at + make_interval(mins => coalesce(m.actual_duration_minutes, m.planned_duration_minutes, 60)) > p_from
  order by m.scheduled_at;
$$;

revoke all on function meeting_calendar(timestamptz, timestamptz) from public, anon;
grant execute on function meeting_calendar(timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- C) Notifications — admins hear when a team needs a room;
--    the booth's leaders hear once it is booked.
-- ------------------------------------------------------------
create or replace function notify_booth_meeting_room() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  booth_name text;
begin
  if new.room is not distinct from (case when tg_op = 'UPDATE' then old.room end) then
    return new;
  end if;
  if new.status = 'cancelled' then
    return new;
  end if;

  select eb.name into booth_name from event_booths eb where eb.id = new.booth_id;

  if new.room = 'booking_requested' then
    insert into notifications (user_id, title, message, type, related_entity_type, related_entity_id)
    select p.id,
      'Room booking needed',
      coalesce(booth_name, 'A booth') || ' — ' || new.title
        || ' · the center hall is taken, please book a room',
      'meeting_room_request',
      'meeting',
      new.id
    from profiles p
    where p.role in ('super_admin', 'admin')
      and p.is_active
      and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  elsif new.room = 'booked' then
    insert into notifications (user_id, title, message, type, related_entity_type, related_entity_id)
    select distinct u.user_id,
      'Room booked',
      coalesce(booth_name, 'Booth') || ' — ' || new.title
        || coalesce(' · ' || new.location, ''),
      'meeting_room_booked',
      'meeting',
      new.id
    from (
      select bl.user_id from booth_leaders bl where bl.booth_id = new.booth_id
      union
      select new.created_by
    ) u
    join profiles p on p.id = u.user_id and p.is_active
    where u.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_booth_meeting_room on booth_meetings;
create trigger trg_notify_booth_meeting_room
  after insert or update of room on booth_meetings
  for each row execute function notify_booth_meeting_room();
