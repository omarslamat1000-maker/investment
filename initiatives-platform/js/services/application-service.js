// طلبات التقديم على الفرص والمفاضلة بينها
// الشريك يقدّم على فرصة مطروحة، ولجنة الفرز تعتمد متقدمًا واحدًا أو شراكة مشتركة
// فتُنشأ مبادرة مرتبطة بكل المعتمدين وتُغلق الفرصة كمُتبنّاة
import { repos } from '../data/repositories.js';
import { uid } from '../core/utils.js';
import { nowIso } from '../core/date-time.js';
import { newInitiative, sanitizeInitiative } from '../domain/initiative-model.js';
import { notify } from './notification-service.js';

export const APPLICATION_STATUS = {
  applied: { id: 'applied', label: 'بانتظار الفرز' },
  accepted: { id: 'accepted', label: 'معتمد' },
  rejected: { id: 'rejected', label: 'اعتذار' }
};

// تقديم شريك على فرصة — يمنع التكرار ويتحقق من الطرح
export async function applyToNeed({ need, session, model, proposal }) {
  if (!session?.partnerId) throw new Error('التقديم متاح لحسابات الجهات الشريكة المعتمدة فقط');
  if (need.status !== 'published') throw new Error('هذه الفرصة غير مطروحة للتقديم حاليًا');
  if (String(proposal || '').trim().length < 20) {
    throw new Error('اكتب مقترح مساهمتكم (20 حرفًا على الأقل)');
  }
  const all = await repos.needApplications.getAll();
  if (all.some((a) => a.needId === need.id && a.partnerId === session.partnerId)) {
    throw new Error('سبق لجهتكم التقديم على هذه الفرصة — تابعوا حالته من بوابتكم');
  }
  const partner = await repos.partners.get(session.partnerId);
  const application = await repos.needApplications.create({
    id: uid('app'),
    needId: need.id,
    partnerId: session.partnerId,
    partnerName: partner?.name || session.name,
    model: model || 'coFunding',
    proposal: String(proposal).trim(),
    status: 'applied',
    at: nowIso()
  });
  await notify('طلب تقديم جديد على فرصة',
    `${application.partnerName} تقدمت على «${need.title}» — بانتظار المفاضلة`, 'info');
  return application;
}

// حفظ درجات المفاضلة (1..5 لكل معيار) وملاحظة لجنة الفرز على طلب
export async function scoreApplication(applicationId, { scores = {}, note = '', by = '' } = {}) {
  const app = await repos.needApplications.get(applicationId);
  if (!app) throw new Error('الطلب غير موجود');
  const clean = {};
  for (const [k, v] of Object.entries(scores)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 1 && n <= 5) clean[k] = Math.round(n);
  }
  return repos.needApplications.update(applicationId, {
    scores: clean, screeningNote: String(note || '').trim(), scoredBy: by, scoredAt: nowIso()
  });
}

// استبعاد متقدم واحد من الفرز دون إغلاق الفرصة
export async function rejectApplication(applicationId, { reason = '', by = '' } = {}) {
  const app = await repos.needApplications.get(applicationId);
  if (!app) throw new Error('الطلب غير موجود');
  if (app.status !== 'applied') throw new Error('سبق البت في هذا الطلب');
  const updated = await repos.needApplications.update(applicationId, {
    status: 'rejected', decidedAt: nowIso(), decidedBy: by, decisionReason: String(reason || '').trim(), resultInitiativeId: null
  });
  await notify('استبعاد من المفاضلة', `${app.partnerName} — ${reason || 'قرار لجنة الفرز'}`, 'warn');
  return updated;
}

export async function applicationsForNeed(needId) {
  const all = await repos.needApplications.getAll();
  return all.filter((a) => a.needId === needId);
}

export async function partnerApplications(partnerId) {
  const all = await repos.needApplications.getAll();
  return all.filter((a) => a.partnerId === partnerId);
}

// المفاضلة: اعتماد متقدم واحد أو أكثر (شراكة مشتركة) وإنشاء المبادرة الموحدة
export async function adoptNeed({ need, applications, selectedIds, byName = 'لجنة الفرز' }) {
  const selected = applications.filter((a) => selectedIds.includes(a.id));
  if (!selected.length) throw new Error('حدد متقدمًا واحدًا على الأقل للاعتماد');

  const names = selected.map((a) => a.partnerName).join(' و ');
  const joint = selected.length > 1;
  const summary = [
    `تبنٍّ ${joint ? 'مشترك' : ''} للفرصة المطروحة ${need.id}: ${need.description}`.trim(),
    need.expectedImpact ? `الأثر المستهدف: ${need.expectedImpact}` : ''
  ].filter(Boolean).join(' — ');

  // مبادرة موحدة باسم الفرصة يرتبط بها كل المعتمدين
  const record = sanitizeInitiative(newInitiative({
    title: need.title,
    summary,
    problem: need.description,
    category: need.category,
    district: need.district,
    location: need.location || '',
    lat: need.lat ?? null,
    lng: need.lng ?? null,
    sites: need.geometry?.coords?.length
      ? [{ id: uid('site'), name: 'موقع الفرصة', geometry: need.geometry }] : [],
    budget: need.estimatedCost ?? null,
    beneficiaries: need.beneficiaries ?? null,
    expectedImpact: need.expectedImpact || '',
    fundingModel: selected[0].model,
    channel: 'partner',
    status: 'draft',
    submitterName: names,
    submitterEntity: joint ? 'شراكة مشتركة بين الجهات المعتمدة' : selected[0].partnerName,
    notes: `أُنشئت بالمفاضلة على الفرصة ${need.id} — ${joint ? 'اعتماد شراكة مشتركة' : 'اعتماد متقدم واحد'} (${names})`
  }));
  const created = await repos.initiatives.create(record);
  const initiative = await repos.initiatives.transition(created.id, 'submitted', { by: byName });

  // ربط كل المعتمدين بالمبادرة الواحدة (أكثر من مستخدم في مبادرة واحدة)
  for (const app of selected) {
    await repos.initiativePartners.create({
      id: uid('ip'),
      initiativeId: created.id,
      partnerId: app.partnerId,
      model: app.model,
      contribution: app.proposal.slice(0, 120),
      signedAt: null
    });
  }

  // تحديث حالات الطلبات + إغلاق الفرصة كمُتبنّاة
  for (const app of applications) {
    const accepted = selectedIds.includes(app.id);
    await repos.needApplications.update(app.id, {
      status: accepted ? 'accepted' : 'rejected',
      decidedAt: nowIso(),
      resultInitiativeId: accepted ? created.id : null
    });
  }
  await repos.needs.update(need.id, { status: 'matched', matchedInitiativeId: created.id });

  await notify('اعتماد مفاضلة فرصة',
    `«${need.title}» — ${joint ? 'شراكة مشتركة' : 'متقدم واحد'}: ${names} ← المبادرة ${created.id}`, 'info');
  return initiative || created;
}
