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

export const DEMO_CAMPAIGNS = [
  {
    id: 'cmp-green-madinah',
    title: 'حملة «المدينة تُزهر» للتشجير المجتمعي',
    summary: 'حملة موسمية لتبنّي مواقع التشجير والتظليل في الأحياء السكنية بمشاركة القطاع الخاص والمتطوعين.',
    startDate: '2026-09-01', endDate: '2026-12-31',
    targetInitiatives: 20, categoryFocus: ['greening', 'shading', 'parks'], status: 'active',
    portfolioId: 'pf-madinah-proposed'
  },
  {
    id: 'cmp-safe-paths',
    title: 'حملة «طرق آمنة لمدارسنا»',
    summary: 'تحسين ممرات المشاة والسلامة المرورية حول المدارس عبر شراكات مع شركات المقاولات المحلية.',
    startDate: '2026-08-15', endDate: '2027-01-31',
    targetInitiatives: 12, categoryFocus: ['sidewalks', 'safety', 'lighting'], status: 'active',
    portfolioId: 'pf-madinah-proposed'
  }
];
