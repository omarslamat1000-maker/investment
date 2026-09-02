// سجل الشركاء — جهات القطاع الخاص وغير الربحي والمجموعات المجتمعية
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader } from '../../ui/components.js';
import { renderTable } from '../../ui/table.js';
import { partnerTypeLabel, modelLabel, newPartner, validatePartner, sanitizePartner } from '../../domain/partner-model.js';
import { PARTNER_TYPES, PARTNERSHIP_MODELS } from '../../core/constants.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { openModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { fmtMoney, sum, fmtNumber } from '../../core/utils.js';
import { scorecardsByPartner, SCORECARD_COMPONENTS } from '../../domain/partner-scorecard.js';
import { ratingStarsHtml } from '../../ui/components.js';

export async function renderPartners(container) {
  const [partners, links, initiatives, milestones, benefits, qualityChecks, progressReports] = await Promise.all([
    repos.partners.getAll(), repos.initiativePartners.getAll(), repos.initiatives.getAll(),
    repos.milestones.getAll(), repos.benefits.getAll(), repos.qualityChecks.getAll(),
    repos.progressReports.getAll().catch(() => [])
  ]);
  const role = getRole();
  // بطاقة الأداء المحسوبة لكل شريك من سجله الفعلي
  const cards = scorecardsByPartner(partners, { links, initiatives, milestones, benefits, qualityChecks, progressReports });
  const cardOf = (pid) => cards[pid];

  const initiativesOf = (pid) => links.filter((l) => l.partnerId === pid);
  const contributionOf = (pid) => sum(
    initiativesOf(pid).map((l) => initiatives.find((i) => i.id === l.initiativeId)).filter(Boolean),
    (i) => i.budget);

  container.innerHTML = html`
    ${raw(sectionHeader('سجل الشركاء', 'الجهات المتعاونة مع الأمانة في مبادرات البنية التحتية',
    can(role, 'partners.create') ? '<button class="mi-btn mi-btn--primary" data-act="new">تسجيل شريك</button>' : ''))}
    <div class="mi-table-host"></div>`;

  renderTable(container.querySelector('.mi-table-host'), partners, [
    { key: 'id', label: 'المعرّف', width: '9rem' },
    { key: 'name', label: 'الجهة' },
    { key: 'type', label: 'النوع', map: (r) => partnerTypeLabel(r.type) },
    { key: 'initiatives', label: 'مبادرات مرتبطة', map: (r) => String(initiativesOf(r.id).length), sortValue: (r) => initiativesOf(r.id).length },
    { key: 'contribution', label: 'قيمة المبادرات', map: (r) => fmtMoney(contributionOf(r.id)), sortValue: (r) => contributionOf(r.id) },
    { key: 'rating', label: 'بطاقة الأداء', htmlMap: (r) => { const c = cardOf(r.id); return ratingStarsHtml(c.rating, { label: c.band.label }) + (c.overall !== null ? ` <small class="mi-muted">${fmtNumber(c.overall)}</small>` : ''); }, map: (r) => { const c = cardOf(r.id); return c.rating ? `${c.rating}/5` : 'جديد'; }, sortValue: (r) => cardOf(r.id).overall ?? -1 },
    { key: 'active', label: 'الحالة', map: (r) => r.active ? 'فاعل' : 'موقوف' }
  ], {
    searchable: true, initialSort: 'id',
    onRowClick: (r) => openPartnerModal(r),
    emptyText: 'لا يوجد شركاء مسجلون'
  });

  container.querySelector('[data-act="new"]')?.addEventListener('click', () => openPartnerModal(null));

  function openPartnerModal(existing) {
    const partner = existing || newPartner();
    const editable = can(role, existing ? 'partners.edit' : 'partners.create');
    const linked = existing ? initiativesOf(existing.id) : [];
    const card = existing ? cardOf(existing.id) : null;
    const scorecardHtml = card ? `
      <div class="mi-scorecard">
        <div class="mi-scorecard__head">
          <div><h4 class="mi-subhead">بطاقة الأداء المحسوبة</h4><small class="mi-muted">${escapeHtml(card.band.label)} — من ${escapeHtml(fmtNumber(card.sample.initiatives))} مبادرة وصلت التنفيذ (${escapeHtml(fmtNumber(card.sample.closed))} مغلقة)</small></div>
          <div class="mi-scorecard__overall">${card.overall !== null ? `<b>${escapeHtml(fmtNumber(card.overall))}</b><small>/100</small>` : '<b>—</b>'}<div>${ratingStarsHtml(card.rating, { label: card.band.label })}</div></div>
        </div>
        ${card.components.map((c) => `
          <div class="mi-scorecard__row" data-available="${c.available ? 'yes' : 'no'}">
            <span>${escapeHtml(c.label)} <small class="mi-muted">(وزن ${escapeHtml(String(c.weight))})</small></span>
            <span class="mi-hbar__track"><span class="mi-hbar__fill" style="width:${c.available ? c.value : 0}%"></span></span>
            <b>${c.available ? escapeHtml(fmtNumber(c.value)) + '٪' : 'لا بيانات'}</b>
          </div>`).join('')}
        <small class="mi-muted">الأدلة: ${escapeHtml(fmtNumber(card.sample.milestones))} معلمًا، ${escapeHtml(fmtNumber(card.sample.qualityChecks))} فحص جودة، ${escapeHtml(fmtNumber(card.sample.benefits))} منفعة مقيسة، ${escapeHtml(fmtNumber(card.sample.reports))} تقريرًا ميدانيًا مبتوتًا فيه.</small>
      </div>` : '';
    const { dialog, close } = openModal({
      title: existing ? existing.name : 'تسجيل شريك جديد',
      wide: true,
      bodyHtml: html`
        <form class="mi-form" id="mi-partner-form">
          <div class="mi-form-row">
            <div class="mi-form-field"><label>اسم الجهة</label><input class="mi-input" name="name" value="${partner.name}" ${editable ? '' : raw('readonly')}></div>
            <div class="mi-form-field"><label>النوع</label>
              <select class="mi-input" name="type" ${editable ? '' : raw('disabled')}>${raw(PARTNER_TYPES.map((t) => `<option value="${t.id}" ${t.id === partner.type ? 'selected' : ''}>${t.label}</option>`).join(''))}</select></div>
            <div class="mi-form-field"><label>السجل / الترخيص</label><input class="mi-input" name="crNumber" value="${partner.crNumber}" ${editable ? '' : raw('readonly')}></div>
          </div>
          <div class="mi-form-row">
            <div class="mi-form-field"><label>ممثل الجهة</label><input class="mi-input" name="contactName" value="${partner.contactName}" ${editable ? '' : raw('readonly')}></div>
            <div class="mi-form-field"><label>البريد</label><input class="mi-input" name="contactEmail" type="email" value="${partner.contactEmail}" ${editable ? '' : raw('readonly')}></div>
            <div class="mi-form-field"><label>الجوال</label><input class="mi-input" name="contactPhone" value="${partner.contactPhone}" ${editable ? '' : raw('readonly')}></div>
          </div>
          <fieldset class="mi-form-field"><legend>نماذج الشراكة المتاحة</legend>
            <div class="mi-check-grid">
              ${raw(PARTNERSHIP_MODELS.map((m) => `<label class="mi-check-item"><input type="checkbox" name="models" value="${m.id}" ${partner.models?.includes(m.id) ? 'checked' : ''} ${editable ? '' : 'disabled'}><span>${m.label}</span></label>`).join(''))}
            </div>
          </fieldset>
          <div class="mi-form-field"><label>ملاحظات</label><textarea class="mi-input" name="notes" rows="2" ${editable ? '' : raw('readonly')}>${partner.notes}</textarea></div>
        </form>
        ${raw(scorecardHtml)}
        ${linked.length ? raw(`<h4 class="mi-subhead">المبادرات المرتبطة</h4>` + linked.map((l) => {
      const ini = initiatives.find((i) => i.id === l.initiativeId);
      return `<div class="mi-partner-line"><a href="#/initiatives/${escapeHtml(l.initiativeId)}" data-close-modal>${escapeHtml(ini?.title || l.initiativeId)}</a><span class="mi-tag">${escapeHtml(modelLabel(l.model))}</span></div>`;
    }).join('')) : ''}`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إغلاق</button>
        ${editable ? raw('<button class="mi-btn mi-btn--primary" data-act="save">حفظ</button>') : ''}`
    });

    dialog.querySelectorAll('[data-close-modal]').forEach((a) => a.addEventListener('click', close));
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="save"]')?.addEventListener('click', async () => {
      const form = dialog.querySelector('#mi-partner-form');
      const record = sanitizePartner({
        ...partner,
        name: form.name.value, type: form.type.value, crNumber: form.crNumber.value,
        contactName: form.contactName.value, contactEmail: form.contactEmail.value, contactPhone: form.contactPhone.value,
        models: [...form.querySelectorAll('input[name="models"]:checked')].map((c) => c.value),
        notes: form.notes.value
      });
      const check = validatePartner(record);
      if (!check.valid) { toastError(Object.values(check.errors)[0]); return; }
      if (existing) await repos.partners.update(existing.id, record);
      else await repos.partners.create(record);
      close();
      toastSuccess('حُفظ سجل الشريك');
      renderPartners(container);
    });
  }
}
