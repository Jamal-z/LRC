-- ============================================================
-- 005: Storage buckets (avatars, attachments)
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- avatars: public read (so <img> tags work without signed URLs), authenticated write
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

create policy avatars_auth_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');

create policy avatars_auth_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

create policy avatars_auth_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars');

-- attachments: internal staff only (all authenticated profiles are internal staff in v1)
create policy attachments_auth_read on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

create policy attachments_auth_write on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

create policy attachments_auth_update on storage.objects for update to authenticated
  using (bucket_id = 'attachments') with check (bucket_id = 'attachments');

create policy attachments_auth_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments');
