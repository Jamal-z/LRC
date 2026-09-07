-- ============================================================
-- 018: Form design system + a fuller interview record
-- Run after 017.
--
-- A) Forms get a full visual designer: a `design` jsonb blob holding
--    background / card / question / typography choices, plus an escape
--    hatch for a hand-written CSS + HTML skin uploaded by an admin.
-- B) Interviews grow the fields the committee actually fills in on
--    paper: per-criterion notes, spoken languages as free text, past
--    volunteering, other talents, whether they applied before, and a
--    final /10 verdict. They can also be started from a form response.
-- ============================================================

-- ------------------------------------------------------------
-- A) Form design
-- ------------------------------------------------------------

-- Everything the public form's look is driven by. Kept as one jsonb so
-- new design controls never need another migration; `form-design.ts`
-- fills in any key that's missing.
alter table forms add column if not exists design jsonb not null default '{}';

-- Escape hatch: an admin can upload an .html file and we keep its <style>
-- here and its markup in custom_header_html. Scripts are stripped client
-- side before saving — this is never executed, only rendered as markup.
alter table forms add column if not exists custom_css text;
alter table forms add column if not exists custom_header_html text;

-- ------------------------------------------------------------
-- B) Interviews
-- ------------------------------------------------------------

-- one short note per scored criterion, keyed the same way as `ratings`
alter table interviews add column if not exists criteria_notes jsonb not null default '{}';

-- languages are written down, not scored — Arabic fluency was dropped
alter table interviews add column if not exists languages text;

-- have they volunteered anywhere before, and doing what
alter table interviews add column if not exists volunteered_before boolean;
alter table interviews add column if not exists previous_volunteering text;

-- talents beyond the role they applied for (e.g. applied to teach Arabic
-- but also runs social media)
alter table interviews add column if not exists other_skills text;

-- did this person apply to the centre before this round
alter table interviews add column if not exists applied_before boolean;

-- the committee's own verdict, 1–10, independent of the criteria average
alter table interviews add column if not exists overall_rating integer
  check (overall_rating is null or (overall_rating between 1 and 10));

-- what they applied for, carried over from the form
alter table interviews add column if not exists applied_for text;

-- the form response this interview was started from, so the same
-- applicant is never opened twice
alter table interviews add column if not exists form_response_id uuid
  references form_responses (id) on delete set null;

create unique index if not exists interviews_form_response_idx
  on interviews (form_response_id) where form_response_id is not null;

-- the old five-star Arabic criterion is now the free-text `languages` field
update interviews
set ratings = ratings - 'arabic' - 'other_languages'
where ratings ? 'arabic' or ratings ? 'other_languages';
