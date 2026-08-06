-- ============================================================
-- 015: Volunteer interviews
-- Run after 014.
--
-- Replaces the paper notebook: every candidate interview is recorded
-- with its scores, sorted into accepted / maybe / rejected, and an
-- accepted candidate can be turned into a real volunteer in one click.
-- ============================================================

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),

  -- candidate details
  full_name text not null,
  university_id text,
  major text,
  phone text,
  email text,
  city text,
  department_id uuid references departments (id) on delete set null,

  -- interview scoring: each criterion is 1–5 stars, kept in one jsonb
  -- object so the committee can adjust the criteria without a migration
  ratings jsonb not null default '{}',
  notes text,
  strengths text,
  concerns text,

  status text not null default 'maybe'
    check (status in ('accepted', 'maybe', 'rejected')),

  -- set once the candidate has been turned into a volunteer
  converted_volunteer_id uuid references volunteers (id) on delete set null,
  converted_at timestamptz,

  interviewed_by uuid references profiles (id) on delete set null,
  interviewed_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interviews_status_idx on interviews (status);
create index if not exists interviews_department_idx on interviews (department_id);

drop trigger if exists trg_interviews_updated_at on interviews;
create trigger trg_interviews_updated_at before update on interviews
  for each row execute function set_updated_at();

alter table interviews enable row level security;
revoke all on table interviews from anon;
grant select, insert, update, delete on table interviews to authenticated;

-- interviews hold personal contact details, so they stay with the committee
drop policy if exists interviews_admin_all on interviews;
create policy interviews_admin_all on interviews for all to authenticated
  using (is_admin()) with check (is_admin());

-- notify the committee when a candidate is accepted
create or replace function notify_interview_accepted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform notify_admins(
      'Interview candidate accepted',
      new.full_name || ' passed their interview',
      'interview_accepted',
      'interview',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_interview_accepted on interviews;
create trigger trg_notify_interview_accepted
  after update of status on interviews
  for each row execute function notify_interview_accepted();
