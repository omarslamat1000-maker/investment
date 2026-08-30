-- سياسات أمان الصفوف RLS لمنصة المبادرات
-- المبدأ: القراءة العامة مقصورة على ما يُعرض في البوابة العامة،
-- وكل كتابة تتطلب مستخدمًا موثقًا (authenticated) — عدّل حسب نموذج مصادقتك.

-- تفعيل RLS على كل الجداول
alter table initiatives enable row level security;
alter table infrastructure_needs enable row level security;
alter table partners enable row level security;
alter table initiative_partners enable row level security;
alter table campaigns enable row level security;
alter table reviews enable row level security;
alter table decisions enable row level security;
alter table gate_checklists enable row level security;
alter table kpis enable row level security;
alter table benefits enable row level security;
alter table risks enable row level security;
alter table milestones enable row level security;
alter table deliverables enable row level security;
alter table quality_checks enable row level security;
alter table change_requests enable row level security;
alter table comments enable row level security;
alter table attachments enable row level security;
alter table users enable row level security;
alter table organizational_units enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
alter table settings enable row level security;
alter table saved_views enable row level security;

-- القراءة العامة (anon): الاحتياجات المنشورة والحملات النشطة فقط
create policy "public read published needs"
  on infrastructure_needs for select
  to anon
  using (status = 'published');

create policy "public read active campaigns"
  on campaigns for select
  to anon
  using (status = 'active');

-- القراءة العامة للمبادرات غير المسودات (لصفحة التتبع العامة)
create policy "public read non-draft initiatives"
  on initiatives for select
  to anon
  using (status <> 'draft');

-- التقديم العام: إدراج مبادرة بحالة مقدَّمة فقط
create policy "public submit initiative"
  on initiatives for insert
  to anon
  with check (status = 'submitted');

-- المستخدمون الموثقون: قراءة وكتابة كاملة (فصّل الأدوار عبر JWT claims حسب حاجتك)
do $$
declare t text;
begin
  foreach t in array array[
    'initiatives','infrastructure_needs','partners','initiative_partners','campaigns',
    'reviews','decisions','gate_checklists','kpis','benefits','risks','milestones',
    'deliverables','quality_checks','change_requests','comments','attachments',
    'users','organizational_units','notifications','audit_logs','settings','saved_views'
  ] loop
    execute format('create policy "authenticated full access" on %I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;
