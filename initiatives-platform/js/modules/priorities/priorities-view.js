// مصفوفة أولويات المحفظة — أثر × تكلفة × جاهزية، ترتيب بالدرجة، وسيناريو ميزانية
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, kpiCard, statusBadge } from '../../ui/components.js';
import { prioritizeInitiatives, budgetScenario, estimatedCost } from '../../domain/priorities.js';
import { categoryLabel, costBandLabel } from '../../domain/initiative-model.js';
import { fmtMoney, fmtNumber, debounce } from '../../core/utils.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { navigate } from '../../router.js';
import { openCommitteeDeck } from '../../ui/slides-viewer.js';
import { openReportViewer } from '../../ui/report-viewer.js';
import { STORAGE_PREFIX } from '../../core/constants.js';

const BUDGET_KEY = STORAGE_PREFIX + 'priorityBudget';

export async function renderPriorities(container) {
  const initiatives = await repos.initiatives.getAll();
  const role = getRole();
  const canEdit = can(role, 'decisions.create') || can(role, 'initiatives.edit');
  const ranked = prioritizeInitiatives(initiatives);
  const total = ranked.reduce((a, r) => a + r.cost, 0);
  let budget = Number(localStorage.getItem(BUDGET_KEY)) || Math.round(total / 3);
  const scenario = budgetScenario(ranked, budget);

  container.innerHTML = html`
    ${raw(sectionHeader('مصفوفة أولويات المحفظة', 'أثر × إلحاح × جاهزية مقابل التكلفة — أي المبادرات تُطرح أولًا، وماذا يدخل ضمن سقف ميزانية معين',
    html`<button class="mi-btn mi-btn--ghost" data-act="report">تقرير الأولويات</button><button class="mi-btn mi-btn--gold" data-act="deck">عرض للجنة</button>`))}
    <div class="mi-kpi-grid">
      ${raw(kpiCard('مبادرات نشطة مرتبة', String(ranked.length), '', 'primary'))}
      ${raw(kpiCard('إجمالي التكلفة التقديرية', fmtMoney(total), 'ميزانيات أو منتصف النطاقات', ''))}
      ${raw(kpiCard('مقيَّمة يدويًا', String(ranked.filter((r) => r.manual).length), 'أثر وإلحاح مدخلان', ''))}
      ${raw(kpiCard('الأعلى أولوية', ranked[0] ? String(ranked[0].score) : '—', ranked[0]?.initiative.title.slice(0, 40) || '', 'gold'))}
    </div>

    <div class="mi-dash-grid">
      <section class="mi-card mi-card--span">
        <h3>مصفوفة الأثر × التكلفة <small class="mi-muted">— حجم الدائرة = الجاهزية، اللون = درجة الأولوية</small></h3>
        ${raw(scatter(ranked))}
      </section>

      <section class="mi-card mi-card--span">
        <h3>سيناريو الميزانية</h3>
        <div class="mi-scenario">
          <label>سقف الميزانية (ريال) <input class="mi-input" type="number" min="0" step="1000000" value="${String(budget)}" data-budget></label>
          <input type="range" min="0" max="${String(Math.max(total, 1))}" step="500000" value="${String(budget)}" data-budget-range aria-label="سقف الميزانية">
          <div class="mi-scenario__summary" data-scenario></div>
        </div>
      </section>

      <section class="mi-card mi-card--span">
        <h3>الترتيب بالدرجة <small class="mi-muted">— عدّل الأثر والإلحاح (1–5) لكل مبادرة وتُعاد الحسبة فورًا</small></h3>
        <div class="mi-table-wrap"><table class="mi-table mi-prio">
          <thead><tr><th>#</th><th>المبادرة</th><th>الحالة</th><th>الأثر</th><th>الإلحاح</th><th>الجاهزية</th><th>التكلفة</th><th>الدرجة</th><th>ضمن السقف</th></tr></thead>
          <tbody data-rows></tbody>
        </table></div>
      </section>
    </div>`;

  const rowsHost = container.querySelector('[data-rows]');
  const scenarioHost = container.querySelector('[data-scenario]');

  function drawRows(currentRanked, sc) {
    const inSet = new Set(sc.selected.map((r) => r.initiative.id));
    rowsHost.innerHTML = currentRanked.map((r, i) => html`
      <tr data-id="${r.initiative.id}" data-in="${inSet.has(r.initiative.id) ? 'yes' : 'no'}">
        <td>${String(i + 1)}</td>
        <td><a href="#/initiatives/${r.initiative.id}"><b>${r.initiative.title}</b></a><br><small class="mi-muted">${categoryLabel(r.initiative.category)}${r.initiative.location ? ' • ' + r.initiative.location : ''}</small></td>
        <td>${raw(statusBadge(r.initiative.status))}</td>
        <td>${canEdit ? raw(sel('impact', r.initiative.id, r.impact)) : String(r.impact)}</td>
        <td>${canEdit ? raw(sel('urgency', r.initiative.id, r.urgency)) : String(r.urgency)}</td>
        <td>${r.readinessLabel} <small class="mi-muted">(${String(r.readiness)}/5)</small></td>
        <td>${r.initiative.costBand ? costBandLabel(r.initiative.costBand) : fmtMoney(r.cost)}</td>
        <td><b class="mi-prio__score" data-score="${r.score >= 70 ? 'high' : r.score >= 50 ? 'mid' : 'low'}">${fmtNumber(r.score)}</b></td>
        <td>${inSet.has(r.initiative.id) ? raw('<span class="mi-rpt-chip" data-tone="ok">ضمن السقف</span>') : raw('<span class="mi-rpt-chip" data-tone="warn">مؤجلة</span>')}</td>
      </tr>`).join('');
    scenarioHost.innerHTML = html`
      <b>${fmtNumber(sc.selected.length)}</b> مبادرة ضمن السقف بقيمة <b>${fmtMoney(sc.used)}</b> — متبقٍ ${fmtMoney(sc.remaining)} — مؤجلة ${fmtNumber(sc.deferred.length)}
      ${sc.selected.length ? raw('<ol class="mi-scenario__list">' + sc.selected.map((r) => `<li>${escapeHtml(r.initiative.title)} <small>— ${escapeHtml(fmtMoney(r.cost))}</small></li>`).join('') + '</ol>') : ''}`;
    rowsHost.querySelectorAll('select[data-inp]').forEach((s) => s.addEventListener('change', debounce(async () => {
      const id = s.dataset.id;
      const ini = initiatives.find((x) => x.id === id);
      const inputs = { ...(ini.priorityInputs || {}), [s.dataset.inp]: Number(s.value) };
      try {
        await repos.initiatives.update(id, { priorityInputs: inputs });
        ini.priorityInputs = inputs;
        recompute();
        toastSuccess('حُفظ التقييم وأُعيد الترتيب');
      } catch (err) { toastError(err.message); }
    }, 150)));
  }
  function sel(field, id, value) {
    return `<select class="mi-input mi-input--sm" data-inp="${field}" data-id="${escapeHtml(id)}">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${n === value ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  }
  function recompute() {
    const r2 = prioritizeInitiatives(initiatives);
    const sc = budgetScenario(r2, budget);
    drawRows(r2, sc);
    container.querySelector('.mi-card--span .mi-scatter')?.replaceWith(rangeToEl(scatter(r2)));
  }
  const rangeToEl = (htmlStr) => { const t = document.createElement('template'); t.innerHTML = htmlStr.trim(); return t.content.firstElementChild; };

  drawRows(ranked, scenario);
  const budgetInput = container.querySelector('[data-budget]');
  const budgetRange = container.querySelector('[data-budget-range]');
  const onBudget = (v) => { budget = Math.max(0, Number(v) || 0); localStorage.setItem(BUDGET_KEY, String(budget)); budgetInput.value = String(budget); budgetRange.value = String(Math.min(budget, Number(budgetRange.max))); recompute(); };
  budgetInput.addEventListener('change', () => onBudget(budgetInput.value));
  budgetRange.addEventListener('input', () => onBudget(budgetRange.value));

  container.querySelector('[data-act="deck"]').addEventListener('click', () =>
    openCommitteeDeck(prioritizeInitiatives(initiatives).map((r) => r.initiative), { title: 'أولويات المحفظة — عرض لجنة المبادرات' }));
  container.querySelector('[data-act="report"]').addEventListener('click', () => {
    const r2 = prioritizeInitiatives(initiatives); const sc = budgetScenario(r2, budget);
    openReportViewer({
      title: 'تقرير أولويات المحفظة', subtitle: `سقف الميزانية ${fmtMoney(budget)} — ${fmtNumber(sc.selected.length)} مبادرة ضمن السقف`,
      kpis: [{ label: 'مبادرات', value: fmtNumber(r2.length) }, { label: 'إجمالي التكلفة', value: fmtMoney(total) }, { label: 'ضمن السقف', value: fmtNumber(sc.selected.length) }, { label: 'مؤجلة', value: fmtNumber(sc.deferred.length) }],
      generatedAt: new Date().toISOString(),
      sections: [{ heading: 'الترتيب بالدرجة', html: `<table class="mi-table"><thead><tr><th>#</th><th>المبادرة</th><th>الأثر</th><th>الإلحاح</th><th>الجاهزية</th><th>التكلفة</th><th>الدرجة</th><th>القرار</th></tr></thead><tbody>${r2.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r.initiative.title)}</td><td>${r.impact}</td><td>${r.urgency}</td><td>${escapeHtml(r.readinessLabel)}</td><td>${escapeHtml(fmtMoney(r.cost))}</td><td><b>${r.score}</b></td><td>${sc.selected.includes(r) ? 'ضمن السقف' : 'مؤجلة'}</td></tr>`).join('')}</tbody></table>` }]
    });
  });
  rowsHost.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#/initiatives/"]'); if (a) { e.preventDefault(); navigate(a.getAttribute('href').slice(2)); } });
}

// رسم SVG: المحور الأفقي التكلفة (لوغاريتمي)، الرأسي الأثر، حجم الدائرة الجاهزية، اللون الدرجة
function scatter(ranked) {
  if (!ranked.length) return '<p class="mi-chart-empty">لا مبادرات نشطة</p>';
  const W = 720; const H = 320; const pad = { l: 40, r: 20, t: 20, b: 40 };
  const costs = ranked.map((r) => Math.max(r.cost, 100_000));
  const minC = Math.log10(Math.min(...costs)); const maxC = Math.log10(Math.max(...costs, 200_000));
  const x = (c) => pad.l + ((Math.log10(Math.max(c, 100_000)) - minC) / Math.max(0.0001, maxC - minC)) * (W - pad.l - pad.r);
  const y = (impact) => H - pad.b - ((impact - 1) / 4) * (H - pad.t - pad.b);
  const color = (s) => s >= 70 ? '#0E5A44' : s >= 50 ? '#C9A227' : '#B8B29A';
  const pts = ranked.map((r) => `<g><circle cx="${x(r.cost).toFixed(1)}" cy="${y(r.impact).toFixed(1)}" r="${6 + r.readiness * 3}" fill="${color(r.score)}" fill-opacity="0.75" stroke="#fff" stroke-width="1.5"><title>${escapeHtml(r.initiative.title)} — الدرجة ${r.score} • التكلفة ${escapeHtml(fmtMoney(r.cost))}</title></circle></g>`).join('');
  const ticks = [1e6, 5e6, 2e7].filter((t) => Math.log10(t) >= minC - 0.2 && Math.log10(t) <= maxC + 0.2).map((t) => `<line x1="${x(t).toFixed(1)}" y1="${pad.t}" x2="${x(t).toFixed(1)}" y2="${H - pad.b}" stroke="#E0E6E2" stroke-dasharray="3 3"/><text x="${x(t).toFixed(1)}" y="${H - 12}" text-anchor="middle" class="mi-chart-lbl">${escapeHtml(fmtMoney(t))}</text>`).join('');
  return `<svg class="mi-chart mi-scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="مصفوفة الأثر والتكلفة">
    <rect x="${pad.l}" y="${pad.t}" width="${(W - pad.l - pad.r) / 2}" height="${(H - pad.t - pad.b) / 2}" fill="#D8EEDF" fill-opacity="0.45"/>
    <text x="${pad.l + 8}" y="${pad.t + 16}" class="mi-chart-lbl" fill="#0E5A44">أثر عالٍ وتكلفة منخفضة — ابدأ هنا</text>
    ${ticks}
    <line x1="${pad.l}" y1="${H - pad.b}" x2="${W - pad.r}" y2="${H - pad.b}" stroke="#A9B1AD"/>
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}" stroke="#A9B1AD"/>
    <text x="${W / 2}" y="${H - 2}" text-anchor="middle" class="mi-chart-lbl">التكلفة التقديرية ←</text>
    <text x="12" y="${H / 2}" text-anchor="middle" transform="rotate(-90 12 ${H / 2})" class="mi-chart-lbl">الأثر ↑</text>
    ${pts}
  </svg>`;
}
