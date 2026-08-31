-- 0006: مخزن المرفقات الخاص + سياسات الوصول حسب مسار الجهة organization_id/initiative_id/file
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'initiative-attachments', 'initiative-attachments', false, 10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- القراءة: الإشراف والإدارة كل شيء، والجهة مجلد جهتها فقط
create policy att_storage_read on storage.objects for select to authenticated
  using (
    bucket_id = 'initiative-attachments'
    and (public.auth_role() in ('admin','supervisor')
         or (storage.foldername(name))[1] = public.auth_org()::text)
  );

-- الرفع: داخل مجلد الجهة فقط (الإشراف والإدارة بلا قيد مجلد)
create policy att_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'initiative-attachments'
    and (public.auth_role() in ('admin','supervisor')
         or (storage.foldername(name))[1] = public.auth_org()::text)
  );

-- الحذف: المدير أو رافع الملف نفسه
create policy att_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'initiative-attachments'
    and (public.auth_role() = 'admin' or owner = auth.uid())
  );
