-- ============================================================
-- 012: Booth-leader visibility fix + shift-based evaluations
-- Run after 011.
-- ============================================================

-- ------------------------------------------------------------
-- A) Let every signed-in staff member read the shared volunteer
--    record (name, photo, team, status).
--    This is safe because 011 moved every personal detail into
--    `volunteer_private`, which stays admin-only. Without this a
--    booth leader could not even search for a volunteer to add to
--    their own booth.
-- ------------------------------------------------------------
drop policy if exists volunteers_select on volunteers;
create policy volunteers_select on volunteers for select to authenticated
  using (true);

drop policy if exists volunteer_departments_select on volunteer_departments;
create policy volunteer_departments_select on volunteer_departments for select to authenticated
  using (true);

-- ------------------------------------------------------------
-- B) Evaluation criteria: meetings, shifts and talent flags
--    Volunteering is organised in shifts, not hours, so each
--    evaluation records how many shifts the volunteer covered.
-- ------------------------------------------------------------
alter table event_evaluations
  add column if not exists meeting_attendance_rating smallint
    check (meeting_attendance_rating between 1 and 5);

alter table event_evaluations
  add column if not exists shifts_count integer not null default 0
    check (shifts_count >= 0);

alter table event_evaluations
  add column if not exists is_talented boolean not null default false;

alter table event_evaluations
  add column if not exists needs_follow_up boolean not null default false;

-- department leaders evaluate their whole team for an event, so an
-- evaluation may legitimately have no booth attached
alter table event_evaluations
  add column if not exists department_id uuid references departments (id) on delete set null;

create index if not exists event_evaluations_event_idx on event_evaluations (event_id);
create index if not exists event_evaluations_department_idx on event_evaluations (department_id);

-- ------------------------------------------------------------
-- C) Booth leaders may add volunteers to their own booth even when
--    the person is not yet part of the event (insert with the booth
--    they lead). Department leaders may add their own team members.
-- ------------------------------------------------------------
drop policy if exists event_participants_insert on event_participants;
create policy event_participants_insert on event_participants for insert to authenticated
  with check (
    is_admin()
    or (booth_id is not null and is_booth_leader(booth_id))
    or (department_id is not null and is_department_leader(department_id))
  );

drop policy if exists event_participants_update on event_participants;
create policy event_participants_update on event_participants for update to authenticated
  using (
    is_admin()
    or (booth_id is not null and is_booth_leader(booth_id))
    or (department_id is not null and is_department_leader(department_id))
  )
  with check (
    is_admin()
    or (booth_id is not null and is_booth_leader(booth_id))
    or (department_id is not null and is_department_leader(department_id))
  );

drop policy if exists event_participants_delete on event_participants;
create policy event_participants_delete on event_participants for delete to authenticated
  using (
    is_admin()
    or (booth_id is not null and is_booth_leader(booth_id))
    or (department_id is not null and is_department_leader(department_id))
  );
