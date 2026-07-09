-- ============================================================
-- 001: Extensions & Enums
-- ============================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

create type user_role as enum ('super_admin', 'admin', 'department_leader', 'booth_leader');

create type volunteer_status as enum (
  'new', 'active', 'inactive', 'on_hold', 'needs_follow_up', 'archived'
);

create type event_status as enum (
  'draft', 'planned', 'in_progress', 'completed', 'cancelled', 'archived'
);

create type participation_status as enum (
  'invited', 'confirmed', 'attended', 'late', 'excused', 'no_show', 'cancelled'
);

create type task_status as enum (
  'backlog', 'todo', 'in_progress', 'waiting_review', 'done', 'cancelled'
);

create type task_priority as enum ('low', 'medium', 'high', 'urgent');
-- ============================================================
-- 002: Core Tables
-- ============================================================

-- ===== PROFILES (internal users: super_admin, admin, department_leader, booth_leader) =====
-- id == auth.users.id, one row per internal account. Volunteers do NOT get a row here (no login in v1).
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null default 'department_leader',
  avatar_url text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== DEPARTMENTS =====
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  requires_monthly_evaluation boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- dynamic, many-to-many: any number of leaders per department
create table department_leaders (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (department_id, user_id)
);

-- ===== VOLUNTEERS (no login) =====
create table volunteers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  photo_url text,
  phone text,
  email text,
  city text,
  birth_date date,
  primary_department_id uuid references departments (id) on delete set null,
  availability text,
  status volunteer_status not null default 'new',
  skills text,
  languages text,
  join_date date not null default current_date,
  internal_notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index volunteers_primary_department_idx on volunteers (primary_department_id);
create index volunteers_status_idx on volunteers (status);

-- a volunteer can belong to several departments; exactly one is_primary row per volunteer (kept in sync with primary_department_id via trigger, see 003_functions.sql)
create table volunteer_departments (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteers (id) on delete cascade,
  department_id uuid not null references departments (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (volunteer_id, department_id)
);

create unique index volunteer_departments_one_primary_idx
  on volunteer_departments (volunteer_id) where (is_primary);

-- ===== TAGS =====
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#2563eb',
  created_at timestamptz not null default now()
);

create table volunteer_tags (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteers (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (volunteer_id, tag_id)
);

-- ===== EVENTS =====
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  start_time time,
  end_time time,
  location text,
  short_description text,
  status event_status not null default 'draft',
  budget numeric(12, 2) default 0,
  paid_amount numeric(12, 2) default 0,
  sponsor_contribution numeric(12, 2) default 0,
  financial_notes text,
  post_event_notes text,
  what_went_well text,
  what_needs_improvement text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_date_idx on events (date);
create index events_status_idx on events (status);

create table event_departments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  department_id uuid not null references departments (id) on delete cascade,
  unique (event_id, department_id)
);

create table event_sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  sponsor_name text not null,
  contribution_amount numeric(12, 2) default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  guest_name text not null,
  role_or_title text,
  notes text,
  created_at timestamptz not null default now()
);

create table event_attachments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  file_url text not null,
  file_name text not null,
  uploaded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- booths are created dynamically per event, never hardcoded
create table event_booths (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  name text not null,
  description text,
  location_in_event text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_booths_event_idx on event_booths (event_id);

-- dynamic, many-to-many: any number of leaders per booth (temporary, event-scoped role)
create table booth_leaders (
  id uuid primary key default gen_random_uuid(),
  booth_id uuid not null references event_booths (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (booth_id, user_id)
);

create table event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  booth_id uuid references event_booths (id) on delete set null,
  volunteer_id uuid not null references volunteers (id) on delete cascade,
  department_id uuid references departments (id) on delete set null,
  role_description text,
  participation_status participation_status not null default 'invited',
  start_time timestamptz,
  end_time timestamptz,
  total_hours numeric(6, 2) generated always as (
    case
      when start_time is not null and end_time is not null and end_time > start_time
        then round((extract(epoch from (end_time - start_time)) / 3600.0)::numeric, 2)
      else 0
    end
  ) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, volunteer_id)
);

create index event_participants_event_idx on event_participants (event_id);
create index event_participants_booth_idx on event_participants (booth_id);
create index event_participants_volunteer_idx on event_participants (volunteer_id);

-- ===== EVALUATIONS =====
create table event_evaluations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  booth_id uuid references event_booths (id) on delete set null,
  volunteer_id uuid not null references volunteers (id) on delete cascade,
  evaluated_by uuid not null references profiles (id) on delete cascade,
  performance_rating smallint check (performance_rating between 1 and 5),
  commitment_rating smallint check (commitment_rating between 1 and 5),
  teamwork_rating smallint check (teamwork_rating between 1 and 5),
  communication_rating smallint check (communication_rating between 1 and 5),
  notes text,
  suggested_tags text[] not null default '{}',
  recommend_for_future_events boolean,
  potential_future_booth_leader boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, volunteer_id, evaluated_by)
);

create index event_evaluations_volunteer_idx on event_evaluations (volunteer_id);

create table monthly_evaluations (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteers (id) on delete cascade,
  department_id uuid not null references departments (id) on delete cascade,
  month smallint not null check (month between 1 and 12),
  year smallint not null check (year between 2000 and 2100),
  evaluated_by uuid references profiles (id) on delete set null,
  commitment_rating smallint check (commitment_rating between 1 and 5),
  quality_rating smallint check (quality_rating between 1 and 5),
  communication_rating smallint check (communication_rating between 1 and 5),
  teamwork_rating smallint check (teamwork_rating between 1 and 5),
  initiative_rating smallint check (initiative_rating between 1 and 5),
  responsiveness_rating smallint check (responsiveness_rating between 1 and 5),
  overall_rating smallint check (overall_rating between 1 and 5),
  -- department-specific extra criteria (e.g. { "creativity": 4, "design_quality": 5 }), keeps schema flexible without hardcoding per-department columns
  extra_criteria jsonb not null default '{}',
  strengths text,
  areas_to_improve text,
  leader_notes text,
  recommended_status volunteer_status,
  suggested_tags text[] not null default '{}',
  future_leader_potential boolean not null default false,
  needs_follow_up boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (volunteer_id, department_id, month, year)
);

create index monthly_evaluations_dept_month_year_idx on monthly_evaluations (department_id, year, month);

-- ===== TASKS (Trello-style board) =====
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  department_id uuid references departments (id) on delete set null,
  assigned_to_user_id uuid references profiles (id) on delete set null,
  assigned_to_volunteer_id uuid references volunteers (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  due_date date,
  priority task_priority not null default 'medium',
  status task_status not null default 'backlog',
  board_position integer not null default 0,
  related_event_id uuid references events (id) on delete set null,
  related_booth_id uuid references event_booths (id) on delete set null,
  related_volunteer_id uuid references volunteers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_department_idx on tasks (department_id);
create index tasks_status_idx on tasks (status);
create index tasks_due_date_idx on tasks (due_date);

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default now()
);

create table task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  file_url text not null,
  file_name text not null,
  uploaded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ===== SYSTEM TABLES =====
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  message text,
  type text not null,
  is_read boolean not null default false,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on notifications (user_id, is_read);

create table import_logs (
  id uuid primary key default gen_random_uuid(),
  imported_by uuid references profiles (id) on delete set null,
  file_name text not null,
  total_rows integer not null default 0,
  successful_rows integer not null default 0,
  failed_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  import_summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_entity_idx on activity_logs (entity_type, entity_id);
create index activity_logs_created_idx on activity_logs (created_at desc);
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
-- ============================================================
-- 005: Storage buckets (avatars, attachments)
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- avatars: public read (so <img> tags work without signed URLs), authenticated write
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

create policy avatars_auth_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');

create policy avatars_auth_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

create policy avatars_auth_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars');

-- attachments: internal staff only (all authenticated profiles are internal staff in v1)
create policy attachments_auth_read on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

create policy attachments_auth_write on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

create policy attachments_auth_update on storage.objects for update to authenticated
  using (bucket_id = 'attachments') with check (bucket_id = 'attachments');

create policy attachments_auth_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments');
-- ============================================================
-- 006: Seed data (departments + default tags)
-- Safe to re-run: uses ON CONFLICT DO NOTHING.
-- ============================================================

insert into departments (name, description, requires_monthly_evaluation) values
  ('Field Volunteering', 'On-the-ground volunteering, mainly evaluated through event/booth participation.', false),
  ('Social Media Team', 'Manages the center''s social media presence and content.', true),
  ('Graphic Design Team', 'Designs visual materials for the center.', true),
  ('Funding and Public Relations Team', 'Handles fundraising, sponsors, and public relations.', true),
  ('Arabic Teaching for Foreigners Team', 'Teaches Arabic language classes to foreigners.', true),
  ('Translation and News Editing Team', 'Translation and news editing for the center.', true)
on conflict (name) do nothing;

insert into tags (name, color) values
  ('Future Leader', '#2563eb'),
  ('Reliable', '#16a34a'),
  ('Creative', '#c084fc'),
  ('Good Communicator', '#0ea5e9'),
  ('Needs Training', '#f59e0b'),
  ('Event Volunteer', '#6366f1'),
  ('Social Media Talent', '#ec4899'),
  ('Translation Talent', '#14b8a6'),
  ('Strong Commitment', '#0d9488'),
  ('Needs Follow-up', '#ef4444'),
  ('Excellent Teamwork', '#22c55e'),
  ('Good with Children', '#f97316'),
  ('Good Public Speaker', '#8b5cf6')
on conflict (name) do nothing;
