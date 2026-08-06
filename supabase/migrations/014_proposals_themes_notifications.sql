-- ============================================================
-- 014: Booth proposals, form theming, richer notifications
-- Run after 013.
-- ============================================================

-- ------------------------------------------------------------
-- A) Booth proposals — a booth leader uploads their plan and asks
--    for the supplies they need; the committee gets notified.
-- ------------------------------------------------------------
create table if not exists booth_proposals (
  id uuid primary key default gen_random_uuid(),
  booth_id uuid not null references event_booths (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  title text not null,
  notes text,
  requested_items text,
  file_url text,
  file_path text,
  file_name text,
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'rejected')),
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booth_proposals_booth_idx on booth_proposals (booth_id);
create index if not exists booth_proposals_event_idx on booth_proposals (event_id);

drop trigger if exists trg_booth_proposals_updated_at on booth_proposals;
create trigger trg_booth_proposals_updated_at before update on booth_proposals
  for each row execute function set_updated_at();

alter table booth_proposals enable row level security;
revoke all on table booth_proposals from anon;
grant select, insert, update, delete on table booth_proposals to authenticated;

drop policy if exists booth_proposals_select on booth_proposals;
create policy booth_proposals_select on booth_proposals for select to authenticated
  using (
    is_admin()
    or is_booth_leader(booth_id)
    or event_in_my_departments(event_id)
  );

drop policy if exists booth_proposals_insert on booth_proposals;
create policy booth_proposals_insert on booth_proposals for insert to authenticated
  with check (is_admin() or is_booth_leader(booth_id));

drop policy if exists booth_proposals_update on booth_proposals;
create policy booth_proposals_update on booth_proposals for update to authenticated
  using (is_admin() or is_booth_leader(booth_id))
  with check (is_admin() or is_booth_leader(booth_id));

drop policy if exists booth_proposals_delete on booth_proposals;
create policy booth_proposals_delete on booth_proposals for delete to authenticated
  using (is_admin() or created_by = auth.uid());

-- ------------------------------------------------------------
-- B) Form theming — the centre's palette is white/blue, so forms
--    get a light theme by default with an optional cover image.
-- ------------------------------------------------------------
alter table forms add column if not exists theme text not null default 'light';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'forms_theme_check'
  ) then
    alter table forms add constraint forms_theme_check
      check (theme in ('light', 'soft', 'gradient', 'dark'));
  end if;
end $$;

-- existing forms were rendered on the dark navy background
update forms set theme = 'light' where theme is null;

-- ------------------------------------------------------------
-- C) Notifications for the committee
-- ------------------------------------------------------------

-- helper: every active admin except the person who triggered the action
create or replace function notify_admins(
  p_title text,
  p_message text,
  p_type text,
  p_entity_type text,
  p_entity_id uuid
) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, title, message, type, related_entity_type, related_entity_id)
  select p.id, p_title, p_message, p_type, p_entity_type, p_entity_id
  from profiles p
  where p.role in ('super_admin', 'admin')
    and p.is_active
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
$$;

-- a booth leader submitted a proposal / supply request
create or replace function notify_booth_proposal() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  booth_name text;
  event_name text;
begin
  select eb.name, e.name into booth_name, event_name
  from event_booths eb join events e on e.id = eb.event_id
  where eb.id = new.booth_id;

  perform notify_admins(
    'New booth proposal',
    coalesce(booth_name, 'A booth') || ' — ' || coalesce(event_name, 'event') || ': ' || new.title,
    'booth_proposal',
    'booth_proposal',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_booth_proposal on booth_proposals;
create trigger trg_notify_booth_proposal
  after insert on booth_proposals
  for each row execute function notify_booth_proposal();

-- somebody filled in a public form
create or replace function notify_form_response() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  form_title text;
begin
  select title into form_title from forms where id = new.form_id;

  insert into notifications (user_id, title, message, type, related_entity_type, related_entity_id)
  select p.id,
         'New form response',
         coalesce(form_title, 'A form') || ' received a new submission',
         'form_response',
         'form',
         new.form_id
  from profiles p
  where p.role in ('super_admin', 'admin') and p.is_active;
  return new;
end;
$$;

drop trigger if exists trg_notify_form_response on form_responses;
create trigger trg_notify_form_response
  after insert on form_responses
  for each row execute function notify_form_response();

-- an event evaluation was submitted (replaces the 007 version so the
-- message mentions the event and the volunteer)
create or replace function notify_evaluation_submitted() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  volunteer_name text;
  event_name text;
begin
  select full_name into volunteer_name from volunteers where id = new.volunteer_id;
  select name into event_name from events where id = new.event_id;

  perform notify_admins(
    'New evaluation submitted',
    coalesce(volunteer_name, 'A volunteer') || ' was evaluated for ' || coalesce(event_name, 'an event'),
    'evaluation_submitted',
    'event_evaluation',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_event_eval on event_evaluations;
create trigger trg_notify_event_eval
  after insert on event_evaluations
  for each row execute function notify_evaluation_submitted();

-- monthly evaluations keep their own message
create or replace function notify_monthly_evaluation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  volunteer_name text;
  dept_name text;
begin
  select full_name into volunteer_name from volunteers where id = new.volunteer_id;
  select name into dept_name from departments where id = new.department_id;

  perform notify_admins(
    'New monthly evaluation',
    coalesce(volunteer_name, 'A volunteer') || ' — ' || coalesce(dept_name, 'team'),
    'evaluation_submitted',
    'monthly_evaluation',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_monthly_eval on monthly_evaluations;
create trigger trg_notify_monthly_eval
  after insert on monthly_evaluations
  for each row execute function notify_monthly_evaluation();

-- a volunteer was terminated
create or replace function notify_volunteer_terminated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'archived' and old.status is distinct from 'archived' then
    perform notify_admins(
      'Volunteer terminated',
      new.full_name || ' was moved to Terminations',
      'volunteer_terminated',
      'volunteer',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_volunteer_terminated on volunteers;
create trigger trg_notify_volunteer_terminated
  after update of status on volunteers
  for each row execute function notify_volunteer_terminated();

-- a new event was created
create or replace function notify_event_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify_admins(
    'New event created',
    new.name || ' on ' || to_char(new.date, 'DD Mon YYYY'),
    'event_created',
    'event',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_event_created on events;
create trigger trg_notify_event_created
  after insert on events
  for each row execute function notify_event_created();
