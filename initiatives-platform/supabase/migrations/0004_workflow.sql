-- 0004: دورة عمل المبادرات — مصفوفة الانتقالات، دالة الانتقال الوحيدة، الحُرّاس، والتدقيق
-- كل تغيير حالة يمر حصريًا عبر change_initiative_status (تسجيل تلقائي + إشعارات + أسباب إلزامية)

-- حارس: منع تغيير الحالة مباشرة، ومنع تغيير الملكية والمشرف من غير المخولين
create or replace function public.guard_initiative_update() returns trigger
language plpgsql as $$
begin
  if new.current_status is distinct from old.current_status
     and coalesce(current_setting('app.allow_status_change', true), '') <> 'on' then
    raise exception 'تغيير حالة المبادرة يتم حصريًا عبر دالة change_initiative_status';
  end if;
  if (new.organization_id is distinct from old.organization_id
      or new.created_by is distinct from old.created_by)
     and coalesce(public.auth_role(), 'admin') <> 'admin' then
    raise exception 'لا يمكن تغيير الجهة المالكة أو منشئ المبادرة';
  end if;
  if new.assigned_supervisor_id is distinct from old.assigned_supervisor_id
     and coalesce(public.auth_role(), 'admin') not in ('admin','supervisor') then
    raise exception 'تعيين المشرف من صلاحيات الإشراف والإدارة';
  end if;
  return new;
end $$;
create trigger initiatives_guard before update on public.initiatives
for each row execute function public.guard_initiative_update();

-- منع الحذف النهائي بعد التقديم — الأرشفة بدل الحذف
create or replace function public.prevent_delete_after_submit() returns trigger
language plpgsql as $$
begin
  if old.current_status <> 'draft' then
    raise exception 'لا يُحذف ما قُدّم للمراجعة — استخدم الأرشفة';
  end if;
  return old;
end $$;
create trigger initiatives_no_delete before delete on public.initiatives
for each row execute function public.prevent_delete_after_submit();

-- مصفوفة الانتقالات المعتمدة (لا تجاوز للتسلسل)
create or replace function public.allowed_transition(p_from text, p_to text) returns boolean
language sql immutable as $$
  select (p_from, p_to) in (
    ('draft','submitted'),
    ('submitted','under_review'),
    ('resubmitted','under_review'),
    ('under_review','returned'),
    ('under_review','initially_accepted'),
    ('under_review','rejected'),
    ('returned','resubmitted'),
    ('initially_accepted','approved'),
    ('initially_accepted','rejected'),
    ('approved','planning'),
    ('planning','in_progress'),
    ('in_progress','on_hold'),
    ('in_progress','completed'),
    ('on_hold','in_progress'),
    ('on_hold','archived'),
    ('completed','archived'),
    ('rejected','archived')
  )
$$;

-- دالة الانتقال الوحيدة: صلاحيات حسب الدور + أسباب إلزامية + سجل + إشعارات
create or replace function public.change_initiative_status(
  p_initiative uuid,
  p_new_status text,
  p_reason text default null,
  p_platform_status text default null
) returns public.initiatives
language plpgsql security definer set search_path = public as $$
declare
  v_ini initiatives%rowtype;
  v_old text;
  v_role text := auth_role();
  v_uid uuid := auth.uid();
begin
  if v_role is null then raise exception 'لا صلاحية — الحساب غير نشط أو غير مسجل'; end if;

  select * into v_ini from initiatives where id = p_initiative for update;
  if not found then raise exception 'المبادرة غير موجودة'; end if;
  v_old := v_ini.current_status;

  -- صلاحيات الانتقال حسب الدور
  if v_role = 'agency_user' then
    if v_ini.organization_id is distinct from auth_org() then
      raise exception 'لا صلاحية على مبادرات جهة أخرى';
    end if;
    if not ((v_old = 'draft' and p_new_status = 'submitted')
         or (v_old = 'returned' and p_new_status = 'resubmitted')) then
      raise exception 'صلاحية الجهة: التقديم وإعادة التقديم فقط';
    end if;
  elsif v_role = 'supervisor' then
    if p_new_status in ('approved','archived') then
      raise exception 'الاعتماد والأرشفة من صلاحيات مدير النظام';
    end if;
  elsif v_role <> 'admin' then
    raise exception 'لا صلاحية';
  end if;

  if not allowed_transition(v_old, p_new_status) then
    raise exception 'انتقال غير مسموح: % ← %', v_old, p_new_status;
  end if;
  if p_new_status in ('returned','rejected','on_hold') and coalesce(trim(p_reason), '') = '' then
    raise exception 'السبب إلزامي عند الإعادة أو الرفض أو الإيقاف';
  end if;

  perform set_config('app.allow_status_change', 'on', true);
  update initiatives set
    current_status = p_new_status,
    details = case when p_platform_status is null then details
                   else jsonb_set(details, '{platform_status}', to_jsonb(p_platform_status)) end,
    submitted_at = case when p_new_status in ('submitted','resubmitted') then now() else submitted_at end,
    approved_at  = case when p_new_status = 'approved' then now() else approved_at end,
    archived_at  = case when p_new_status = 'archived' then now() else archived_at end
  where id = p_initiative
  returning * into v_ini;
  perform set_config('app.allow_status_change', '', true);

  insert into initiative_status_history (initiative_id, previous_status, new_status, action, reason, changed_by)
  values (p_initiative, v_old, p_new_status, v_old || '→' || p_new_status, nullif(trim(p_reason), ''), v_uid);

  -- إشعارات داخل المنصة للجهة والمشرف
  if v_ini.created_by is distinct from v_uid then
    insert into notifications (user_id, initiative_id, title, message)
    values (v_ini.created_by, p_initiative, 'تحديث حالة مبادرة',
            v_ini.title || ' — الحالة الجديدة: ' || p_new_status
            || coalesce('. السبب: ' || nullif(trim(p_reason), ''), ''));
  end if;
  if v_ini.assigned_supervisor_id is not null and v_ini.assigned_supervisor_id is distinct from v_uid then
    insert into notifications (user_id, initiative_id, title, message)
    values (v_ini.assigned_supervisor_id, p_initiative, 'تحديث حالة مبادرة',
            v_ini.title || ' — ' || v_old || ' ← ' || p_new_status);
  elsif p_new_status in ('submitted','resubmitted') then
    insert into notifications (user_id, initiative_id, title, message)
    select p.id, p_initiative, 'مبادرة بانتظار المراجعة', v_ini.title
    from profiles p where p.role = 'supervisor' and p.is_active and p.id is distinct from v_uid;
  end if;

  return v_ini;
end $$;
revoke execute on function public.change_initiative_status(uuid, text, text, text) from anon;

-- سجل تدقيق عام (details تُستثنى لتفادي تضخيم السجل بصور Base64)
create or replace function public.write_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) - 'details' end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) - 'details' end;
  v_id text := case when tg_op = 'DELETE' then (to_jsonb(old)->>'id') else (to_jsonb(new)->>'id') end;
begin
  insert into audit_logs (user_id, entity_type, entity_id, action, old_values, new_values)
  values (auth.uid(), tg_table_name, v_id, tg_op, v_old, v_new);
  return coalesce(new, old);
end $$;

create trigger audit_initiatives after insert or update or delete on public.initiatives
for each row execute function public.write_audit();
create trigger audit_stages after insert or update or delete on public.initiative_stages
for each row execute function public.write_audit();
create trigger audit_comments after insert or delete on public.initiative_comments
for each row execute function public.write_audit();
create trigger audit_attachments after insert or delete on public.attachments
for each row execute function public.write_audit();
create trigger audit_profiles after insert or update on public.profiles
for each row execute function public.write_audit();
create trigger audit_organizations after insert or update on public.organizations
for each row execute function public.write_audit();
