// الثوابت المرجعية لمنصة المبادرات — مصدر الحقيقة الوحيد للمعرّفات والتسميات
export const DB_NAME = 'madinah-initiatives-platform-db';
export const DB_VERSION = 6; // v5: progressReports + agreements، v6: ضمان فهارسهما

export const STORAGE_PREFIX = 'madinahInitiativesPlatform:';
export const CHANNELS = {
  events: 'madinah-initiatives-platform-events',
  settings: 'madinah-initiatives-platform-settings',
  notifications: 'madinah-initiatives-platform-notifications'
};
export const CACHE_PREFIX = 'madinah-initiatives-platform-';

export const OBJECT_STORES = [
  'initiatives', 'infrastructureNeeds', 'partners', 'initiativePartners',
  'campaigns', 'reviews', 'decisions', 'gateChecklists', 'kpis', 'benefits',
  'risks', 'milestones', 'deliverables', 'qualityChecks', 'changeRequests',
  'comments', 'attachments', 'users', 'organizationalUnits', 'notifications',
  'auditLogs', 'settings', 'savedViews', 'portfolios', 'gallery', 'needApplications',
  'progressReports', 'agreements'
];

// حالات المبادرة عبر دورة الحياة
export const STATUSES = {
  draft:      { id: 'draft',      label: 'مسودة',            color: 'muted' },
  submitted:  { id: 'submitted',  label: 'مقدَّمة',           color: 'info' },
  returned:   { id: 'returned',   label: 'معادة للاستكمال',  color: 'warn' },
  screening:  { id: 'screening',  label: 'قيد الفرز',        color: 'info' },
  study:      { id: 'study',      label: 'قيد الدراسة',      color: 'info' },
  approval:   { id: 'approval',   label: 'قيد الاعتماد',     color: 'warn' },
  readiness:  { id: 'readiness',  label: 'جاهزية التنفيذ',   color: 'warn' },
  execution:  { id: 'execution',  label: 'قيد التنفيذ',      color: 'exec' },
  benefits:   { id: 'benefits',   label: 'تحقق المنافع',     color: 'gold' },
  closed:     { id: 'closed',     label: 'مغلقة',            color: 'ok' },
  rejected:   { id: 'rejected',   label: 'معتذَر عنها',      color: 'bad' },
  onHold:     { id: 'onHold',     label: 'معلَّقة',           color: 'muted' }
};

// البوابات المرحلية Stage-Gates
export const GATES = [
  { id: 'G0', name: 'بوابة الفرز',              from: 'submitted', to: 'study',     desc: 'التحقق من اكتمال الطلب وملاءمته لنطاق الأمانة' },
  { id: 'G1', name: 'بوابة الجدوى والملاءمة',   from: 'study',     to: 'approval',  desc: 'دراسة الجدوى الفنية والمجتمعية وتقييم المعايير' },
  { id: 'G2', name: 'بوابة الاعتماد والشراكة',  from: 'approval',  to: 'readiness', desc: 'اعتماد المبادرة وتوقيع اتفاقية الشراكة' },
  { id: 'G3', name: 'بوابة جاهزية التنفيذ',     from: 'readiness', to: 'execution', desc: 'التحقق من الخطة والتصاريح وجاهزية الموقع' },
  { id: 'G4', name: 'بوابة الإغلاق والمنافع',   from: 'benefits',  to: 'closed',    desc: 'التحقق من التسليم وقياس المنافع المتحققة' }
];

// تصنيفات مبادرات البنية التحتية
export const CATEGORIES = [
  { id: 'roads',      label: 'طرق وجسور' },
  { id: 'humanization', label: 'أنسنة' },
  { id: 'drainage',   label: 'تصريف أمطار' },
  { id: 'facilities', label: 'مرافق' },
  { id: 'technology', label: 'تقنية' },
  { id: 'greening',   label: 'تشجير وتجميل' },
  { id: 'lighting',   label: 'إنارة وطاقة' },
  { id: 'sidewalks',  label: 'أرصفة وممرات مشاة' },
  { id: 'parks',      label: 'حدائق وساحات' },
  { id: 'shading',    label: 'تظليل ومناخ حضري' },
  { id: 'mobility',   label: 'تنقّل ومسارات دراجات' },
  { id: 'cleanliness',label: 'نظافة وإعادة تدوير' },
  { id: 'safety',     label: 'سلامة مرورية' },
  { id: 'rehab',      label: 'تأهيل بنية تحتية' },
  { id: 'furniture',  label: 'أثاث بلدي وخدمات' }
];

// أنواع الشركاء ونماذج الشراكة
export const PARTNER_TYPES = [
  { id: 'private',    label: 'قطاع خاص' },
  { id: 'nonprofit',  label: 'قطاع غير ربحي' },
  { id: 'gov',        label: 'جهة حكومية' },
  { id: 'community',  label: 'مجموعة مجتمعية' }
];
export const PARTNERSHIP_MODELS = [
  { id: 'fullFunding', label: 'تمويل كامل' },
  { id: 'coFunding',   label: 'تمويل مشترك' },
  { id: 'execution',   label: 'تنفيذ مباشر' },
  { id: 'operation',   label: 'تشغيل وصيانة' },
  { id: 'inKind',      label: 'تبرع عيني' },
  { id: 'sponsorship', label: 'رعاية' }
];

// معايير المفاضلة وأوزانها (المجموع 100)
export const SCORING_CRITERIA = [
  { id: 'strategic',  label: 'التوافق الاستراتيجي',     weight: 25 },
  { id: 'impact',     label: 'الأثر المجتمعي',          weight: 25 },
  { id: 'feasibility',label: 'الجدوى الفنية والمالية',  weight: 20 },
  { id: 'readiness',  label: 'جاهزية الشريك',           weight: 15 },
  { id: 'risk',       label: 'انخفاض المخاطر',          weight: 15 }
];

// الأدوار والصلاحيات
export const ROLES = {
  admin:       { id: 'admin',       label: 'مدير النظام' },
  supervisor:  { id: 'supervisor',  label: 'المشرف على المبادرات' },
  agency_user: { id: 'agency_user', label: 'ممثل جهة' },
  pmo:         { id: 'pmo',         label: 'مكتب إدارة المبادرات' },
  reviewer:    { id: 'reviewer',    label: 'عضو لجنة المراجعة' },
  executor:    { id: 'executor',    label: 'مشرف تنفيذ' },
  partner:     { id: 'partner',     label: 'شريك' },
  viewer:      { id: 'viewer',      label: 'مطَّلع' }
};

export const RISK_LEVELS = [
  { id: 'low',    label: 'منخفض',  score: 1 },
  { id: 'medium', label: 'متوسط',  score: 2 },
  { id: 'high',   label: 'مرتفع',  score: 3 },
  { id: 'critical', label: 'حرج',  score: 4 }
];

export const DISTRICTS = [
  'المنطقة المركزية', 'قباء', 'العوالي', 'الحرة الشرقية', 'الحرة الغربية',
  'العيون', 'سيد الشهداء', 'الملك فهد', 'النخيل', 'الرانوناء', 'العزيزية', 'الجرف',
  'البيداء', 'عروة', 'قربان', 'العالية', 'المغيسلة', 'السقيا', 'السيح', 'الأصفرين',
  'بني معاوية', 'بني الأشهل', 'شوران', 'السد', 'عموم المدينة', 'غير محدد'
];

// مراكز تقريبية للأحياء (خط عرض، خط طول) — تُستخدم لخريطة التغطية عند غياب مواقع مسجلة
export const DISTRICT_CENTROIDS = {
  'البيداء': [24.4870, 39.5560],
  'عروة': [24.4480, 39.5760],
  'قربان': [24.4500, 39.6230],
  'العالية': [24.4420, 39.6200],
  'المغيسلة': [24.4700, 39.6000],
  'السقيا': [24.4620, 39.6030],
  'السيح': [24.4400, 39.6100],
  'الأصفرين': [24.4620, 39.6200],
  'بني معاوية': [24.4330, 39.6000],
  'بني الأشهل': [24.4820, 39.6180],
  'شوران': [24.4180, 39.6480],
  'السد': [24.4080, 39.6430],
  'المنطقة المركزية': [24.4680, 39.6110],
  'قباء': [24.4390, 39.6170],
  'العوالي': [24.4450, 39.6400],
  'الحرة الشرقية': [24.4780, 39.6400],
  'الحرة الغربية': [24.4700, 39.5750],
  'العيون': [24.5200, 39.6050],
  'سيد الشهداء': [24.5000, 39.6150],
  'الملك فهد': [24.5000, 39.6500],
  'النخيل': [24.4550, 39.5800],
  'الرانوناء': [24.4250, 39.5600],
  'العزيزية': [24.4500, 39.6600],
  'الجرف': [24.5250, 39.5750]
};

// نطاقات قالب تعريف المبادرة (من النموذج المعتمد)
export const COST_BANDS = [
  { id: 'lt1m', label: 'أقل من مليون ريال' },
  { id: '1to5m', label: '1–5 ملايين ريال' },
  { id: '5to20m', label: '5–20 مليون ريال' },
  { id: 'gt20m', label: 'أكثر من 20 مليون ريال' },
  { id: 'tbd', label: 'غير محددة' }
];
export const DURATION_BANDS = [
  { id: 'lt3m', label: 'أقل من 3 أشهر' },
  { id: '3to6m', label: '3–6 أشهر' },
  { id: '6to12m', label: '6–12 شهرًا' },
  { id: 'gt1y', label: 'أكثر من سنة' }
];
export const READINESS_LEVELS = [
  { id: 'idea', label: 'فكرة' },
  { id: 'sited', label: 'موقع محدد' },
  { id: 'studied', label: 'دراسة متوفرة' },
  { id: 'designed', label: 'تصميم متوفر' },
  { id: 'ready', label: 'جاهزة للتنفيذ' }
];

export const ID_PREFIXES = {
  initiative: 'MDN-INIT',
  need: 'MDN-NEED',
  partner: 'MDN-PRT',
  decision: 'MDN-DEC'
};
