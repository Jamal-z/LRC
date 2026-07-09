-- ============================================================
-- 009: Leader evaluations (admin committee evaluates department
-- and booth leaders after each event)
-- ============================================================

create table if not exists leader_evaluations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  leader_user_id uuid not null references profiles (id) on delete cascade,
  evaluated_by uuid not null references profiles (id) on delete cascade,
  leadership_rating smallint check (leadership_rating between 1 and 5),
  organization_rating smallint check (organization_rating between 1 and 5),
  communication_rating smallint check (communication_rating between 1 and 5),
  overall_rating smallint check (overall_rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, leader_user_id, evaluated_by)
);

create trigger trg_leader_evaluations_updated_at before update on leader_evaluations
  for each row execute function set_updated_at();

revoke all on table leader_evaluations from anon;
grant select, insert, update, delete on table leader_evaluations to authenticated;
alter table leader_evaluations enable row level security;

-- admins manage; a leader may see their own evaluations
create policy leader_evaluations_select on leader_evaluations for select to authenticated
  using (is_admin() or leader_user_id = auth.uid());

create policy leader_evaluations_write on leader_evaluations for all to authenticated
  using (is_admin()) with check (is_admin());
