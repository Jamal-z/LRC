-- ============================================================
-- 026 — Department meetings
-- Run after 025.
--
-- Meetings were only for booth teams. Departments (Social Media,
-- Graphic Design, …) now hold their own meetings too: the
-- department's leaders schedule them, and every volunteer in the
-- department is on the attendance sheet.
--
-- A meeting belongs to exactly one team:
--   booth meeting       booth_id + event_id, department_id null
--   department meeting  department_id, booth_id + event_id null
--
-- The table keeps its name (booth_meetings) so nothing that
-- already points at it has to move.
-- ============================================================

-- ------------------------------------------------------------
-- A) Columns
-- ------------------------------------------------------------
alter table booth_meetings
  add column if not exists department_id uuid references departments (id) on delete cascade;

alter table booth_meetings alter column booth_id drop not null;
alter table booth_meetings alter column event_id drop not null;

alter table booth_meetings drop constraint if exists booth_meetings_one_team;
alter table booth_meetings add constraint booth_meetings_one_team check (
  (booth_id is not null and event_id is not null and department_id is null)
  or (booth_id is null and event_id is null and department_id is not null)
);

create index if not exists booth_meetings_department_idx on booth_meetings (department_id);

-- ------------------------------------------------------------
-- B) RLS — a department's leaders run its meetings, like booth
--    leaders run theirs. is_booth_leader / is_department_leader
--    are false for null, so one expression covers both kinds.
-- ------------------------------------------------------------
create or replace function can_manage_meeting(p_booth_id uuid, p_department_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or is_booth_leader(p_booth_id) or is_department_leader(p_department_id);
$$;

drop policy if exists booth_meetings_select on booth_meetings;
create policy booth_meetings_select on booth_meetings for select to authenticated
  using (can_manage_meeting(booth_id, department_id) or event_in_my_departments(event_id));

drop policy if exists booth_meetings_insert on booth_meetings;
create policy booth_meetings_insert on booth_meetings for insert to authenticated
  with check (can_manage_meeting(booth_id, department_id));

drop policy if exists booth_meetings_update on booth_meetings;
create policy booth_meetings_update on booth_meetings for update to authenticated
  using (can_manage_meeting(booth_id, department_id))
  with check (can_manage_meeting(booth_id, department_id));

drop policy if exists booth_meetings_delete on booth_meetings;
create policy booth_meetings_delete on booth_meetings for delete to authenticated
  using (can_manage_meeting(booth_id, department_id));

drop policy if exists booth_meeting_attendance_select on booth_meeting_attendance;
create policy booth_meeting_attendance_select on booth_meeting_attendance for select to authenticated
  using (
    exists (
      select 1 from booth_meetings m
      where m.id = booth_meeting_attendance.meeting_id
        and (can_manage_meeting(m.booth_id, m.department_id) or event_in_my_departments(m.event_id))
    )
  );

drop policy if exists booth_meeting_attendance_write on booth_meeting_attendance;
create policy booth_meeting_attendance_write on booth_meeting_attendance for all to authenticated
  using (
    exists (
      select 1 from booth_meetings m
      where m.id = booth_meeting_attendance.meeting_id
        and can_manage_meeting(m.booth_id, m.department_id)
    )
  )
  with check (
    exists (
      select 1 from booth_meetings m
      where m.id = booth_meeting_attendance.meeting_id
        and can_manage_meeting(m.booth_id, m.department_id)
    )
  );

-- Action items from a department meeting are tasks with that
-- department_id, which department leaders could already create.

-- ------------------------------------------------------------
-- C) Who leads a meeting's team — booth or department leaders.
-- ------------------------------------------------------------
create or replace function meeting_team_leaders(p_booth_id uuid, p_department_id uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select bl.user_id from booth_leaders bl where bl.booth_id = p_booth_id
  union
  select dl.user_id from department_leaders dl where dl.department_id = p_department_id;
$$;

revoke all on function meeting_team_leaders(uuid, uuid) from public, anon, authenticated;

create or replace function meeting_team_name(p_booth_id uuid, p_department_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select eb.name from event_booths eb where eb.id = p_booth_id),
    (select d.name from departments d where d.id = p_department_id)
  );
$$;

-- ------------------------------------------------------------
-- D) Center hall guard — same rules, the clash message names
--    whichever team holds the hall.
-- ------------------------------------------------------------
create or replace function guard_booth_meeting_room() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  clash_team text;
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

    select coalesce(meeting_team_name(m.booth_id, m.department_id), 'another team') into clash_team
    from booth_meetings m
    where m.id <> new.id
      and m.room = 'center_hall'
      and m.status <> 'cancelled'
      and m.scheduled_at < new_end
      and m.scheduled_at + make_interval(mins => coalesce(m.planned_duration_minutes, 60)) > new.scheduled_at
    limit 1;

    if found then
      raise exception 'The center hall is already taken at that time (%). Pick another time or request a room booking.', clash_team
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- E) Calendar feed — adds the department columns. The return
--    type changes, so the function is dropped and made again.
--    booth_id / booth_name stay where they were.
-- ------------------------------------------------------------
drop function if exists meeting_calendar(timestamptz, timestamptz);

create function meeting_calendar(p_from timestamptz, p_to timestamptz)
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
  can_open boolean,
  department_id uuid,
  department_name text
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
    can_manage_meeting(m.booth_id, m.department_id) or event_in_my_departments(m.event_id),
    m.department_id,
    d.name
  from booth_meetings m
  left join event_booths eb on eb.id = m.booth_id
  left join events ev on ev.id = m.event_id
  left join departments d on d.id = m.department_id
  where auth.uid() is not null
    and m.status <> 'cancelled'
    and m.scheduled_at < p_to
    and m.scheduled_at + make_interval(mins => coalesce(m.actual_duration_minutes, m.planned_duration_minutes, 60)) > p_from
  order by m.scheduled_at;
$$;

revoke all on function meeting_calendar(timestamptz, timestamptz) from public, anon;
grant execute on function meeting_calendar(timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- F) Notifications & the missing-minutes reminder reach the
--    department's leaders too.
-- ------------------------------------------------------------
create or replace function notify_booth_meeting() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  team_name text;
  v_title text;
  v_type text;
begin
  team_name := meeting_team_name(new.booth_id, new.department_id);

  if tg_op = 'INSERT' then
    v_title := 'Meeting scheduled';
    v_type := 'meeting_scheduled';
  elsif new.status = 'completed' and old.status <> 'completed' then
    v_title := 'Meeting minutes recorded';
    v_type := 'meeting_completed';
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    v_title := 'Meeting cancelled';
    v_type := 'meeting_cancelled';
  elsif new.status = 'scheduled' and new.scheduled_at is distinct from old.scheduled_at then
    v_title := 'Meeting rescheduled';
    v_type := 'meeting_rescheduled';
  else
    return new;
  end if;

  insert into notifications (user_id, title, message, type, related_entity_type, related_entity_id)
  select distinct on (u.user_id)
    u.user_id,
    v_title,
    coalesce(team_name, 'Team') || ' — ' || new.title,
    v_type,
    'meeting',
    new.id
  from (
    select l as user_id from meeting_team_leaders(new.booth_id, new.department_id) l
    union
    select p.id from profiles p where p.role in ('super_admin', 'admin')
  ) u
  join profiles p on p.id = u.user_id and p.is_active
  where u.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  return new;
end;
$$;

create or replace function notify_booth_meeting_room() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  team_name text;
begin
  if new.room is not distinct from (case when tg_op = 'UPDATE' then old.room end) then
    return new;
  end if;
  if new.status = 'cancelled' then
    return new;
  end if;

  team_name := meeting_team_name(new.booth_id, new.department_id);

  if new.room = 'booking_requested' then
    insert into notifications (user_id, title, message, type, related_entity_type, related_entity_id)
    select p.id,
      'Room booking needed',
      coalesce(team_name, 'A team') || ' — ' || new.title
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
      coalesce(team_name, 'Team') || ' — ' || new.title
        || coalesce(' · ' || new.location, ''),
      'meeting_room_booked',
      'meeting',
      new.id
    from (
      select l as user_id from meeting_team_leaders(new.booth_id, new.department_id) l
      union
      select new.created_by
    ) u
    join profiles p on p.id = u.user_id and p.is_active
    where u.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  return new;
end;
$$;

create or replace function remind_missing_meeting_minutes() returns integer
language plpgsql security definer set search_path = public as $$
declare
  m record;
  sent integer := 0;
begin
  for m in
    select bm.id, bm.title, bm.booth_id, bm.department_id,
      meeting_team_name(bm.booth_id, bm.department_id) as team_name
    from booth_meetings bm
    where bm.status = 'scheduled'
      and not exists (select 1 from meeting_minutes_reminders r where r.meeting_id = bm.id)
      -- ended at least 5 hours ago …
      and bm.scheduled_at
          + make_interval(mins => coalesce(bm.planned_duration_minutes, 60))
          + interval '5 hours' <= now()
      -- … but not long before the job existed (see 025)
      and bm.scheduled_at
          + make_interval(mins => coalesce(bm.planned_duration_minutes, 60))
          > now() - interval '2 days'
  loop
    insert into meeting_minutes_reminders (meeting_id) values (m.id)
    on conflict (meeting_id) do nothing;
    if not found then
      continue;
    end if;

    insert into notifications (user_id, title, message, type, related_entity_type, related_entity_id)
    select l,
      'Meeting minutes missing',
      coalesce(m.team_name, 'Team') || ' — ' || m.title
        || ' · it ended 5 hours ago, please write the minutes',
      'meeting_minutes_missing',
      'meeting',
      m.id
    from meeting_team_leaders(m.booth_id, m.department_id) l
    join profiles p on p.id = l and p.is_active;

    sent := sent + 1;
  end loop;

  return sent;
end;
$$;

revoke all on function remind_missing_meeting_minutes() from public, anon, authenticated;
