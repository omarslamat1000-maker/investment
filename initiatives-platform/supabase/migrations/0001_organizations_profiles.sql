-- 0001: الجهات والملفات الشخصية والأدوار + دوال RLS المساعدة
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  organization_id uuid references public.organizations(id),
  role text not null default 'agency_user'
    check (role in ('admin','supervisor','agency_user')),
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  -- تجاوزات صلاحيات الواجهة لكل حساب (سماح/منع فوق الدور)
  overrides jsonb not null default '{"grants":[],"denies":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_org_idx on public.profiles(organization_id);

-- دوال مساعدة لسياسات RLS — security definer كي لا تدور على سياسات profiles نفسها
create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() and is_active $$;

create or replace function public.auth_org() returns uuid
language sql stable security definer set search_path = public as
$$ select organization_id from public.profiles where id = auth.uid() and is_active $$;

-- إنشاء الملف الشخصي تلقائيًا عند تسجيل/دعوة مستخدم (الدور والجهة من الميتاداتا)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, organization_id, must_change_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'role','agency_user'),
    (select id from public.organizations where code = new.raw_user_meta_data->>'organization_code'),
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- تحديث updated_at تلقائيًا
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger organizations_touch before update on public.organizations
for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

-- إقفال علم "يجب تغيير كلمة المرور" لصاحب الحساب فقط
create or replace function public.clear_password_flag() returns void
language sql security definer set search_path = public as
$$ update public.profiles set must_change_password = false where id = auth.uid() $$;
revoke execute on function public.clear_password_flag() from anon;
