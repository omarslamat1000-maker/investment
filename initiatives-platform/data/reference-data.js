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
  { id: 'u-partner', username: 'partner', name: 'أ. ناصر الزهراني', role: 'partner', orgUnitId: null, email: 'partner@example.com', active: true, grants: [], denies: [] }
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
