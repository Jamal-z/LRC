-- ============================================================
-- 010: Department images + public volunteer registration form
-- ============================================================

alter table departments add column if not exists image_url text;

-- Registration form submissions (public form, reviewed by admins before
-- becoming volunteers)
create table if not exists form_submissions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  university_id text,
  major text,
  phone text,
  email text,
  city text,
  department_id uuid references departments (id) on delete set null,
  languages text,
  skills text,
  availability text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table form_submissions enable row level security;

-- the public registration page may only INSERT (no reading anything back)
grant insert on table form_submissions to anon;
grant select, insert, update, delete on table form_submissions to authenticated;

create policy form_submissions_public_insert on form_submissions for insert to anon
  with check (status = 'pending');

create policy form_submissions_auth_insert on form_submissions for insert to authenticated
  with check (status = 'pending');

create policy form_submissions_admin_select on form_submissions for select to authenticated
  using (is_admin());

create policy form_submissions_admin_update on form_submissions for update to authenticated
  using (is_admin()) with check (is_admin());

create policy form_submissions_admin_delete on form_submissions for delete to authenticated
  using (is_admin());

-- the public form needs to list departments to choose from
grant select on table departments to anon;
create policy departments_public_select on departments for select to anon
  using (is_active);
