-- ============================================================
-- 023 — Booth meetings
--
-- Booth leaders schedule meetings with their booth team. Once the
-- meeting is over they record the minutes: who from the booth came,
-- how long it took, in person or online, a summary and the ideas /
-- notes that came out of it. Action items become ordinary tasks
-- (tasks.related_meeting_id) so they show up on the Tasks board.
-- ============================================================

-- ------------------------------------------------------------
-- A) Tables
-- ------------------------------------------------------------
create table if not exists booth_meetings (
  id uuid primary key default gen_random_uuid(),
  booth_id uuid not null references event_booths (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  title text not null,
  agenda text,
  scheduled_at timestamptz not null,
  planned_duration_minutes integer check (planned_duration_minutes > 0),
  mode text not null default 'in_person' check (mode in ('in_person', 'online')),
  -- room for in-person meetings, a link for online ones
  location text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  -- minutes, filled in after the meeting
  actual_duration_minutes integer check (actual_duration_minutes > 0),
  summary text,
  ideas_notes text,
  completed_at timestamptz,
  completed_by uuid references profiles (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booth_meetings_booth_idx on booth_meetings (booth_id);
create index if not exists booth_meetings_event_idx on booth_meetings (event_id);
create index if not exists booth_meetings_scheduled_idx on booth_meetings (scheduled_at);

drop trigger if exists trg_booth_meetings_updated_at on booth_meetings;
create trigger trg_booth_meetings_updated_at before update on booth_meetings
  for each row execute function set_updated_at();

-- one row per booth volunteer once the minutes are recorded
create table if not exists booth_meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references booth_meetings (id) on delete cascade,
  volunteer_id uuid not null references volunteers (id) on delete cascade,
  attended boolean not null default false,
  created_at timestamptz not null default now(),
  unique (meeting_id, volunteer_id)
);

create index if not exists booth_meeting_attendance_volunteer_idx
  on booth_meeting_attendance (volunteer_id);

-- action items from a meeting are regular tasks
alter table tasks
  add column if not exists related_meeting_id uuid references booth_meetings (id) on delete set null;

create index if not exists tasks_related_meeting_idx on tasks (related_meeting_id);

-- ------------------------------------------------------------
-- B) RLS — the booth's leaders run its meetings; admins see and
--    manage all; department leaders can read meetings of events
--    their department takes part in.
-- ------------------------------------------------------------
alter table booth_meetings enable row level security;
alter table booth_meeting_attendance enable row level security;

drop policy if exists booth_meetings_select on booth_meetings;
create policy booth_meetings_select on booth_meetings for select to authenticated
  using (is_admin() or is_booth_leader(booth_id) or event_in_my_departments(event_id));

drop policy if exists booth_meetings_insert on booth_meetings;
create policy booth_meetings_insert on booth_meetings for insert to authenticated
  with check (is_admin() or is_booth_leader(booth_id));

drop policy if exists booth_meetings_update on booth_meetings;
create policy booth_meetings_update on booth_meetings for update to authenticated
  using (is_admin() or is_booth_leader(booth_id))
  with check (is_admin() or is_booth_leader(booth_id));

drop policy if exists booth_meetings_delete on booth_meetings;
create policy booth_meetings_delete on booth_meetings for delete to authenticated
  using (is_admin() or is_booth_leader(booth_id));

drop policy if exists booth_meeting_attendance_select on booth_meeting_attendance;
create policy booth_meeting_attendance_select on booth_meeting_attendance for select to authenticated
  using (
    exists (
      select 1 from booth_meetings m
      where m.id = booth_meeting_attendance.meeting_id
        and (is_admin() or is_booth_leader(m.booth_id) or event_in_my_departments(m.event_id))
    )
  );

drop policy if exists booth_meeting_attendance_write on booth_meeting_attendance;
create policy booth_meeting_attendance_write on booth_meeting_attendance for all to authenticated
  using (
    exists (
      select 1 from booth_meetings m
      where m.id = booth_meeting_attendance.meeting_id
        and (is_admin() or is_booth_leader(m.booth_id))
    )
  )
  with check (
    exists (
      select 1 from booth_meetings m
      where m.id = booth_meeting_attendance.meeting_id
        and (is_admin() or is_booth_leader(m.booth_id))
    )
  );

-- ------------------------------------------------------------
-- C) Tasks — booth leaders may create and update tasks tied to a
--    booth they lead (that's how meeting action items get in).
--    Everything else is unchanged from 004.
-- ------------------------------------------------------------
drop policy if exists tasks_insert on tasks;
create policy tasks_insert on tasks for insert to authenticated
  with check (
    is_admin()
    or (department_id is not null and is_department_leader(department_id))
    or (related_booth_id is not null and is_booth_leader(related_booth_id))
  );

drop policy if exists tasks_update on tasks;
create policy tasks_update on tasks for update to authenticated
  using (
    is_admin()
    or (department_id is not null and is_department_leader(department_id))
    or assigned_to_user_id = auth.uid()
    or (related_booth_id is not null and is_booth_leader(related_booth_id))
  )
  with check (
    is_admin()
    or (department_id is not null and is_department_leader(department_id))
    or assigned_to_user_id = auth.uid()
    or (related_booth_id is not null and is_booth_leader(related_booth_id))
  );

-- ------------------------------------------------------------
-- D) Notifications — the booth's other leaders and the committee
--    hear about new, moved, cancelled and completed meetings.
--    (Task assignments already notify via trg_notify_task_assigned.)
-- ------------------------------------------------------------
create or replace function notify_booth_meeting() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  booth_name text;
  v_title text;
  v_type text;
begin
  select eb.name into booth_name from event_booths eb where eb.id = new.booth_id;

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
    coalesce(booth_name, 'Booth') || ' — ' || new.title,
    v_type,
    'meeting',
    new.id
  from (
    select bl.user_id from booth_leaders bl where bl.booth_id = new.booth_id
    union
    select p.id from profiles p where p.role in ('super_admin', 'admin')
  ) u
  join profiles p on p.id = u.user_id and p.is_active
  where u.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  return new;
end;
$$;

drop trigger if exists trg_notify_booth_meeting on booth_meetings;
create trigger trg_notify_booth_meeting
  after insert or update of status, scheduled_at on booth_meetings
  for each row execute function notify_booth_meeting();

-- log meeting changes alongside the other important actions
drop trigger if exists trg_log_booth_meetings on booth_meetings;
create trigger trg_log_booth_meetings
  after insert or update or delete on booth_meetings
  for each row execute function log_activity('meeting_created', 'meeting_updated', 'meeting_deleted');
