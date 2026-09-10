-- ============================================================
-- 021: Remembered name matches (volunteer aliases)
-- Run after 020.
--
-- Matching a form response to a volunteer is guesswork whenever the two
-- were written in different scripts: "Mohammad Ilaiwi" and "محمد عليوي"
-- are the same person, but no amount of normalising proves it. The
-- comparison tools therefore *propose* cross-script matches and a human
-- confirms them. This table is where that confirmation is kept, so the
-- same name is never asked about twice.
--
-- `normalized` is what the app matches on; it is written by the client
-- (src/lib/names.ts normalizeName) and kept unique per volunteer so
-- confirming the same spelling twice is a no-op.
-- ============================================================

create table if not exists volunteer_aliases (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteers (id) on delete cascade,
  -- the alternative spelling exactly as it was written on the form
  name text not null,
  -- normalizeName(name) — the key everything is looked up by
  normalized text not null,
  -- free text: where this spelling came from ("Renewal 2026 form")
  source text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (volunteer_id, normalized)
);

create index if not exists volunteer_aliases_normalized_idx
  on volunteer_aliases (normalized);

alter table volunteer_aliases enable row level security;

grant select, insert, update, delete on table volunteer_aliases to authenticated;

-- everything that reads aliases lives on an admin-only page
drop policy if exists volunteer_aliases_admin_all on volunteer_aliases;
create policy volunteer_aliases_admin_all on volunteer_aliases for all to authenticated
  using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- Rejected proposals
-- ------------------------------------------------------------

-- The other half of a confirmation: "this person really is nobody on the
-- roster". Without somewhere to record it, the same wrong guess would be
-- offered for review again on every visit.
alter table form_responses add column if not exists match_dismissed boolean not null default false;

comment on column form_responses.match_dismissed is
  'Set when a reviewer confirmed this response belongs to nobody on the volunteer roster.';
