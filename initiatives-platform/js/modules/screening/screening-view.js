// شاشة الفرز — مقارنة المتقدمين على الفرصة الواحدة جنبًا إلى جنب:
// البيانات الأساسية للجهة (من حسابها) والتفصيلية (من نموذج التقديم) ثم معايير موزونة
// (عامة + خاصة بالفرصة) تعطي كل متقدم نسبة، فترتيب، ثم اعتماد الأقرب للتنفيذ أو الاستبعاد
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, kpiCard, ratingStarsHtml, emptyState } from '../../ui/components.js';
import { applicantPercent, suggestedScores, rankApplicants, percentBand, isFullyScored, totalWeight, sanitizeCriteria, DEFAULT_SCREENING_CRITERIA } from '../../domain/applicant-scoring.js';
import { APPLICATION_FIELDS, bestApplicantsByField, formatDetail, detailsCompleteness } from '../../domain/application-details.js';
import { getGlobalCriteria, saveGlobalCriteria, saveNeedCriteria, criteriaForNeed } from '../../services/screening-criteria-service.js';
import { APPLICATION_STATUS, adoptNeed, scoreApplication, rejectApplication } from '../../services/application-service.js';
import { partnerScorecard } from '../../domain/partner-scorecard.js';
import { modelLabel, partnerTypeLabel } from '../../domain/partner-model.js';
import { categoryLabel } from '../../domain/initiative-model.js';
import { PRIORITY_LABELS, needStatusLabel } from '../../domain/infrastructure-need-model.js';
import { fmtMoney, fmtNumber, sortBy, debounce, uid } from '../../core/utils.js';
import { fmtDate } from '../../core/date-time.js';
import { getRole, getSession } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { confirmModal, openModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { navigate } from '../../router.js';

let selectedNeedId = null;
const FMT = { fmtMoney, fmtNumber, fmtDate };

export async function renderScreening(container, presetNeedId = null) {
  const [needs, apps, partners, links, initiatives, milestones, benefits, qualityChecks, progressReports, globalCriteria] = await Promise.all([
    repos.needs.getAll(), repos.needApplications.getAll().catch(() => []), repos.partners.getAll(),
    repos.initiativePartners.getAll(), repos.initiatives.getAll(), repos.milestones.getAll(),
    repos.benefits.getAll(), repos.qualityChecks.getAll(), repos.progressReports.getAll().catch(() => []),
    getGlobalCriteria()
  ]);
  const role = getRole();
  const canDecide = can(role, 'decisions.create');
  const canManageCriteria = can(role, 'settings.view') || role === 'admin';
  const scorecardOf = (pid) => partnerScorecard({ partnerId: pid, links, initiatives, milestones, benefits, qualityChecks, progressReports });

  const withApps = needs
    .map((n) => ({ need: n, apps: apps.filter((a) => a.needId === n.id) }))
    .filter((x) => x.apps.length);
  const open = withApps.filter((x) => x.need.status === 'published');
  const pendingCount = open.reduce((s, x) => s + x.apps.filter((a) => a.status === 'applied').length, 0);
  const multi = open.filter((x) => x.apps.filter((a) => a.status === 'applied').length > 1).length;

  if (presetNeedId) selectedNeedId = presetNeedId;
  if (!withApps.some((x) => x.need.id === selectedNeedId)) selectedNeedId = (open[0] || withApps[0])?.need.id || null;

  container.innerHTML = html`
    ${raw(sectionHeader('الفرز والمفاضلة بين المتقدمين',
    'مقارنة من تقدّم على الفرصة الواحدة ببياناتهم الأساسية والتفصيلية ومعايير موزونة، ثم اعتماد الأقرب للتنفيذ منفردًا أو بشراكة مشتركة',
    canManageCriteria ? '<button class="mi-btn mi-btn--ghost" data-act="criteria-global">المعايير العامة</button>' : ''))}
    <div class="mi-kpi-grid">
      ${raw(kpiCard('فرص مطروحة عليها متقدمون', String(open.length), '', 'primary'))}
      ${raw(kpiCard('طلبات بانتظار الفرز', String(pendingCount), '', pendingCount ? 'gold' : ''))}
      ${raw(kpiCard('فرص بأكثر من متقدم', String(multi), 'تحتاج مفاضلة', multi ? 'warn' : ''))}
      ${raw(kpiCard('فرص تم البت فيها', String(withApps.length - open.length), 'مُتبنّاة بمبادرة', 'ok'))}
    </div>
    <div class="mi-screening">
      <aside class="mi-card mi-screening__list" aria-label="الفرص">
        <h3>الفرص</h3>
        ${withApps.length ? raw(sortBy(withApps, (x) => x.need.status === 'published' ? 0 : 1).map(({ need, apps: a }) => html`
          <button class="mi-screening__item" data-need="${need.id}" aria-pressed="${need.id === selectedNeedId ? 'true' : 'false'}">
            <b>${need.title}</b>
            <small>${need.id} • ${needStatusLabel(need.status)}</small>
            <span class="mi-tag" data-benefit="${need.status === 'published' ? 'onTrack' : 'achieved'}">${fmtNumber(a.length)} متقدم${a.filter((x) => x.status === 'applied').length > 1 ? ' — مفاضلة' : ''}</span>
          </button>`).join('')) : raw('<p class="mi-muted">لا طلبات تقديم بعد — تصل من بوابة الشركاء على الفرص المطروحة</p>')}
      </aside>
      <section class="mi-screening__main" data-main></section>
    </div>`;

  container.querySelectorAll('[data-need]').forEach((btn) => btn.addEventListener('click', () => {
    selectedNeedId = btn.dataset.need;
    container.querySelectorAll('[data-need]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.need === selectedNeedId ? 'true' : 'false'));
    drawMain();
  }));
  container.querySelector('[data-act="criteria-global"]')?.addEventListener('click', () =>
    openCriteriaEditor({ scope: 'global', list: globalCriteria, onSaved: () => renderScreening(container, selectedNeedId) }));

  drawMain();

  function decideLine(best) {
    if (!best) return 'لا متقدمين قيد الفرز';
    return `الأقرب للتنفيذ حاليًا: <span class="mi-screening__top">${escapeHtml(best.partnerName)}</span>${best.percent !== null && best.percent !== undefined ? ` بنسبة ${escapeHtml(fmtNumber(best.percent))}٪` : ''}`;
  }

  async function drawMain() {
    const main = container.querySelector('[data-main]');
    const entry = withApps.find((x) => x.need.id === selectedNeedId);
    if (!entry) {
      main.innerHTML = emptyState('اختر فرصة من القائمة', 'تظهر هنا مصفوفة المقارنة بين المتقدمين عليها');
      return;
    }
    const { need } = entry;
    const decidable = canDecide && need.status === 'published';
    const criteria = await criteriaForNeed(need);
    const weightSum = totalWeight(criteria);

    const enriched = entry.apps.map((a) => {
      const card = scorecardOf(a.partnerId);
      const partner = partners.find((p) => p.id === a.partnerId);
      const basic = a.basic || (partner ? { name: partner.name, type: partner.type, contactName: partner.contactName, contactEmail: partner.contactEmail, contactPhone: partner.contactPhone, models: partner.models || [] } : {});
      const suggested = suggestedScores({ application: a, need, scorecard: card });
      const scores = { ...suggested, ...(a.scores || {}) };
      return { ...a, card, basic, suggested, scores, details: a.details || {} };
    });
    const ranked = rankApplicants(enriched, criteria);
    const top = ranked.find((a) => a.status === 'applied');
    const activeIds = ranked.filter((a) => a.status === 'applied').map((a) => a.id);
    let currentTopId = top?.id || null;
    const best = bestApplicantsByField(ranked);
    const groups = [...new Set(APPLICATION_FIELDS.map((f) => f.group))];
    const cols = String(ranked.length + 1);

    main.innerHTML = html`
      <div class="mi-card">
        <div class="mi-detail-head">
          <div>
            <h3>${need.title} <span class="mi-tag mi-tag--priority" data-priority="${need.priority}">${PRIORITY_LABELS[need.priority] || need.priority}</span></h3>
            <p class="mi-muted">${need.id} • ${categoryLabel(need.category)} • حي ${need.district} • التكلفة التقديرية ${fmtMoney(need.estimatedCost)} • النماذج المفضلة: ${(need.preferredModels || []).map(modelLabel).join('، ') || '—'}</p>
          </div>
          <div class="mi-screening__btns">
            ${need.status === 'matched' && need.matchedInitiativeId ? raw(`<a class="mi-btn mi-btn--ghost mi-btn--sm" href="#/initiatives/${escapeHtml(need.matchedInitiativeId)}">المبادرة الناتجة ${escapeHtml(need.matchedInitiativeId)}</a>`) : ''}
            ${canManageCriteria && need.status === 'published' ? raw('<button class="mi-btn mi-btn--ghost mi-btn--sm" data-act="criteria-need">معايير خاصة بهذه الفرصة</button>') : ''}
          </div>
        </div>
        <p class="mi-screening__desc">${need.description}</p>

        <h4 class="mi-subhead">مصفوفة المقارنة <small class="mi-muted">— البيانات كما قدمتها الجهات، والدرجات من 1 إلى 5 لكل معيار، والنسبة تُطبَّع على مجموع الأوزان (${fmtNumber(weightSum)})</small></h4>
        <div class="mi-table-wrap">
          <table class="mi-table mi-compare">
            <thead>
              <tr>
                <th class="mi-compare__crit">البند</th>
                ${raw(ranked.map((a, i) => html`
                  <th class="mi-compare__head" data-rank="${i + 1}" data-status="${a.status}" ${top && a.id === top.id ? raw('data-top="yes"') : ''}>
                    <span class="mi-compare__rank">#${String(i + 1)}</span>
                    <b>${a.partnerName}</b>
                    <small>${modelLabel(a.model)} • ${fmtDate(a.at)}</small>
                    <span>${raw(ratingStarsHtml(a.card.rating, { label: a.card.band.label }))}</span>
                    ${a.status !== 'applied' ? raw(`<span class="mi-tag" data-benefit="${a.status === 'accepted' ? 'achieved' : 'atRisk'}">${escapeHtml(APPLICATION_STATUS[a.status]?.label || a.status)}</span>`) : ''}
                  </th>`).join(''))}
              </tr>
            </thead>
            <tbody>
              <tr class="mi-compare__group"><th colspan="${cols}">البيانات الأساسية (من حساب الجهة)</th></tr>
              <tr class="mi-compare__basic"><th>نوع الجهة</th>${raw(ranked.map((a) => html`<td>${partnerTypeLabel(a.basic?.type)}</td>`).join(''))}</tr>
              <tr class="mi-compare__basic"><th>ممثل الجهة</th>${raw(ranked.map((a) => html`<td>${a.basic?.contactName || '—'}</td>`).join(''))}</tr>
              <tr class="mi-compare__basic"><th>نماذج الشراكة المتاحة</th>${raw(ranked.map((a) => html`<td>${(a.basic?.models || []).map(modelLabel).join('، ') || '—'}</td>`).join(''))}</tr>
              <tr class="mi-compare__basic"><th>سجل الأداء</th>${raw(ranked.map((a) => html`<td>${a.card.overall !== null ? raw(`<b>${escapeHtml(fmtNumber(a.card.overall))}/100</b> — ${escapeHtml(a.card.band.label)}`) : 'شريك جديد'}</td>`).join(''))}</tr>
              <tr class="mi-compare__proposal"><th>المقترح</th>${raw(ranked.map((a) => html`<td><small>${a.proposal}</small></td>`).join(''))}</tr>

              ${raw(groups.map((g) => html`
                <tr class="mi-compare__group"><th colspan="${cols}">البيانات التفصيلية — ${g}</th></tr>
                ${raw(APPLICATION_FIELDS.filter((f) => f.group === g).map((f) => html`
                  <tr class="mi-compare__data">
                    <th>${f.label}${f.better ? raw(` <small class="mi-muted">(${f.better === 'max' ? 'الأعلى أفضل' : 'الأقل أفضل'})</small>`) : ''}</th>
                    ${raw(ranked.map((a) => {
                    const v = a.details?.[f.id];
                    const provided = ranked.filter((x) => x.details?.[f.id] !== undefined && x.details?.[f.id] !== '').length;
                    const isBest = (best[f.id] || []).includes(a.id) && (best[f.id] || []).length < provided;
                    return html`<td class="${f.type === 'text' ? 'mi-compare__text' : ''}" ${isBest ? raw('data-best="yes"') : ''}>${v === undefined || v === '' ? raw('<span class="mi-compare__missing">لم يُقدَّم</span>') : formatDetail(f, v, FMT)}</td>`;
                  }).join(''))}
                  </tr>`).join(''))}`).join(''))}
              <tr class="mi-compare__basic"><th>اكتمال البيانات التفصيلية</th>${raw(ranked.map((a) => { const c = detailsCompleteness(a.details); return html`<td>${fmtNumber(c.filled)} / ${fmtNumber(c.total)} (${fmtNumber(c.percent)}٪)</td>`; }).join(''))}</tr>

              <tr class="mi-compare__group"><th colspan="${cols}">معايير المفاضلة الموزونة ${criteria.some((c) => c.scope === 'need') ? raw('<span class="mi-tag mi-tag--gold">تشمل معايير خاصة بالفرصة</span>') : ''}</th></tr>
              ${raw(criteria.map((c) => html`
                <tr data-scope="${c.scope || 'global'}">
                  <th title="${c.hint || ''}">${c.label} <small class="mi-muted">(${String(c.weight)})</small>${c.scope === 'need' ? raw(' <span class="mi-tag mi-tag--gold">خاص</span>') : ''}<br><small class="mi-muted">${c.hint || ''}</small></th>
                  ${raw(ranked.map((a) => {
                  const v = a.scores[c.id];
                  const savedScores = entry.apps.find((x) => x.id === a.id)?.scores || {};
                  const isAuto = a.suggested[c.id] !== undefined && savedScores[c.id] === undefined;
                  return html`
                    <td class="mi-compare__cell">
                      ${decidable && a.status === 'applied'
                    ? raw(`<select class="mi-input mi-input--sm mi-compare__score" data-app="${escapeHtml(a.id)}" data-crit="${escapeHtml(c.id)}" aria-label="${escapeHtml(c.label)} — ${escapeHtml(a.partnerName)}">
                          <option value="">—</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(v) === n ? 'selected' : ''}>${n}</option>`).join('')}</select>`)
                    : raw(`<b>${v ? escapeHtml(String(v)) : '—'}</b>`)}
                      ${isAuto ? raw('<small class="mi-muted" title="درجة مقترحة آليًا من البيانات المقدمة — تُحفظ عند أول تعديل">آلي</small>') : ''}
                    </td>`;
                }).join(''))}
                </tr>`).join(''))}
              <tr class="mi-compare__total">
                <th>النسبة المرجحة</th>
                ${raw(ranked.map((a) => {
                  const band = percentBand(a.percent);
                  return html`<td data-band="${band.id}">
                    <b class="mi-compare__pct">${a.percent === null ? '—' : fmtNumber(a.percent) + '٪'}</b>
                    <span class="mi-tag" data-benefit="${band.id === 'strong' ? 'achieved' : band.id === 'good' ? 'onTrack' : band.id === 'none' ? '' : 'atRisk'}">${band.label}</span>
                    <small class="mi-muted" ${a.fullyScored || a.status !== 'applied' ? raw('hidden') : ''}>تقييم غير مكتمل</small>
                  </td>`;
                }).join(''))}
              </tr>
              <tr>
                <th>ملاحظة لجنة الفرز</th>
                ${raw(ranked.map((a) => html`<td>${decidable && a.status === 'applied'
                  ? raw(`<textarea class="mi-input mi-compare__note" rows="2" data-note="${escapeHtml(a.id)}" placeholder="ملاحظة…">${escapeHtml(a.screeningNote || '')}</textarea>`)
                  : raw(`<small>${escapeHtml(a.screeningNote || '—')}</small>`)}</td>`).join(''))}
              </tr>
              ${decidable ? raw(html`
              <tr class="mi-compare__actions">
                <th>القرار</th>
                ${raw(ranked.map((a) => html`<td>
                  ${a.status === 'applied' ? raw(`
                    <label class="mi-check-item"><input type="checkbox" data-select="${escapeHtml(a.id)}"><span>اختيار للاعتماد (شراكة)</span></label>
                    <button class="mi-btn mi-btn--ghost mi-btn--sm" data-reject="${escapeHtml(a.id)}">استبعاد</button>`) : ''}
                </td>`).join(''))}
              </tr>`) : ''}
            </tbody>
          </table>
        </div>

        ${decidable ? raw(html`
          <div class="mi-screening__decide">
            <div>
              <b class="mi-screening__decide-line">${raw(decideLine(top))}</b>
              <p class="mi-muted">اعتماد جهة واحدة ينشئ المبادرة باسمها، واختيار أكثر من جهة يعتمد شراكة مشتركة بمبادرة واحدة ترتبط بها كل الجهات. تُرفض بقية الطلبات وتُغلق الفرصة كمُتبنّاة.</p>
            </div>
            <div class="mi-screening__btns">
              <button class="mi-btn mi-btn--gold" data-act="adopt-top" ${top ? '' : raw('disabled')}>اعتماد الأقرب للتنفيذ</button>
              <button class="mi-btn mi-btn--primary" data-act="adopt" ${activeIds.length ? '' : raw('disabled')}>اعتماد المحدد (شراكة مشتركة)</button>
            </div>
          </div>`) : need.status === 'published' ? raw('<p class="mi-muted">الاعتماد يتطلب صلاحية إصدار قرار بوابة.</p>') : ''}
      </div>`;

    main.querySelector('[data-act="criteria-need"]')?.addEventListener('click', () =>
      openCriteriaEditor({ scope: 'need', need, list: need.extraCriteria || [], globalCriteria, onSaved: () => renderScreening(container, need.id) }));

    if (!decidable) return;

    // حفظ مؤجل مستقل لكل متقدم
    const savers = new Map();
    const saveScores = (appId) => {
      if (!savers.has(appId)) savers.set(appId, debounce(() => persistScores(appId), 350));
      savers.get(appId)();
    };
    async function persistScores(appId) {
      const scores = {};
      main.querySelectorAll(`[data-app="${appId}"]`).forEach((sel) => { if (sel.value) scores[sel.dataset.crit] = Number(sel.value); });
      const note = main.querySelector(`[data-note="${appId}"]`)?.value || '';
      try {
        await scoreApplication(appId, { scores, note, by: getSession()?.name || '' });
        const idx = apps.findIndex((a) => a.id === appId);
        if (idx >= 0) apps[idx] = { ...apps[idx], scores, screeningNote: note };
        refreshTotals();
      } catch (err) { toastError(err.message); }
    }
    main.querySelectorAll('.mi-compare__score').forEach((sel) => sel.addEventListener('change', () => saveScores(sel.dataset.app)));
    main.querySelectorAll('.mi-compare__note').forEach((ta) => ta.addEventListener('input', () => saveScores(ta.dataset.note)));

    function refreshTotals() {
      const cells = [...main.querySelectorAll('.mi-compare__total td')];
      const heads = [...main.querySelectorAll('.mi-compare__head')];
      const current = ranked.map((a) => {
        const scores = {};
        main.querySelectorAll(`[data-app="${a.id}"]`).forEach((sel) => { if (sel.value) scores[sel.dataset.crit] = Number(sel.value); });
        return { id: a.id, status: a.status, percent: Object.keys(scores).length ? applicantPercent(scores, criteria) : a.percent, full: isFullyScored(scores, criteria) };
      });
      current.forEach((c, i) => {
        const band = percentBand(c.percent);
        const td = cells[i];
        if (!td) return;
        td.dataset.band = band.id;
        td.querySelector('.mi-compare__pct').textContent = c.percent === null ? '—' : `${fmtNumber(c.percent)}٪`;
        const tag = td.querySelector('.mi-tag');
        tag.textContent = band.label;
        tag.dataset.benefit = band.id === 'strong' ? 'achieved' : band.id === 'good' ? 'onTrack' : band.id === 'none' ? '' : 'atRisk';
        const small = td.querySelector('small');
        if (small) small.hidden = c.full || c.status !== 'applied';
      });
      const bestNow = [...current].filter((c) => c.status === 'applied').sort((x, y) => (y.percent ?? -1) - (x.percent ?? -1))[0];
      heads.forEach((h, i) => { if (bestNow && current[i].id === bestNow.id) h.dataset.top = 'yes'; else delete h.dataset.top; });
      const line = main.querySelector('.mi-screening__decide-line');
      if (line) line.innerHTML = decideLine(bestNow ? { ...ranked.find((a) => a.id === bestNow.id), percent: bestNow.percent } : null);
      currentTopId = bestNow?.id || null;
    }

    async function adopt(selectedIds) {
      if (!selectedIds.length) { toastError('حدد متقدمًا واحدًا على الأقل'); return; }
      const names = selectedIds.map((id) => ranked.find((a) => a.id === id)?.partnerName).join(' و ');
      const unscored = selectedIds.filter((id) => !isFullyScored((apps.find((a) => a.id === id) || {}).scores || {}, criteria));
      const sure = await confirmModal(selectedIds.length > 1 ? 'اعتماد شراكة مشتركة' : 'اعتماد المتقدم الأقرب للتنفيذ',
        `${selectedIds.length > 1 ? 'ستُنشأ مبادرة واحدة مشتركة بين' : 'ستُنشأ مبادرة باسم'} «${names}» وتُرفض بقية الطلبات وتُغلق الفرصة.${unscored.length ? ' تنبيه: تقييم بعض المحددين غير مكتمل.' : ''} متابعة؟`,
        { confirmLabel: 'اعتماد وإنشاء المبادرة' });
      if (!sure) return;
      try {
        const initiative = await adoptNeed({ need, applications: entry.apps, selectedIds, byName: getSession()?.name || 'لجنة الفرز' });
        toastSuccess(`اعتُمد ${selectedIds.length > 1 ? 'شراكة مشتركة' : 'المتقدم'} وأُنشئت المبادرة ${initiative.id}`);
        navigate(`initiatives/${initiative.id}`);
      } catch (err) { toastError(err.message); }
    }
    main.querySelector('[data-act="adopt-top"]')?.addEventListener('click', () => adopt(currentTopId ? [currentTopId] : []));
    main.querySelector('[data-act="adopt"]')?.addEventListener('click', () =>
      adopt([...main.querySelectorAll('[data-select]:checked')].map((c) => c.dataset.select)));

    main.querySelectorAll('[data-reject]').forEach((btn) => btn.addEventListener('click', () => {
      const a = ranked.find((x) => x.id === btn.dataset.reject);
      const { dialog, close } = openModal({
        title: `استبعاد ${a.partnerName} من المفاضلة`,
        bodyHtml: html`<div class="mi-form-field"><label for="mi-rej-reason">سبب الاستبعاد (يصل للجهة في بوابتها)</label><textarea id="mi-rej-reason" class="mi-input" rows="3"></textarea></div>`,
        footerHtml: html`<button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button><button class="mi-btn mi-btn--danger" data-act="ok">استبعاد</button>`
      });
      dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
      dialog.querySelector('[data-act="ok"]').addEventListener('click', async () => {
        const reason = dialog.querySelector('#mi-rej-reason').value.trim();
        if (reason.length < 5) { toastError('سبب الاستبعاد مطلوب'); return; }
        try {
          await rejectApplication(a.id, { reason, by: getSession()?.name || '' });
          close();
          toastSuccess(`استُبعد ${a.partnerName}`);
          renderScreening(container, need.id);
        } catch (err) { toastError(err.message); }
      });
    }));
  }
}

// محرر المعايير: العامة (تُطبق على كل الفرص) أو الخاصة بفرصة (تُضاف فوق العامة)
function openCriteriaEditor({ scope, need = null, list = [], globalCriteria = [], onSaved }) {
  let rows = (list || []).map((c) => ({ ...c }));
  const isGlobal = scope === 'global';
  const sumText = () => fmtNumber(rows.reduce((a, c) => a + (Number(c.weight) || 0), 0)) + (isGlobal ? '' : ` (+ ${fmtNumber(totalWeight(globalCriteria))} من العامة)`);
  const { dialog, close } = openModal({
    title: isGlobal ? 'المعايير العامة للمفاضلة' : `معايير خاصة بفرصة «${need.title}»`,
    wide: true,
    bodyHtml: html`
      <p class="mi-muted">${isGlobal
        ? 'تُطبق على كل الفرص. الوزن رقم موجب، وتُطبَّع النسب تلقائيًا على مجموع الأوزان. المعايير الافتراضية الثلاثة الأولى تُقترح درجاتها من بيانات التقديم.'
        : `تُضاف فوق المعايير العامة (${globalCriteria.map((c) => c.label).join('، ')}) لهذه الفرصة وحدها.`}</p>
      <div data-rows></div>
      <div class="mi-crit-total"><span>مجموع الأوزان: <b data-sum></b></span>
        <button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-act="add">+ إضافة معيار</button></div>`,
    footerHtml: html`
      ${isGlobal ? raw('<button class="mi-btn mi-btn--ghost" data-act="reset">استعادة الافتراضي</button>') : ''}
      <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
      <button class="mi-btn mi-btn--primary" data-act="save">حفظ المعايير</button>`
  });
  const host = dialog.querySelector('[data-rows]');
  function draw() {
    host.innerHTML = rows.map((c, i) => html`
      <div class="mi-crit-row" data-scope="${isGlobal ? 'global' : 'need'}">
        <input class="mi-input mi-input--sm" data-f="label" data-i="${String(i)}" value="${c.label}" placeholder="اسم المعيار">
        <input class="mi-input mi-input--sm" data-f="weight" data-i="${String(i)}" type="number" min="1" max="100" value="${String(c.weight)}" aria-label="الوزن">
        <input class="mi-input mi-input--sm" data-f="hint" data-i="${String(i)}" value="${c.hint || ''}" placeholder="توضيح للمقيِّم">
        <button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-del="${String(i)}" aria-label="حذف">✕</button>
      </div>`).join('') || '<p class="mi-muted">لا معايير — أضف معيارًا</p>';
    dialog.querySelector('[data-sum]').textContent = sumText();
    host.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => {
      rows[Number(inp.dataset.i)][inp.dataset.f] = inp.dataset.f === 'weight' ? Number(inp.value) : inp.value;
      dialog.querySelector('[data-sum]').textContent = sumText();
    }));
    host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { rows.splice(Number(b.dataset.del), 1); draw(); }));
  }
  draw();
  dialog.querySelector('[data-act="add"]').addEventListener('click', () => {
    rows.push({ id: uid('crit'), label: '', weight: 10, hint: '', source: 'manual' });
    draw();
    host.querySelector(`[data-i="${rows.length - 1}"][data-f="label"]`)?.focus();
  });
  dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
  dialog.querySelector('[data-act="reset"]')?.addEventListener('click', () => { rows = DEFAULT_SCREENING_CRITERIA.map((c) => ({ ...c })); draw(); });
  dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
    if (rows.some((r) => !String(r.label).trim())) { toastError('كل معيار يحتاج اسمًا'); return; }
    const clean = sanitizeCriteria(rows);
    if (isGlobal && !clean.length) { toastError('يلزم معيار واحد على الأقل بوزن موجب'); return; }
    try {
      if (isGlobal) await saveGlobalCriteria(clean);
      else await saveNeedCriteria(need.id, clean);
      close();
      toastSuccess('حُفظت المعايير — تُطبق فورًا على النسب');
      onSaved?.();
    } catch (err) { toastError(err.message); }
  });
}
