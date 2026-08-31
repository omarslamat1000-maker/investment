-- 0003: مراحل المبادرة، الملاحظات، المرفقات، سجل الحالات، الإشعارات، سجل التدقيق، والمخزن العام
create table if not exists public.initiative_stages (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  stage_name text not null,
  stage_order int not null default 1,
  status text not null default 'pending'
    check (status in ('pending','in_progress','done','skipped')),
  responsible_user_id uuid references public.profiles(id),
  planned_start_date date,
  planned_end_date date,
  progress_percentage numeric not null default 0
    check (progress_percentage >= 0 and progress_percentage <= 100),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stages_initiative_idx on public.initiative_stages(initiative_id, stage_order);

create table if not exists public.initiative_comments (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  comment text not null,
  comment_type text not null default 'note'
    check (comment_type in ('note','recommendation','return_reason','decision')),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_initiative_idx on public.initiative_comments(initiative_id, created_at);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size int check (file_size is null or file_size <= 10485760),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists attachments_initiative_idx on public.attachments(initiative_id);

create table if not exists public.initiative_status_history (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  previous_status text,
  new_status text not null,
  action text not null,
  reason text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists history_initiative_idx on public.initiative_status_history(initiative_id, created_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  initiative_id uuid references public.initiatives(id) on delete cascade,
  title text not null,
  message text default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, is_read, created_at);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  entity_type text not null,
  entity_id text,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_at_idx on public.audit_logs(created_at desc);

-- مخزن عام لبقية كيانات المنصة القائمة (المحافظ، الاحتياجات، الشركاء، المنافع...)
-- يبقي كامل وظائف المنصة تعمل سحابيًا دون إعادة بنائها جدولًا جدولًا
create table if not exists public.app_store (
  store text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (store, id)
);
create index if not exists app_store_store_idx on public.app_store(store);

create trigger stages_touch before update on public.initiative_stages
for each row execute function public.touch_updated_at();
