-- ============================================================
-- 003: Functions & Triggers
-- ============================================================

-- ------------------------------------------------------------
-- updated_at maintenance
-- ------------------------------------------------------------
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger trg_departments_updated_at before update on departments
  for each row execute function set_updated_at();
create trigger trg_volunteers_updated_at before update on volunteers
  for each row execute function set_updated_at();
create trigger trg_events_updated_at before update on events
  for each row execute function set_updated_at();
create trigger trg_event_booths_updated_at before update on event_booths
  for each row execute function set_updated_at();
create trigger trg_event_participants_updated_at before update on event_participants
  for each row execute function set_updated_at();
create trigger trg_event_evaluations_updated_at before update on event_evaluations
  for each row execute function set_updated_at();
create trigger trg_monthly_evaluations_updated_at before update on monthly_evaluations
  for each row execute function set_updated_at();
create trigger trg_tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- auth.users -> profiles bootstrap
-- Admins create accounts via a Supabase Edge Function using the service role
-- (auth.admin.createUser), passing full_name / role / notes as user metadata.
-- This trigger reads that metadata and creates the matching profile row, so
-- there is a single source of truth for "how a profile gets created".
-- ------------------------------------------------------------
create function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email, role, notes)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'department_leader'),
    new.raw_user_meta_data ->> 'notes'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ------------------------------------------------------------
-- Keep volunteer_departments.is_primary in sync with volunteers.primary_department_id
-- ------------------------------------------------------------
create function sync_volunteer_primary_department() returns trigger
language plpgsql as $$
begin
  if new.primary_department_id is null then
    return new;
  end if;

  -- demote any previous primary row for this volunteer
  update volunteer_departments
  set is_primary = false
  where volunteer_id = new.id and is_primary and department_id <> new.primary_department_id;

  insert into volunteer_departments (volunteer_id, department_id, is_primary)
  values (new.id, new.primary_department_id, true)
  on conflict (volunteer_id, department_id)
  do update set is_primary = true;

  return new;
end;
$$;

create trigger trg_sync_volunteer_primary_department
  after insert or update of primary_department_id on volunteers
  for each row execute function sync_volunteer_primary_department();

-- ------------------------------------------------------------
-- Permission helper functions (security definer: read past RLS on the
-- lookup tables themselves to avoid recursive-policy issues)
-- ------------------------------------------------------------
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_active and role in ('super_admin', 'admin')
  );
$$;

create function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_active and role = 'super_admin'
  );
$$;

create function current_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create function is_department_leader(dept_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from department_leaders dl
    join profiles p on p.id = dl.user_id
    where dl.department_id = dept_id and dl.user_id = auth.uid() and p.is_active
  );
$$;

create function is_booth_leader(booth_id_param uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from booth_leaders bl
    join profiles p on p.id = bl.user_id
    where bl.booth_id = booth_id_param and bl.user_id = auth.uid() and p.is_active
  );
$$;

-- true if the volunteer belongs to any department led by the current user
create function volunteer_in_my_departments(v_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from volunteer_departments vd
    join department_leaders dl on dl.department_id = vd.department_id
    where vd.volunteer_id = v_id and dl.user_id = auth.uid()
  );
$$;

-- true if the current user leads at least one of the event's participating departments
create function event_in_my_departments(ev_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from event_departments ed
    join department_leaders dl on dl.department_id = ed.department_id
    where ed.event_id = ev_id and dl.user_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- Generic activity log trigger (covers "important actions to log")
-- ------------------------------------------------------------
create function log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_action text;
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_action := tg_argv[0];
    v_entity_id := new.id;
    insert into activity_logs (user_id, action, entity_type, entity_id, new_value)
    values (auth.uid(), v_action, tg_table_name, v_entity_id, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    v_action := tg_argv[1];
    v_entity_id := new.id;
    insert into activity_logs (user_id, action, entity_type, entity_id, old_value, new_value)
    values (auth.uid(), v_action, tg_table_name, v_entity_id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    v_action := tg_argv[2];
    v_entity_id := old.id;
    insert into activity_logs (user_id, action, entity_type, entity_id, old_value)
    values (auth.uid(), v_action, tg_table_name, v_entity_id, to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_log_volunteers
  after insert or update or delete on volunteers
  for each row execute function log_activity('volunteer_created', 'volunteer_updated', 'volunteer_deleted');

create trigger trg_log_department_leaders
  after insert or delete on department_leaders
  for each row execute function log_activity('department_leader_assigned', '', 'department_leader_removed');

create trigger trg_log_booth_leaders
  after insert or delete on booth_leaders
  for each row execute function log_activity('booth_leader_assigned', '', 'booth_leader_removed');

create trigger trg_log_events
  after insert or update on events
  for each row execute function log_activity('event_created', 'event_updated', '');

create trigger trg_log_event_evaluations
  after insert or update on event_evaluations
  for each row execute function log_activity('evaluation_submitted', 'evaluation_updated', '');

create trigger trg_log_monthly_evaluations
  after insert or update on monthly_evaluations
  for each row execute function log_activity('evaluation_submitted', 'evaluation_updated', '');

create trigger trg_log_tasks
  after update of status on tasks
  for each row execute function log_activity('', 'task_status_changed', '');

create trigger trg_log_profiles
  after update of role on profiles
  for each row execute function log_activity('', 'user_role_changed', '');
