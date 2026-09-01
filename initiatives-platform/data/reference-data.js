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

// صور معرض تجريبية — SVG مدمجة خفيفة تُستبدل بصور فعلية من شاشة الإدارة
function galleryPlaceholder(bg, accent, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#052A20"/></linearGradient></defs>
    <rect width="640" height="420" fill="url(#g)"/>
    <g fill="none" stroke="${accent}" stroke-width="6" opacity="0.9">
      <path d="M240 300 V210 a80 80 0 0 1 160 0 V300"/>
    </g>
    <g fill="none" stroke="${accent}" stroke-width="3" opacity="0.35">
      <path d="M80 340 V290 a40 40 0 0 1 80 0 V340"/>
      <path d="M480 340 V290 a40 40 0 0 1 80 0 V340"/>
    </g>
    <text x="320" y="375" text-anchor="middle" fill="#F5EDD4" font-family="sans-serif" font-size="26" font-weight="bold">${label}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/\n\s*/g, ' '));
}

export const DEMO_GALLERY = [
  {
    id: 'gal-001', title: 'تشجير محور طريق قباء بالمشاركة المجتمعية',
    status: 'execution', initiativeId: 'MDN-INIT-2026-0001', order: 1,
    caption: 'زراعة القطاع الأول — 400 شجرة ظل محلية بسواعد 120 متطوعًا',
    imageDataUrl: galleryPlaceholder('#0E5A44', '#C9A227', 'تشجير محور قباء')
  },
  {
    id: 'gal-002', title: 'مظلات ساحة مسجد الميقات',
    status: 'benefits', initiativeId: 'MDN-INIT-2026-0004', order: 2,
    caption: '2800 م² من الظل لخدمة الحجاج والمعتمرين بتمويل شريك خاص',
    imageDataUrl: galleryPlaceholder('#8A6D1F', '#F5EDD4', 'مظلات الميقات')
  },
  {
    id: 'gal-003', title: 'حديقة حي الجرف المجتمعية',
    status: 'closed', initiativeId: 'MDN-INIT-2026-0005', order: 3,
    caption: 'اكتملت وتحققت منافعها 96% — تشغيل أهلي نموذجي',
    imageDataUrl: galleryPlaceholder('#1E7A5F', '#E8D9A8', 'حديقة الجرف')
  },
  {
    id: 'gal-004', title: 'تأهيل أرصفة شارع السلام وممرات المدارس',
    status: 'execution', initiativeId: 'MDN-INIT-2026-0003', order: 4,
    caption: 'رصف المقطع الأول 1.2 كم بمنحدرات وصول شامل',
    imageDataUrl: galleryPlaceholder('#2C6E7A', '#C9A227', 'أرصفة شارع السلام')
  }
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
