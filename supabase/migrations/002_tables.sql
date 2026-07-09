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
