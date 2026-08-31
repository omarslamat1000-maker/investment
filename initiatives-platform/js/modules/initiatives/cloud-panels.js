// لوحات وضع السحابة في تفاصيل المبادرة — الحوكمة الرسمية، لوحة المشرف،
// الملاحظات (مع الداخلية)، المرفقات الموقعة، والخط الزمني من قاعدة البيانات
import { getSupabase } from '../../data/supabase-client.js';
import { cloudHistory, initiativeUuid } from '../../data/cloud-provider.js';
import { CLOUD_STATUS_LABELS } from '../../data/cloud-status-map.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { progressBar, definitionList } from '../../ui/components.js';
import { fmtDateTime } from '../../core/date-time.js';
import { fmtNumber } from '../../core/utils.js';
import { getSession, getRole } from '../../core/state.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { uploadCloudAttachment, openCloudAttachment, listCloudAttachments, removeCloudAttachment } from '../../services/attachment-service.js';

const REVIEWER_ROLES = ['admin', 'supervisor'];

export async function renderCloudPanels(host, initiative, rerender) {
  const session = getSession();
  const role = getRole();
  const isReviewer = REVIEWER_ROLES.includes(role);
  const client = await getSupabase();
  const uuid = initiative._uuid || await initiativeUuid(initiative.id);

  const [historyRows, commentsRes, profilesRes, orgsRes, attachments] = await Promise.all([
    cloudHistory(initiative.id),
    client.from('initiative_comments').select('*').eq('initiative_id', uuid).order('created_at'),
    isReviewer ? client.from('profiles').select('id, full_name, role').eq('is_active', true) : Promise.resolve({ data: [] }),
    client.from('organizations').select('id, name_ar'),
    listCloudAttachments(initiative.id)
  ]);
  const comments = commentsRes.data || [];
  const profiles = profilesRes.data || [];
  const orgName = (orgsRes.data || []).find((o) => o.id === initiative.organizationId)?.name_ar || '—';
  const supervisors = profiles.filter((p) => p.role === 'supervisor' || p.role === 'admin');
  const nameOf = (uid) => profiles.find((p) => p.id === uid)?.full_name
    || (uid === session?.userId ? session.name : (uid ? 'مستخدم' : 'النظام'));
  const canAttach = isReviewer || (role === 'agency_user' && ['draft', 'returned'].includes(initiative.status));

  host.innerHTML = html`
    <section class="mi-card mi-card--span">
      <h3>الحوكمة الرسمية (Supabase)</h3>
      ${raw(definitionList([
    ['الرقم الرسمي', initiative.id],
    ['الجهة المالكة', orgName],
    ['الحالة الرسمية', CLOUD_STATUS_LABELS[initiative.cloudStatus] || initiative.cloudStatus],
    ['المرحلة الحالية', initiative.currentStage || '—'],
    ['المشرف المعيّن', initiative.assignedSupervisorId ? nameOf(initiative.assignedSupervisorId) : '—']
  ]))}
      ${raw(progressBar(initiative.progressPercentage || 0, 'نسبة الإنجاز'))}

      ${isReviewer ? raw(html`
      <div class="mi-cloud-supervise">
        <h4 class="mi-subhead">لوحة المشرف — تحديث المتابعة</h4>
        <div class="mi-form-row">
          <div class="mi-form-field"><label>المرحلة الحالية</label>
            <input class="mi-input" data-cp="stage" value="${initiative.currentStage || ''}" placeholder="مثال: التصميم التفصيلي"></div>
          <div class="mi-form-field"><label>نسبة الإنجاز ٪</label>
            <input class="mi-input" data-cp="progress" type="number" min="0" max="100" value="${String(initiative.progressPercentage || 0)}"></div>
          <div class="mi-form-field"><label>مسؤول المتابعة</label>
            <select class="mi-input" data-cp="supervisor">
              <option value="">—</option>
              ${raw(supervisors.map((s) => `<option value="${escapeHtml(s.id)}" ${s.id === initiative.assignedSupervisorId ? 'selected' : ''}>${escapeHtml(s.full_name)}</option>`).join(''))}
            </select></div>
        </div>
        <button class="mi-btn mi-btn--primary mi-btn--sm" data-cp="save">حفظ المتابعة</button>
      </div>`) : ''}

      <h4 class="mi-subhead">الخط الزمني الرسمي للحالات</h4>
      <div class="mi-timeline">
        ${historyRows.length ? raw([...historyRows].reverse().map((h) => html`
          <div class="mi-timeline__item">
            <time>${fmtDateTime(h.created_at)}</time>
            <div>
              <b>${CLOUD_STATUS_LABELS[h.previous_status] || h.previous_status || 'البداية'} ← ${CLOUD_STATUS_LABELS[h.new_status] || h.new_status}</b>
              <small class="mi-muted"> — ${nameOf(h.changed_by)}</small>
              ${h.reason ? raw(`<p class="mi-decision-note">السبب: ${escapeHtml(h.reason)}</p>`) : ''}
            </div>
          </div>`).join('')) : raw('<p class="mi-muted">لا انتقالات مسجلة بعد</p>')}
      </div>
    </section>

    <section class="mi-card">
      <h3>الملاحظات والتوصيات</h3>
      <div class="mi-cloud-comments">
        ${comments.length ? raw(comments.map((c) => html`
          <div class="mi-comment" data-internal="${c.is_internal ? 'yes' : 'no'}">
            <div class="mi-comment__head">
              <b>${nameOf(c.user_id)}</b>
              ${c.is_internal ? raw('<span class="mi-tag" data-benefit="atRisk">داخلية</span>') : ''}
              <small class="mi-muted">${fmtDateTime(c.created_at)}</small>
            </div>
            <p>${c.comment}</p>
          </div>`).join('')) : raw('<p class="mi-muted">لا ملاحظات بعد</p>')}
      </div>
      <div class="mi-form-field">
        <textarea class="mi-input" data-cp="comment" rows="2" placeholder="أضف ملاحظة…"></textarea>
        ${isReviewer ? raw('<label class="mi-check-item"><input type="checkbox" data-cp="internal"><span>ملاحظة داخلية (لا تظهر لحساب الجهة)</span></label>') : ''}
        <button class="mi-btn mi-btn--ghost mi-btn--sm" data-cp="add-comment">إضافة الملاحظة</button>
      </div>
    </section>

    <section class="mi-card">
      <h3>المرفقات والوثائق الداعمة</h3>
      <div class="mi-cloud-attachments">
        ${attachments.length ? raw(attachments.map((a) => html`
          <div class="mi-attachment-row">
            <span class="mi-attachment-row__name">📎 ${a.name}</span>
            <small class="mi-muted">${fmtNumber(Math.round((a.size || 0) / 1024))} ك.ب</small>
            <button class="mi-btn mi-btn--ghost mi-btn--sm" data-open-att="${a.id}">فتح</button>
            ${(a.uploadedBy === session?.userId && ['draft', 'returned'].includes(initiative.status)) || role === 'admin'
      ? raw(`<button class="mi-btn mi-btn--ghost mi-btn--sm" data-del-att="${escapeHtml(a.id)}">حذف</button>`) : ''}
          </div>`).join('')) : raw('<p class="mi-muted">لا مرفقات — الأنواع المسموحة: PDF, DOCX, XLSX, JPG, PNG (حتى 10 م.ب)</p>')}
      </div>
      ${canAttach ? raw('<button class="mi-btn mi-btn--primary mi-btn--sm" data-cp="upload">رفع مرفق</button>') : ''}
    </section>`;

  // حفظ المتابعة (المشرف)
  host.querySelector('[data-cp="save"]')?.addEventListener('click', async () => {
    const stage = host.querySelector('[data-cp="stage"]').value.trim();
    const progress = Math.max(0, Math.min(100, Number(host.querySelector('[data-cp="progress"]').value) || 0));
    const supervisorId = host.querySelector('[data-cp="supervisor"]').value || null;
    const { error } = await client.from('initiatives').update({
      current_stage: stage || null,
      progress_percentage: progress,
      assigned_supervisor_id: supervisorId
    }).eq('id', uuid);
    if (error) { toastError(error.message); return; }
    toastSuccess('حُدّثت بيانات المتابعة');
    rerender();
  });

  // إضافة ملاحظة
  host.querySelector('[data-cp="add-comment"]')?.addEventListener('click', async () => {
    const text = host.querySelector('[data-cp="comment"]').value.trim();
    if (text.length < 3) { toastError('اكتب الملاحظة أولًا'); return; }
    const isInternal = host.querySelector('[data-cp="internal"]')?.checked || false;
    const { error } = await client.from('initiative_comments').insert({
      initiative_id: uuid, user_id: session.userId, comment: text, is_internal: isInternal
    });
    if (error) { toastError(error.message); return; }
    toastSuccess('أُضيفت الملاحظة');
    rerender();
  });

  // المرفقات
  host.querySelector('[data-cp="upload"]')?.addEventListener('click', async () => {
    try {
      const uploaded = await uploadCloudAttachment(initiative);
      if (uploaded) { toastSuccess(`رُفع: ${uploaded.name}`); rerender(); }
    } catch (err) { toastError(err.message); }
  });
  host.querySelectorAll('[data-open-att]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      try { await openCloudAttachment(btn.dataset.openAtt); }
      catch (err) { toastError(err.message); }
    }));
  host.querySelectorAll('[data-del-att]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      try {
        await removeCloudAttachment(btn.dataset.delAtt);
        toastSuccess('حُذف المرفق');
        rerender();
      } catch (err) { toastError(err.message); }
    }));
}
