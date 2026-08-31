-- 0008: تحصين — سحب تنفيذ الدوال من PUBLIC/anon وتثبيت search_path (توصيات فاحص الأمان)

-- دوال التريغر لا تُستدعى عبر REST إطلاقًا
revoke execute on function public.assign_initiative_number() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.write_audit() from public, anon, authenticated;
revoke execute on function public.guard_initiative_update() from public, anon, authenticated;
revoke execute on function public.prevent_delete_after_submit() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- دوال RLS المساعدة: للمسجلين فقط (تُستدعى ضمن السياسات بدور المستعلم)
revoke execute on function public.auth_role() from public, anon;
grant execute on function public.auth_role() to authenticated;
revoke execute on function public.auth_org() from public, anon;
grant execute on function public.auth_org() to authenticated;
revoke execute on function public.can_see_initiative(uuid) from public, anon;
grant execute on function public.can_see_initiative(uuid) to authenticated;
revoke execute on function public.allowed_transition(text, text) from public, anon;
grant execute on function public.allowed_transition(text, text) to authenticated;

-- دوال الأعمال: للمسجلين فقط
revoke execute on function public.change_initiative_status(uuid, text, text, text) from public, anon;
grant execute on function public.change_initiative_status(uuid, text, text, text) to authenticated;
revoke execute on function public.clear_password_flag() from public, anon;
grant execute on function public.clear_password_flag() to authenticated;

-- تثبيت search_path للدوال المنبه عليها
alter function public.touch_updated_at() set search_path = public;
alter function public.allowed_transition(text, text) set search_path = public;
alter function public.guard_initiative_update() set search_path = public;
alter function public.prevent_delete_after_submit() set search_path = public;
