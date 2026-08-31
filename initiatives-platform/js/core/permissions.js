// مصفوفة الصلاحيات — من يملك فعل ماذا حسب الدور
// الأفعال معرفة كسلاسل "مورد.فعل" وتُفحص عبر can(role, action)
// تجاوزات المستخدم (سماح/منع لكل حساب) تُطبق فوق المصفوفة عبر setOverridesProvider
const MATRIX = {
  admin: ['*'],
  pmo: [
    'initiatives.view', 'initiatives.create', 'initiatives.edit', 'initiatives.transition',
    'needs.view', 'needs.create', 'needs.edit', 'needs.publish',
    'partners.view', 'partners.create', 'partners.edit',
    'reviews.view', 'reviews.create', 'decisions.view', 'decisions.create',
    'gates.view', 'gates.check',
    'benefits.view', 'benefits.edit', 'risks.view', 'risks.edit',
    'execution.view', 'execution.edit', 'quality.view', 'quality.edit',
    'reports.view', 'reports.export', 'settings.view', 'backup.run',
    'users.view', 'portfolios.view', 'portfolios.manage'
  ],
  reviewer: [
    'initiatives.view', 'needs.view', 'partners.view',
    'reviews.view', 'reviews.create', 'decisions.view',
    'gates.view', 'benefits.view', 'risks.view', 'reports.view', 'portfolios.view'
  ],
  executor: [
    'initiatives.view', 'execution.view', 'execution.edit',
    'quality.view', 'quality.edit', 'risks.view', 'risks.edit',
    'benefits.view', 'reports.view', 'portfolios.view'
  ],
  partner: [
    'initiatives.view', 'needs.view', 'execution.view', 'benefits.view', 'reports.view', 'portfolios.view'
  ],
  viewer: [
    'initiatives.view', 'needs.view', 'partners.view', 'benefits.view', 'reports.view', 'gates.view', 'portfolios.view'
  ]
};

// مزوّد تجاوزات المستخدم الحالي — يُسجَّل من طبقة التطبيق بعد تسجيل الدخول
// يعيد { grants: [], denies: [] } أو null. المنع مقدَّم على السماح وعلى دور المستخدم.
let overridesProvider = null;
export function setOverridesProvider(fn) {
  overridesProvider = typeof fn === 'function' ? fn : null;
}

function roleAllows(role, action) {
  const grants = MATRIX[role] || [];
  if (grants.includes('*')) return true;
  if (grants.includes(action)) return true;
  // دعم "مورد.*"
  const resource = action.split('.')[0];
  return grants.includes(`${resource}.*`);
}

export function can(role, action) {
  const overrides = overridesProvider ? overridesProvider() : null;
  if (overrides) {
    if ((overrides.denies || []).includes(action)) return false;
    if ((overrides.grants || []).includes(action)) return true;
  }
  return roleAllows(role, action);
}

export function grantsFor(role) {
  return [...(MATRIX[role] || [])];
}

export const PERMISSIONS_MATRIX = MATRIX;

// دليل الأفعال المعروفة بعناوينها العربية — مصدر شاشة إدارة الصلاحيات
export const ACTION_CATALOG = [
  { group: 'المبادرات', actions: [
    { id: 'initiatives.view', label: 'عرض المبادرات' },
    { id: 'initiatives.create', label: 'إنشاء مبادرة' },
    { id: 'initiatives.edit', label: 'تعديل مبادرة' },
    { id: 'initiatives.transition', label: 'نقل حالة مبادرة' }
  ] },
  { group: 'الاحتياجات', actions: [
    { id: 'needs.view', label: 'عرض الاحتياجات' },
    { id: 'needs.create', label: 'إنشاء احتياج' },
    { id: 'needs.edit', label: 'تعديل احتياج' },
    { id: 'needs.publish', label: 'نشر احتياج للشراكة' }
  ] },
  { group: 'الشركاء', actions: [
    { id: 'partners.view', label: 'عرض الشركاء' },
    { id: 'partners.create', label: 'تسجيل شريك' },
    { id: 'partners.edit', label: 'تعديل شريك' }
  ] },
  { group: 'الحوكمة', actions: [
    { id: 'reviews.view', label: 'عرض المراجعات' },
    { id: 'reviews.create', label: 'تسجيل توصية' },
    { id: 'decisions.view', label: 'عرض القرارات' },
    { id: 'decisions.create', label: 'إصدار قرار بوابة' },
    { id: 'gates.view', label: 'عرض البوابات' },
    { id: 'gates.check', label: 'إنجاز بنود التحقق' }
  ] },
  { group: 'التنفيذ والقياس', actions: [
    { id: 'execution.view', label: 'عرض التنفيذ' },
    { id: 'execution.edit', label: 'تحديث التنفيذ' },
    { id: 'benefits.view', label: 'عرض المنافع' },
    { id: 'benefits.edit', label: 'قياس المنافع' },
    { id: 'risks.view', label: 'عرض المخاطر' },
    { id: 'risks.edit', label: 'إدارة المخاطر' },
    { id: 'quality.view', label: 'عرض فحوص الجودة' },
    { id: 'quality.edit', label: 'تسجيل فحص جودة' }
  ] },
  { group: 'المحافظ والشهادات', actions: [
    { id: 'portfolios.view', label: 'عرض المحافظ' },
    { id: 'portfolios.manage', label: 'إدارة المحافظ وتجميع المبادرات' },
    { id: 'certificates.manage', label: 'تحرير بيانات شهادات الإنجاز' }
  ] },
  { group: 'التقارير والنظام', actions: [
    { id: 'reports.view', label: 'عرض التقارير' },
    { id: 'reports.export', label: 'تصدير التقارير' },
    { id: 'settings.view', label: 'الإعدادات' },
    { id: 'backup.run', label: 'النسخ الاحتياطي والاستعادة' },
    { id: 'users.view', label: 'عرض المستخدمين' },
    { id: 'users.manage', label: 'إدارة المستخدمين والصلاحيات' }
  ] }
];

export const ALL_ACTIONS = ACTION_CATALOG.flatMap((g) => g.actions.map((a) => a.id));
