-- ============================================================
-- 006: Seed data (departments + default tags)
-- Safe to re-run: uses ON CONFLICT DO NOTHING.
-- ============================================================

insert into departments (name, description, requires_monthly_evaluation) values
  ('Field Volunteering', 'On-the-ground volunteering, mainly evaluated through event/booth participation.', false),
  ('Social Media Team', 'Manages the center''s social media presence and content.', true),
  ('Graphic Design Team', 'Designs visual materials for the center.', true),
  ('Funding and Public Relations Team', 'Handles fundraising, sponsors, and public relations.', true),
  ('Arabic Teaching for Foreigners Team', 'Teaches Arabic language classes to foreigners.', true),
  ('Translation and News Editing Team', 'Translation and news editing for the center.', true)
on conflict (name) do nothing;

insert into tags (name, color) values
  ('Future Leader', '#2563eb'),
  ('Reliable', '#16a34a'),
  ('Creative', '#c084fc'),
  ('Good Communicator', '#0ea5e9'),
  ('Needs Training', '#f59e0b'),
  ('Event Volunteer', '#6366f1'),
  ('Social Media Talent', '#ec4899'),
  ('Translation Talent', '#14b8a6'),
  ('Strong Commitment', '#0d9488'),
  ('Needs Follow-up', '#ef4444'),
  ('Excellent Teamwork', '#22c55e'),
  ('Good with Children', '#f97316'),
  ('Good Public Speaker', '#8b5cf6')
on conflict (name) do nothing;
