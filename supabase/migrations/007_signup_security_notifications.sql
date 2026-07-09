-- ============================================================
-- 007: Signup hardening + notification triggers
-- Run this in the Supabase SQL Editor (after 001–006).
-- ============================================================

-- --------------------------------------------------------------
-- A) Cap self-signup roles.
-- The app creates internal accounts from the Users page via auth signUp.
-- Metadata may request department_leader/booth_leader only; admin and
-- super_admin can NEVER come from client metadata — a super admin promotes
-- accounts afterwards from the UI (guarded by prevent_role_escalation).
-- --------------------------------------------------------------
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  safe_role user_role;
begin
  if requested_role in ('department_leader', 'booth_leader') then
    safe_role := requested_role::user_role;
  else
    safe_role := 'department_leader';
  end if;

  insert into profiles (id, full_name, email, role, notes)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    safe_role,
    new.raw_user_meta_data ->> 'notes'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- --------------------------------------------------------------
-- B) In-app notification triggers
-- --------------------------------------------------------------

-- Task assigned to a user
create or replace function notify_task_assigned() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to_user_id is not null
     and (tg_op = 'INSERT' or new.assigned_to_user_id is distinct from old.assigned_to_user_id)
     and new.assigned_to_user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  then
    insert into notifications (user_id, title, message, type, related_entity_type, related_entity_id)
    values (
      new.assigned_to_user_id,
      'New task assigned',
      new.title,
      'task_assigned',
      'task',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_task_assigned on tasks;
create trigger trg_notify_task_assigned
  after insert or update of assigned_to_user_id on tasks
  for each row execute function notify_task_assigned();

-- Booth leader assigned
create or replace function notify_booth_leader_assigned() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  booth_name text;
  event_name text;
begin
  select eb.name, e.name into booth_name, event_name
  from event_booths eb join events e on e.id = eb.event_id
  where eb.id = new.booth_id;

  if new.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into notifications (user_id, title, message, type, related_entity_type, related_entity_id)
    values (
      new.user_id,
      'You were assigned as booth leader',
      coalesce(booth_name, 'Booth') || ' — ' || coalesce(event_name, 'Event'),
      'booth_leader_assigned',
      'booth',
      new.booth_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_booth_leader on booth_leaders;
create trigger trg_notify_booth_leader
  after insert on booth_leaders
  for each row execute function notify_booth_leader_assigned();

-- Department leader assigned
create or replace function notify_department_leader_assigned() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dept_name text;
begin
  select name into dept_name from departments where id = new.department_id;

  if new.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into notifications (user_id, title, message, type, related_entity_type, related_entity_id)
    values (
      new.user_id,
      'You were assigned as department leader',
      coalesce(dept_name, 'Department'),
      'department_leader_assigned',
      'department',
      new.department_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_department_leader on department_leaders;
create trigger trg_notify_department_leader
  after insert on department_leaders
  for each row execute function notify_department_leader_assigned();

-- Evaluation submitted -> notify admins
create or replace function notify_evaluation_submitted() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  volunteer_name text;
begin
  select full_name into volunteer_name from volunteers where id = new.volunteer_id;

  insert into notifications (user_id, title, message, type, related_entity_type, related_entity_id)
  select p.id,
         'New evaluation submitted',
         coalesce(volunteer_name, 'A volunteer') || ' was evaluated',
         'evaluation_submitted',
         tg_table_name,
         new.id
  from profiles p
  where p.role in ('super_admin', 'admin')
    and p.is_active
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  return new;
end;
$$;

drop trigger if exists trg_notify_event_eval on event_evaluations;
create trigger trg_notify_event_eval
  after insert on event_evaluations
  for each row execute function notify_evaluation_submitted();

drop trigger if exists trg_notify_monthly_eval on monthly_evaluations;
create trigger trg_notify_monthly_eval
  after insert on monthly_evaluations
  for each row execute function notify_evaluation_submitted();
