-- 0002: جدول المبادرات — كل حقول المنصة القائمة + حقول الحوكمة المطلوبة + الترقيم التلقائي
create table if not exists public.initiatives (
  id uuid primary key default gen_random_uuid(),
  initiative_number text unique,
  organization_id uuid not null references public.organizations(id),
  created_by uuid not null references public.profiles(id),
  assigned_supervisor_id uuid references public.profiles(id),
  current_status text not null default 'draft' check (current_status in
    ('draft','submitted','under_review','returned','resubmitted',
     'initially_accepted','approved','planning','in_progress','on_hold',
     'completed','rejected','archived')),
  current_stage text,
  progress_percentage numeric not null default 0
    check (progress_percentage >= 0 and progress_percentage <= 100),

  -- حقول قالب تعريف المبادرة القائمة في المنصة
  title text not null,
  summary text not null default '',
  problem text default '',
  category text,
  district text,
  location text,
  priority text default 'medium',
  beneficiary_groups text default '',
  beneficiaries integer,
  expected_impact text default '',
  cost_band text,
  duration_band text,
  readiness_level text,
  budget numeric,
  spent numeric default 0,
  funding_model text,
  start_date date,
  end_date date,
  -- بقية حقول المنصة الغنية (المواقع sites، الصورة، درجات المفاضلة، الحالة الداخلية...)
  details jsonb not null default '{}'::jsonb,

  submitted_at timestamptz,
  approved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists initiatives_org_idx on public.initiatives(organization_id);
create index if not exists initiatives_status_idx on public.initiatives(current_status);
create index if not exists initiatives_supervisor_idx on public.initiatives(assigned_supervisor_id);
create index if not exists initiatives_created_by_idx on public.initiatives(created_by);
create index if not exists initiatives_category_idx on public.initiatives(category);

-- الترقيم التلقائي الفريد INIT-YYYY-NNNN (عداد لكل سنة)
create table if not exists public.initiative_counters (
  year int primary key,
  counter int not null default 0
);

create or replace function public.assign_initiative_number() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  y int := extract(year from now())::int;
  n int;
begin
  if new.initiative_number is not null then return new; end if;
  insert into initiative_counters (year, counter) values (y, 1)
  on conflict (year) do update set counter = initiative_counters.counter + 1
  returning counter into n;
  new.initiative_number := 'INIT-' || y || '-' || lpad(n::text, 4, '0');
  return new;
end $$;

create trigger initiatives_number before insert on public.initiatives
for each row execute function public.assign_initiative_number();

create trigger initiatives_touch before update on public.initiatives
for each row execute function public.touch_updated_at();
