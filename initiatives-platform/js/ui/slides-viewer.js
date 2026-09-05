// عرض تقديمي آلي للجنة — شرائح HTML بملء الشاشة من بيانات المبادرات
// (شريحة غلاف، شريحة ملخص، ثم شريحة لكل مبادرة) بتنقل لوحة المفاتيح والطباعة
import { escapeHtml } from '../core/sanitizer.js';
import { statusLabel } from '../domain/workflow.js';
import { categoryLabel, costBandLabel, durationBandLabel, readinessLabel } from '../domain/initiative-model.js';
import { fmtDate, fmtHijri, nowIso } from '../core/date-time.js';
import { fmtNumber, fmtMoney } from '../core/utils.js';

const e = escapeHtml;

export function openCommitteeDeck(initiatives, { title = 'عرض لجنة المبادرات', subtitle = 'أمانة منطقة المدينة المنورة — منصة مبادرات البنية التحتية والشراكات المجتمعية' } = {}) {
  document.querySelector('.mi-deck')?.remove();
  const now = nowIso();
  const slides = [];
  slides.push(`
    <section class="mi-slide mi-slide--cover">
      <div class="mi-slide__arches" aria-hidden="true">${'<i></i>'.repeat(7)}</div>
      <p class="mi-slide__entity">أمانة منطقة المدينة المنورة</p>
      <h1>${e(title)}</h1>
      <p class="mi-slide__sub">${e(subtitle)}</p>
      <p class="mi-slide__date">${e(fmtHijri(now))} — ${e(fmtDate(now))}</p>
    </section>`);
  const byStatus = {};
  for (const i of initiatives) byStatus[i.status] = (byStatus[i.status] || 0) + 1;
  slides.push(`
    <section class="mi-slide">
      <h2>ملخص المحفظة المعروضة</h2>
      <div class="mi-slide__kpis">
        <div><b>${e(fmtNumber(initiatives.length))}</b><span>مبادرة</span></div>
        ${Object.entries(byStatus).map(([s, n]) => `<div><b>${e(fmtNumber(n))}</b><span>${e(statusLabel(s))}</span></div>`).join('')}
        <div><b>${e(fmtMoney(initiatives.reduce((a, i) => a + (Number(i.budget) || 0), 0)))}</b><span>ميزانيات مسجلة</span></div>
      </div>
      <ol class="mi-slide__list">${initiatives.map((i, idx) => `<li><b>${e(String(idx + 1))}.</b> ${e(i.title)} <small>— ${e(categoryLabel(i.category))}${i.costBand ? ' • ' + e(costBandLabel(i.costBand)) : ''}</small></li>`).join('')}</ol>
    </section>`);
  initiatives.forEach((i, idx) => {
    slides.push(`
      <section class="mi-slide mi-slide--initiative">
        <header class="mi-slide__head">
          <span class="mi-slide__num">${e(String(idx + 1))} / ${e(String(initiatives.length))}</span>
          <h2>${e(i.title)}</h2>
          <p class="mi-slide__meta">${e(i.id)} • ${e(categoryLabel(i.category))}${i.location ? ' • ' + e(i.location) : ''} • <span class="mi-rpt-chip" data-tone="primary">${e(statusLabel(i.status))}</span></p>
        </header>
        <div class="mi-slide__body">
          <div class="mi-slide__text">
            ${i.problem ? `<h4>المشكلة أو الاحتياج</h4><p>${e(i.problem)}</p>` : ''}
            <h4>الحل المقترح</h4><p>${e(i.summary)}</p>
            ${i.expectedImpact ? `<h4>الأثر المتوقع</h4><p>${e(i.expectedImpact)}</p>` : ''}
            <div class="mi-slide__facts">
              <span>التكلفة: <b>${e(i.budget ? fmtMoney(i.budget) : (i.costBand ? costBandLabel(i.costBand) : '—'))}</b></span>
              <span>المدة: <b>${e(i.durationBand ? durationBandLabel(i.durationBand) : '—')}</b></span>
              <span>الجاهزية: <b>${e(i.readinessLevel ? readinessLabel(i.readinessLevel) : '—')}</b></span>
              <span>الجهة: <b>${e(i.submitterEntity || '—')}</b></span>
            </div>
          </div>
          ${i.imageDataUrl ? `<figure class="mi-slide__figure"><img src="${e(i.imageDataUrl)}" alt=""></figure>` : ''}
        </div>
        <footer class="mi-slide__foot">القرار المطلوب من اللجنة: ${e(i.status === 'submitted' ? 'بدء المراجعة والفرز' : i.status === 'screening' ? 'اجتياز بوابة الفرز G0' : i.status === 'study' ? 'اجتياز بوابة الجدوى G1' : i.status === 'approval' ? 'الاعتماد وتوقيع الشراكة G2' : 'الاطلاع')}</footer>
      </section>`);
  });
  slides.push(`
    <section class="mi-slide mi-slide--cover">
      <div class="mi-slide__arches" aria-hidden="true">${'<i></i>'.repeat(7)}</div>
      <h1>شكرًا لكم</h1>
      <p class="mi-slide__sub">منصة مبادرات البنية التحتية والشراكات المجتمعية</p>
    </section>`);

  const deck = document.createElement('div');
  deck.className = 'mi-deck';
  deck.setAttribute('role', 'dialog');
  deck.setAttribute('aria-label', title);
  deck.innerHTML = `
    <div class="mi-deck__bar">
      <span class="mi-deck__counter" data-counter></span>
      <button class="mi-btn mi-btn--ghost mi-btn--sm" data-act="prev">◀ السابقة</button>
      <button class="mi-btn mi-btn--ghost mi-btn--sm" data-act="next">التالية ▶</button>
      <button class="mi-btn mi-btn--ghost mi-btn--sm" data-act="full">ملء الشاشة</button>
      <button class="mi-btn mi-btn--gold mi-btn--sm" data-act="print">🖨 طباعة / PDF</button>
      <button class="mi-btn mi-btn--ghost mi-btn--sm" data-act="close">إغلاق ✕</button>
    </div>
    <div class="mi-deck__stage">${slides.join('')}</div>`;
  document.body.appendChild(deck);
  const all = [...deck.querySelectorAll('.mi-slide')];
  let idx = 0;
  const show = (n) => {
    idx = Math.max(0, Math.min(all.length - 1, n));
    all.forEach((s, i) => { s.hidden = i !== idx; });
    deck.querySelector('[data-counter]').textContent = `${fmtNumber(idx + 1)} / ${fmtNumber(all.length)}`;
  };
  const close = () => { deck.remove(); document.removeEventListener('keydown', onKey); document.body.classList.remove('mi-deck-printing'); };
  const onKey = (ev) => {
    if (ev.key === 'Escape') close();
    else if (['ArrowLeft', 'PageDown', ' '].includes(ev.key)) show(idx + 1);
    else if (['ArrowRight', 'PageUp'].includes(ev.key)) show(idx - 1);
  };
  document.addEventListener('keydown', onKey);
  deck.querySelector('[data-act="prev"]').addEventListener('click', () => show(idx - 1));
  deck.querySelector('[data-act="next"]').addEventListener('click', () => show(idx + 1));
  deck.querySelector('[data-act="close"]').addEventListener('click', close);
  deck.querySelector('[data-act="full"]').addEventListener('click', () => { (deck.requestFullscreen ? deck.requestFullscreen() : Promise.resolve()).catch(() => {}); });
  deck.querySelector('[data-act="print"]').addEventListener('click', () => {
    document.body.classList.add('mi-deck-printing');
    all.forEach((s) => { s.hidden = false; });
    const cleanup = () => { document.body.classList.remove('mi-deck-printing'); show(idx); };
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => { window.print(); setTimeout(cleanup, 1000); }, 50);
  });
  show(0);
  return { close, show };
}
