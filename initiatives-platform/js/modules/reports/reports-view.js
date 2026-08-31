// التقارير — تقارير محفظة جاهزة للطباعة والتصدير
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader } from '../../ui/components.js';
import { statusLabel, statusOrder, isActive } from '../../domain/workflow.js';
import { categoryLabel } from '../../domain/initiative-model.js';
import { weightedScore, scoreBand } from '../../domain/scoring.js';
import { realizationPercent, benefitStatus } from '../../domain/benefits.js';
import { exposure, exposureLevel } from '../../domain/risks.js';
import { partnerTypeLabel } from '../../domain/partner-model.js';
import { fmtMoney, fmtNumber, sum, sortBy, groupBy } from '../../core/utils.js';
import { fmtDate } from '../../core/date-time.js';
import { openPrintReport } from '../../services/print-service.js';
import { toHtmlTable, downloadCsv } from '../../services/export-service.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { toastSuccess } from '../../ui/toast.js';

export async function renderReports(container) {
  const role = getRole();
  const REPORTS = [
    { id: 'portfolio', title: 'تقرير المحفظة الشامل', desc: 'كل المبادرات بحالاتها ودرجاتها وميزانياتها' },
    { id: 'gates', title: 'تقرير الحوكمة والقرارات', desc: 'القرارات الصادرة عند كل بوابة بمسوغاتها' },
    { id: 'benefits', title: 'تقرير تحقق المنافع', desc: 'المستهدف مقابل المتحقق لكل منفعة' },
    { id: 'risks', title: 'تقرير المخاطر', desc: 'المخاطر مرتبة بالتعرض مع خطط الاستجابة' },
    { id: 'partners', title: 'تقرير الشركاء', desc: 'مساهمات الشركاء وأدوارهم عبر المبادرات' }
  ];

  container.innerHTML = html`
    ${raw(sectionHeader('التقارير', 'تقارير جاهزة للطباعة A4 أو التصدير CSV'))}
    <div class="mi-report-grid">
      ${raw(REPORTS.map((r) => html`
        <section class="mi-card mi-report-card">
          <h3>${r.title}</h3>
          <p class="mi-muted">${r.desc}</p>
          <div class="mi-report-card__actions">
            <button class="mi-btn mi-btn--primary" data-print="${r.id}">طباعة</button>
            ${can(role, 'reports.export') ? raw(`<button class="mi-btn mi-btn--ghost" data-csv="${r.id}">CSV</button>`) : ''}
          </div>
        </section>`).join(''))}
    </div>`;

  container.querySelectorAll('[data-print]').forEach((btn) =>
    btn.addEventListener('click', () => buildReport(btn.dataset.print, 'print')));
  container.querySelectorAll('[data-csv]').forEach((btn) =>
    btn.addEventListener('click', () => buildReport(btn.dataset.csv, 'csv')));

  async function buildReport(id, mode) {
    const [initiatives, decisions, benefits, risks, partners, links] = await Promise.all([
      repos.initiatives.getAll(), repos.decisions.getAll(), repos.benefits.getAll(),
      repos.risks.getAll(), repos.partners.getAll(), repos.initiativePartners.getAll()
    ]);
    const titleOf = (iid) => initiatives.find((i) => i.id === iid)?.title || iid;

    if (id === 'portfolio') {
      const rows = sortBy(initiatives, (i) => statusOrder(i.status));
      const cols = [
        { key: 'id', label: 'المعرف' }, { key: 'title', label: 'المبادرة' },
        { key: 'category', label: 'التصنيف', map: (r) => categoryLabel(r.category) },
        { key: 'district', label: 'الحي' },
        { key: 'status', label: 'الحالة', map: (r) => statusLabel(r.status) },
        { key: 'score', label: 'المفاضلة', map: (r) => { const s = weightedScore(r.scores); return s === null ? '—' : `${s} (${scoreBand(s).label})`; } },
        { key: 'budget', label: 'الميزانية', map: (r) => fmtMoney(r.budget) },
        { key: 'spent', label: 'المنصرف', map: (r) => fmtMoney(r.spent) }
      ];
      if (mode === 'csv') { downloadCsv(rows, cols, 'portfolio-report.csv'); toastSuccess('صُدّر التقرير'); return; }
      const active = initiatives.filter((i) => isActive(i.status) && i.status !== 'draft');
      openPrintReport({
        title: 'تقرير المحفظة الشامل',
        subtitle: 'الصورة الكاملة لمحفظة مبادرات البنية التحتية والشراكات المجتمعية',
        kpis: [
          { label: 'إجمالي المبادرات', value: fmtNumber(initiatives.length) },
          { label: 'نشطة عبر البوابات', value: fmtNumber(active.length) },
          { label: 'قيد التنفيذ', value: fmtNumber(initiatives.filter((i) => i.status === 'execution').length) },
          { label: 'مغلقة', value: fmtNumber(initiatives.filter((i) => i.status === 'closed').length) },
          { label: 'قيمة المحفظة', value: fmtMoney(sum(initiatives.filter((i) => i.status !== 'rejected'), (i) => i.budget)) }
        ],
        generatedAt: new Date().toISOString(),
        sections: [
          { heading: 'سجل المبادرات', html: toHtmlTable(rows, cols) },
          {
            heading: 'التوزيع حسب الحالة', html: toHtmlTable(
              Object.entries(groupBy(initiatives, (i) => i.status)).map(([s, list]) => ({ status: statusLabel(s), count: list.length, budget: fmtMoney(sum(list, (i) => i.budget)) })),
              [{ key: 'status', label: 'الحالة' }, { key: 'count', label: 'العدد' }, { key: 'budget', label: 'القيمة' }])
          }
        ]
      });
    }

    if (id === 'gates') {
      const rows = sortBy(decisions, (d) => d.at, 'desc');
      const cols = [
        { key: 'id', label: 'رقم القرار' },
        { key: 'at', label: 'التاريخ', map: (r) => fmtDate(r.at) },
        { key: 'initiativeId', label: 'المبادرة', map: (r) => titleOf(r.initiativeId) },
        { key: 'gateId', label: 'البوابة' },
        { key: 'outcome', label: 'النتيجة', map: (r) => ({ pass: 'اجتياز', reject: 'اعتذار', hold: 'تعليق' })[r.outcome] || r.outcome },
        { key: 'rationale', label: 'المسوغات' }
      ];
      if (mode === 'csv') { downloadCsv(rows, cols, 'governance-report.csv'); toastSuccess('صُدّر التقرير'); return; }
      openPrintReport({
        title: 'تقرير الحوكمة والقرارات',
        subtitle: 'القرارات الرسمية الصادرة عند البوابات المرحلية بمسوغاتها',
        kpis: [
          { label: 'إجمالي القرارات', value: fmtNumber(rows.length) },
          { label: 'اجتياز', value: fmtNumber(rows.filter((d) => d.outcome === 'pass').length) },
          { label: 'اعتذار', value: fmtNumber(rows.filter((d) => d.outcome === 'reject').length) },
          { label: 'تعليق', value: fmtNumber(rows.filter((d) => d.outcome === 'hold').length) }
        ],
        generatedAt: new Date().toISOString(),
        sections: [{ heading: 'سجل القرارات', html: toHtmlTable(rows, cols) }]
      });
    }

    if (id === 'benefits') {
      const cols = [
        { key: 'title', label: 'المنفعة' },
        { key: 'initiativeId', label: 'المبادرة', map: (r) => titleOf(r.initiativeId) },
        { key: 'target', label: 'المستهدف', map: (b) => `${fmtNumber(b.target)} ${b.unit}` },
        { key: 'actual', label: 'المتحقق', map: (b) => b.actual === null || b.actual === undefined ? 'لم يُقس' : `${fmtNumber(b.actual)} ${b.unit}` },
        { key: 'p', label: 'نسبة التحقق', map: (b) => { const p = realizationPercent(b); return p === null ? '—' : `${p}٪`; } },
        { key: 'st', label: 'الحالة', map: (b) => benefitStatus(b).label }
      ];
      if (mode === 'csv') { downloadCsv(benefits, cols, 'benefits-report.csv'); toastSuccess('صُدّر التقرير'); return; }
      const measured = benefits.filter((b) => realizationPercent(b) !== null);
      const achieved = measured.filter((b) => realizationPercent(b) >= 100);
      const avg = measured.length
        ? Math.round(measured.reduce((a, b) => a + Math.min(realizationPercent(b), 100), 0) / measured.length)
        : null;
      openPrintReport({
        title: 'تقرير تحقق المنافع',
        subtitle: 'المستهدف مقابل المتحقق — جوهر مساءلة الشراكات المجتمعية',
        kpis: [
          { label: 'منافع مستهدفة', value: fmtNumber(benefits.length) },
          { label: 'جرى قياسها', value: fmtNumber(measured.length) },
          { label: 'متحققة بالكامل', value: fmtNumber(achieved.length) },
          { label: 'متوسط التحقق', value: avg === null ? '—' : `${fmtNumber(avg)}٪` }
        ],
        generatedAt: new Date().toISOString(),
        sections: [{ heading: 'المنافع', html: toHtmlTable(benefits, cols) }]
      });
    }

    if (id === 'risks') {
      const rows = sortBy(risks, (r) => exposure(r), 'desc');
      const cols = [
        { key: 'title', label: 'الخطر' },
        { key: 'initiativeId', label: 'المبادرة', map: (r) => titleOf(r.initiativeId) },
        { key: 'exposure', label: 'التعرض', map: (r) => `${exposure(r)} — ${exposureLevel(r).label}` },
        { key: 'response', label: 'الاستجابة' },
        { key: 'status', label: 'الحالة', map: (r) => ({ open: 'مفتوح', mitigated: 'مُعالج', closed: 'مغلق' })[r.status] || r.status }
      ];
      if (mode === 'csv') { downloadCsv(rows, cols, 'risks-report.csv'); toastSuccess('صُدّر التقرير'); return; }
      const open = rows.filter((r) => r.status === 'open');
      openPrintReport({
        title: 'تقرير المخاطر',
        subtitle: 'سجل المخاطر مرتبًا بالتعرض (الاحتمالية × الأثر) مع خطط الاستجابة',
        kpis: [
          { label: 'إجمالي المخاطر', value: fmtNumber(rows.length) },
          { label: 'مفتوحة', value: fmtNumber(open.length) },
          { label: 'حرجة/مرتفعة مفتوحة', value: fmtNumber(open.filter((r) => exposure(r) >= 8).length) },
          { label: 'مُعالجة', value: fmtNumber(rows.filter((r) => r.status === 'mitigated').length) }
        ],
        generatedAt: new Date().toISOString(),
        sections: [{ heading: 'سجل المخاطر', html: toHtmlTable(rows, cols) }]
      });
    }

    if (id === 'partners') {
      const rows = partners.map((p) => {
        const pLinks = links.filter((l) => l.partnerId === p.id);
        const value = sum(pLinks.map((l) => initiatives.find((i) => i.id === l.initiativeId)).filter(Boolean), (i) => i.budget);
        return { ...p, initiativesCount: pLinks.length, totalValue: value };
      });
      const cols = [
        { key: 'name', label: 'الجهة' },
        { key: 'type', label: 'النوع', map: (r) => partnerTypeLabel(r.type) },
        { key: 'initiativesCount', label: 'المبادرات' },
        { key: 'totalValue', label: 'قيمة المبادرات', map: (r) => fmtMoney(r.totalValue) },
        { key: 'rating', label: 'التقييم', map: (r) => r.rating ? `${r.rating}/5` : 'جديد' }
      ];
      if (mode === 'csv') { downloadCsv(rows, cols, 'partners-report.csv'); toastSuccess('صُدّر التقرير'); return; }
      openPrintReport({
        title: 'تقرير الشركاء',
        subtitle: 'مساهمات جهات القطاع الخاص وغير الربحي والمجتمع عبر المبادرات',
        kpis: [
          { label: 'جهات شريكة', value: fmtNumber(partners.length) },
          { label: 'فاعلة', value: fmtNumber(partners.filter((p) => p.active).length) },
          { label: 'روابط شراكة', value: fmtNumber(links.length) },
          { label: 'قيمة المبادرات المرتبطة', value: fmtMoney(sum(rows, (r) => r.totalValue)) }
        ],
        generatedAt: new Date().toISOString(),
        sections: [{ heading: 'سجل الشركاء', html: toHtmlTable(rows, cols) }]
      });
    }
  }
}
