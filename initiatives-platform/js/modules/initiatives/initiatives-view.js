// سجل المبادرات + صفحة تفاصيل المبادرة مع مسار البوابات والانتقالات
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, statusBadge, gateTrackHtml, definitionList, progressBar, healthBadge, emptyState } from '../../ui/components.js';
import { renderTable } from '../../ui/table.js';
import { statusLabel, allowedTransitions, transitionMeta } from '../../domain/workflow.js';
import { categoryLabel, historyEntry, costBandLabel, durationBandLabel, readinessLabel, getSites, firstLatLng } from '../../domain/initiative-model.js';
import { openLocationPicker, renderSitesPreview } from '../../ui/location-picker.js';
import { pickInitiativeImage } from '../../services/image-service.js';
import { measureLabel, sitesSummaryLabel } from '../../core/geo.js';
import { uid } from '../../core/utils.js';
import { getCertTemplate, saveCertTemplate, renderCertificateCanvas, downloadCanvasPng } from '../../services/certificate-service.js';
import { weightedScore, scoreBand, criteriaWithScores } from '../../domain/scoring.js';
import { nextGateForStatus, buildChecklist, gateReadiness } from '../../domain/stage-gates.js';
import { initiativeHealth } from '../../domain/initiative-health.js';
import { modelLabel } from '../../domain/partner-model.js';
import { benefitStatus, realizationPercent } from '../../domain/benefits.js';
import { exposureLevel } from '../../domain/risks.js';
import { fmtMoney, fmtNumber, percent, sortBy } from '../../core/utils.js';
import { fmtDate } from '../../core/date-time.js';
import { getRole, getUserName } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { navigate } from '../../router.js';
import { confirmModal, openModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { notify } from '../../services/notification-service.js';
import { downloadCsv } from '../../services/export-service.js';
import { openReportViewer } from '../../ui/report-viewer.js';
import { toHtmlTable } from '../../services/export-service.js';

export async function renderInitiativesList(container) {
  const initiatives = await repos.initiatives.getAll();
  const role = getRole();

  container.innerHTML = html`
    ${raw(sectionHeader('سجل المبادرات', 'جميع المبادرات المقدمة عبر القنوات الداخلية والعامة وقنوات الشركاء',
    html`${can(role, 'reports.export') ? raw('<button class="mi-btn mi-btn--ghost" data-act="export">تصدير CSV</button>') : ''}
      ${can(role, 'initiatives.create') ? raw('<a class="mi-btn mi-btn--primary" href="./submit.html">مبادرة جديدة</a>') : ''}`))}
    <div class="mi-filters" role="group" aria-label="تصفية المبادرات"></div>
    <div class="mi-table-host"></div>`;

  const filtersBox = container.querySelector('.mi-filters');
  const statuses = [...new Set(initiatives.map((i) => i.status))];
  filtersBox.innerHTML = `
    <button class="mi-chip" data-status="" aria-pressed="true">الكل (${initiatives.length})</button>
    ${statuses.map((s) => `<button class="mi-chip" data-status="${escapeHtml(s)}" aria-pressed="false">${escapeHtml(statusLabel(s))} (${initiatives.filter((i) => i.status === s).length})</button>`).join('')}`;

  const host = container.querySelector('.mi-table-host');
  const { isCloudMode } = await import('../../config.js');
  const cloud = isCloudMode();
  const columns = [
    { key: 'id', label: 'المعرّف', width: '10rem' },
    { key: 'title', label: 'المبادرة' },
    { key: 'category', label: 'التصنيف', map: (r) => categoryLabel(r.category) },
    { key: 'district', label: 'الحي' },
    { key: 'status', label: 'الحالة', htmlMap: (r) => statusBadge(r.status), sortValue: (r) => r.status, map: (r) => statusLabel(r.status) },
    ...(cloud ? [
      { key: 'currentStage', label: 'المرحلة الحالية', map: (r) => r.currentStage || '—' },
      { key: 'progressPercentage', label: 'الإنجاز', map: (r) => `${fmtNumber(r.progressPercentage || 0)}٪`, sortValue: (r) => Number(r.progressPercentage) || 0 }
    ] : [
      { key: 'score', label: 'المفاضلة', map: (r) => { const s = weightedScore(r.scores); return s === null ? '—' : String(s); }, sortValue: (r) => weightedScore(r.scores) ?? -1 }
    ]),
    { key: 'budget', label: 'الميزانية', map: (r) => fmtMoney(r.budget), sortValue: (r) => Number(r.budget) || 0 }
  ];

  const table = renderTable(host, initiatives, columns, {
    searchable: true,
    initialSort: 'id',
    onRowClick: (r) => navigate(`initiatives/${r.id}`),
    emptyText: 'لا توجد مبادرات — ابدأ بتقديم مبادرة جديدة'
  });

  filtersBox.querySelectorAll('.mi-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      filtersBox.querySelectorAll('.mi-chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      chip.setAttribute('aria-pressed', 'true');
      const s = chip.dataset.status;
      table.update(s ? initiatives.filter((i) => i.status === s) : initiatives);
    });
  });

  container.querySelector('[data-act="export"]')?.addEventListener('click', () => {
    downloadCsv(initiatives, [
      { key: 'id', label: 'المعرف' }, { key: 'title', label: 'المبادرة' },
      { key: 'category', label: 'التصنيف', map: (r) => categoryLabel(r.category) },
      { key: 'district', label: 'الحي' },
      { key: 'status', label: 'الحالة', map: (r) => statusLabel(r.status) },
      { key: 'budget', label: 'الميزانية' }, { key: 'beneficiaries', label: 'المستفيدون' }
    ], 'madinah-initiatives.csv');
    toastSuccess('صُدّر السجل بصيغة CSV');
  });
}

export async function renderInitiativeDetails(container, id) {
  const initiative = await repos.initiatives.get(id);
  if (!initiative) {
    container.innerHTML = emptyState('المبادرة غير موجودة', `لا توجد مبادرة بالمعرف ${id}`,
      '<a class="mi-btn mi-btn--primary" href="#/initiatives">العودة إلى السجل</a>');
    return;
  }

  const [links, partners, milestones, benefits, risks, decisions, reviews, checklists, quality, portfolios] = await Promise.all([
    repos.initiativePartners.byInitiative(id), repos.partners.getAll(),
    repos.milestones.byInitiative(id), repos.benefits.byInitiative(id),
    repos.risks.byInitiative(id), repos.decisions.byInitiative(id),
    repos.reviews.byInitiative(id), repos.gateChecklists.byInitiative(id),
    repos.qualityChecks.byInitiative(id), repos.portfolios.getAll()
  ]);
  const campaigns = await repos.campaigns.getAll();
  const portfolio = initiative.portfolioId ? portfolios.find((p) => p.id === initiative.portfolioId) : null;
  const campaign = initiative.campaignId ? campaigns.find((c) => c.id === initiative.campaignId) : null;

  const role = getRole();
  // قاعدة تحرير الجهة: بعد الإرسال تصبح المبادرة للقراءة فقط إلا عند الإعادة للاستكمال
  // (سياسات RLS تفرض القاعدة نفسها في القاعدة — هذا للعرض فقط)
  const canEditRec = can(role, 'initiatives.edit')
    && (role !== 'agency_user' || ['draft', 'returned'].includes(initiative.status));
  const score = weightedScore(initiative.scores);
  const band = scoreBand(score);
  const health = initiativeHealth(initiative, { milestones, risks, benefits });
  const doneMs = milestones.filter((m) => m.done).length;
  const nextGate = nextGateForStatus(initiative.status);
  const checklist = nextGate ? checklists.find((c) => c.gateId === nextGate.id) : null;
  const readiness = checklist ? gateReadiness(checklist) : null;
  const transitions = allowedTransitions(initiative.status, role);

  const partnerName = (pid) => partners.find((p) => p.id === pid)?.name || pid;

  container.innerHTML = html`
    <nav class="mi-breadcrumb" aria-label="مسار التنقل">
      <a href="#/initiatives">سجل المبادرات</a> <span aria-hidden="true">←</span> <span>${initiative.id}</span>
    </nav>

    <header class="mi-detail-head">
      <div>
        <h2>${initiative.title}</h2>
        <p class="mi-detail-head__meta">${initiative.id} • ${categoryLabel(initiative.category)} • حي ${initiative.district}</p>
      </div>
      <div class="mi-detail-head__badges">
        ${raw(statusBadge(initiative.status))}
        ${['execution', 'benefits'].includes(initiative.status) ? raw(healthBadge(health)) : ''}
      </div>
    </header>

    ${raw(gateTrackHtml(initiative.status))}

    <div class="mi-detail-grid">
      <section class="mi-card mi-card--span mi-detail-media">
        <div class="mi-detail-media__image">
          ${initiative.imageDataUrl
    ? raw(`<img class="mi-initiative-image" src="${initiative.imageDataUrl}" alt="صورة مبادرة ${escapeHtml(initiative.title)}">`)
    : raw('<div class="mi-initiative-image mi-initiative-image--empty" aria-hidden="true">🖼<span>لا صورة للمبادرة</span></div>')}
          ${canEditRec ? raw(`
            <div class="mi-detail-media__tools">
              <button class="mi-btn mi-btn--ghost mi-btn--sm" data-act="image">${initiative.imageDataUrl ? 'تغيير الصورة' : 'إضافة صورة'}</button>
              ${initiative.imageDataUrl ? '<button class="mi-btn mi-btn--ghost mi-btn--sm" data-act="image-remove">إزالة الصورة</button>' : ''}
            </div>`) : ''}
        </div>
        <div class="mi-detail-media__map">
          ${(() => {
    const sites = getSites(initiative);
    return sites.length
      ? raw(`
            <div class="mi-geo-host" data-geo></div>
            <p class="mi-geo-caption"><b>${escapeHtml(sitesSummaryLabel(sites))}</b></p>
            <div class="mi-sites-list">
              ${sites.map((s) => `
                <div class="mi-site-row">
                  <span class="mi-site-row__name-text">◈ ${escapeHtml(s.name || 'موقع')}</span>
                  <span class="mi-site-row__measure">${escapeHtml(measureLabel(s.geometry))}</span>
                  ${canEditRec ? `
                    <button class="mi-btn mi-btn--ghost mi-btn--sm" data-edit-site="${escapeHtml(s.id)}">تعديل</button>
                    <button class="mi-btn mi-btn--ghost mi-btn--sm" data-del-site="${escapeHtml(s.id)}">حذف</button>` : ''}
                </div>`).join('')}
            </div>`)
      : raw('<div class="mi-geo-host mi-geo-host--empty">لم تُحدد مواقع جغرافية على الخريطة</div>');
  })()}
          ${canEditRec ? raw(`
            <div class="mi-detail-media__tools">
              <button class="mi-btn mi-btn--ghost mi-btn--sm" data-act="add-site">إضافة موقع</button>
            </div>`) : ''}
        </div>
      </section>

      <section class="mi-card mi-card--span">
        <h3>بطاقة المبادرة (قالب التعريف المعتمد)</h3>
        ${initiative.problem ? raw(`<h4 class="mi-subhead">المشكلة أو الاحتياج</h4><p class="mi-summary">${escapeHtml(initiative.problem)}</p>`) : ''}
        <h4 class="mi-subhead">الوصف والحل المقترح</h4>
        <p class="mi-summary">${initiative.summary}</p>
        ${initiative.expectedImpact ? raw(`<h4 class="mi-subhead">الأثر المتوقع</h4><p class="mi-summary">${escapeHtml(initiative.expectedImpact)}</p>`) : ''}
        ${raw(definitionList([
    ['نطاق العمل', initiative.scope || '—'],
    ['المحفظة', portfolio ? portfolio.title : '—'],
    ['الحملة الموسمية', campaign ? campaign.title : '—'],
    ['مقدّم المبادرة', `${initiative.submitterName}${initiative.submitterEntity ? ' — ' + initiative.submitterEntity : ''}`],
    ['الوحدة المشرفة', initiative.ownerName || '—'],
    ['الفئات المستفيدة', initiative.beneficiaryGroups || '—'],
    ['التكلفة التقديرية', initiative.costBand ? costBandLabel(initiative.costBand) : '—'],
    ['المدة التقديرية', initiative.durationBand ? durationBandLabel(initiative.durationBand) : '—'],
    ['مستوى الجاهزية عند التقديم', initiative.readinessLevel ? readinessLabel(initiative.readinessLevel) : '—'],
    ['الميزانية', fmtMoney(initiative.budget)],
    ['المنصرف', fmtMoney(initiative.spent)],
    ['المستفيدون المقدَّرون', initiative.beneficiaries ? fmtNumber(initiative.beneficiaries) : '—'],
    ['تاريخ البداية', fmtDate(initiative.startDate)],
    ['تاريخ النهاية', fmtDate(initiative.endDate)],
    ['ملاحظات', initiative.notes || '—']
  ]))}
      </section>

      <section class="mi-card">
        <h3>درجة المفاضلة</h3>
        ${score !== null ? raw(html`
          <div class="mi-score">
            <div class="mi-score__value">${String(score)}</div>
            <div class="mi-score__band">${band.label}</div>
          </div>
          ${raw(criteriaWithScores(initiative.scores).map((c) => html`
            <div class="mi-criteria-row">
              <span>${c.label} <small>(وزن ${String(c.weight)})</small></span>
              <b>${String(c.score)}/5</b>
            </div>`).join(''))}`) : raw('<p class="mi-muted">لم تُقيَّم بعد — تُستكمل الدرجات في مرحلة الدراسة</p>')}
      </section>

      <section class="mi-card">
        <h3>الشركاء</h3>
        ${links.length ? raw(links.map((l) => html`
          <div class="mi-partner-line">
            <b>${partnerName(l.partnerId)}</b>
            <span class="mi-tag">${modelLabel(l.model)}</span>
            <small>${l.contribution || ''}</small>
          </div>`).join('')) : raw('<p class="mi-muted">لا يوجد شركاء مرتبطون بعد</p>')}
      </section>

      ${nextGate ? raw(html`
      <section class="mi-card">
        <h3>البوابة القادمة: ${nextGate.id} — ${nextGate.name}</h3>
        <p class="mi-muted">${nextGate.desc}</p>
        ${readiness ? raw(progressBar(readiness.percent, 'جاهزية البوابة')) : ''}
        <div class="mi-checklist" data-gate="${nextGate.id}">
          ${checklist ? raw(checklist.items.map((item) => html`
            <label class="mi-check-item">
              <input type="checkbox" data-key="${item.key}" ${item.done ? raw('checked') : ''} ${can(role, 'gates.check') ? '' : raw('disabled')}>
              <span>${item.text}</span>
            </label>`).join('')) : raw(`<button class="mi-btn mi-btn--ghost" data-act="open-checklist" ${can(role, 'gates.check') ? '' : 'disabled'}>فتح قائمة تحقق البوابة</button>`)}
        </div>
      </section>`) : ''}

      <section class="mi-card">
        <h3>معالم التنفيذ (${String(doneMs)}/${String(milestones.length)})</h3>
        ${milestones.length ? raw(sortBy(milestones, (m) => m.due).map((m) => html`
          <div class="mi-ms" data-done="${m.done ? 'yes' : 'no'}">
            <span class="mi-ms__dot" aria-hidden="true"></span>
            <span>${m.title}</span>
            <small>${fmtDate(m.due)}</small>
          </div>`).join('')) : raw('<p class="mi-muted">تُعتمد المعالم عند بوابة جاهزية التنفيذ</p>')}
      </section>

      <section class="mi-card">
        <h3>المنافع المستهدفة</h3>
        ${benefits.length ? raw(benefits.map((b) => {
    const p = realizationPercent(b);
    const st = benefitStatus(b);
    return html`
          <div class="mi-benefit">
            <div class="mi-benefit__head"><span>${b.title}</span><span class="mi-tag" data-benefit="${st.id}">${st.label}</span></div>
            ${p !== null ? raw(progressBar(Math.min(p, 100), b.title)) : ''}
            <small class="mi-muted">المستهدف: ${fmtNumber(b.target)} ${b.unit} — المتحقق: ${b.actual === null || b.actual === undefined ? 'لم يُقس' : fmtNumber(b.actual) + ' ' + b.unit}</small>
          </div>`;
  }).join('')) : raw('<p class="mi-muted">تُحدد المنافع عند بوابة الاعتماد</p>')}
      </section>

      <section class="mi-card">
        <h3>سجل المخاطر</h3>
        ${risks.length ? raw(risks.map((r) => html`
          <div class="mi-risk-line">
            <span class="mi-risk-line__badge" data-level="${exposureLevel(r).id}">${exposureLevel(r).label}</span>
            <div><b>${r.title}</b><br><small class="mi-muted">${r.response || ''} — ${r.status === 'open' ? 'مفتوح' : r.status === 'mitigated' ? 'مُعالج' : 'مغلق'}</small></div>
          </div>`).join('')) : raw('<p class="mi-muted">لا مخاطر مسجلة</p>')}
      </section>

      <section class="mi-card">
        <h3>فحوص الجودة</h3>
        ${quality.length ? raw(quality.map((q) => html`
          <div class="mi-quality-line" data-result="${q.result}">
            <span class="mi-tag" data-benefit="${q.result === 'pass' ? 'achieved' : 'atRisk'}">${q.result === 'pass' ? 'مطابق' : 'غير مطابق'}</span>
            <div><b>${q.title}</b><br><small class="mi-muted">${fmtDate(q.at)} — ${q.inspector}${q.notes ? ' — ' + q.notes : ''}</small></div>
          </div>`).join('')) : raw('<p class="mi-muted">لا فحوص مسجلة</p>')}
      </section>

      <section class="mi-card mi-card--span">
        <h3>القرارات وتاريخ الحالة</h3>
        <div class="mi-timeline">
          ${raw(sortBy([...(initiative.statusHistory || [])], (h) => h.at, 'desc').map((h) => {
    const dec = decisions.find((d) => d.id === h.decisionId);
    return html`
            <div class="mi-timeline__item">
              <time>${fmtDate(h.at)}</time>
              <div>
                <b>${statusLabel(h.from)} ← ${statusLabel(h.to)}</b>
                <small class="mi-muted"> — ${h.by || ''}</small>
                ${dec ? raw(`<p class="mi-decision-note">${escapeHtml(dec.id)}: ${escapeHtml(dec.rationale || '')}</p>`) : ''}
              </div>
            </div>`;
  }).join('') || '<p class="mi-muted">لا يوجد تاريخ حالة بعد</p>')}
        </div>
        ${reviews.length ? raw(html`<h4 class="mi-subhead">توصيات المراجعين</h4>
          ${raw(reviews.map((rv) => html`
            <div class="mi-review-line">
              <b>${rv.reviewer}</b> <span class="mi-tag">${rv.gateId}</span>
              <span>${rv.recommendation}</span>
              ${rv.notes ? raw(`<small class="mi-muted"> — ${escapeHtml(rv.notes)}</small>`) : ''}
            </div>`).join(''))}`) : ''}
      </section>
    </div>

    <div class="mi-cloud-panels mi-detail-grid" data-cloud-panels hidden></div>

    <div class="mi-detail-actions">
      <button class="mi-btn mi-btn--ghost" data-act="print">تقرير طباعة</button>
      ${initiative.status === 'closed' ? raw('<button class="mi-btn mi-btn--gold" data-act="certificate">شهادة الإنجاز 🏅</button>') : ''}
      ${raw(transitions.map((t) => html`
        <button class="mi-btn ${t.to === 'rejected' ? 'mi-btn--danger' : 'mi-btn--primary'}" data-transition="${t.to}">${t.label}</button>`).join(''))}
    </div>`;

  // معاينة كل مواقع المبادرة على خريطة واحدة
  const geoHost = container.querySelector('[data-geo]');
  if (geoHost) renderSitesPreview(geoHost, getSites(initiative));

  // لوحات وضع السحابة: الحوكمة الرسمية، لوحة المشرف، الملاحظات، المرفقات
  (async () => {
    const { isCloudMode } = await import('../../config.js');
    if (!isCloudMode() || !initiative._uuid) return;
    const panelsHost = container.querySelector('[data-cloud-panels]');
    panelsHost.hidden = false;
    const { renderCloudPanels } = await import('./cloud-panels.js');
    await renderCloudPanels(panelsHost, initiative, () => renderInitiativeDetails(container, id));
  })().catch((err) => console.warn('تعذر تحميل لوحات السحابة', err));

  // إدارة صورة المبادرة
  container.querySelector('[data-act="image"]')?.addEventListener('click', async () => {
    try {
      const dataUrl = await pickInitiativeImage();
      if (!dataUrl) return;
      await repos.initiatives.update(id, { imageDataUrl: dataUrl });
      toastSuccess('حُفظت صورة المبادرة');
      renderInitiativeDetails(container, id);
    } catch (err) { toastError(err.message); }
  });
  container.querySelector('[data-act="image-remove"]')?.addEventListener('click', async () => {
    await repos.initiatives.update(id, { imageDataUrl: null });
    toastSuccess('أُزيلت الصورة');
    renderInitiativeDetails(container, id);
  });

  // إدارة مواقع المبادرة المتعددة
  async function saveSites(sites) {
    const { lat, lng } = firstLatLng(sites);
    // geometry القديمة تُلغى بعد التحول لنظام المواقع
    await repos.initiatives.update(id, { sites, geometry: null, lat, lng });
    renderInitiativeDetails(container, id);
  }
  container.querySelector('[data-act="add-site"]')?.addEventListener('click', () => {
    openLocationPicker({
      initial: null,
      async onConfirm(geometry) {
        const sites = [...getSites(initiative).map((s) => ({ ...s })),
        { id: uid('site'), name: `الموقع ${getSites(initiative).length + 1}`, geometry }];
        await saveSites(sites);
        toastSuccess(`أُضيف موقع — ${measureLabel(geometry)}`);
      }
    });
  });
  container.querySelectorAll('[data-edit-site]').forEach((btn) => btn.addEventListener('click', () => {
    const sites = getSites(initiative).map((s) => ({ ...s }));
    const site = sites.find((s) => s.id === btn.dataset.editSite);
    if (!site) return;
    openLocationPicker({
      initial: site.geometry,
      async onConfirm(geometry) {
        site.geometry = geometry;
        await saveSites(sites);
        toastSuccess(`حُدّث الموقع — ${measureLabel(geometry)}`);
      }
    });
  }));
  container.querySelectorAll('[data-del-site]').forEach((btn) => btn.addEventListener('click', async () => {
    const sure = await confirmModal('حذف موقع', 'سيُحذف هذا الموقع من مواقع المبادرة. متابعة؟', { confirmLabel: 'حذف', danger: true });
    if (!sure) return;
    const sites = getSites(initiative).filter((s) => s.id !== btn.dataset.delSite).map((s) => ({ ...s }));
    await saveSites(sites);
    toastSuccess('حُذف الموقع');
  }));

  // شهادة الإنجاز (للمبادرات المغلقة)
  container.querySelector('[data-act="certificate"]')?.addEventListener('click', () =>
    openCertificateModal(initiative, links, partners, role));

  // فتح قائمة تحقق البوابة
  container.querySelector('[data-act="open-checklist"]')?.addEventListener('click', async () => {
    const c = buildChecklist(nextGate.id, id);
    await repos.gateChecklists.create(c);
    toastSuccess(`فُتحت قائمة تحقق ${nextGate.id}`);
    renderInitiativeDetails(container, id);
  });

  // تحديث بنود القائمة
  container.querySelectorAll('.mi-check-item input').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const items = checklist.items.map((it) => it.key === cb.dataset.key ? { ...it, done: cb.checked } : it);
      await repos.gateChecklists.update(checklist.id, { items });
      renderInitiativeDetails(container, id);
    });
  });

  // تنفيذ الانتقالات — قرارات البوابات والإعادة تتطلب مسوغات، والبقية مباشرة
  container.querySelectorAll('[data-transition]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const to = btn.dataset.transition;
      const meta = transitionMeta(initiative.status, to);
      if (meta?.gate && readiness && !readiness.ready) {
        const proceed = await confirmModal('قائمة التحقق غير مكتملة',
          `أُنجز ${readiness.done} من ${readiness.total} بنود بوابة ${meta.gate}. هل تريد تسجيل القرار رغم ذلك؟`,
          { confirmLabel: 'متابعة بقرار مسبب', danger: true });
        if (!proceed) return;
      }
      if (meta?.gate || meta?.requiresReason) {
        openDecisionModal(container, initiative, meta, to);
      } else {
        try {
          await repos.initiatives.transition(initiative.id, to, { by: getUserName() });
          toastSuccess(`انتقلت المبادرة إلى: ${statusLabel(to)}`);
          renderInitiativeDetails(container, id);
        } catch (err) { toastError(err.message); }
      }
    });
  });

  // تقرير الطباعة
  container.querySelector('[data-act="print"]')?.addEventListener('click', () => {
    openReportViewer({
      title: `تقرير مبادرة — ${initiative.title}`,
      subtitle: `${initiative.id} • ${categoryLabel(initiative.category)} • حي ${initiative.district}`,
      kpis: [
        { label: 'الحالة', value: statusLabel(initiative.status) },
        { label: 'الميزانية', value: fmtMoney(initiative.budget) },
        { label: 'المنصرف', value: fmtMoney(initiative.spent) },
        { label: 'المستفيدون', value: initiative.beneficiaries ? fmtNumber(initiative.beneficiaries) : '—' },
        { label: 'المواقع', value: fmtNumber(getSites(initiative).length) }
      ],
      generatedAt: new Date().toISOString(),
      sections: [
        { heading: 'الوصف', html: `<p>${escapeHtml(initiative.summary)}</p>` },
        {
          heading: 'المؤشرات المالية', html: toHtmlTable([initiative], [
            { key: 'budget', label: 'الميزانية', map: (r) => fmtMoney(r.budget) },
            { key: 'spent', label: 'المنصرف', map: (r) => fmtMoney(r.spent) },
            { key: 'beneficiaries', label: 'المستفيدون', map: (r) => fmtNumber(r.beneficiaries || 0) }
          ])
        },
        {
          heading: 'المنافع', html: benefits.length ? toHtmlTable(benefits, [
            { key: 'title', label: 'المنفعة' }, { key: 'target', label: 'المستهدف', map: (b) => `${fmtNumber(b.target)} ${b.unit}` },
            { key: 'actual', label: 'المتحقق', map: (b) => b.actual === null || b.actual === undefined ? 'لم يُقس' : `${fmtNumber(b.actual)} ${b.unit}` }
          ]) : '<p>لا منافع مسجلة</p>'
        },
        {
          heading: 'المخاطر', html: risks.length ? toHtmlTable(risks, [
            { key: 'title', label: 'الخطر' }, { key: 'level', label: 'المستوى', map: (r) => exposureLevel(r).label },
            { key: 'response', label: 'الاستجابة' }
          ]) : '<p>لا مخاطر مسجلة</p>'
        }
      ]
    });
  });

  async function openDecisionModal(host, ini, meta, to) {
    const isReturn = to === 'returned';
    const { dialog, close } = openModal({
      title: meta.gate ? `قرار بوابة ${meta.gate} — ${meta.label}` : meta.label,
      bodyHtml: html`
        <div class="mi-form-field">
          <label for="mi-dec-rationale">${isReturn ? 'سبب الإعادة (يصل للجهة — إلزامي)' : 'مسوّغات القرار'}</label>
          <textarea id="mi-dec-rationale" class="mi-input" rows="4" placeholder="اكتب الأساس الذي بُني عليه القرار…"></textarea>
        </div>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
        <button class="mi-btn ${isReturn || to === 'rejected' ? 'mi-btn--danger' : 'mi-btn--primary'}" data-act="save">تسجيل القرار</button>`
    });
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const rationale = dialog.querySelector('#mi-dec-rationale').value.trim();
      if (rationale.length < 10) { toastError('المسوّغات مطلوبة (10 أحرف على الأقل)'); return; }
      const outcome = to === 'rejected' ? 'reject' : to === 'onHold' ? 'hold' : isReturn ? 'return' : 'pass';
      try {
        const decision = await repos.decisions.create({
          initiativeId: ini.id, gateId: meta.gate || null, outcome, rationale,
          by: getUserName(), at: new Date().toISOString()
        });
        await repos.initiatives.transition(ini.id, to, {
          reason: rationale, by: getUserName(), decisionId: decision.id
        });
      } catch (err) { toastError(err.message); return; }
      close();
      toastSuccess(`سُجّل القرار وانتقلت المبادرة إلى: ${statusLabel(to)}`);
      notify(meta.gate ? `قرار بوابة ${meta.gate}` : meta.label, `${ini.title} — ${statusLabel(to)}`);
      renderInitiativeDetails(container, ini.id);
    });
  }
}

// نافذة شهادة الإنجاز: معاينة فاخرة + تنزيل PNG للجميع، وتحرير البيانات لمدير النظام فقط
async function openCertificateModal(initiative, links, partners, role) {
  const template = await getCertTemplate();
  const partnerNames = links
    .map((l) => partners.find((p) => p.id === l.partnerId)?.name)
    .filter(Boolean);
  const recipientNames = partnerNames.length
    ? partnerNames
    : [initiative.submitterEntity || initiative.submitterName || 'شركاء المبادرة'];

  const canEdit = can(role, 'certificates.manage') || role === 'admin';

  const { dialog, close } = openModal({
    title: `شهادة إنجاز — ${initiative.title}`,
    wide: true,
    bodyHtml: html`
      <div class="mi-cert-preview" aria-label="معاينة الشهادة"><p class="mi-muted">جارٍ تجهيز الشهادة…</p></div>
      ${canEdit ? raw(`
      <details class="mi-cert-edit">
        <summary>تحرير بيانات الشهادة (مدير النظام)</summary>
        <form class="mi-form" id="mi-cert-form">
          <div class="mi-form-row">
            <div class="mi-form-field"><label>اسم الموقّع</label><input class="mi-input" name="signatoryName" value="${escapeHtml(template.signatoryName)}"></div>
            <div class="mi-form-field"><label>صفة الموقّع</label><input class="mi-input" name="signatoryTitle" value="${escapeHtml(template.signatoryTitle)}"></div>
          </div>
          <div class="mi-form-field"><label>عبارة التقديم</label><input class="mi-input" name="appreciationText" value="${escapeHtml(template.appreciationText)}"></div>
          <div class="mi-form-field"><label>نص التقدير</label><textarea class="mi-input" name="bodyText" rows="3">${escapeHtml(template.bodyText)}</textarea></div>
          <button type="button" class="mi-btn mi-btn--primary mi-btn--sm" data-act="save-template">حفظ وتحديث المعاينة</button>
        </form>
      </details>`) : ''}`,
    footerHtml: html`
      <button class="mi-btn mi-btn--ghost" data-act="close">إغلاق</button>
      <button class="mi-btn mi-btn--gold" data-act="download" disabled>تنزيل الشهادة كصورة</button>`
  });

  const preview = dialog.querySelector('.mi-cert-preview');
  const downloadBtn = dialog.querySelector('[data-act="download"]');
  let currentCanvas = null;

  async function draw(tmpl) {
    try {
      currentCanvas = await renderCertificateCanvas({ initiative, recipientNames, template: tmpl });
      preview.innerHTML = '';
      currentCanvas.className = 'mi-cert-canvas';
      preview.appendChild(currentCanvas);
      downloadBtn.disabled = false;
    } catch (err) {
      console.error('تعذر رسم الشهادة', err);
      preview.innerHTML = '<p class="mi-alert mi-alert--error">تعذر تجهيز الشهادة</p>';
    }
  }
  draw(template);

  dialog.querySelector('[data-act="close"]').addEventListener('click', close);
  dialog.querySelector('[data-act="download"]').addEventListener('click', () => {
    if (currentCanvas) downloadCanvasPng(currentCanvas, `شهادة-${initiative.id}.png`);
  });
  dialog.querySelector('[data-act="save-template"]')?.addEventListener('click', async () => {
    const form = dialog.querySelector('#mi-cert-form');
    const patch = {
      signatoryName: form.signatoryName.value.trim(),
      signatoryTitle: form.signatoryTitle.value.trim(),
      appreciationText: form.appreciationText.value.trim(),
      bodyText: form.bodyText.value.trim()
    };
    const saved = await saveCertTemplate(patch);
    toastSuccess('حُفظت بيانات الشهادة');
    draw(saved);
  });
}
