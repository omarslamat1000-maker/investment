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

// طلبات تقديم تجريبية على الفرص — أكثر من متقدم على الفرصة الواحدة لعرض المفاضلة
export const DEMO_NEED_APPLICATIONS = [
  {
    id: 'app-001', needId: 'MDN-NEED-2026-0001', partnerId: 'MDN-PRT-2026-0001',
    partnerName: 'شركة واحة البناء للمقاولات', model: 'execution',
    proposal: 'تنفيذ كامل للمظلات خلال 4 أشهر بفريقنا الإنشائي، مع ضمان 5 سنوات على الهياكل والقماش.',
    status: 'applied', at: '2026-08-10T09:00:00Z'
  },
  {
    id: 'app-002', needId: 'MDN-NEED-2026-0001', partnerId: 'MDN-PRT-2026-0006',
    partnerName: 'مؤسسة عمران للتطوير العقاري', model: 'fullFunding',
    proposal: 'تمويل كامل للمشروع ضمن برنامج مسؤوليتنا المجتمعية، بشرط لوحة تعريف بالممول في الموقع.',
    status: 'applied', at: '2026-08-14T09:00:00Z'
  },
  {
    id: 'app-003', needId: 'MDN-NEED-2026-0002', partnerId: 'MDN-PRT-2026-0003',
    partnerName: 'مجموعة نور المدينة القابضة', model: 'fullFunding',
    proposal: 'توريد وتركيب 320 وحدة LED ذكية مع منصة تحكم سحابية وصيانة 3 سنوات.',
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

// تقارير تقدم ميدانية تجريبية من الشركاء — واحد معتمد وآخران بانتظار اعتماد مكتب المبادرات
const DEMO_PHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#DCE9E0"/>' +
  '<rect x="0" y="220" width="480" height="100" fill="#8FB59E"/><circle cx="120" cy="150" r="60" fill="#2C7A63"/>' +
  '<rect x="112" y="200" width="16" height="60" fill="#5A3E1B"/><circle cx="330" cy="130" r="70" fill="#4E8F7B"/>' +
  '<rect x="322" y="190" width="16" height="70" fill="#5A3E1B"/><text x="240" y="300" text-anchor="middle" font-size="18" fill="#073B2E">صورة ميدانية توضيحية</text></svg>');

export const DEMO_PROGRESS_REPORTS = [
  {
    id: 'pr-001', initiativeId: 'MDN-INIT-2026-0001', partnerId: 'MDN-PRT-2026-0002', partnerName: 'جمعية سقيا وظل',
    milestoneId: 'ms-102', percent: 55, note: 'اكتملت زراعة القطاع الأول (400 شجرة) وتشغيل شبكة الري — بدأ التحضير للقطاع الثاني.',
    photos: [DEMO_PHOTO], status: 'approved', at: '2026-07-05T09:00:00Z',
    reviewedAt: '2026-07-06T08:30:00Z', reviewedBy: 'أ. ريم الجهني', reviewNote: 'مطابق للزيارة الميدانية.'
  },
  {
    id: 'pr-002', initiativeId: 'MDN-INIT-2026-0001', partnerId: 'MDN-PRT-2026-0004', partnerName: 'فريق «دربك أخضر» التطوعي',
    milestoneId: 'ms-103', percent: 62, note: 'يوم تطوعي ثالث: زُرعت 140 شجرة إضافية من القطاع الثاني بمشاركة 60 متطوعًا.',
    photos: [DEMO_PHOTO], status: 'pending', at: '2026-08-28T10:00:00Z',
    reviewedAt: null, reviewedBy: '', reviewNote: ''
  },
  {
    id: 'pr-003', initiativeId: 'MDN-INIT-2026-0003', partnerId: 'MDN-PRT-2026-0001', partnerName: 'شركة واحة البناء للمقاولات',
    milestoneId: 'ms-303', percent: 72, note: 'رُصف 900 م من المقطع الثاني وتركيب 9 منحدرات — متبقٍ 300 م وتشطيب المنحدرات.',
    photos: [], status: 'pending', at: '2026-08-30T07:30:00Z',
    reviewedAt: null, reviewedBy: '', reviewNote: ''
  }
];

// اتفاقيات شراكة تجريبية — موقعتان تاريخيًا وواحدة صادرة بانتظار اعتماد الشريك (مبادرة في مرحلة الاعتماد)
export const DEMO_AGREEMENTS = [
  {
    id: 'MDN-AGR-2026-0001', initiativeId: 'MDN-INIT-2026-0001', initiativeTitle: 'تشجير محور طريق قباء بالمشاركة المجتمعية',
    district: 'قباء', budget: 3200000, joint: true, models: ['coFunding', 'inKind'], durationMonths: 24, startDate: '2026-04-01',
    parties: [
      { partnerId: 'MDN-PRT-2026-0002', name: 'جمعية سقيا وظل', representative: 'أ. مها الصاعدي', model: 'coFunding', modelLabel: 'تمويل مشترك', contribution: 'تمويل 40% + التشغيل والصيانة لسنتين', approvedAt: '2026-03-08T09:00:00Z', approvedBy: 'أ. مها الصاعدي' },
      { partnerId: 'MDN-PRT-2026-0004', name: 'فريق «دربك أخضر» التطوعي', representative: 'أ. سارة الحسيني', model: 'inKind', modelLabel: 'تبرع عيني', contribution: 'أيام تطوعية للزراعة (120 متطوعًا)', approvedAt: '2026-03-09T11:00:00Z', approvedBy: 'أ. سارة الحسيني' }
    ],
    clauses: [], status: 'signed', issuedAt: '2026-03-05T08:00:00Z', issuedBy: 'أ. ريم الجهني',
    amanah: { approvedAt: '2026-03-10T08:00:00Z', approvedBy: 'م. عبدالله الحربي' }, signedAt: '2026-03-10T08:00:00Z', version: 1
  },
  {
    id: 'MDN-AGR-2026-0002', initiativeId: 'MDN-INIT-2026-0002', initiativeTitle: 'إنارة LED ذكية لممرات حي العوالي',
    district: 'العوالي', budget: 1450000, joint: false, models: ['fullFunding'], durationMonths: 12, startDate: '2026-09-01',
    parties: [
      { partnerId: 'MDN-PRT-2026-0003', name: 'مجموعة نور المدينة', representative: 'أ. عمر البلوي', model: 'fullFunding', modelLabel: 'تمويل كامل', contribution: 'تمويل كامل ضمن برنامج المسؤولية المجتمعية', approvedAt: '2026-07-28T09:00:00Z', approvedBy: 'أ. عمر البلوي' }
    ],
    clauses: [], status: 'signed', issuedAt: '2026-07-25T08:00:00Z', issuedBy: 'أ. ريم الجهني',
    amanah: { approvedAt: '2026-08-01T08:00:00Z', approvedBy: 'م. عبدالله الحربي' }, signedAt: '2026-08-01T08:00:00Z', version: 1
  },
  {
    id: 'MDN-AGR-2026-0003', initiativeId: 'MDN-INIT-2026-0007', initiativeTitle: 'ممر ظليل يربط قباء بالمسار النبوي',
    district: 'قباء', budget: 5400000, joint: false, models: ['coFunding'], durationMonths: 18, startDate: null,
    parties: [
      { partnerId: 'MDN-PRT-2026-0005', name: 'شركة مسارات الذكية للتقنية', representative: 'م. يوسف قاضي', model: 'coFunding', modelLabel: 'تمويل مشترك', contribution: 'تمويل 35% والتصميم التفصيلي والإشراف', approvedAt: null, approvedBy: '' }
    ],
    clauses: [], status: 'issued', issuedAt: '2026-08-27T08:00:00Z', issuedBy: 'أ. ريم الجهني',
    amanah: { approvedAt: null, approvedBy: '' }, signedAt: null, version: 1
  }
];

// ربط شريك بمبادرة الاعتماد (للاتفاقية الصادرة) — يُضاف مع الزرع التكميلي v7
export const DEMO_EXTRA_LINKS_V7 = [
  { id: 'ip-009', initiativeId: 'MDN-INIT-2026-0007', partnerId: 'MDN-PRT-2026-0005', model: 'coFunding', contribution: 'تمويل 35% والتصميم التفصيلي والإشراف', signedAt: null }
];
