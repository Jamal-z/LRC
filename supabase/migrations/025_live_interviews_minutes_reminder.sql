-- ============================================================
-- 025 — Live interview rooms & the missing-minutes reminder
-- Run after 024.
--
-- A) Two interviewers can fill in the same interview from two
--    laptops and see each other's typing before anyone saves. The
--    page talks over a *private* Supabase Realtime channel named
--    `interview:<id>`; these policies let only the committee
--    (is_admin) join, send or listen, so candidates' details never
--    go over a channel anyone else could open.
--
-- B) A booth meeting that ended 5 hours ago with no minutes yet
--    sends its booth leaders one reminder. pg_cron checks every
--    15 minutes.
-- ============================================================

-- ------------------------------------------------------------
-- A) Realtime authorization for interview rooms
-- ------------------------------------------------------------
drop policy if exists interview_rooms_receive on realtime.messages;
create policy interview_rooms_receive on realtime.messages
  for select to authenticated
  using (realtime.topic() like 'interview:%' and public.is_admin());

drop policy if exists interview_rooms_send on realtime.messages;
create policy interview_rooms_send on realtime.messages
  for insert to authenticated
  with check (realtime.topic() like 'interview:%' and public.is_admin());

-- ------------------------------------------------------------
-- B) Missing-minutes reminder
-- ------------------------------------------------------------

-- one row per meeting once its reminder went out, so it is sent once.
-- Kept apart from booth_meetings so sending it does not bump
-- updated_at or write a "meeting updated" line to the activity log.
create table if not exists meeting_minutes_reminders (
  meeting_id uuid primary key references booth_meetings (id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table meeting_minutes_reminders enable row level security;
revoke all on table meeting_minutes_reminders from anon, authenticated;

create or replace function remind_missing_meeting_minutes() returns integer
language plpgsql security definer set search_path = public as $$
declare
  m record;
  sent integer := 0;
begin
  for m in
    select bm.id, bm.title, bm.booth_id, eb.name as booth_name
    from booth_meetings bm
    left join event_booths eb on eb.id = bm.booth_id
    where bm.status = 'scheduled'
      and not exists (select 1 from meeting_minutes_reminders r where r.meeting_id = bm.id)
      -- ended at least 5 hours ago …
      and bm.scheduled_at
          + make_interval(mins => coalesce(bm.planned_duration_minutes, 60))
          + interval '5 hours' <= now()
      -- … but not long before this job existed, so switching it on does
      -- not flood leaders with every old meeting at once
      and bm.scheduled_at
          + make_interval(mins => coalesce(bm.planned_duration_minutes, 60))
          > now() - interval '2 days'
  loop
    insert into meeting_minutes_reminders (meeting_id) values (m.id)
    on conflict (meeting_id) do nothing;
    if not found then
      continue;
    end if;

    insert into notifications (user_id, title, message, type, related_entity_type, related_entity_id)
    select bl.user_id,
      'Meeting minutes missing',
      coalesce(m.booth_name, 'Booth') || ' — ' || m.title
        || ' · it ended 5 hours ago, please write the minutes',
      'meeting_minutes_missing',
      'meeting',
      m.id
    from booth_leaders bl
    join profiles p on p.id = bl.user_id and p.is_active
    where bl.booth_id = m.booth_id;

    sent := sent + 1;
  end loop;

  return sent;
end;
$$;

revoke all on function remind_missing_meeting_minutes() from public, anon, authenticated;

-- pg_cron ships with Supabase; this switches it on if it is not already
create extension if not exists pg_cron with schema pg_catalog;

-- scheduling under the same name again just updates the job
select cron.schedule(
  'lrc-meeting-minutes-reminder',
  '*/15 * * * *',
  $$select public.remind_missing_meeting_minutes()$$
);
