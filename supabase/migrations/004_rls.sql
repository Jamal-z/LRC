-- ============================================================
-- 004: Row Level Security
-- This is an internal system: anon (public, not logged in) gets nothing.
-- Only authenticated internal accounts (profiles) can read/write anything,
-- scoped further by role via the helper functions from 003_functions.sql.
-- ============================================================

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on table public.%I from anon;', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated;', t);
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
create policy profiles_select on profiles for select to authenticated
  using (true); -- internal staff directory; not sensitive in this context

create policy profiles_update on profiles for update to authenticated
  using (is_admin() or id = auth.uid())
  with check (is_admin() or id = auth.uid());

create policy profiles_delete on profiles for delete to authenticated
  using (is_super_admin());

-- block self-service role escalation: only a super_admin may change `role`
create function prevent_role_escalation() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and not is_super_admin() then
    raise exception 'Only a super admin can change user roles';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_role_escalation before update of role on profiles
  for each row execute function prevent_role_escalation();

-- ------------------------------------------------------------
-- departments / department_leaders
-- ------------------------------------------------------------
create policy departments_select on departments for select to authenticated using (true);
create policy departments_write on departments for all to authenticated
  using (is_admin()) with check (is_admin());

create policy department_leaders_select on department_leaders for select to authenticated using (true);
create policy department_leaders_write on department_leaders for all to authenticated
  using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- volunteers / volunteer_departments / tags / volunteer_tags
-- ------------------------------------------------------------
create policy volunteers_select on volunteers for select to authenticated
  using (
    is_admin()
    or volunteer_in_my_departments(id)
    or exists (
      select 1 from event_participants ep
      where ep.volunteer_id = volunteers.id and is_booth_leader(ep.booth_id)
    )
  );

create policy volunteers_insert on volunteers for insert to authenticated
  with check (
    is_admin()
    or (primary_department_id is not null and is_department_leader(primary_department_id))
  );

create policy volunteers_update on volunteers for update to authenticated
  using (is_admin() or volunteer_in_my_departments(id))
  with check (is_admin() or volunteer_in_my_departments(id));

create policy volunteers_delete on volunteers for delete to authenticated
  using (is_super_admin());

create policy volunteer_departments_select on volunteer_departments for select to authenticated
  using (
    is_admin()
    or is_department_leader(department_id)
    or exists (
      select 1 from event_participants ep
      where ep.volunteer_id = volunteer_departments.volunteer_id and is_booth_leader(ep.booth_id)
    )
  );

create policy volunteer_departments_write on volunteer_departments for all to authenticated
  using (is_admin()) with check (is_admin());

create policy tags_select on tags for select to authenticated using (true);
create policy tags_write on tags for all to authenticated
  using (is_admin()) with check (is_admin());

create policy volunteer_tags_select on volunteer_tags for select to authenticated
  using (is_admin() or volunteer_in_my_departments(volunteer_id));

create policy volunteer_tags_write on volunteer_tags for all to authenticated
  using (is_admin() or volunteer_in_my_departments(volunteer_id))
  with check (is_admin() or volunteer_in_my_departments(volunteer_id));

-- ------------------------------------------------------------
-- events & related detail tables
-- ------------------------------------------------------------
create policy events_select on events for select to authenticated
  using (
    is_admin()
    or event_in_my_departments(id)
    or exists (select 1 from event_booths eb where eb.event_id = events.id and is_booth_leader(eb.id))
  );

create policy events_write on events for all to authenticated
  using (is_admin()) with check (is_admin());

create policy event_departments_select on event_departments for select to authenticated
  using (
    is_admin()
    or event_in_my_departments(event_id)
    or exists (select 1 from event_booths eb where eb.event_id = event_departments.event_id and is_booth_leader(eb.id))
  );
create policy event_departments_write on event_departments for all to authenticated
  using (is_admin()) with check (is_admin());

create policy event_sponsors_select on event_sponsors for select to authenticated
  using (is_admin() or event_in_my_departments(event_id));
create policy event_sponsors_write on event_sponsors for all to authenticated
  using (is_admin()) with check (is_admin());

create policy event_guests_select on event_guests for select to authenticated
  using (is_admin() or event_in_my_departments(event_id));
create policy event_guests_write on event_guests for all to authenticated
  using (is_admin()) with check (is_admin());

create policy event_attachments_select on event_attachments for select to authenticated
  using (
    is_admin()
    or event_in_my_departments(event_id)
    or exists (select 1 from event_booths eb where eb.event_id = event_attachments.event_id and is_booth_leader(eb.id))
  );
create policy event_attachments_write on event_attachments for all to authenticated
  using (is_admin()) with check (is_admin());

create policy event_booths_select on event_booths for select to authenticated
  using (is_admin() or event_in_my_departments(event_id) or is_booth_leader(id));
create policy event_booths_write on event_booths for all to authenticated
  using (is_admin()) with check (is_admin());

create policy booth_leaders_select on booth_leaders for select to authenticated
  using (
    is_admin()
    or user_id = auth.uid()
    or is_booth_leader(booth_id)
    or exists (
      select 1 from event_booths eb where eb.id = booth_leaders.booth_id and event_in_my_departments(eb.event_id)
    )
  );
create policy booth_leaders_write on booth_leaders for all to authenticated
  using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- event_participants
-- ------------------------------------------------------------
create policy event_participants_select on event_participants for select to authenticated
  using (
    is_admin()
    or is_booth_leader(booth_id)
    or (department_id is not null and is_department_leader(department_id))
    or event_in_my_departments(event_id)
  );

create policy event_participants_write on event_participants for all to authenticated
  using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- event_evaluations (booth leaders: only their booth's volunteers;
-- department leaders: only their department's participants in the event)
-- ------------------------------------------------------------
create policy event_evaluations_select on event_evaluations for select to authenticated
  using (
    is_admin()
    or evaluated_by = auth.uid()
    or is_booth_leader(booth_id)
    or exists (
      select 1 from event_participants ep
      where ep.event_id = event_evaluations.event_id
        and ep.volunteer_id = event_evaluations.volunteer_id
        and ep.department_id is not null
        and is_department_leader(ep.department_id)
    )
  );

create policy event_evaluations_insert on event_evaluations for insert to authenticated
  with check (
    is_admin()
    or (
      evaluated_by = auth.uid()
      and (
        (
          booth_id is not null and is_booth_leader(booth_id)
          and exists (
            select 1 from event_participants ep
            where ep.event_id = event_evaluations.event_id
              and ep.volunteer_id = event_evaluations.volunteer_id
              and ep.booth_id = event_evaluations.booth_id
          )
        )
        or exists (
          select 1 from event_participants ep
          where ep.event_id = event_evaluations.event_id
            and ep.volunteer_id = event_evaluations.volunteer_id
            and ep.department_id is not null
            and is_department_leader(ep.department_id)
        )
      )
    )
  );

create policy event_evaluations_update on event_evaluations for update to authenticated
  using (is_admin() or evaluated_by = auth.uid())
  with check (is_admin() or evaluated_by = auth.uid());

create policy event_evaluations_delete on event_evaluations for delete to authenticated
  using (is_admin() or evaluated_by = auth.uid());

-- ------------------------------------------------------------
-- monthly_evaluations (department leaders: only their own department's volunteers)
-- ------------------------------------------------------------
create policy monthly_evaluations_select on monthly_evaluations for select to authenticated
  using (is_admin() or evaluated_by = auth.uid() or is_department_leader(department_id));

create policy monthly_evaluations_insert on monthly_evaluations for insert to authenticated
  with check (
    is_admin()
    or (
      evaluated_by = auth.uid()
      and is_department_leader(department_id)
      and exists (
        select 1 from volunteer_departments vd
        where vd.volunteer_id = monthly_evaluations.volunteer_id and vd.department_id = monthly_evaluations.department_id
      )
    )
  );

create policy monthly_evaluations_update on monthly_evaluations for update to authenticated
  using (is_admin() or evaluated_by = auth.uid())
  with check (is_admin() or evaluated_by = auth.uid());

create policy monthly_evaluations_delete on monthly_evaluations for delete to authenticated
  using (is_admin());

-- ------------------------------------------------------------
-- tasks / task_comments / task_attachments
-- ------------------------------------------------------------
create policy tasks_select on tasks for select to authenticated
  using (
    is_admin()
    or (department_id is not null and is_department_leader(department_id))
    or assigned_to_user_id = auth.uid()
    or created_by = auth.uid()
    or (related_booth_id is not null and is_booth_leader(related_booth_id))
  );

create policy tasks_insert on tasks for insert to authenticated
  with check (
    is_admin() or (department_id is not null and is_department_leader(department_id))
  );

create policy tasks_update on tasks for update to authenticated
  using (
    is_admin()
    or (department_id is not null and is_department_leader(department_id))
    or assigned_to_user_id = auth.uid()
  )
  with check (
    is_admin()
    or (department_id is not null and is_department_leader(department_id))
    or assigned_to_user_id = auth.uid()
  );

create policy tasks_delete on tasks for delete to authenticated
  using (
    is_admin()
    or (department_id is not null and is_department_leader(department_id))
    or created_by = auth.uid()
  );

create policy task_comments_select on task_comments for select to authenticated
  using (
    exists (
      select 1 from tasks t
      where t.id = task_comments.task_id
        and (
          is_admin()
          or (t.department_id is not null and is_department_leader(t.department_id))
          or t.assigned_to_user_id = auth.uid()
          or t.created_by = auth.uid()
          or (t.related_booth_id is not null and is_booth_leader(t.related_booth_id))
        )
    )
  );

create policy task_comments_insert on task_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from tasks t
      where t.id = task_comments.task_id
        and (
          is_admin()
          or (t.department_id is not null and is_department_leader(t.department_id))
          or t.assigned_to_user_id = auth.uid()
          or t.created_by = auth.uid()
          or (t.related_booth_id is not null and is_booth_leader(t.related_booth_id))
        )
    )
  );

create policy task_comments_delete on task_comments for delete to authenticated
  using (is_admin() or user_id = auth.uid());

create policy task_attachments_select on task_attachments for select to authenticated
  using (
    exists (
      select 1 from tasks t
      where t.id = task_attachments.task_id
        and (
          is_admin()
          or (t.department_id is not null and is_department_leader(t.department_id))
          or t.assigned_to_user_id = auth.uid()
          or t.created_by = auth.uid()
          or (t.related_booth_id is not null and is_booth_leader(t.related_booth_id))
        )
    )
  );

create policy task_attachments_insert on task_attachments for insert to authenticated
  with check (
    exists (
      select 1 from tasks t
      where t.id = task_attachments.task_id
        and (
          is_admin()
          or (t.department_id is not null and is_department_leader(t.department_id))
          or t.assigned_to_user_id = auth.uid()
          or t.created_by = auth.uid()
        )
    )
  );

create policy task_attachments_delete on task_attachments for delete to authenticated
  using (is_admin() or uploaded_by = auth.uid());

-- ------------------------------------------------------------
-- notifications (each user only sees their own; rows are created by
-- security-definer functions/triggers which bypass RLS as table owner)
-- ------------------------------------------------------------
create policy notifications_select on notifications for select to authenticated
  using (is_admin() or user_id = auth.uid());

create policy notifications_update on notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_delete on notifications for delete to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- import_logs / activity_logs (admin only)
-- ------------------------------------------------------------
create policy import_logs_all on import_logs for all to authenticated
  using (is_admin()) with check (is_admin());

create policy activity_logs_select on activity_logs for select to authenticated
  using (is_admin());
