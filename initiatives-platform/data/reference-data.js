// بيانات مرجعية ثابتة: الوحدات التنظيمية والمستخدمون التجريبيون والحملات
export const ORG_UNITS = [
  { id: 'ou-projects', name: 'وكالة التعمير والمشاريع' },
  { id: 'ou-services', name: 'وكالة الخدمات' },
  { id: 'ou-invest', name: 'وكالة الاستثمار والإيرادات' },
  { id: 'ou-community', name: 'إدارة الشراكة المجتمعية' },
  { id: 'ou-pmo', name: 'مكتب إدارة المبادرات' }
];

// كلمة المرور الافتراضية لكل حسابات العرض: Admin@123 — تُجزّأ SHA-256 عند الزرع
export const DEMO_USERS = [
  { id: 'u-admin', username: 'admin', name: 'م. عبدالله الحربي', role: 'admin', orgUnitId: 'ou-pmo', email: 'admin@amana.example', active: true, grants: [], denies: [] },
  { id: 'u-pmo', username: 'pmo', name: 'أ. ريم الجهني', role: 'pmo', orgUnitId: 'ou-pmo', email: 'pmo@amana.example', active: true, grants: [], denies: [] },
  { id: 'u-rev1', username: 'reviewer1', name: 'د. سالم الأنصاري', role: 'reviewer', orgUnitId: 'ou-projects', email: 'rev1@amana.example', active: true, grants: [], denies: [] },
  { id: 'u-rev2', username: 'reviewer2', name: 'م. هند العمري', role: 'reviewer', orgUnitId: 'ou-services', email: 'rev2@amana.example', active: true, grants: [], denies: [] },
  { id: 'u-exec', username: 'executor', name: 'م. فهد المطيري', role: 'executor', orgUnitId: 'ou-projects', email: 'exec@amana.example', active: true, grants: [], denies: [] },
  { id: 'u-partner', username: 'partner', name: 'أ. ناصر الزهراني', role: 'partner', orgUnitId: null, email: 'partner@example.com', active: true, grants: [], denies: [] },
  // حسابات الجهات الشريكة — حساب واحد باسم ممثل الجهة، مقيد ببوابة الشركاء وبيانات جهته فقط
  { id: 'u-prt-waha', username: 'waha', name: 'م. خالد الرشيدي', role: 'partner', partnerId: 'MDN-PRT-2026-0001', orgUnitId: null, email: 'k.r@waha.example', active: true, grants: [], denies: [] },
  { id: 'u-prt-suqya', username: 'suqya', name: 'أ. مها الصاعدي', role: 'partner', partnerId: 'MDN-PRT-2026-0002', orgUnitId: null, email: 'maha@suqya.example', active: true, grants: [], denies: [] },
  { id: 'u-prt-noor', username: 'noor', name: 'أ. عمر البلوي', role: 'partner', partnerId: 'MDN-PRT-2026-0003', orgUnitId: null, email: 'omar@noor.example', active: true, grants: [], denies: [] },
  { id: 'u-prt-darbak', username: 'darbak', name: 'أ. سارة الحسيني', role: 'partner', partnerId: 'MDN-PRT-2026-0004', orgUnitId: null, email: 'sara@darbak.example', active: true, grants: [], denies: [] },
  { id: 'u-prt-masarat', username: 'masarat', name: 'م. يوسف قاضي', role: 'partner', partnerId: 'MDN-PRT-2026-0005', orgUnitId: null, email: 'y.qadi@masarat.example', active: true, grants: [], denies: [] },
  { id: 'u-prt-omran', username: 'omran', name: 'أ. بدر العوفي', role: 'partner', partnerId: 'MDN-PRT-2026-0006', orgUnitId: null, email: 'badr@omran.example', active: true, grants: [], denies: [] },
  { id: 'u-prt-emaar', username: 'emaar', name: 'د. أحمد خياط', role: 'partner', partnerId: 'MDN-PRT-2026-0007', orgUnitId: null, email: 'ahmad@emaar-m.example', active: true, grants: [], denies: [] },
  { id: 'u-prt-yanabea', username: 'yanabea', name: 'م. لينا مغربي', role: 'partner', partnerId: 'MDN-PRT-2026-0008', orgUnitId: null, email: 'lina@yanabea.example', active: true, grants: [], denies: [] }
];


export const DEMO_GALLERY = [
  { id: 'gal-0001', title: 'تنفيذ جسر مشاة لربط الجامعة الإسلامية وجامعة طيبة على طريق الأمير نايف', status: 'submitted', initiativeId: 'MDN-INIT-2026-0001', order: 1, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i01.jpg' },
  { id: 'gal-0002', title: 'تنفيذ جسر مشاة لربط مجمع النور مول ومجمع العروبة على طريق الملك عبدالله', status: 'submitted', initiativeId: 'MDN-INIT-2026-0002', order: 2, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i02.jpg' },
  { id: 'gal-0003', title: 'تنفيذ جسر تقاطع طريق الملك خالد مع طريق الملك عبدالعزيز', status: 'submitted', initiativeId: 'MDN-INIT-2026-0003', order: 3, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i03.jpg' },
  { id: 'gal-0004', title: 'إنشاء جسر تقاطع طريق الأمير سلطان مع طريق العباس بن عبادة', status: 'submitted', initiativeId: 'MDN-INIT-2026-0004', order: 4, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i04.jpg' },
  { id: 'gal-0005', title: 'إنشاء جسر تقاطع طريق الأمير سلطان مع طريق عمر بن الخطاب', status: 'submitted', initiativeId: 'MDN-INIT-2026-0005', order: 5, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i05.jpg' },
  { id: 'gal-0006', title: 'تنفيذ جسر أو نفق تقاطع طريق الأمير عبدالمجيد مع طريق الأمير عبدالمحسن', status: 'submitted', initiativeId: 'MDN-INIT-2026-0006', order: 6, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i06.jpg' },
  { id: 'gal-0007', title: 'تنفيذ جسر تقاطع طريق الأمير عبدالمجيد مع طريق الأمير محمد بن سلمان', status: 'submitted', initiativeId: 'MDN-INIT-2026-0007', order: 7, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i07.jpg' },
  { id: 'gal-0008', title: 'رفع كفاءة وصيانة الطرق داخل أحياء المغيسلة والسقيا والسيح والأصفرين وبني معاوية', status: 'submitted', initiativeId: 'MDN-INIT-2026-0008', order: 8, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i08.jpg' },
  { id: 'gal-0009', title: 'تشغيل وصيانة الطرق داخل أحياء المدينة المنورة', status: 'submitted', initiativeId: 'MDN-INIT-2026-0009', order: 9, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i09.jpg' },
  { id: 'gal-0010', title: 'تنفيذ جسر على تقاطع طريق الصناعية مع طريق عمر بن الخطاب', status: 'submitted', initiativeId: 'MDN-INIT-2026-0010', order: 10, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i10.jpg' },
  { id: 'gal-0011', title: 'تنفيذ جسر على طريق الأمير نايف مقابل المستشفى السعودي الألماني', status: 'submitted', initiativeId: 'MDN-INIT-2026-0011', order: 11, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i11.jpg' },
  { id: 'gal-0012', title: 'تنفيذ جسر تقاطع طريق قباء مع طريق صلاح الدين', status: 'submitted', initiativeId: 'MDN-INIT-2026-0012', order: 12, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i12.jpg' },
  { id: 'gal-0013', title: 'تنفيذ جسر تقاطع طريق الأمير عبدالمحسن مع طريق صلاح الدين', status: 'submitted', initiativeId: 'MDN-INIT-2026-0013', order: 13, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i13.jpg' },
  { id: 'gal-0014', title: 'تطوير وأنسنة طريق عبدالله بن جبير من سيد الشهداء إلى حديقة الأمير محمد بن عبدالعزيز', status: 'submitted', initiativeId: 'MDN-INIT-2026-0014', order: 14, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i14.jpg' },
  { id: 'gal-0015', title: 'تنفيذ حدائق داخل أحياء المدينة المنورة', status: 'submitted', initiativeId: 'MDN-INIT-2026-0015', order: 15, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i15.jpg' },
  { id: 'gal-0016', title: 'تطوير طريق أبي ذر الغفاري من طريق الملك عبدالله إلى المنطقة المركزية', status: 'submitted', initiativeId: 'MDN-INIT-2026-0016', order: 16, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i16.jpg' },
  { id: 'gal-0017', title: 'زيادة التشجير والمسطحات الخضراء في حي شوران وحي السد', status: 'submitted', initiativeId: 'MDN-INIT-2026-0017', order: 17, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i17.jpg' },
  { id: 'gal-0018', title: 'تنفيذ حديقة بملاعب داخل حي السد', status: 'submitted', initiativeId: 'MDN-INIT-2026-0018', order: 18, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/i18.jpg' },
  { id: 'gal-0019', title: 'دهان أعمدة الإنارة بالشوارع الرئيسية', status: 'submitted', initiativeId: 'MDN-INIT-2026-0019', order: 19, caption: 'صورة الموقع من نموذج احتياج المبادرات المستقبلية', imageDataUrl: './assets/initiatives/b01.jpg' }
];

// طلبات تقديم تجريبية على الفرص — أكثر من متقدم على الفرصة الواحدة لعرض المفاضلة
export const DEMO_NEED_APPLICATIONS = [
  {
    id: 'app-001', needId: 'MDN-NEED-2026-0001', partnerId: 'MDN-PRT-2026-0001',
    partnerName: 'شركة واحة البناء للمقاولات', model: 'execution',
    proposal: 'تنفيذ كامل للمظلات خلال 4 أشهر بفريقنا الإنشائي، مع ضمان 5 سنوات على الهياكل والقماش.',
    details: { contributionAmount: 950000, contributionPercent: 100, durationMonths: 4, startReadyDate: '2026-10-01', readinessLevel: 'designed', teamSize: 18, teamExperience: 'فريق إنشائي بخبرة 12 عامًا في المظلات والهياكل المعدنية', similarProjectsCount: 6, similarProjectsDesc: 'مظلات ساحات 3 مساجد ومحطتين للنقل بالمدينة', warrantyMonths: 60, addedValue: 'صيانة دورية مجانية للسنة الأولى' },
    status: 'applied', at: '2026-08-10T09:00:00Z'
  },
  {
    id: 'app-002', needId: 'MDN-NEED-2026-0001', partnerId: 'MDN-PRT-2026-0006',
    partnerName: 'مؤسسة عمران للتطوير العقاري', model: 'fullFunding',
    proposal: 'تمويل كامل للمشروع ضمن برنامج مسؤوليتنا المجتمعية، بشرط لوحة تعريف بالممول في الموقع.',
    details: { contributionAmount: 950000, contributionPercent: 100, durationMonths: 7, startReadyDate: '2026-11-15', readinessLevel: 'sited', teamSize: 6, teamExperience: 'فريق إدارة مشاريع مع مقاول من الباطن', similarProjectsCount: 2, similarProjectsDesc: 'مظلات ساحة مسجد الميقات وممشى سكني', warrantyMonths: 24, addedValue: 'لوحة تعريف بالممول ونشاط تطوعي افتتاحي' },
    status: 'applied', at: '2026-08-14T09:00:00Z'
  },
  {
    id: 'app-003', needId: 'MDN-NEED-2026-0002', partnerId: 'MDN-PRT-2026-0003',
    partnerName: 'مجموعة نور المدينة القابضة', model: 'fullFunding',
    proposal: 'توريد وتركيب 320 وحدة LED ذكية مع منصة تحكم سحابية وصيانة 3 سنوات.',
    details: { contributionAmount: 1200000, contributionPercent: 100, durationMonths: 5, startReadyDate: '2026-10-15', readinessLevel: 'studied', teamSize: 10, teamExperience: 'مهندسو كهرباء وإنارة معتمدون', similarProjectsCount: 4, similarProjectsDesc: 'إنارة LED لأربعة أحياء سكنية', warrantyMonths: 36, addedValue: 'نظام تحكم عن بعد مجاني' },
    status: 'applied', at: '2026-08-20T09:00:00Z'
  }
];

export const DEMO_CAMPAIGNS = [
  {
    id: 'cmp-green-madinah',
    title: 'حملة «المدينة تُزهر» للتشجير المجتمعي',
    summary: 'حملة موسمية لتبنّي مواقع التشجير والتظليل في الأحياء السكنية بمشاركة القطاع الخاص والمتطوعين.',
    startDate: '2026-09-01', endDate: '2026-12-31',
    targetInitiatives: 20, categoryFocus: ['greening', 'shading', 'parks'], status: 'active',
    portfolioId: 'pf-infra-future'
  },
  {
    id: 'cmp-safe-paths',
    title: 'حملة «طرق آمنة لمدارسنا»',
    summary: 'تحسين ممرات المشاة والسلامة المرورية حول المدارس عبر شراكات مع شركات المقاولات المحلية.',
    startDate: '2026-08-15', endDate: '2027-01-31',
    targetInitiatives: 12, categoryFocus: ['sidewalks', 'safety', 'lighting'], status: 'active',
    portfolioId: 'pf-infra-future'
  }
];


export const DEMO_PROGRESS_REPORTS = [];

// اتفاقيات شراكة تجريبية — موقعتان تاريخيًا وواحدة صادرة بانتظار اعتماد الشريك (مبادرة في مرحلة الاعتماد)
export const DEMO_AGREEMENTS = [];

// ربط شريك بمبادرة الاعتماد (للاتفاقية الصادرة) — يُضاف مع الزرع التكميلي v7
export const DEMO_EXTRA_LINKS_V7 = [];
