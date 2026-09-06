// التكلفة التقديرية للمبادرة — حاسبة بوحدات قياس ثابتة (م²، م.ط، عدد…) وسعر وحدة بالريال ومعدل زمني،
// تقترح البنود من مواقع المبادرة ونص نموذجها، وتحفظ التقدير على المبادرة (الميزانية ونطاقا التكلفة والمدة)،
// مع كتالوج وحدات قابل للتعديل لمن يملك صلاحية الإعدادات.
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, kpiCard, statusBadge } from '../../ui/components.js';
import { computeEstimate, suggestItems, unitsForCategory, costBandText, durationBandText, UNIT_KINDS, DEFAULT_COST_UNITS } from '../../domain/cost-estimate.js';
import { getCostConfig, saveCostConfig, upsertUnit, removeUnit, resetUnits, saveEstimateToInitiative } from '../../services/cost-units-service.js';
import { categoryLabel } from '../../domain/initiative-model.js';
import { fmtMoney, fmtNumber, uid, sortBy } from '../../core/utils.js';
import { fmtDate } from '../../core/date-time.js';
import { getRole, getUserName } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { openModal, confirmModal } from '../../ui/modal.js';
import { openReportViewer } from '../../ui/report-viewer.js';
import { CATEGORIES } from '../../core/constants.js';

const CATEGORY_OPTIONS = [...CATEGORIES, { id: 'general', label: 'عام (كل المجالات)' }];
const catLabel = (id) => id === 'general' ? 'عام' : categoryLabel(id);

export async function renderCosting(container, params = {}) {
  const [initiatives, cfg] = await Promise.all([repos.initiatives.getAll(), getCostConfig()]);
  const role = getRole();
  const canSave = can(role, 'initiatives.edit');
  const canManage = can(role, 'settings.view') && (role === 'admin' || role === 'pmo');
  const list = sortBy(initiatives.filter((i) => i.status !== 'rejected'), (i) => i.id);

  // حالة الحاسبة
  let units = cfg.units;
  let contingencyPct = cfg.contingencyPct;
  let durationMode = 'parallel';
  let selected = params.id ? list.find((i) => i.id === params.id) || null : null;
  let category = selected?.category || 'parks';
  let items = selected ? itemsFromSaved(selected) || suggestItems(selected, units) : [];
  let suggestionNote = selected && !selected.costEstimate ? sourcesNote(items) : (selected?.costEstimate ? `تقدير محفوظ بتاريخ ${fmtDate(selected.costEstimate.at)}` : '');

  function itemsFromSaved(ini) {
    const e = ini.costEstimate;
    if (!e?.lines?.length) return null;
    return e.lines.map((l) => ({ unitId: l.unitId, qty: l.qty, rate: l.rate, source: 'من التقدير المحفوظ' }));
  }
  function sourcesNote(its) {
    const src = [...new Set(its.map((i) => i.source).filter(Boolean))];
    return src.length ? `اقتُرحت الكميات ${src.join('، ')} — راجعها وعدّلها قبل الحفظ` : 'أضف البنود وأدخل الكميات';
  }

  container.innerHTML = html`
    ${raw(sectionHeader('التكلفة التقديرية للمبادرة',
    'وحدات قياس ثابتة لكل مجال (م²، م.ط، عدد…) بسعر وحدة بالريال ومعدل زمني — أدخل الكميات فتُحتسب التكلفة والمدة التقديريتان ونطاقاهما، ويمكن حفظ التقدير على المبادرة',
    `<button class="mi-btn mi-btn--ghost" data-act="print">تقرير التقدير</button>${canManage ? '<button class="mi-btn mi-btn--gold" data-act="catalog">كتالوج الوحدات والأسعار</button>' : ''}`))}
    <div class="mi-cost-grid">
      <section class="mi-card mi-cost-calc">
        <div class="mi-form-grid mi-cost-pick">
          <div class="mi-form-field mi-form-field--wide">
            <label for="mi-cost-ini">المبادرة (اختياري — يقترح النظام البنود من موقعها ونموذجها)</label>
            <select class="mi-input" id="mi-cost-ini">
              <option value="">— حساب حر بدون مبادرة —</option>
              ${raw(list.map((i) => `<option value="${escapeHtml(i.id)}" ${selected?.id === i.id ? 'selected' : ''}>${escapeHtml(i.id)} — ${escapeHtml(i.title)}</option>`).join(''))}
            </select>
          </div>
          <div class="mi-form-field">
            <label for="mi-cost-cat">نوع المبادرة (المجال)</label>
            <select class="mi-input" id="mi-cost-cat">${raw(CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === category ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join(''))}</select>
          </div>
          <div class="mi-form-field">
            <label for="mi-cost-cont">احتياطي الطوارئ %</label>
            <input class="mi-input" id="mi-cost-cont" type="number" min="0" max="50" step="1" value="${String(contingencyPct)}">
          </div>
          <div class="mi-form-field">
            <label for="mi-cost-mode">احتساب المدة</label>
            <select class="mi-input" id="mi-cost-mode"><option value="parallel">بالتوازي — أطول بند</option><option value="sequential">متسلسل — مجموع البنود</option></select>
          </div>
        </div>
        <p class="mi-muted mi-cost-note" data-note>${suggestionNote}</p>
        <div class="mi-table-wrap">
          <table class="mi-table mi-cost-table">
            <thead><tr><th>البند (وحدة القياس)</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة (ريال)</th><th>التكلفة</th><th>المدة (يوم)</th><th></th></tr></thead>
            <tbody data-lines></tbody>
          </table>
        </div>
        <div class="mi-cost-actions">
          <button class="mi-btn mi-btn--ghost mi-btn--sm" data-act="add">+ إضافة بند</button>
          <button class="mi-btn mi-btn--ghost mi-btn--sm" data-act="suggest" ${selected ? '' : raw('disabled')}>اقتراح البنود من المبادرة</button>
          <button class="mi-btn mi-btn--ghost mi-btn--sm" data-act="clear">مسح البنود</button>
        </div>
      </section>
      <aside class="mi-card mi-cost-result" data-result></aside>
    </div>`;

  const linesEl = container.querySelector('[data-lines]');
  const resultEl = container.querySelector('[data-result]');
  const noteEl = container.querySelector('[data-note]');
  const iniSel = container.querySelector('#mi-cost-ini');
  const catSel = container.querySelector('#mi-cost-cat');
  const contInput = container.querySelector('#mi-cost-cont');
  const modeSel = container.querySelector('#mi-cost-mode');

  function estimate() { return computeEstimate(items, units, { contingencyPct, durationMode }); }

  function unitOptions(current) {
    const avail = unitsForCategory(units, category);
    const cur = units.find((u) => u.id === current);
    const all = cur && !avail.includes(cur) ? [cur, ...avail] : avail;
    return all.map((u) => `<option value="${escapeHtml(u.id)}" ${u.id === current ? 'selected' : ''}>${escapeHtml(u.label)}${u.category === 'general' ? ' (عام)' : ''}</option>`).join('');
  }

  function renderLines() {
    const e = estimate();
    if (!items.length) {
      linesEl.innerHTML = '<tr><td colspan="7" class="mi-muted">لا بنود بعد — اختر مبادرة ليقترح النظام البنود أو أضف بندًا يدويًا</td></tr>';
    } else {
      linesEl.innerHTML = items.map((it, idx) => {
        const u = units.find((x) => x.id === it.unitId);
        const rate = it.rate === undefined || it.rate === null || it.rate === '' ? (u?.rate ?? 0) : it.rate;
        const qty = Number(it.qty) || 0;
        const cost = Math.round(qty * Number(rate || 0));
        const days = u ? Math.ceil(u.baseDays + qty * u.daysPerUnit) : 0;
        return `<tr data-idx="${idx}">
          <td><select class="mi-input mi-input--sm" data-f="unitId">${unitOptions(it.unitId)}</select>${it.source ? `<small class="mi-muted mi-cost-src">${escapeHtml(it.source)}</small>` : ''}</td>
          <td><span class="mi-tag">${escapeHtml(u?.unit || '—')}</span></td>
          <td><input class="mi-input mi-input--sm mi-cost-qty" data-f="qty" type="number" min="0" step="1" value="${qty || ''}" placeholder="0"></td>
          <td><input class="mi-input mi-input--sm mi-cost-rate" data-f="rate" type="number" min="0" step="1" value="${escapeHtml(String(rate))}" title="السعر الافتراضي ${fmtNumber(u?.rate ?? 0)} ريال">${u && Number(rate) !== u.rate ? '<small class="mi-cost-custom">سعر مخصص</small>' : ''}</td>
          <td><b>${qty ? fmtMoney(cost) : '—'}</b></td>
          <td>${qty ? fmtNumber(days) : '—'}</td>
          <td><button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-del="${idx}" aria-label="حذف البند">✕</button></td>
        </tr>`;
      }).join('');
    }
    renderResult(e);
  }

  function renderResult(e) {
    const savedMatch = selected?.costEstimate && selected.costEstimate.total === e.total;
    resultEl.innerHTML = html`
      <h3>النتيجة التقديرية</h3>
      ${selected ? raw(`<p class="mi-cost-target"><span class="mi-tag">${escapeHtml(selected.id)}</span> ${escapeHtml(selected.title)} ${statusBadge(selected.status)}</p>`) : raw('<p class="mi-muted">حساب حر — اختر مبادرة لحفظ التقدير عليها</p>')}
      <div class="mi-cost-kpis">
        ${raw(kpiCard('التكلفة التقديرية', fmtMoney(e.total), `نطاق: ${costBandText(e.costBand)}`, 'gold'))}
        ${raw(kpiCard('المدة التقديرية', e.days ? `${fmtNumber(e.days)} يومًا` : '—', e.days ? `≈ ${fmtNumber(e.months)} شهرًا — ${durationBandText(e.durationBand)}` : 'أدخل الكميات', 'exec'))}
      </div>
      <dl class="mi-cost-breakdown">
        <div><dt>مجموع البنود</dt><dd>${fmtMoney(e.subtotal)}</dd></div>
        <div><dt>احتياطي الطوارئ (${fmtNumber(e.contingencyPct)}%)</dt><dd>${fmtMoney(e.contingency)}</dd></div>
        <div class="mi-cost-breakdown__total"><dt>الإجمالي</dt><dd>${fmtMoney(e.total)}</dd></div>
        <div><dt>عدد البنود</dt><dd>${fmtNumber(e.lines.length)}</dd></div>
      </dl>
      ${selected?.costEstimate ? raw(`<p class="mi-muted mi-cost-saved">آخر تقدير محفوظ: ${escapeHtml(fmtMoney(selected.costEstimate.total))} بتاريخ ${escapeHtml(fmtDate(selected.costEstimate.at))}${selected.costEstimate.by ? ' — ' + escapeHtml(selected.costEstimate.by) : ''}</p>`) : ''}
      ${selected && (selected.budget && !selected.costEstimate) ? raw(`<p class="mi-muted">الميزانية الحالية المسجلة: ${escapeHtml(fmtMoney(selected.budget))}</p>`) : ''}
      <div class="mi-cost-result__actions">
        ${selected && canSave ? raw(`<button class="mi-btn mi-btn--primary" data-act="save" ${e.lines.length && !savedMatch ? '' : 'disabled'}>حفظ التقدير في المبادرة</button>`) : ''}
        ${selected ? raw(`<a class="mi-btn mi-btn--ghost" href="#/initiatives/${encodeURIComponent(selected.id)}">فتح المبادرة</a>`) : ''}
      </div>
      <p class="mi-muted mi-cost-disclaimer">الأسعار والمعدلات الزمنية استرشادية وتُعدَّل من كتالوج الوحدات؛ الحفظ يحدّث الميزانية ونطاقي التكلفة والمدة في المبادرة.</p>`;
    resultEl.querySelector('[data-act="save"]')?.addEventListener('click', async () => {
      try {
        await saveEstimateToInitiative(selected.id, e, { byName: getUserName() });
        selected = await repos.initiatives.get(selected.id);
        toastSuccess(`حُفظ التقدير على «${selected.title}» — ${fmtMoney(e.total)}`);
        renderResult(e);
      } catch (err) { toastError(err.message); }
    });
  }

  // ————— الأحداث —————
  linesEl.addEventListener('input', (ev) => {
    const tr = ev.target.closest('tr[data-idx]'); if (!tr) return;
    const it = items[Number(tr.dataset.idx)]; const f = ev.target.dataset.f;
    if (f === 'qty') it.qty = ev.target.value;
    if (f === 'rate') it.rate = ev.target.value;
    it.source = '';
    // تحديث الأرقام دون إعادة بناء الحقول (للحفاظ على التركيز)
    const e = estimate();
    const u = units.find((x) => x.id === it.unitId);
    const qty = Number(it.qty) || 0; const rate = it.rate === '' || it.rate === undefined ? (u?.rate ?? 0) : Number(it.rate);
    tr.children[4].innerHTML = `<b>${qty ? fmtMoney(Math.round(qty * rate)) : '—'}</b>`;
    tr.children[5].textContent = qty && u ? fmtNumber(Math.ceil(u.baseDays + qty * u.daysPerUnit)) : '—';
    renderResult(e);
  });
  linesEl.addEventListener('change', (ev) => {
    const tr = ev.target.closest('tr[data-idx]'); if (!tr) return;
    const it = items[Number(tr.dataset.idx)];
    if (ev.target.dataset.f === 'unitId') { it.unitId = ev.target.value; it.rate = ''; it.source = ''; renderLines(); }
    if (ev.target.dataset.f === 'rate') renderLines();
  });
  linesEl.addEventListener('click', (ev) => {
    const del = ev.target.closest('[data-del]'); if (!del) return;
    items.splice(Number(del.dataset.del), 1); renderLines();
  });
  container.querySelector('[data-act="add"]').addEventListener('click', () => {
    const avail = unitsForCategory(units, category);
    const next = avail.find((u) => !items.some((i) => i.unitId === u.id)) || avail[0];
    if (!next) { toastError('لا وحدات معرفة لهذا المجال — أضفها من الكتالوج'); return; }
    items.push({ unitId: next.id, qty: '', rate: '', source: '' });
    renderLines();
    linesEl.querySelector('tr:last-child [data-f="qty"]')?.focus();
  });
  container.querySelector('[data-act="clear"]').addEventListener('click', () => { items = []; noteEl.textContent = ''; renderLines(); });
  container.querySelector('[data-act="suggest"]').addEventListener('click', () => {
    if (!selected) return;
    items = suggestItems(selected, units); noteEl.textContent = sourcesNote(items); renderLines();
  });
  iniSel.addEventListener('change', () => {
    selected = list.find((i) => i.id === iniSel.value) || null;
    container.querySelector('[data-act="suggest"]').disabled = !selected;
    if (selected) {
      category = selected.category || category; catSel.value = category;
      items = itemsFromSaved(selected) || suggestItems(selected, units);
      noteEl.textContent = selected.costEstimate ? `تقدير محفوظ بتاريخ ${fmtDate(selected.costEstimate.at)} — عدّله واحفظه مجددًا عند الحاجة` : sourcesNote(items);
    } else { items = []; noteEl.textContent = ''; }
    renderLines();
  });
  catSel.addEventListener('change', () => { category = catSel.value; renderLines(); });
  contInput.addEventListener('input', () => { contingencyPct = Number(contInput.value) || 0; renderResult(estimate()); });
  modeSel.addEventListener('change', () => { durationMode = modeSel.value; renderResult(estimate()); });

  container.querySelector('[data-act="print"]').addEventListener('click', () => {
    const e = estimate();
    if (!e.lines.length) { toastError('لا بنود لعرضها'); return; }
    openReportViewer({
      title: 'التكلفة التقديرية' + (selected ? ` — ${selected.title}` : ''),
      subtitle: `${selected ? selected.id + ' • ' : ''}${categoryLabel(category)} • احتياطي ${fmtNumber(e.contingencyPct)}% • المدة ${durationMode === 'sequential' ? 'متسلسلة' : 'بالتوازي'}`,
      fileName: `cost-estimate-${selected?.id || 'free'}`,
      kpis: [
        { label: 'التكلفة التقديرية', value: fmtMoney(e.total), sub: costBandText(e.costBand) },
        { label: 'المدة التقديرية', value: e.days ? `${fmtNumber(e.days)} يومًا` : '—', sub: durationBandText(e.durationBand) },
        { label: 'عدد البنود', value: fmtNumber(e.lines.length) }
      ],
      sections: [
        { title: 'بنود التقدير', html: `<table class="mi-table"><thead><tr><th>البند</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>التكلفة</th><th>المدة (يوم)</th></tr></thead><tbody>${e.lines.map((l) => `<tr><td>${escapeHtml(l.label)}</td><td>${escapeHtml(l.unit)}</td><td>${fmtNumber(l.qty)}</td><td>${fmtMoney(l.rate)}${l.customRate ? ' *' : ''}</td><td>${fmtMoney(l.cost)}</td><td>${fmtNumber(l.days)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="4">مجموع البنود</td><td>${fmtMoney(e.subtotal)}</td><td></td></tr><tr><td colspan="4">احتياطي الطوارئ ${fmtNumber(e.contingencyPct)}%</td><td>${fmtMoney(e.contingency)}</td><td></td></tr><tr><td colspan="4"><b>الإجمالي</b></td><td><b>${fmtMoney(e.total)}</b></td><td></td></tr></tfoot></table><p class="mi-muted">* سعر مخصص يختلف عن سعر الكتالوج. الأسعار والمعدلات استرشادية.</p>` }
      ]
    });
  });

  container.querySelector('[data-act="catalog"]')?.addEventListener('click', () => openCatalog());

  // ————— كتالوج الوحدات والأسعار —————
  function openCatalog() {
    const { dialog, close } = openModal({
      title: 'كتالوج وحدات القياس والأسعار',
      wide: true,
      bodyHtml: '<div data-catalog></div>',
      footerHtml: '<button class="mi-btn mi-btn--ghost" data-act="close">إغلاق</button>'
    });
    const host = dialog.querySelector('[data-catalog]');
    dialog.querySelector('[data-act="close"]').addEventListener('click', () => { close(); renderLines(); });

    function draw() {
      const grouped = CATEGORY_OPTIONS.map((c) => ({ c, list: units.filter((u) => u.category === c.id) })).filter((g) => g.list.length);
      host.innerHTML = html`
        <p class="mi-muted">وحدات ثابتة لكل مجال: سعر الوحدة بالريال، وأيام التنفيذ لكل وحدة، وأيام التجهيز الثابتة. التعديل يُحفظ فورًا ويؤثر على التقديرات الجديدة فقط.</p>
        <div class="mi-cost-cat-tools">
          <label class="mi-form-field"><span>احتياطي الطوارئ الافتراضي %</span><input class="mi-input mi-input--sm" type="number" min="0" max="50" data-cont value="${String(contingencyPct)}"></label>
          <button type="button" class="mi-btn mi-btn--primary mi-btn--sm" data-act="new">+ وحدة جديدة</button>
          <button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-act="reset">استعادة الافتراضي</button>
        </div>
        <div class="mi-table-wrap"><table class="mi-table mi-cost-catalog">
          <thead><tr><th>المجال</th><th>البند</th><th>الوحدة</th><th>السعر (ريال/وحدة)</th><th>يوم/وحدة</th><th>أيام تجهيز</th><th></th></tr></thead>
          <tbody>${raw(grouped.map((g) => g.list.map((u) => `<tr data-unit="${escapeHtml(u.id)}">
            <td>${escapeHtml(catLabel(u.category))}</td>
            <td>${escapeHtml(u.label)}${DEFAULT_COST_UNITS.some((d) => d.id === u.id) ? '' : ' <span class="mi-tag mi-tag--gold">مخصصة</span>'}</td>
            <td><span class="mi-tag">${escapeHtml(u.unit)}</span></td>
            <td><input class="mi-input mi-input--sm" type="number" min="0" step="1" data-f="rate" value="${u.rate}"></td>
            <td><input class="mi-input mi-input--sm" type="number" min="0" step="0.001" data-f="daysPerUnit" value="${u.daysPerUnit}"></td>
            <td><input class="mi-input mi-input--sm" type="number" min="0" step="1" data-f="baseDays" value="${u.baseDays}"></td>
            <td><button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-edit="${escapeHtml(u.id)}">تعديل</button> <button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-remove="${escapeHtml(u.id)}">حذف</button></td>
          </tr>`).join('')).join(''))}</tbody>
        </table></div>`;

      host.querySelector('[data-cont]').addEventListener('change', async (ev) => {
        contingencyPct = Number(ev.target.value) || 0; contInput.value = String(contingencyPct);
        const c = await saveCostConfig({ units, removed: cfg.removed, contingencyPct }); units = c.units; toastSuccess('حُفظ الاحتياطي الافتراضي');
      });
      host.querySelectorAll('tr[data-unit] input[data-f]').forEach((inp) => inp.addEventListener('change', async () => {
        const id = inp.closest('tr').dataset.unit; const u = units.find((x) => x.id === id); if (!u) return;
        const c = await upsertUnit({ ...u, [inp.dataset.f]: Number(inp.value) || 0 }); units = c.units; cfg.removed = c.removed;
        toastSuccess(`حُدّثت «${u.label}»`);
      }));
      host.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editUnit(units.find((x) => x.id === b.dataset.edit))));
      host.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
        const u = units.find((x) => x.id === b.dataset.remove);
        if (!await confirmModal('حذف وحدة', `حذف «${u.label}» من الكتالوج؟ التقديرات المحفوظة سابقًا لا تتأثر.`, { confirmLabel: 'حذف', danger: true })) return;
        const c = await removeUnit(u.id); units = c.units; cfg.removed = c.removed; toastSuccess('حُذفت الوحدة'); draw();
      }));
      host.querySelector('[data-act="new"]').addEventListener('click', () => editUnit(null));
      host.querySelector('[data-act="reset"]').addEventListener('click', async () => {
        if (!await confirmModal('استعادة الافتراضي', 'إلغاء كل التعديلات والوحدات المخصصة والعودة إلى الكتالوج الافتراضي؟', { confirmLabel: 'استعادة', danger: true })) return;
        const c = await resetUnits(); units = c.units; cfg.removed = c.removed; contingencyPct = c.contingencyPct; contInput.value = String(contingencyPct); toastSuccess('استُعيد الكتالوج الافتراضي'); draw();
      });
    }

    function editUnit(u) {
      const isNew = !u;
      const v = u || { id: uid('unit'), category, label: '', unit: 'م²', rate: 0, daysPerUnit: 0, baseDays: 0, note: '' };
      const { dialog: d2, close: close2 } = openModal({
        title: isNew ? 'وحدة قياس جديدة' : 'تعديل وحدة القياس',
        bodyHtml: html`
          <form class="mi-form" id="mi-unit-form">
            <div class="mi-form-field"><label>البند</label><input class="mi-input" name="label" required maxlength="120" value="${v.label}" placeholder="مثال: حديقة حي متكاملة"></div>
            <div class="mi-form-grid">
              <div class="mi-form-field"><label>المجال</label><select class="mi-input" name="category">${raw(CATEGORY_OPTIONS.map((c) => `<option value="${c.id}" ${c.id === v.category ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join(''))}</select></div>
              <div class="mi-form-field"><label>وحدة القياس</label><select class="mi-input" name="unit">${raw(UNIT_KINDS.map((k) => `<option ${k === v.unit ? 'selected' : ''}>${k}</option>`).join(''))}</select></div>
              <div class="mi-form-field"><label>سعر الوحدة (ريال)</label><input class="mi-input" name="rate" type="number" min="0" step="1" required value="${String(v.rate)}"></div>
              <div class="mi-form-field"><label>أيام التنفيذ لكل وحدة</label><input class="mi-input" name="daysPerUnit" type="number" min="0" step="0.001" value="${String(v.daysPerUnit)}"></div>
              <div class="mi-form-field"><label>أيام التجهيز الثابتة</label><input class="mi-input" name="baseDays" type="number" min="0" step="1" value="${String(v.baseDays)}"></div>
            </div>
            <div class="mi-form-field"><label>ملاحظة (اختياري)</label><input class="mi-input" name="note" maxlength="200" value="${v.note || ''}"></div>
          </form>`,
        footerHtml: '<button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button><button class="mi-btn mi-btn--primary" data-act="ok">حفظ</button>'
      });
      d2.querySelector('[data-act="cancel"]').addEventListener('click', close2);
      d2.querySelector('[data-act="ok"]').addEventListener('click', async () => {
        const f = d2.querySelector('#mi-unit-form');
        if (!f.reportValidity()) return;
        const data = Object.fromEntries(new FormData(f).entries());
        try {
          const c = await upsertUnit({ ...v, ...data, rate: Number(data.rate), daysPerUnit: Number(data.daysPerUnit), baseDays: Number(data.baseDays) });
          units = c.units; cfg.removed = c.removed; close2(); toastSuccess(isNew ? 'أُضيفت الوحدة' : 'حُفظت الوحدة'); draw();
        } catch (err) { toastError(err.message); }
      });
    }
    draw();
  }

  renderLines();
}
