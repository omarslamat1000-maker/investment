// اتفاقية الشراكة الرقمية — تُولَّد عند بوابة الاعتماد G2 من قالب حسب نموذج الشراكة،
// وتُعتمد إلكترونيًا من طرفيها (الأمانة والجهة/الجهات الشريكة) لتصبح موقعة
import { PARTNERSHIP_MODELS } from '../core/constants.js';

export const AGREEMENT_STATUS = {
  issued: { id: 'issued', label: 'صادرة — بانتظار اعتماد الأطراف' },
  partnerApproved: { id: 'partnerApproved', label: 'اعتمدها الشركاء — بانتظار الأمانة' },
  amanahApproved: { id: 'amanahApproved', label: 'اعتمدتها الأمانة — بانتظار الشركاء' },
  signed: { id: 'signed', label: 'موقعة إلكترونيًا من الطرفين' },
  cancelled: { id: 'cancelled', label: 'ملغاة' }
};

// بنود خاصة بكل نموذج شراكة
const MODEL_CLAUSES = {
  fullFunding: [
    'يلتزم الطرف الثاني بتمويل كامل تكلفة المبادرة وفق الميزانية المعتمدة، ويتحمل أي فروقات ناتجة عن تغييرات يطلبها.',
    'تُحوَّل الدفعات وفق جدول المعالم المعتمد، وتُصرف الدفعة الأخيرة بعد الاستلام النهائي.'
  ],
  coFunding: [
    'يساهم الطرف الثاني بالحصة التمويلية المحددة في بند المساهمة، وتتولى الأمانة أو الشركاء الآخرون بقية التكلفة وفق الاتفاق.',
    'تُدار الميزانية المشتركة بحساب موحد وتقارير مالية شهرية تُتاح للطرفين.'
  ],
  execution: [
    'يتولى الطرف الثاني تنفيذ الأعمال بنفسه أو عبر مقاول مؤهل يعتمده الطرف الأول، وفق المواصفات والكودات المعتمدة.',
    'تخضع الأعمال لفحوص جودة يجريها الطرف الأول أو من يكلفه، ويُعالج الطرف الثاني الملاحظات خلال 15 يومًا.'
  ],
  operation: [
    'يتولى الطرف الثاني تشغيل وصيانة الأصل طوال مدة الاتفاقية بمؤشرات جودة معلنة (زمن الاستجابة، حالة الأصول، النظافة).',
    'يقدّم الطرف الثاني تقريرًا تشغيليًا ربع سنوي ويسمح للطرف الأول بالتفتيش في أي وقت.'
  ],
  inKind: [
    'يقدّم الطرف الثاني مساهمة عينية (مواد، أعمال، ساعات تطوعية) بالقيمة والمواصفات المحددة في بند المساهمة.',
    'تُستلم المساهمة العينية بمحضر استلام موقع، ولا تُقبل بدائل دون موافقة كتابية من الطرف الأول.'
  ],
  sponsorship: [
    'يقدّم الطرف الثاني الرعاية المالية المحددة، مقابل حق الظهور التعريفي في الموقع وفق دليل هوية الأمانة.',
    'لا يمنح حق الرعاية أي تصرف في الأصل العام أو تسميته، ويخضع أي ظهور إعلاني لموافقة الطرف الأول المسبقة.'
  ]
};

const GENERAL_CLAUSES = [
  'يظل الأصل الناتج عن المبادرة ملكًا عامًا لأمانة منطقة المدينة المنورة، وتُسلَّم مخرجاته بمحضر استلام نهائي.',
  'يلتزم الطرف الثاني بأنظمة السلامة والبيئة والاشتراطات البلدية، ويتحمل مسؤولية أي ضرر ناتج عن أعماله.',
  'يقدّم الطرف الثاني تقارير تقدم ميدانية عبر بوابة الشركاء، ويحق للطرف الأول طلب توضيحات أو زيارات ميدانية.',
  'تُقاس منافع المبادرة وفق المؤشرات المستهدفة المسجلة في المنصة، وتُعلن النتائج بعد اعتمادها من الطرف الأول.',
  'يحق للطرف الأول إنهاء الاتفاقية بإشعار كتابي قبل 30 يومًا عند الإخلال الجوهري دون معالجة خلال المهلة الممنوحة.',
  'تُحل الخلافات وديًا خلال 30 يومًا، وإلا فتُحال للجهة المختصة نظامًا في المدينة المنورة.',
  'يُعد الاعتماد الإلكتروني عبر منصة المبادرات بمثابة التوقيع، ويُوثَّق بتاريخه ومعرّف الحساب المعتمِد في سجل المنصة.'
];

export function modelClauses(model) {
  return MODEL_CLAUSES[model] || MODEL_CLAUSES.coFunding;
}

// كل بنود الاتفاقية لمجموعة نماذج (بنود النماذج ثم البنود العامة)
export function clausesForModels(models = []) {
  const uniq = [...new Set(models)];
  return [...uniq.flatMap((m) => modelClauses(m)), ...GENERAL_CLAUSES];
}

// بناء مسودة الاتفاقية من المبادرة وروابط الشركاء — دالة نقية قابلة للاختبار
export function buildAgreement({ initiative, links = [], partners = [], issuedBy = '', durationMonths = 12, now = new Date().toISOString() }) {
  const parties = links.map((l) => {
    const p = partners.find((x) => x.id === l.partnerId);
    return {
      partnerId: l.partnerId,
      name: p?.name || l.partnerId,
      representative: p?.contactName || '',
      model: l.model,
      modelLabel: PARTNERSHIP_MODELS.find((m) => m.id === l.model)?.label || l.model,
      contribution: l.contribution || '',
      approvedAt: null,
      approvedBy: ''
    };
  });
  if (!parties.length) throw new Error('لا يمكن إصدار اتفاقية دون شريك مرتبط بالمبادرة');

  const models = [...new Set(parties.map((p) => p.model))];
  const clauses = clausesForModels(models);

  return {
    id: null,
    initiativeId: initiative.id,
    initiativeTitle: initiative.title,
    district: initiative.district,
    location: initiative.location || '',
    budget: initiative.budget ?? null,
    joint: parties.length > 1,
    parties,
    models,
    durationMonths,
    startDate: initiative.startDate || null,
    clauses,
    status: 'issued',
    issuedAt: now,
    issuedBy,
    amanah: { approvedAt: null, approvedBy: '' },
    signedAt: null,
    version: 1
  };
}

// الحالة المحسوبة من اعتمادات الأطراف
export function computeAgreementStatus(agreement) {
  if (agreement.status === 'cancelled') return 'cancelled';
  const partnersDone = (agreement.parties || []).length > 0 && agreement.parties.every((p) => p.approvedAt);
  const amanahDone = Boolean(agreement.amanah?.approvedAt);
  if (partnersDone && amanahDone) return 'signed';
  if (partnersDone) return 'partnerApproved';
  if (amanahDone) return 'amanahApproved';
  return 'issued';
}

export function agreementStatusLabel(status) {
  return AGREEMENT_STATUS[status]?.label || status;
}

// اعتماد طرف شريك — يعيد نسخة جديدة بحالة محدثة
export function approveByPartner(agreement, partnerId, { by = '', now = new Date().toISOString() } = {}) {
  const party = (agreement.parties || []).find((p) => p.partnerId === partnerId);
  if (!party) throw new Error('جهتكم ليست طرفًا في هذه الاتفاقية');
  if (party.approvedAt) throw new Error('سبق اعتماد الاتفاقية من جهتكم');
  if (agreement.status === 'cancelled') throw new Error('الاتفاقية ملغاة');
  const next = {
    ...agreement,
    parties: agreement.parties.map((p) => p.partnerId === partnerId ? { ...p, approvedAt: now, approvedBy: by } : p)
  };
  next.status = computeAgreementStatus(next);
  if (next.status === 'signed') next.signedAt = now;
  return next;
}

export function approveByAmanah(agreement, { by = '', now = new Date().toISOString() } = {}) {
  if (agreement.amanah?.approvedAt) throw new Error('سبق اعتماد الاتفاقية من الأمانة');
  if (agreement.status === 'cancelled') throw new Error('الاتفاقية ملغاة');
  const next = { ...agreement, amanah: { approvedAt: now, approvedBy: by } };
  next.status = computeAgreementStatus(next);
  if (next.status === 'signed') next.signedAt = now;
  return next;
}

export function isSigned(agreement) {
  return Boolean(agreement) && computeAgreementStatus(agreement) === 'signed';
}
