-- ============================================================
-- 022: A closed form says it is closed
-- Run after 021.
--
-- Closing a form used to hide the row itself from visitors, so somebody
-- opening the link was told "النموذج غير موجود" — as if the link were wrong
-- and their registration had never existed. The row is now readable while
-- closed so the page can say the round is over; its questions stay hidden
-- and a response still cannot be inserted, which is what closing has to mean.
-- ============================================================

drop policy if exists forms_public_select on forms;
create policy forms_public_select on forms for select to anon using (true);

comment on policy forms_public_select on forms is
  'A form is reachable by link, open or closed. Only its title/description are
   exposed here — form_fields stays gated on is_active, so a closed form shows
   no questions, and form_responses_public_insert blocks the submission itself.';
