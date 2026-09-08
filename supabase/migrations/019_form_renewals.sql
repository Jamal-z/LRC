-- ============================================================
-- 019: Volunteer renewal forms
-- Run after 018.
--
-- A renewal form is filled in by people who are already on the roster.
-- Accepting one must NOT create a second volunteer: it merges the answers
-- into the record we already have — filling blanks, leaving identical
-- values alone, and updating changed ones while keeping a trail of what
-- was replaced.
-- ============================================================

-- ------------------------------------------------------------
-- A) The new destination
-- ------------------------------------------------------------

alter table forms drop constraint if exists forms_destination_check;
alter table forms add constraint forms_destination_check
  check (destination in ('volunteers', 'event_participants', 'renew_volunteers', 'none'));

-- ------------------------------------------------------------
-- B) Tracking what a review actually did
-- ------------------------------------------------------------

-- which volunteer this response ended up touching, so you can jump
-- straight from a response to the person it renewed
alter table form_responses add column if not exists volunteer_id uuid
  references volunteers (id) on delete set null;

-- a human-readable summary of the merge ("Filled major. Phone 078… -> 079…"),
-- or the reason a renewal could not be matched to anyone
alter table form_responses add column if not exists review_note text;

create index if not exists form_responses_volunteer_idx
  on form_responses (volunteer_id) where volunteer_id is not null;

-- ------------------------------------------------------------
-- C) When each volunteer last renewed
-- ------------------------------------------------------------

alter table volunteer_private add column if not exists renewed_at timestamptz;

comment on column volunteer_private.renewed_at is
  'Set every time an accepted renewal-form response is merged into this volunteer.';
