-- ============================================================
-- 020: ASCII-only form slugs
-- Run after 019.
--
-- Slugs used to keep whatever letters the title had, so an Arabic title
-- produced a URL like /f/تسيت-0-mb9i. Browsers percent-encode that into a
-- wall of %D8%AA…, and reverse proxies, link previewers and QR readers
-- handle it inconsistently — it 404s in front of real users.
--
-- New slugs are transliterated to ASCII in the app (src/lib/slug.ts). This
-- rewrites the ones already in the database.
-- ============================================================

-- Any slug outside [a-z0-9-] becomes a short, stable, unique id-based slug.
-- Existing links to those forms were already broken, so nothing working is lost.
update forms
set slug = 'form-' || substr(replace(id::text, '-', ''), 1, 10)
where slug !~ '^[a-z0-9-]+$';

-- Keep it that way: the database now refuses a non-ASCII slug outright,
-- so this class of broken link cannot come back through another code path.
alter table forms drop constraint if exists forms_slug_ascii_check;
alter table forms add constraint forms_slug_ascii_check
  check (slug ~ '^[a-z0-9-]+$');
