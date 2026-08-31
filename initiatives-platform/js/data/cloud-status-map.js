// خريطة حالات المنصة ↔ حالات دورة العمل المعتمدة في قاعدة البيانات (13 حالة)
// المنصة تحتفظ بمسار بواباتها الغني في الواجهة، وقاعدة البيانات تفرض التسلسل الرسمي

export const PLATFORM_TO_CLOUD = {
  draft: 'draft',
  submitted: 'submitted',
  returned: 'returned',
  screening: 'under_review',
  study: 'under_review',
  approval: 'initially_accepted',
  readiness: 'planning',
  execution: 'in_progress',
  benefits: 'in_progress',
  onHold: 'on_hold',
  closed: 'completed',
  rejected: 'rejected'
};

export const CLOUD_TO_PLATFORM = {
  draft: 'draft',
  submitted: 'submitted',
  resubmitted: 'submitted',
  under_review: 'screening',
  returned: 'returned',
  initially_accepted: 'approval',
  approved: 'approval',
  planning: 'readiness',
  in_progress: 'execution',
  on_hold: 'onHold',
  completed: 'closed',
  rejected: 'rejected',
  archived: 'closed'
};

export const CLOUD_STATUS_LABELS = {
  draft: 'مسودة',
  submitted: 'مقدمة للمراجعة',
  resubmitted: 'أعيد تقديمها',
  under_review: 'تحت المراجعة',
  returned: 'معادة للاستكمال',
  initially_accepted: 'مقبولة مبدئيًا',
  approved: 'معتمدة',
  planning: 'قيد التخطيط',
  in_progress: 'قيد التنفيذ',
  on_hold: 'متوقفة',
  completed: 'مكتملة',
  rejected: 'مرفوضة',
  archived: 'مؤرشفة'
};

// الحالة السحابية المستهدفة عند انتقال منصة، مع مراعاة إعادة التقديم بعد الإعادة
export function cloudTargetFor(platformTo, currentCloudStatus) {
  if (platformTo === 'submitted' && currentCloudStatus === 'returned') return 'resubmitted';
  // اجتياز الدراسة نحو الاعتماد بينما السحابة under_review → initially_accepted
  return PLATFORM_TO_CLOUD[platformTo] || null;
}

// انتقالات سحابية وسيطة مطلوبة قبل الهدف (مثال: submitted→under_review قبل returned)
export function cloudPathTo(currentCloud, targetCloud) {
  const direct = { // (from→to) المسموح مباشرة — نسخة مختصرة من مصفوفة القاعدة
    'draft:submitted': [], 'returned:resubmitted': [],
    'submitted:under_review': [], 'resubmitted:under_review': [],
    'under_review:returned': [], 'under_review:initially_accepted': [], 'under_review:rejected': [],
    'initially_accepted:approved': [], 'initially_accepted:rejected': [],
    'approved:planning': [], 'planning:in_progress': [],
    'in_progress:on_hold': [], 'in_progress:completed': [], 'on_hold:in_progress': [],
    'completed:archived': [], 'rejected:archived': [], 'on_hold:archived': []
  };
  if (currentCloud === targetCloud) return [];
  if (`${currentCloud}:${targetCloud}` in direct) return [targetCloud];
  // مسارات شائعة بخطوة وسيطة
  const via = {
    'submitted:returned': ['under_review', 'returned'],
    'resubmitted:returned': ['under_review', 'returned'],
    'submitted:initially_accepted': ['under_review', 'initially_accepted'],
    'resubmitted:initially_accepted': ['under_review', 'initially_accepted'],
    'submitted:rejected': ['under_review', 'rejected'],
    'resubmitted:rejected': ['under_review', 'rejected'],
    'initially_accepted:planning': ['approved', 'planning'],
    'under_review:planning': ['initially_accepted', 'approved', 'planning'],
    'approved:in_progress': ['planning', 'in_progress'],
    'initially_accepted:in_progress': ['approved', 'planning', 'in_progress'],
    'in_progress:archived': ['completed', 'archived']
  };
  return via[`${currentCloud}:${targetCloud}`] || [targetCloud];
}
