// مصفوفة الصلاحيات — من يملك فعل ماذا حسب الدور
// الأفعال معرفة كسلاسل "مورد.فعل" وتُفحص عبر can(role, action)
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
    'reports.view', 'reports.export', 'settings.view', 'backup.run'
  ],
  reviewer: [
    'initiatives.view', 'needs.view', 'partners.view',
    'reviews.view', 'reviews.create', 'decisions.view',
    'gates.view', 'benefits.view', 'risks.view', 'reports.view'
  ],
  executor: [
    'initiatives.view', 'execution.view', 'execution.edit',
    'quality.view', 'quality.edit', 'risks.view', 'risks.edit',
    'benefits.view', 'reports.view'
  ],
  partner: [
    'initiatives.view', 'needs.view', 'execution.view', 'benefits.view', 'reports.view'
  ],
  viewer: [
    'initiatives.view', 'needs.view', 'partners.view', 'benefits.view', 'reports.view', 'gates.view'
  ]
};

export function can(role, action) {
  const grants = MATRIX[role] || [];
  if (grants.includes('*')) return true;
  if (grants.includes(action)) return true;
  // دعم "مورد.*"
  const resource = action.split('.')[0];
  return grants.includes(`${resource}.*`);
}

export function grantsFor(role) {
  return [...(MATRIX[role] || [])];
}

export const PERMISSIONS_MATRIX = MATRIX;
