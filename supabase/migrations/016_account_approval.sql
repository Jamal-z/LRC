-- ============================================================
-- 016: Approve accounts from the Users page instead of by email
-- Run after 015.
--
-- Nothing here fights Supabase Auth. Supabase still owns the password and
-- the session; we only add an application-level gate on top: a brand-new
-- account starts as pending (profiles.is_active = false) and stays useless
-- until an admin flips it from Users & Roles.
--
-- Turn "Confirm email" OFF in Authentication → Sign In / Providers → Email;
-- this approval flow replaces it.
-- ============================================================

-- --------------------------------------------------------------
-- A) Every new signup lands as pending.
--
-- Deliberately NOT driven by client metadata — a crafted signup request
-- cannot ask to be born active. The Users page activates accounts it
-- creates itself, right after the signup call.
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
    safe_role := 'booth_leader';
  end if;

  insert into profiles (id, full_name, email, role, notes, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    safe_role,
    new.raw_user_meta_data ->> 'notes',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- --------------------------------------------------------------
-- B) The approval gate itself.
-- is_admin() / is_department_leader() / is_booth_leader() already require
-- is_active, so a pending account has no powers. What is left are the
-- policies that trust any logged-in user; those now ask for approval too.
-- --------------------------------------------------------------
create or replace function is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active);
$$;

-- a pending user must still be able to read their own row, otherwise the app
-- cannot tell "waiting for approval" apart from "account deleted"
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using (is_approved() or id = auth.uid());

drop policy if exists departments_select on departments;
create policy departments_select on departments for select to authenticated
  using (is_approved());

drop policy if exists department_leaders_select on department_leaders;
create policy department_leaders_select on department_leaders for select to authenticated
  using (is_approved());

drop policy if exists volunteers_select on volunteers;
create policy volunteers_select on volunteers for select to authenticated
  using (is_approved());

drop policy if exists volunteer_departments_select on volunteer_departments;
create policy volunteer_departments_select on volunteer_departments for select to authenticated
  using (is_approved());

drop policy if exists tags_select on tags;
create policy tags_select on tags for select to authenticated
  using (is_approved());

-- --------------------------------------------------------------
-- C) Nobody approves themselves.
-- profiles_update lets a user edit their own row (name, avatar), so the
-- approval flag needs its own guard or a pending account could simply
-- PATCH itself active.
-- --------------------------------------------------------------
create or replace function prevent_self_activation() returns trigger
language plpgsql as $$
begin
  if new.is_active is distinct from old.is_active and not is_admin() then
    raise exception 'Only an admin can activate or deactivate an account';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_activation on profiles;
create trigger trg_prevent_self_activation before update of is_active on profiles
  for each row execute function prevent_self_activation();

-- --------------------------------------------------------------
-- D) Tell the committee a request is waiting.
-- --------------------------------------------------------------
create or replace function notify_pending_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_active then
    perform notify_admins(
      'New account waiting for approval',
      new.full_name || ' (' || new.email || ') signed up',
      'user_pending',
      'user',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_pending_account on profiles;
create trigger trg_notify_pending_account
  after insert on profiles
  for each row execute function notify_pending_account();

-- --------------------------------------------------------------
-- E) Existing accounts keep working — approve everyone already in the system.
--
-- One-time backfill. Do NOT re-run this file once people start signing up,
-- or it will approve everyone still waiting in the queue.
-- --------------------------------------------------------------
update profiles set is_active = true where is_active is false;
