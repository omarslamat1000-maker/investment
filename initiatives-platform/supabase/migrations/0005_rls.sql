-- 0005: سياسات أمان الصفوف RLS — الفصل الكامل بين الجهات وتقييد الأدوار في قاعدة البيانات نفسها
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.initiatives enable row level security;
alter table public.initiative_stages enable row level security;
alter table public.initiative_comments enable row level security;
alter table public.attachments enable row level security;
alter table public.initiative_status_history enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_store enable row level security;
alter table public.initiative_counters enable row level security; -- بلا سياسات: الدوال المعرِّفة فقط

-- الجهات: قراءة لكل مسجل، إدارة للمدير
create policy org_select on public.organizations for select to authenticated using (true);
create policy org_admin_write on public.organizations for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

-- الملفات الشخصية: كل مستخدم يرى ملفه، والإشراف والإدارة يرون الجميع؛ الكتابة للمدير
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.auth_role() in ('admin','supervisor'));
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

-- المبادرات
create policy ini_select on public.initiatives for select to authenticated
  using (public.auth_role() in ('admin','supervisor') or organization_id = public.auth_org());

create policy ini_insert on public.initiatives for insert to authenticated
  with check (
    public.auth_role() in ('admin','supervisor')
    or (public.auth_role() = 'agency_user'
        and organization_id = public.auth_org()
        and created_by = auth.uid()
        and current_status = 'draft')
  );

create policy ini_update_admin on public.initiatives for update to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

create policy ini_update_supervisor on public.initiatives for update to authenticated
  using (public.auth_role() = 'supervisor') with check (public.auth_role() = 'supervisor');

-- الجهة: تعديل مبادراتها فقط وفي حالتي المسودة والمعادة فقط
-- (تثبيت organization_id/created_by/الحالة يفرضه حارس التريغر في 0004)
create policy ini_update_agency on public.initiatives for update to authenticated
  using (public.auth_role() = 'agency_user'
         and organization_id = public.auth_org()
         and current_status in ('draft','returned'))
  with check (public.auth_role() = 'agency_user'
              and organization_id = public.auth_org()
              and current_status in ('draft','returned'));

create policy ini_delete on public.initiatives for delete to authenticated
  using (current_status = 'draft'
         and (public.auth_role() = 'admin'
              or (public.auth_role() = 'agency_user'
                  and organization_id = public.auth_org()
                  and created_by = auth.uid())));

-- رؤية المبادرة (تُستخدم في الجداول التابعة)
create or replace function public.can_see_initiative(p_initiative uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from initiatives i
    where i.id = p_initiative
      and (public.auth_role() in ('admin','supervisor') or i.organization_id = public.auth_org())
  )
$$;

-- المراحل: قراءة حسب رؤية المبادرة؛ الكتابة للإشراف والإدارة
create policy stages_select on public.initiative_stages for select to authenticated
  using (public.can_see_initiative(initiative_id));
create policy stages_write on public.initiative_stages for all to authenticated
  using (public.auth_role() in ('admin','supervisor'))
  with check (public.auth_role() in ('admin','supervisor'));

-- الملاحظات: الداخلية للإشراف والإدارة فقط — لا تصل حسابات الجهات إطلاقًا
create policy comments_select on public.initiative_comments for select to authenticated
  using (public.can_see_initiative(initiative_id)
         and (not is_internal or public.auth_role() in ('admin','supervisor')));
create policy comments_insert on public.initiative_comments for insert to authenticated
  with check (user_id = auth.uid()
              and public.can_see_initiative(initiative_id)
              and (not is_internal or public.auth_role() in ('admin','supervisor')));
create policy comments_admin_delete on public.initiative_comments for delete to authenticated
  using (public.auth_role() = 'admin');

-- سجلات المرفقات
create policy att_select on public.attachments for select to authenticated
  using (public.can_see_initiative(initiative_id));
create policy att_insert on public.attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_see_initiative(initiative_id));
create policy att_delete on public.attachments for delete to authenticated
  using (public.auth_role() = 'admin'
         or (uploaded_by = auth.uid()
             and exists (select 1 from initiatives i
                         where i.id = initiative_id
                           and i.current_status in ('draft','returned'))));

-- سجل الحالات: قراءة حسب الرؤية؛ لا كتابة من الواجهة (الدالة المعرِّفة فقط)
create policy history_select on public.initiative_status_history for select to authenticated
  using (public.can_see_initiative(initiative_id));

-- الإشعارات: كل مستخدم إشعاراته فقط (قراءة وتعليم كمقروء وحذف)
create policy notif_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- سجل التدقيق: قراءة للمدير فقط — غير قابل للتعديل من أي حساب واجهة
create policy audit_admin_select on public.audit_logs for select to authenticated
  using (public.auth_role() = 'admin');

-- المخزن العام لبقية كيانات المنصة: قراءة لكل مسجل، كتابة للإشراف والإدارة،
-- وقراءة عامة (anon) للمحتوى المنشور عمدًا في البوابة العامة فقط
create policy app_store_select on public.app_store for select to authenticated using (true);
create policy app_store_write on public.app_store for all to authenticated
  using (public.auth_role() in ('admin','supervisor'))
  with check (public.auth_role() in ('admin','supervisor'));
create policy app_store_public on public.app_store for select to anon
  using ((store = 'infrastructureNeeds' and data->>'status' = 'published')
      or (store = 'campaigns' and data->>'status' = 'active'));
