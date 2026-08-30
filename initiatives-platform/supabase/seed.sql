-- بذور توضيحية مختصرة لبيئة Supabase — البيانات الكاملة تُزرع من data/*.js في الوضع المحلي
insert into organizational_units (id, name) values
  ('ou-projects', 'وكالة التعمير والمشاريع'),
  ('ou-services', 'وكالة الخدمات'),
  ('ou-community', 'إدارة الشراكة المجتمعية'),
  ('ou-pmo', 'مكتب إدارة المبادرات')
on conflict (id) do nothing;

insert into partners (id, name, type, contact_name, contact_email, contact_phone, models, active) values
  ('MDN-PRT-2026-0001', 'شركة واحة البناء للمقاولات', 'private', 'م. خالد الرشيدي', 'k.r@waha.example', '0551000001', '["execution","coFunding"]', true),
  ('MDN-PRT-2026-0002', 'جمعية سقيا وظل الأهلية', 'nonprofit', 'أ. مها الصاعدي', 'maha@suqya.example', '0551000002', '["inKind","operation"]', true)
on conflict (id) do nothing;

insert into infrastructure_needs (id, title, description, category, district, status, priority, estimated_cost, beneficiaries, published_at) values
  ('MDN-NEED-2026-0001', 'تظليل ممرات مشاة محيط حديقة الملك فهد',
   'تركيب مظلات مقاومة للحرارة على مسار المشاة الرئيس بطول 800 متر.',
   'shading', 'الملك فهد', 'published', 'high', 950000, 15000, '2026-07-10')
on conflict (id) do nothing;

insert into initiatives (id, title, summary, category, district, status, submitter_name, submitter_entity, budget, funding_model, beneficiaries) values
  ('MDN-INIT-2026-0001', 'تشجير محور طريق قباء بالمشاركة المجتمعية',
   'زراعة 1200 شجرة ظل محلية على جانبي محور قباء مع شبكة ري بالتنقيط وصيانة تشغيلية لمدة سنتين.',
   'greening', 'قباء', 'execution', 'أ. مها الصاعدي', 'جمعية سقيا وظل الأهلية', 1850000, 'coFunding', 40000)
on conflict (id) do nothing;
