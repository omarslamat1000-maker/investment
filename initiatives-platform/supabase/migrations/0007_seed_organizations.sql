-- 0007: الجهات الأولية — تُضاف جهات جديدة مستقبلًا من شاشة الإدارة لا من الكود
insert into public.organizations (name_ar, code) values
  ('الوكالة المساعدة للطرق', 'ROADS'),
  ('الوكالة المساعدة للحدائق والأنسنة', 'PARKS')
on conflict (code) do nothing;
