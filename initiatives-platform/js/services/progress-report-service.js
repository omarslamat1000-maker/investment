// تقارير التقدم الميدانية — يرفعها الشريك من بوابته (نسبة + صور + ملاحظة لكل مَعلم)،
// ويعتمدها مكتب إدارة المبادرات قبل أن تنعكس على الإنجاز المعلن للجمهور
import { repos } from '../data/repositories.js';
import { uid } from '../core/utils.js';
import { nowIso } from '../core/date-time.js';
import { notify } from './notification-service.js';

export const REPORT_STATUS = {
  pending: { id: 'pending', label: 'بانتظار الاعتماد' },
  approved: { id: 'approved', label: 'معتمد' },
  rejected: { id: 'rejected', label: 'مرفوض' }
};

export const MAX_REPORT_PHOTOS = 4;
const REPORTABLE = ['execution', 'benefits'];

// الشريك يقدّم تقريرًا — يتحقق من ارتباطه بالمبادرة ومرحلتها
export async function submitProgressReport({ initiative, session, milestoneId = null, percent, note, photos = [] }) {
  if (!session?.partnerId) throw new Error('رفع التقارير الميدانية متاح لحسابات الجهات الشريكة فقط');
  if (!REPORTABLE.includes(initiative.status)) throw new Error('التقارير الميدانية تُرفع للمبادرات قيد التنفيذ أو قياس المنافع فقط');
  const links = await repos.initiativePartners.byInitiative(initiative.id);
  if (!links.some((l) => l.partnerId === session.partnerId)) throw new Error('جهتكم ليست شريكًا مسجلًا في هذه المبادرة');
  const p = Number(percent);
  if (!Number.isFinite(p) || p < 0 || p > 100) throw new Error('نسبة الإنجاز يجب أن تكون بين 0 و100');
  if (String(note || '').trim().length < 10) throw new Error('اكتب وصفًا للأعمال المنجزة (10 أحرف على الأقل)');
  if (photos.length > MAX_REPORT_PHOTOS) throw new Error(`الحد الأقصى ${MAX_REPORT_PHOTOS} صور للتقرير الواحد`);

  const partner = await repos.partners.get(session.partnerId);
  const report = await repos.progressReports.create({
    id: uid('pr'),
    initiativeId: initiative.id,
    partnerId: session.partnerId,
    partnerName: partner?.name || session.name,
    milestoneId: milestoneId || null,
    percent: Math.round(p),
    note: String(note).trim(),
    photos: [...photos],
    status: 'pending',
    at: nowIso(),
    reviewedAt: null, reviewedBy: '', reviewNote: ''
  });
  await notify('تقرير تقدم ميداني جديد', `${report.partnerName} — «${initiative.title}» بنسبة ${report.percent}٪ بانتظار الاعتماد`, 'info');
  return report;
}

// مراجعة مكتب المبادرات: الاعتماد يحدّث الإنجاز المعلن ويُنجز المَعلم عند 100٪
export async function reviewProgressReport(reportId, { approve, note = '', by = '' }) {
  const report = await repos.progressReports.get(reportId);
  if (!report) throw new Error('التقرير غير موجود');
  if (report.status !== 'pending') throw new Error('سبق البت في هذا التقرير');
  const updated = await repos.progressReports.update(reportId, {
    status: approve ? 'approved' : 'rejected',
    reviewedAt: nowIso(), reviewedBy: by, reviewNote: String(note || '').trim()
  });
  if (approve) {
    const initiative = await repos.initiatives.get(report.initiativeId);
    if (initiative) {
      const current = Number(initiative.progressPercentage) || 0;
      await repos.initiatives.update(initiative.id, {
        progressPercentage: Math.max(current, report.percent),
        lastFieldUpdateAt: report.at
      });
    }
    if (report.milestoneId && report.percent >= 100) {
      const ms = await repos.milestones.get(report.milestoneId);
      if (ms && !ms.done) await repos.milestones.update(ms.id, { done: true, doneAt: report.at });
    }
  }
  await notify(approve ? 'اعتُمد تقرير تقدم ميداني' : 'رُفض تقرير تقدم ميداني',
    `${report.partnerName} — ${report.percent}٪${note ? ' — ' + note : ''}`, approve ? 'info' : 'warn');
  return updated;
}

export async function reportsForInitiative(initiativeId) {
  return repos.progressReports.byInitiative(initiativeId);
}

export async function pendingReports() {
  const all = await repos.progressReports.getAll().catch(() => []);
  return all.filter((r) => r.status === 'pending');
}
