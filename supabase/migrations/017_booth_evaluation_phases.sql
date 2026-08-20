-- ============================================================
-- 017: Booth evaluations split into two phases
-- Run after 016.
--
-- A booth leader now scores each volunteer TWICE:
--
--   preparation (before)  meeting attendance · task completion · communication
--   post_event  (after)   performance · teamwork · communication ·
--                         attitude with people · punctuality · shifts · flags
--
-- Communication is deliberately rated in BOTH phases (how they communicated
-- while preparing is a different thing from how they handled the day itself),
-- which is why a phase needs its own row rather than extra columns on one row.
--
-- Department/team event evaluations and the monthly evaluations are NOT
-- affected — they stay single-phase and simply keep phase = 'post_event'.
-- ============================================================

-- ------------------------------------------------------------
-- A) The phase marker.
--
-- Defaulting to 'post_event' backfills every existing row correctly: today's
-- evaluations are all filled in after the event (they carry shifts and the
-- talented / needs-follow-up flags, which are post-event by definition).
-- ------------------------------------------------------------
alter table event_evaluations
  add column if not exists phase text not null default 'post_event'
    check (phase in ('preparation', 'post_event'));

-- ------------------------------------------------------------
-- B) The two new criteria.
--
-- `commitment_rating` already exists from 002 and was never wired up, so
-- punctuality reuses it instead of adding a third column.
-- ------------------------------------------------------------
alter table event_evaluations
  add column if not exists task_completion_rating smallint
    check (task_completion_rating between 1 and 5);

alter table event_evaluations
  add column if not exists attitude_rating smallint
    check (attitude_rating between 1 and 5);

comment on column event_evaluations.task_completion_rating is
  'Preparation phase: did they finish the tasks assigned to them before the event';
comment on column event_evaluations.attitude_rating is
  'Post-event phase: how respectfully they dealt with volunteers and students';
comment on column event_evaluations.commitment_rating is
  'Post-event phase: punctuality and sticking to the agreed times';

-- ------------------------------------------------------------
-- C) One row per phase.
--
-- The old constraint allowed a single evaluation per (event, volunteer,
-- evaluator) which now blocks the second phase. Look the name up rather than
-- hardcoding it, so this works whether or not Postgres auto-named it.
-- ------------------------------------------------------------
do $$
declare
  con_name text;
begin
  select c.conname into con_name
  from pg_constraint c
  where c.conrelid = 'event_evaluations'::regclass
    and c.contype = 'u'
    and (
      select array_agg(a.attname::text order by a.attname)
      from unnest(c.conkey) k
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
    ) = array['evaluated_by', 'event_id', 'volunteer_id'];

  if con_name is not null then
    execute format('alter table event_evaluations drop constraint %I', con_name);
  end if;
end $$;

-- add the phase-aware replacement (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'event_evaluations'::regclass
      and conname = 'event_evaluations_event_volunteer_evaluator_phase_key'
  ) then
    alter table event_evaluations
      add constraint event_evaluations_event_volunteer_evaluator_phase_key
      unique (event_id, volunteer_id, evaluated_by, phase);
  end if;
end $$;

create index if not exists event_evaluations_booth_phase_idx
  on event_evaluations (booth_id, phase);
