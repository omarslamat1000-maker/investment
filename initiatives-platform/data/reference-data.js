// بيانات مرجعية ثابتة: الوحدات التنظيمية والمستخدمون التجريبيون والحملات
import { DEMO_INITIATIVES, TRACKS } from './demo-initiatives.js';
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


// معرض الصور: صورة العرض الرئيسة لكل مبادرة مستهدفة + المخطط/الصورة الثانوية + خرائط المسارات
const CAPTION_MAIN = 'من عرض مبادرات وكالة البنية التحتية المستهدفة (21-10-2026)';
export const DEMO_GALLERY = [
  ...DEMO_INITIATIVES.map((i, k) => ({ id: `gal-${String(k + 1).padStart(4, '0')}`, title: i.title, status: i.status, initiativeId: i.id, order: k + 1, caption: CAPTION_MAIN, imageDataUrl: i.imageDataUrl })),
  ...DEMO_INITIATIVES.filter((i) => i.planImageUrl).map((i, k) => ({ id: `gal-p${String(k + 1).padStart(3, '0')}`, title: `${i.category === 'parks' ? 'المخطط' : 'صورة الموقع'} — ${i.title}`, status: i.status, initiativeId: i.id, order: 100 + k, caption: i.category === 'parks' ? 'المخطط المبدئي من العرض' : 'صورة الموقع/المخطط من العرض', imageDataUrl: i.planImageUrl })),
  { id: 'gal-m000', title: 'خريطة مواقع المبادرات المستهدفة الـ34', status: 'submitted', initiativeId: null, order: 200, caption: 'صور الخريطة: Esri 2026/10 — من عرض الوكالة', imageDataUrl: './assets/initiatives/m00.jpg' },
  { id: 'gal-m001', title: 'خريطة مسار الحدائق (10 مبادرات — 41.8 مليون ريال)', status: 'submitted', initiativeId: null, order: 201, caption: 'جدول المبادرات وترقيمها على الخريطة', imageDataUrl: './assets/initiatives/m01.jpg' },
  { id: 'gal-m002', title: 'خريطة مسار تطوير الطرق وأنسنتها (9 مبادرات — 259.4 مليون ريال)', status: 'submitted', initiativeId: null, order: 202, caption: 'جدول المبادرات وترقيمها على الخريطة', imageDataUrl: './assets/initiatives/m02.jpg' },
  { id: 'gal-m003', title: 'خريطة مسار جسور المشاة (6 مبادرات — 41 مليون ريال)', status: 'submitted', initiativeId: null, order: 203, caption: 'جدول المبادرات وترقيمها على الخريطة', imageDataUrl: './assets/initiatives/m03.jpg' },
  { id: 'gal-m004', title: 'خريطة مسار الجسور (9 مبادرات — 547 مليون ريال)', status: 'submitted', initiativeId: null, order: 204, caption: 'جدول المبادرات وترقيمها على الخريطة', imageDataUrl: './assets/initiatives/m04.jpg' }
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

// مسارات عرض الوكالة الأربعة — حملات داخل محفظة المبادرات المستهدفة
export const DEMO_CAMPAIGNS = [
  { id: TRACKS.parks, title: 'المسار 01 — الحدائق', summary: 'عشر حدائق أحياء بدراسات متوفرة وجاهزة للتنفيذ بمساحات 5–15 ألف م²، بإجمالي 41.8 مليون ريال.', startDate: '2026-10-21', endDate: '2028-10-21', targetInitiatives: 10, categoryFocus: ['parks'], status: 'active', portfolioId: 'pf-infra-targeted-2026' },
  { id: TRACKS.roads, title: 'المسار 02 — تطوير الطرق وأنسنتها', summary: 'تسع مبادرات لأنسنة الطرق والتقاطعات الحيوية (أرصفة، مسارات مشاة ودراجات، تشجير، إنارة جمالية)، بإجمالي 259.4 مليون ريال.', startDate: '2026-10-21', endDate: '2029-10-21', targetInitiatives: 9, categoryFocus: ['humanization', 'greening', 'sidewalks'], status: 'active', portfolioId: 'pf-infra-targeted-2026' },
  { id: TRACKS.pedBridges, title: 'المسار 03 — جسور المشاة', summary: 'ست مبادرات لجسور ومعابر مشاة آمنة عند الجامعات والمجمعات والمدارس ومحطة القطار والمنطقة المركزية، بإجمالي 41 مليون ريال.', startDate: '2026-10-21', endDate: '2027-04-21', targetInitiatives: 6, categoryFocus: ['safety', 'sidewalks'], status: 'active', portfolioId: 'pf-infra-targeted-2026' },
  { id: TRACKS.bridges, title: 'المسار 04 — الجسور', summary: 'تسعة جسور تقاطعات لتحرير الحركة المرورية على المحاور الرئيسة، بإجمالي 547 مليون ريال.', startDate: '2026-10-21', endDate: '2028-04-21', targetInitiatives: 9, categoryFocus: ['roads', 'safety'], status: 'active', portfolioId: 'pf-infra-targeted-2026' }
];


export const DEMO_PROGRESS_REPORTS = [];

// اتفاقيات شراكة تجريبية — موقعتان تاريخيًا وواحدة صادرة بانتظار اعتماد الشريك (مبادرة في مرحلة الاعتماد)
export const DEMO_AGREEMENTS = [];

// ربط شريك بمبادرة الاعتماد (للاتفاقية الصادرة) — يُضاف مع الزرع التكميلي v7
export const DEMO_EXTRA_LINKS_V7 = [];
