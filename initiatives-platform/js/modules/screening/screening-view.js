// شاشة الفرز — مقارنة المتقدمين على الفرصة الواحدة جنبًا إلى جنب بمعايير موزونة،
// إعطاء كل متقدم نسبة، ترتيبهم، ثم اعتماد الأقرب للتنفيذ (منفردًا أو شراكة مشتركة) أو الاستبعاد
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, kpiCard, ratingStarsHtml, emptyState } from '../../ui/components.js';
import { SCREENING_CRITERIA, applicantPercent, suggestedScores, rankApplicants, percentBand, isFullyScored } from '../../domain/applicant-scoring.js';
import { APPLICATION_STATUS, adoptNeed, scoreApplication, rejectApplication } from '../../services/application-service.js';
import { partnerScorecard } from '../../domain/partner-scorecard.js';
import { modelLabel } from '../../domain/partner-model.js';
import { categoryLabel } from '../../domain/initiative-model.js';
import { PRIORITY_LABELS, needStatusLabel } from '../../domain/infrastructure-need-model.js';
import { fmtMoney, fmtNumber, sortBy, debounce } from '../../core/utils.js';
import { fmtDate } from '../../core/date-time.js';
import { getRole, getSession } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { confirmModal, openModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { navigate } from '../../router.js';

let selectedNeedId = null;

export async function renderScreening(container, presetNeedId = null) {
  const [needs, apps, partners, links, initiatives, milestones, benefits, qualityChecks, progressReports] = await Promise.all([
    repos.needs.getAll(), repos.needApplications.getAll().catch(() => []), repos.partners.getAll(),
    repos.initiativePartners.getAll(), repos.initiatives.getAll(), repos.milestones.getAll(),
    repos.benefits.getAll(), repos.qualityChecks.getAll(), repos.progressReports.getAll().catch(() => [])
  ]);
  const role = getRole();
  const canDecide = can(role, 'decisions.create');
  const scorecardOf = (pid) => partnerScorecard({ partnerId: pid, links, initiatives, milestones, benefits, qualityChecks, progressReports });

  // الفرص التي عليها طلبات — المطروحة أولًا ثم المُتبنّاة (للاطلاع على نتيجة المفاضلة)
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
    'مقارنة من تقدّم على الفرصة الواحدة بمعايير موزونة، إعطاء نسبة لكل متقدم، ثم اعتماد الأقرب للتنفيذ منفردًا أو بشراكة مشتركة'))}
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

  drawMain();

  function decideLine(best) {
    if (!best) return 'لا متقدمين قيد الفرز';
    return `الأقرب للتنفيذ حاليًا: <span class="mi-screening__top">${escapeHtml(best.partnerName)}</span>${best.percent !== null && best.percent !== undefined ? ` بنسبة ${escapeHtml(fmtNumber(best.percent))}٪` : ''}`;
  }

  function drawMain() {
    const main = container.querySelector('[data-main]');
    const entry = withApps.find((x) => x.need.id === selectedNeedId);
    if (!entry) {
      main.innerHTML = emptyState('اختر فرصة من القائمة', 'تظهر هنا مصفوفة المقارنة بين المتقدمين عليها');
      return;
    }
    const { need } = entry;
    const decidable = canDecide && need.status === 'published';
    // درجات مقترحة للمتقدمين غير المقيَّمين (لا تُحفظ حتى يلمسها المقيِّم)
    const enriched = entry.apps.map((a) => {
      const card = scorecardOf(a.partnerId);
      const suggested = suggestedScores({ application: a, need, scorecard: card });
      const scores = { ...suggested, ...(a.scores || {}) };
      return { ...a, card, scores, suggested };
    });
    const ranked = rankApplicants(enriched);
    const top = ranked.find((a) => a.status === 'applied');
    const activeIds = ranked.filter((a) => a.status === 'applied').map((a) => a.id);
    let currentTopId = top?.id || null;

    main.innerHTML = html`
      <div class="mi-card">
        <div class="mi-detail-head">
          <div>
            <h3>${need.title} <span class="mi-tag mi-tag--priority" data-priority="${need.priority}">${PRIORITY_LABELS[need.priority] || need.priority}</span></h3>
            <p class="mi-muted">${need.id} • ${categoryLabel(need.category)} • حي ${need.district} • التكلفة التقديرية ${fmtMoney(need.estimatedCost)} • النماذج المفضلة: ${(need.preferredModels || []).map(modelLabel).join('، ') || '—'}</p>
          </div>
          <div>
            ${need.status === 'matched' && need.matchedInitiativeId ? raw(`<a class="mi-btn mi-btn--ghost mi-btn--sm" href="#/initiatives/${escapeHtml(need.matchedInitiativeId)}">المبادرة الناتجة ${escapeHtml(need.matchedInitiativeId)}</a>`) : ''}
          </div>
        </div>
        <p class="mi-screening__desc">${need.description}</p>

        <h4 class="mi-subhead">مصفوفة المقارنة <small class="mi-muted">— الدرجات من 1 إلى 5 لكل معيار، والنسبة تُحسب بالأوزان (المجموع 100)</small></h4>
        <div class="mi-table-wrap">
          <table class="mi-table mi-compare">
            <thead>
              <tr>
                <th class="mi-compare__crit">المعيار <small>(الوزن)</small></th>
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
              <tr class="mi-compare__proposal">
                <th>المقترح</th>
                ${raw(ranked.map((a) => html`<td><small>${a.proposal}</small></td>`).join(''))}
              </tr>
              ${raw(SCREENING_CRITERIA.map((c) => html`
                <tr>
                  <th title="${c.hint}">${c.label} <small class="mi-muted">(${String(c.weight)})</small><br><small class="mi-muted">${c.hint}</small></th>
                  ${raw(ranked.map((a) => {
                  const v = a.scores[c.id];
                  // «آلي»: درجة مقترحة لم يحفظها المقيِّم بعد
                  const savedScores = entry.apps.find((x) => x.id === a.id)?.scores || {};
                  const isAuto = a.suggested[c.id] !== undefined && savedScores[c.id] === undefined;
                  return html`
                    <td class="mi-compare__cell">
                      ${decidable && a.status === 'applied'
                    ? raw(`<select class="mi-input mi-input--sm mi-compare__score" data-app="${escapeHtml(a.id)}" data-crit="${escapeHtml(c.id)}" aria-label="${escapeHtml(c.label)} — ${escapeHtml(a.partnerName)}">
                          <option value="">—</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(v) === n ? 'selected' : ''}>${n}</option>`).join('')}</select>`)
                    : raw(`<b>${v ? escapeHtml(String(v)) : '—'}</b>`)}
                      ${isAuto ? raw('<small class="mi-muted" title="درجة مقترحة آليًا — تُحفظ عند أول تعديل">آلي</small>') : ''}
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
                    ${!a.fullyScored && a.status === 'applied' ? raw('<small class="mi-muted">تقييم غير مكتمل</small>') : ''}
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

    if (!decidable) return;

    // حفظ الدرجات والملاحظات تلقائيًا
    // حفظ مؤجل مستقل لكل متقدم كي لا تضيع تعديلات متقدم عند تعديل آخر مباشرة
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

    // تحديث النسب والترتيب دون إعادة رسم كاملة (الحفاظ على التركيز)
    function refreshTotals() {
      const cells = [...main.querySelectorAll('.mi-compare__total td')];
      const heads = [...main.querySelectorAll('.mi-compare__head')];
      const current = ranked.map((a) => {
        const scores = {};
        main.querySelectorAll(`[data-app="${a.id}"]`).forEach((sel) => { if (sel.value) scores[sel.dataset.crit] = Number(sel.value); });
        return { id: a.id, status: a.status, percent: Object.keys(scores).length ? applicantPercent(scores) : a.percent, full: isFullyScored(scores) };
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
        if (small) small.hidden = c.full;
      });
      const best = [...current].filter((c) => c.status === 'applied').sort((x, y) => (y.percent ?? -1) - (x.percent ?? -1))[0];
      heads.forEach((h, i) => { if (best && current[i].id === best.id) h.dataset.top = 'yes'; else delete h.dataset.top; });
      const line = main.querySelector('.mi-screening__decide-line');
      if (line) line.innerHTML = decideLine(best ? { ...ranked.find((a) => a.id === best.id), percent: best.percent } : null);
      currentTopId = best?.id || null;
    }

    // الاعتماد: الأقرب للتنفيذ (منفرد) أو المحدد (شراكة مشتركة)
    async function adopt(selectedIds) {
      if (!selectedIds.length) { toastError('حدد متقدمًا واحدًا على الأقل'); return; }
      const names = selectedIds.map((id) => ranked.find((a) => a.id === id)?.partnerName).join(' و ');
      const unscored = selectedIds.filter((id) => !isFullyScored((apps.find((a) => a.id === id) || {}).scores || {}));
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

    // استبعاد متقدم واحد
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
