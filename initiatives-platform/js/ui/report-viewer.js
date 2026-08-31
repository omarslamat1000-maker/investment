// عارض التقارير الداخلي — يعرض التقرير الفاخر داخل المنصة نفسها ويطبعه مباشرة
// بلا نوافذ منبثقة (window.open) التي تحجبها المتصفحات، مع تنزيل ملف مستقل
import { escapeHtml } from '../core/sanitizer.js';
import { fmtDateTime, fmtHijri, todayYmd } from '../core/date-time.js';

// payload: { title, subtitle, kpis: [{label, value}], sections: [{heading, html}], generatedAt }
export function openReportViewer(payload) {
  // أغلق أي عارض سابق
  document.querySelector('.mi-report-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'mi-report-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', payload.title);

  const arches = '<div class="mi-print-arches" aria-hidden="true">' + '<i></i>'.repeat(7) + '</div>';
  const kpis = (payload.kpis || []).length
    ? `<div class="mi-print-kpis">${payload.kpis.map((k) =>
      `<div class="mi-print-kpi"><b>${escapeHtml(k.value)}</b><span>${escapeHtml(k.label)}</span></div>`).join('')}</div>`
    : '';

  const reportHtml = `
    ${arches}
    <header class="mi-print-head">
      <p class="mi-print-entity-name">أمانة منطقة المدينة المنورة</p>
      <p class="mi-print-entity-sub">منصة مبادرات البنية التحتية والشراكات المجتمعية</p>
      <h1>${escapeHtml(payload.title)}</h1>
      ${payload.subtitle ? `<p class="mi-print-sub">${escapeHtml(payload.subtitle)}</p>` : ''}
    </header>
    ${kpis}
    ${(payload.sections || []).map((s) => `
      <section class="mi-print-section">
        <h2>${escapeHtml(s.heading)}</h2>
        ${s.html}
      </section>`).join('')}
    <footer class="mi-print-foot">
      <span>أُنشئ في: ${escapeHtml(fmtDateTime(payload.generatedAt))} — ${escapeHtml(fmtHijri(payload.generatedAt))}</span>
      <span>وثيقة آلية من منصة المبادرات — نسخة عرض ببيانات توضيحية</span>
    </footer>`;

  overlay.innerHTML = `
    <div class="mi-print-toolbar">
      <button class="mi-btn mi-btn--primary" data-act="print">🖨 طباعة / حفظ PDF</button>
      <button class="mi-btn mi-btn--gold" data-act="download">تنزيل التقرير (ملف مستقل)</button>
      <button class="mi-btn mi-btn--ghost" data-act="close">إغلاق ✕</button>
    </div>
    <div class="mi-print-page">${reportHtml}</div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('[data-act="print"]').focus();

  const close = () => {
    overlay.remove();
    document.body.classList.remove('mi-report-printing');
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('[data-act="close"]').addEventListener('click', close);

  // الطباعة: تُخفى واجهة المنصة كاملة ويُطبع التقرير وحده (قواعد @media print في print.css)
  overlay.querySelector('[data-act="print"]').addEventListener('click', () => {
    document.body.classList.add('mi-report-printing');
    const cleanup = () => document.body.classList.remove('mi-report-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    // مهلة احتياطية إن لم يُطلق المتصفح afterprint
    setTimeout(() => { window.print(); setTimeout(cleanup, 1000); }, 50);
  });

  // التنزيل: ملف HTML مستقل مضمّن الأنماط يعمل خارج المنصة
  overlay.querySelector('[data-act="download"]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'جارٍ التجهيز…';
    try {
      const cssTexts = await Promise.all(
        ['./css/tokens.css', './css/base.css', './css/components.css', './css/print.css']
          .map((href) => fetch(href).then((r) => r.text()))
      );
      const standalone = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(payload.title)} — أمانة منطقة المدينة المنورة</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Noto+Kufi+Arabic:wght@500;700&display=swap" rel="stylesheet">
<style>${cssTexts.join('\n')}\n.mi-print-toolbar{display:none}</style>
</head>
<body class="mi-print-body">
<div class="mi-print-page">${reportHtml}</div>
</body>
</html>`;
      const blob = new Blob(['﻿' + standalone], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `تقرير-${payload.title.replace(/[\\/:*?"<>|]/g, ' ').trim()}-${todayYmd()}.html`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('تعذر تجهيز ملف التنزيل', err);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  return { close };
}
