// البوابة العامة — محتوى index.html: الفرص المطروحة والإحصاءات والحملات
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { categoryLabel } from '../../domain/initiative-model.js';
import { PRIORITY_LABELS } from '../../domain/infrastructure-need-model.js';
import { modelLabel } from '../../domain/partner-model.js';
import { fmtMoney, fmtNumber, sum, sortBy, percent } from '../../core/utils.js';
import { isActive } from '../../domain/workflow.js';
import { benefitsSummary, realizationPercent } from '../../domain/benefits.js';
import { fmtDate } from '../../core/date-time.js';

export async function renderPortalStats(container) {
  const [initiatives, partners, benefits] = await Promise.all([
    repos.initiatives.getAll(), repos.partners.getAll(), repos.benefits.getAll()
  ]);
  const active = initiatives.filter((i) => isActive(i.status) && i.status !== 'draft');
  const value = sum(initiatives.filter((i) => !['rejected', 'draft'].includes(i.status)), (i) => i.budget);
  const beneficiaries = sum(initiatives.filter((i) => ['execution', 'benefits', 'closed'].includes(i.status)), (i) => i.beneficiaries);
  const ben = benefitsSummary(benefits);

  container.innerHTML = html`
    <div class="mi-hero-stat"><b>${fmtNumber(active.length)}</b><span>مبادرة نشطة</span></div>
    <div class="mi-hero-stat"><b>${fmtNumber(partners.filter((p) => p.active).length)}</b><span>جهة شريكة</span></div>
    <div class="mi-hero-stat"><b>${fmtMoney(value)}</b><span>قيمة الشراكات</span></div>
    <div class="mi-hero-stat"><b>${fmtNumber(beneficiaries)}</b><span>مستفيد من مبادرات منفَّذة</span></div>
    ${ben.avgRealization !== null ? raw(`<div class="mi-hero-stat"><b>${ben.avgRealization}٪</b><span>متوسط تحقق المنافع</span></div>`) : ''}`;
}

export async function renderPublishedNeeds(container, { limit = 6 } = {}) {
  const needs = await repos.needs.getAll();
  const published = needs.filter((n) => n.status === 'published').slice(0, limit);

  if (!published.length) {
    container.innerHTML = '<p class="mi-muted">لا فرص مطروحة حاليًا — تُنشر الاحتياجات الجديدة هنا فور اعتمادها.</p>';
    return;
  }

  container.innerHTML = published.map((n) => html`
    <article class="mi-opportunity-card">
      <div class="mi-opportunity-card__arch" aria-hidden="true"></div>
      <span class="mi-tag mi-tag--priority" data-priority="${n.priority}">${PRIORITY_LABELS[n.priority] || n.priority}</span>
      <h3>${n.title}</h3>
      <p class="mi-opportunity-card__meta">${categoryLabel(n.category)} • حي ${n.district}</p>
      <p class="mi-opportunity-card__desc">${n.description.length > 140 ? n.description.slice(0, 137) + '…' : n.description}</p>
      <div class="mi-opportunity-card__facts">
        <span>التكلفة التقديرية: <b>${fmtMoney(n.estimatedCost)}</b></span>
        <span>المستفيدون: <b>${fmtNumber(n.beneficiaries || 0)}</b></span>
      </div>
      <div class="mi-opportunity-card__models">${raw((n.preferredModels || []).map((m) => `<span class="mi-tag">${escapeHtml(modelLabel(m))}</span>`).join(' '))}</div>
      <a class="mi-btn mi-btn--primary" href="./opportunity.html?id=${encodeURIComponent(n.id)}">تفاصيل الفرصة والتقدم لتبنّيها</a>
    </article>`).join('');
}

// المبادرات الجاري العمل عليها — تُعرض للجمهور بشفافية مع نسبة إنجاز المعالم
export async function renderRunningInitiatives(container, { limit = 6 } = {}) {
  const [initiatives, milestones] = await Promise.all([
    repos.initiatives.getAll(), repos.milestones.getAll()
  ]);
  const running = sortBy(initiatives.filter((i) => ['execution', 'benefits'].includes(i.status)), (i) => i.updatedAt, 'desc').slice(0, limit);
  if (!running.length) {
    container.innerHTML = '<p class="mi-muted">لا مبادرات قيد التنفيذ حاليًا.</p>';
    return;
  }
  container.innerHTML = running.map((i) => {
    const ms = milestones.filter((m) => m.initiativeId === i.id);
    const done = ms.filter((m) => m.done).length;
    const p = ms.length ? percent(done, ms.length) : null;
    return html`
      <article class="mi-progress-card">
        ${i.imageDataUrl ? raw(`<img class="mi-progress-card__img" src="${i.imageDataUrl}" alt="">`) : raw('<div class="mi-progress-card__img mi-progress-card__img--empty" aria-hidden="true"><span class="mi-gate__arch"></span></div>')}
        <div class="mi-progress-card__body">
          <h3>${i.title}</h3>
          <p class="mi-opportunity-card__meta">${categoryLabel(i.category)} • حي ${i.district}</p>
          ${p !== null ? raw(`
            <div class="mi-progress" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="نسبة الإنجاز">
              <div class="mi-progress__fill" style="width:${p}%"></div>
              <span class="mi-progress__text">${escapeHtml(fmtNumber(p))}٪</span>
            </div>`) : raw(`<p class="mi-muted">${i.status === 'benefits' ? 'اكتمل التنفيذ — جارٍ قياس المنافع' : 'انطلقت الأعمال'}</p>`)}
        </div>
      </article>`;
  }).join('');
}

// المبادرات المنتهية — قصص نجاح بمنافع محققة معلنة
export async function renderCompletedInitiatives(container, { limit = 6 } = {}) {
  const [initiatives, benefits] = await Promise.all([
    repos.initiatives.getAll(), repos.benefits.getAll()
  ]);
  const closed = sortBy(initiatives.filter((i) => i.status === 'closed'), (i) => i.updatedAt, 'desc').slice(0, limit);
  if (!closed.length) {
    container.innerHTML = '<p class="mi-muted">ستُعرض هنا المبادرات المكتملة ومنافعها المتحققة.</p>';
    return;
  }
  container.innerHTML = closed.map((i) => {
    const myBenefits = benefits.filter((b) => b.initiativeId === i.id && realizationPercent(b) !== null);
    const closedAt = (i.statusHistory || []).find((h) => h.to === 'closed')?.at;
    return html`
      <article class="mi-progress-card mi-progress-card--done">
        ${i.imageDataUrl ? raw(`<img class="mi-progress-card__img" src="${i.imageDataUrl}" alt="">`) : raw('<div class="mi-progress-card__img mi-progress-card__img--empty mi-progress-card__img--gold" aria-hidden="true"><span class="mi-gate__arch"></span></div>')}
        <div class="mi-progress-card__body">
          <span class="mi-tag" data-benefit="achieved">منجزة${closedAt ? raw(` — ${escapeHtml(fmtDate(closedAt))}`) : ''}</span>
          <h3>${i.title}</h3>
          <p class="mi-opportunity-card__meta">${categoryLabel(i.category)} • حي ${i.district}</p>
          ${myBenefits.length ? raw(myBenefits.slice(0, 2).map((b) => `
            <p class="mi-done-benefit">✦ ${escapeHtml(b.title)}: <b>${escapeHtml(fmtNumber(Math.min(realizationPercent(b), 100)))}٪</b> من المستهدف</p>`).join('')) : ''}
        </div>
      </article>`;
  }).join('');
}

export async function renderCampaigns(container) {
  const campaigns = await repos.campaigns.getAll();
  const activeCampaigns = campaigns.filter((c) => c.status === 'active');
  if (!activeCampaigns.length) { container.closest('section')?.setAttribute('hidden', ''); return; }
  container.innerHTML = activeCampaigns.map((c) => html`
    <article class="mi-campaign">
      <h3>${c.title}</h3>
      <p>${c.summary}</p>
      <small class="mi-muted">تستهدف ${fmtNumber(c.targetInitiatives)} مبادرة — تصنيفات: ${raw((c.categoryFocus || []).map((k) => escapeHtml(categoryLabel(k))).join('، '))}</small>
    </article>`).join('');
}
