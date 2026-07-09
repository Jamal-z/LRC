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
