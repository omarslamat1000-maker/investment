// البوابات المرحلية — قوائم التحقق لكل بوابة ومنطق الجاهزية للعبور
import { GATES } from '../core/constants.js';

// بنود التحقق المعيارية لكل بوابة (تُنسخ كسجل gateChecklist عند فتح البوابة)
export const GATE_CHECKLIST_TEMPLATES = {
  G0: [
    'اكتمال بيانات مقدّم المبادرة وصفته',
    'وضوح وصف المبادرة ونطاقها الجغرافي',
    'المبادرة ضمن اختصاص الأمانة وصلاحياتها',
    'عدم التعارض مع مشاريع قائمة أو مخططة'
  ],
  G1: [
    'اكتمال دراسة الجدوى الفنية',
    'تقدير التكلفة والموارد المطلوبة',
    'تقييم الأثر المجتمعي والمستفيدين',
    'اكتمال درجات معايير المفاضلة',
    'تحديد المخاطر الأولية وخطط معالجتها'
  ],
  G2: [
    'اعتماد لجنة المبادرات للمبادرة',
    'تحديد الشريك ونموذج الشراكة',
    'توقيع اتفاقية أو مذكرة تفاهم',
    'تحديد مؤشرات الأداء والمنافع المستهدفة',
    'تخصيص الوحدة التنظيمية المشرفة'
  ],
  G3: [
    'اعتماد الخطة التنفيذية والجدول الزمني',
    'استكمال التصاريح والموافقات',
    'جاهزية الموقع وإزالة العوائق',
    'تعيين مشرف التنفيذ وفريق العمل',
    'تحديث سجل المخاطر قبل الإطلاق'
  ],
  G4: [
    'استلام جميع المخرجات ومطابقتها للمواصفات',
    'اجتياز فحوص الجودة النهائية',
    'قياس مؤشرات المنافع مقابل المستهدف',
    'توثيق الدروس المستفادة',
    'إشعار الشريك وتوثيق الشكر والتقدير'
  ]
};

export function gateById(gateId) {
  return GATES.find((g) => g.id === gateId) || null;
}

// البوابة القادمة أمام حالة معينة (إن وجدت)
export function nextGateForStatus(status) {
  const map = { screening: 'G0', study: 'G1', approval: 'G2', readiness: 'G3', benefits: 'G4' };
  return map[status] ? gateById(map[status]) : null;
}

export function buildChecklist(gateId, initiativeId) {
  const items = (GATE_CHECKLIST_TEMPLATES[gateId] || []).map((text, i) => ({
    key: `${gateId}-${i + 1}`, text, done: false, note: ''
  }));
  return { gateId, initiativeId, items };
}

// جاهزية العبور: كل البنود منجزة
export function gateReadiness(checklist) {
  const items = checklist?.items || [];
  const done = items.filter((i) => i.done).length;
  return {
    total: items.length,
    done,
    ready: items.length > 0 && done === items.length,
    percent: items.length ? Math.round((done / items.length) * 100) : 0
  };
}

// موقع المبادرة على مسار البوابات: passed | current | upcoming لكل بوابة
export function gateTrack(status) {
  const reached = { draft: -1, submitted: -1, returned: -1, screening: 0, study: 1, approval: 2, readiness: 3, execution: 4, benefits: 4, closed: 5, rejected: -1, onHold: 2 };
  const idx = reached[status] ?? -1;
  return GATES.map((g, i) => ({
    ...g,
    state: status === 'closed' ? 'passed' : (i < idx ? 'passed' : i === idx ? 'current' : 'upcoming')
  }));
}
