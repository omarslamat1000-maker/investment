-- مخطط Supabase لمنصة المبادرات — مطابق لمخازن IndexedDB (snake_case)
-- التفعيل اختياري: المنصة تعمل افتراضيًا بقاعدة محلية. انظر supabase/README.md

create table if not exists initiatives (
  id text primary key,
  title text not null,
  summary text not null,
  scope text,
  category text not null,
  district text not null,
  location text,
  lat double precision,
  lng double precision,
  status text not null default 'draft',
  channel text default 'internal',
  submitter_name text,
  submitter_entity text,
  submitter_email text,
  submitter_phone text,
  budget numeric,
  spent numeric default 0,
  funding_model text,
  start_date date,
  end_date date,
  org_unit_id text,
  owner_name text,
  scores jsonb default '{}'::jsonb,
  beneficiaries integer,
  notes text,
  status_history jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists infrastructure_needs (
  id text primary key,
  title text not null,
  description text not null,
  category text not null,
  district text not null,
  location text,
  lat double precision,
  lng double precision,
  status text not null default 'draft',
  priority text default 'medium',
  estimated_cost numeric,
  expected_impact text,
  beneficiaries integer,
  preferred_models jsonb default '[]'::jsonb,
  published_at timestamptz,
  matched_initiative_id text references initiatives(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists partners (
  id text primary key,
  name text not null,
  type text not null,
  cr_number text,
  contact_name text,
  contact_email text,
  contact_phone text,
  interests jsonb default '[]'::jsonb,
  models jsonb default '[]'::jsonb,
  rating numeric,
  active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists initiative_partners (
  id text primary key,
  initiative_id text not null references initiatives(id) on delete cascade,
  partner_id text not null references partners(id) on delete cascade,
  model text not null,
  contribution text,
  signed_at date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists campaigns (
  id text primary key,
  title text not null,
  summary text,
  start_date date,
  end_date date,
  target_initiatives integer,
  category_focus jsonb default '[]'::jsonb,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists reviews (
  id text primary key,
  initiative_id text not null references initiatives(id) on delete cascade,
  gate_id text not null,
  reviewer text not null,
  at timestamptz not null,
  recommendation text not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists decisions (
  id text primary key,
  initiative_id text not null references initiatives(id) on delete cascade,
  gate_id text not null,
  outcome text not null check (outcome in ('pass', 'reject', 'hold')),
  at timestamptz not null,
  by text,
  rationale text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists gate_checklists (
  id text primary key,
  initiative_id text not null references initiatives(id) on delete cascade,
  gate_id text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists kpis (
  id text primary key,
  initiative_id text references initiatives(id) on delete cascade,
  title text not null,
  unit text,
  target numeric,
  actual numeric,
  period text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists benefits (
  id text primary key,
  initiative_id text not null references initiatives(id) on delete cascade,
  title text not null,
  unit text,
  baseline numeric default 0,
  target numeric not null,
  actual numeric,
  measured_at timestamptz,
  owner text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists risks (
  id text primary key,
  initiative_id text not null references initiatives(id) on delete cascade,
  title text not null,
  probability integer check (probability between 1 and 4),
  impact integer check (impact between 1 and 4),
  response text,
  owner text,
  status text default 'open' check (status in ('open', 'mitigated', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists milestones (
  id text primary key,
  initiative_id text not null references initiatives(id) on delete cascade,
  title text not null,
  due date,
  done boolean default false,
  done_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists deliverables (
  id text primary key,
  initiative_id text not null references initiatives(id) on delete cascade,
  title text not null,
  accepted boolean default false,
  accepted_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists quality_checks (
  id text primary key,
  initiative_id text not null references initiatives(id) on delete cascade,
  title text not null,
  at date,
  result text check (result in ('pass', 'fail')),
  inspector text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists change_requests (
  id text primary key,
  initiative_id text not null references initiatives(id) on delete cascade,
  title text not null,
  description text,
  status text default 'open',
  decision text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists comments (
  id text primary key,
  initiative_id text not null references initiatives(id) on delete cascade,
  author text,
  body text not null,
  at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists attachments (
  id text primary key,
  initiative_id text not null references initiatives(id) on delete cascade,
  name text not null,
  type text,
  size integer,
  note text,
  data_url text,
  uploaded_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists users (
  id text primary key,
  name text not null,
  role text not null,
  org_unit_id text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists organizational_units (
  id text primary key,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists notifications (
  id text primary key,
  title text not null,
  body text,
  level text default 'info',
  at timestamptz default now(),
  read boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists audit_logs (
  id text primary key,
  at timestamptz not null default now(),
  actor text,
  role text,
  action text not null,
  store text not null,
  record_id text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists settings (
  id text primary key,
  seeded boolean,
  at timestamptz,
  value jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists saved_views (
  id text primary key,
  name text not null,
  route text,
  filters jsonb default '{}'::jsonb,
  owner text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- فهارس الاستعلام الشائع
create index if not exists idx_initiatives_status on initiatives(status);
create index if not exists idx_initiatives_district on initiatives(district);
create index if not exists idx_needs_status on infrastructure_needs(status);
create index if not exists idx_decisions_initiative on decisions(initiative_id);
create index if not exists idx_benefits_initiative on benefits(initiative_id);
create index if not exists idx_risks_initiative on risks(initiative_id);
create index if not exists idx_milestones_initiative on milestones(initiative_id);
create index if not exists idx_audit_at on audit_logs(at desc);
