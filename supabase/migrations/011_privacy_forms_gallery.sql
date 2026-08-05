-- ============================================================
-- 011: app_settings, volunteer privacy split, form builder,
--      event photo gallery, permission updates
-- Safe to run once on an existing database.
-- ============================================================

-- ------------------------------------------------------------
-- A) app_settings (key/value store — already created by hand for the
--    login page photos; this documents it so a rebuild from migrations
--    produces the same schema)
-- ------------------------------------------------------------
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
revoke all on table app_settings from anon;
grant select on table app_settings to anon; -- login page reads its photos before sign-in
grant select, insert, update, delete on table app_settings to authenticated;

drop policy if exists app_settings_public_select on app_settings;
create policy app_settings_public_select on app_settings for select to anon using (true);

drop policy if exists app_settings_select on app_settings;
create policy app_settings_select on app_settings for select to authenticated using (true);

drop policy if exists app_settings_write on app_settings;
create policy app_settings_write on app_settings for all to authenticated
  using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- B) Volunteer privacy split
--    `volunteers` keeps only what every staff member may see
--    (name, photo, team, status). Everything personal moves to
--    `volunteer_private`, which only admins can read or write —
--    department/booth leaders cannot reach it at all, even by
--    querying the API directly.
-- ------------------------------------------------------------
create table if not exists volunteer_private (
  volunteer_id uuid primary key references volunteers (id) on delete cascade,
  phone text,
  email text,
  city text,
  birth_date date,
  university_id text,
  major text,
  skills text,
  languages text,
  availability text,
  internal_notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- copy existing data across (only on the first run, while the old columns still exist)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'volunteers' and column_name = 'phone'
  ) then
    insert into volunteer_private (
      volunteer_id, phone, email, city, birth_date, university_id, major,
      skills, languages, availability, internal_notes,
      emergency_contact_name, emergency_contact_phone
    )
    select id, phone, email, city, birth_date, university_id, major,
           skills, languages, availability, internal_notes,
           emergency_contact_name, emergency_contact_phone
    from volunteers
    on conflict (volunteer_id) do nothing;
  end if;
end $$;

-- drop the now-duplicated columns from the shared table
alter table volunteers drop column if exists phone;
alter table volunteers drop column if exists email;
alter table volunteers drop column if exists city;
alter table volunteers drop column if exists birth_date;
alter table volunteers drop column if exists university_id;
alter table volunteers drop column if exists major;
alter table volunteers drop column if exists skills;
alter table volunteers drop column if exists languages;
alter table volunteers drop column if exists availability;
alter table volunteers drop column if exists internal_notes;
alter table volunteers drop column if exists emergency_contact_name;
alter table volunteers drop column if exists emergency_contact_phone;

create index if not exists volunteer_private_email_idx on volunteer_private (email);
create index if not exists volunteer_private_phone_idx on volunteer_private (phone);
create index if not exists volunteer_private_university_id_idx on volunteer_private (university_id);

drop trigger if exists trg_volunteer_private_updated_at on volunteer_private;
create trigger trg_volunteer_private_updated_at before update on volunteer_private
  for each row execute function set_updated_at();

alter table volunteer_private enable row level security;
revoke all on table volunteer_private from anon;
grant select, insert, update, delete on table volunteer_private to authenticated;

drop policy if exists volunteer_private_admin_all on volunteer_private;
create policy volunteer_private_admin_all on volunteer_private for all to authenticated
  using (is_admin()) with check (is_admin());

-- department leaders may now add + edit volunteers inside their own team
drop policy if exists volunteers_insert on volunteers;
create policy volunteers_insert on volunteers for insert to authenticated
  with check (
    is_admin()
    or (primary_department_id is not null and is_department_leader(primary_department_id))
  );

-- admins (not only super admins) may permanently delete from Terminations
drop policy if exists volunteers_delete on volunteers;
create policy volunteers_delete on volunteers for delete to authenticated
  using (is_admin());

-- ------------------------------------------------------------
-- C) Booth leaders manage their own booth's participants
-- ------------------------------------------------------------
drop policy if exists event_participants_write on event_participants;

create policy event_participants_insert on event_participants for insert to authenticated
  with check (is_admin() or (booth_id is not null and is_booth_leader(booth_id)));

create policy event_participants_update on event_participants for update to authenticated
  using (is_admin() or (booth_id is not null and is_booth_leader(booth_id)))
  with check (is_admin() or (booth_id is not null and is_booth_leader(booth_id)));

create policy event_participants_delete on event_participants for delete to authenticated
  using (is_admin() or (booth_id is not null and is_booth_leader(booth_id)));

-- ------------------------------------------------------------
-- D) Event photo gallery
-- ------------------------------------------------------------
create table if not exists event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  booth_id uuid references event_booths (id) on delete set null,
  url text not null,
  path text not null,
  caption text,
  uploaded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists event_photos_event_idx on event_photos (event_id);

alter table event_photos enable row level security;
revoke all on table event_photos from anon;
grant select, insert, update, delete on table event_photos to authenticated;

drop policy if exists event_photos_select on event_photos;
create policy event_photos_select on event_photos for select to authenticated
  using (
    is_admin()
    or event_in_my_departments(event_id)
    or exists (select 1 from event_booths eb where eb.event_id = event_photos.event_id and is_booth_leader(eb.id))
  );

drop policy if exists event_photos_insert on event_photos;
create policy event_photos_insert on event_photos for insert to authenticated
  with check (
    is_admin()
    or event_in_my_departments(event_id)
    or (booth_id is not null and is_booth_leader(booth_id))
  );

drop policy if exists event_photos_delete on event_photos;
create policy event_photos_delete on event_photos for delete to authenticated
  using (is_admin() or uploaded_by = auth.uid());

-- ------------------------------------------------------------
-- E) Form builder
--    Admins design forms; the public fills them in at /f/<slug>;
--    accepted responses are pushed to the configured destination.
-- ------------------------------------------------------------
create table if not exists forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  slug text not null unique,
  accent_color text not null default '#2563eb',
  cover_image_url text,
  is_active boolean not null default true,
  -- where an accepted response goes: 'volunteers', 'event_participants' or 'none'
  destination text not null default 'volunteers'
    check (destination in ('volunteers', 'event_participants', 'none')),
  destination_event_id uuid references events (id) on delete set null,
  destination_department_id uuid references departments (id) on delete set null,
  success_message text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_forms_updated_at on forms;
create trigger trg_forms_updated_at before update on forms
  for each row execute function set_updated_at();

create table if not exists form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms (id) on delete cascade,
  label text not null,
  help_text text,
  -- text | textarea | email | phone | number | date | select | radio | checkbox
  field_type text not null default 'text',
  options jsonb not null default '[]',
  is_required boolean not null default false,
  position integer not null default 0,
  -- optional mapping onto a real volunteer column, so accepted responses
  -- can be turned into records automatically
  maps_to text,
  created_at timestamptz not null default now()
);

create index if not exists form_fields_form_idx on form_fields (form_id, position);

create table if not exists form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms (id) on delete cascade,
  answers jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists form_responses_form_idx on form_responses (form_id, status);

alter table forms enable row level security;
alter table form_fields enable row level security;
alter table form_responses enable row level security;

-- the public form page must read the form + its fields, and submit a response
grant select on table forms to anon;
grant select on table form_fields to anon;
grant insert on table form_responses to anon;
grant select, insert, update, delete on table forms to authenticated;
grant select, insert, update, delete on table form_fields to authenticated;
grant select, insert, update, delete on table form_responses to authenticated;

drop policy if exists forms_public_select on forms;
create policy forms_public_select on forms for select to anon using (is_active);

drop policy if exists forms_select on forms;
create policy forms_select on forms for select to authenticated using (true);

drop policy if exists forms_write on forms;
create policy forms_write on forms for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists form_fields_public_select on form_fields;
create policy form_fields_public_select on form_fields for select to anon
  using (exists (select 1 from forms f where f.id = form_fields.form_id and f.is_active));

drop policy if exists form_fields_select on form_fields;
create policy form_fields_select on form_fields for select to authenticated using (true);

drop policy if exists form_fields_write on form_fields;
create policy form_fields_write on form_fields for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists form_responses_public_insert on form_responses;
create policy form_responses_public_insert on form_responses for insert to anon
  with check (
    status = 'pending'
    and exists (select 1 from forms f where f.id = form_responses.form_id and f.is_active)
  );

drop policy if exists form_responses_auth_insert on form_responses;
create policy form_responses_auth_insert on form_responses for insert to authenticated
  with check (status = 'pending');

drop policy if exists form_responses_admin_select on form_responses;
create policy form_responses_admin_select on form_responses for select to authenticated
  using (is_admin());

drop policy if exists form_responses_admin_update on form_responses;
create policy form_responses_admin_update on form_responses for update to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists form_responses_admin_delete on form_responses;
create policy form_responses_admin_delete on form_responses for delete to authenticated
  using (is_admin());
