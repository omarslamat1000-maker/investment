-- 0009: سياسات app_store للمشاركة المجتمعية وبوابة الشركاء
-- - الشركاء (authenticated غير إداريين) يقدّمون طلبات على الفرص وتقارير ميدانية ويعدّلون بياناتها
-- - الزائر (anon) يرسل تأييدًا/تعليقًا ويقرأ التعليقات المعتمدة والمعرض والمحافظ والمبادرات المنشورة (بدون المسودات)
-- - لا تُمنح أي صلاحية حذف للزائر أو للشريك

-- طلبات الفرص والتقارير الميدانية: إدراج وتحديث لأي مستخدم موثّق (المراجعة والاعتماد تبقى للإدارة)
drop policy if exists app_store_partner_insert on public.app_store;
create policy app_store_partner_insert on public.app_store for insert to authenticated
  with check (store in ('needApplications', 'progressReports', 'comments'));

drop policy if exists app_store_partner_update on public.app_store;
create policy app_store_partner_update on public.app_store for update to authenticated
  using (store in ('needApplications', 'progressReports'))
  with check (store in ('needApplications', 'progressReports'));

-- الزائر: تأييد أو تعليق (يُنشر بعد المراجعة)، وقراءة التعليقات المعتمدة فقط
drop policy if exists app_store_anon_engage on public.app_store;
create policy app_store_anon_engage on public.app_store for insert to anon
  with check (store = 'comments' and coalesce(data->>'status', 'pending') in ('pending', 'approved') and coalesce(data->>'kind', 'comment') in ('support', 'comment'));

drop policy if exists app_store_public_engage on public.app_store;
create policy app_store_public_engage on public.app_store for select to anon
  using (
    (store = 'comments' and (data->>'kind' = 'support' or data->>'status' = 'approved'))
    or store in ('gallery', 'portfolios')
  );

-- المبادرات: قراءة عامة للمبادرات غير المسودة (صفحة المبادرة العامة وقسم المبادرات في الصفحة الرئيسية)
drop policy if exists ini_public_select on public.initiatives;
create policy ini_public_select on public.initiatives for select to anon
  using (coalesce(details->>'platform_status', current_status) <> 'draft');
