-- ============================================================
-- 008: University ID + Major fields for volunteers
-- ============================================================

alter table volunteers add column if not exists university_id text;
alter table volunteers add column if not exists major text;

create index if not exists volunteers_university_id_idx on volunteers (university_id);
