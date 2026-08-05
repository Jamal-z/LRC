-- ============================================================
-- 013: Department leaders evaluate their whole team for an event
-- Run after 012.
--
-- A team like Social Media works on an event as a whole, so its leader
-- must be able to evaluate every volunteer in the team — not only the
-- ones registered as event participants (which is how booths work).
-- ============================================================

drop policy if exists event_evaluations_select on event_evaluations;
create policy event_evaluations_select on event_evaluations for select to authenticated
  using (
    is_admin()
    or evaluated_by = auth.uid()
    or (booth_id is not null and is_booth_leader(booth_id))
    or (department_id is not null and is_department_leader(department_id))
  );

drop policy if exists event_evaluations_insert on event_evaluations;
create policy event_evaluations_insert on event_evaluations for insert to authenticated
  with check (
    is_admin()
    or (
      evaluated_by = auth.uid()
      and (
        -- booth leader: the volunteer must be assigned to that booth
        (
          booth_id is not null
          and is_booth_leader(booth_id)
          and exists (
            select 1 from event_participants ep
            where ep.event_id = event_evaluations.event_id
              and ep.volunteer_id = event_evaluations.volunteer_id
              and ep.booth_id = event_evaluations.booth_id
          )
        )
        -- team leader: the volunteer just has to belong to a team they lead
        or (
          department_id is not null
          and is_department_leader(department_id)
          and exists (
            select 1 from volunteer_departments vd
            where vd.volunteer_id = event_evaluations.volunteer_id
              and vd.department_id = event_evaluations.department_id
          )
        )
      )
    )
  );

drop policy if exists event_evaluations_update on event_evaluations;
create policy event_evaluations_update on event_evaluations for update to authenticated
  using (is_admin() or evaluated_by = auth.uid())
  with check (is_admin() or evaluated_by = auth.uid());
