// مكوّنات عرض مشتركة — كلها تُرجع HTML معقّمًا عبر قالب html``
import { html, raw, escapeHtml } from '../core/sanitizer.js';
import { statusLabel, statusColor } from '../domain/workflow.js';
import { fmtMoney, fmtNumber } from '../core/utils.js';
import { gateTrack } from '../domain/stage-gates.js';

export function statusBadge(status) {
  return html`<span class="mi-status-badge" data-tone="${statusColor(status)}">${statusLabel(status)}</span>`;
}

export function healthBadge(health) {
  if (!health) return '';
  return html`<span class="mi-health" data-health="${health.id}" title="${health.reasons.join(' • ')}">${health.label}</span>`;
}

export function kpiCard(title, value, sub = '', tone = '') {
  return html`
    <div class="mi-kpi" data-tone="${tone}">
      <div class="mi-kpi__value">${value}</div>
      <div class="mi-kpi__title">${title}</div>
      ${sub ? raw(`<div class="mi-kpi__sub">${escapeHtml(sub)}</div>`) : ''}
    </div>`;
}

export function moneyText(n) { return fmtMoney(n); }
export function numText(n) { return fmtNumber(n); }

// العنصر المميز للمنصة: مسار البوابات بأقواس معمارية
export function gateTrackHtml(status, { compact = false } = {}) {
  const gates = gateTrack(status);
  const items = gates.map((g) => html`
    <li class="mi-gate" data-state="${g.state}" title="${g.name} — ${g.desc}">
      <span class="mi-gate__arch" aria-hidden="true"></span>
      <span class="mi-gate__id">${g.id}</span>
      ${compact ? '' : raw(`<span class="mi-gate__name">${escapeHtml(g.name.replace('بوابة ', ''))}</span>`)}
    </li>`).join('');
  return html`<ol class="mi-gate-track${compact ? ' mi-gate-track--compact' : ''}" aria-label="مسار البوابات المرحلية">${raw(items)}</ol>`;
}

// شارة SLA: أيام في المرحلة مقابل الحد — sla من domain/sla.js (null إذا لا مؤقت)
export function slaChip(sla, { compact = false } = {}) {
  if (!sla) return '';
  const text = sla.level === 'overdue'
    ? `متجاوز بـ ${fmtNumber(sla.overdueDays)} يومًا`
    : sla.level === 'warn' ? `متبقٍ ${fmtNumber(sla.remaining)} يومًا` : `${fmtNumber(sla.days)} / ${fmtNumber(sla.limit)} يومًا`;
  return html`<span class="mi-sla" data-level="${sla.level}" title="في المرحلة منذ ${fmtNumber(sla.days)} يومًا — الحد ${fmtNumber(sla.limit)} يومًا">${compact ? '' : raw('<i aria-hidden="true">⏱</i> ')}${text}</span>`;
}

// نجوم تقييم الشريك المحسوب
export function ratingStarsHtml(rating, { label = '' } = {}) {
  if (!rating) return html`<span class="mi-stars mi-stars--none" title="${label || 'لا سجل تنفيذي بعد'}">جديد</span>`;
  return html`<span class="mi-stars" title="${label}" aria-label="تقييم ${String(rating)} من 5">${'★'.repeat(rating)}<i>${'★'.repeat(5 - rating)}</i></span>`;
}

export function progressBar(percentValue, label = '') {
  const p = Math.max(0, Math.min(100, Number(percentValue) || 0));
  return html`
    <div class="mi-progress" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="${label || 'نسبة الإنجاز'}">
      <div class="mi-progress__fill" style="width:${p}%"></div>
      <span class="mi-progress__text">${fmtNumber(p)}٪</span>
    </div>`;
}

export function emptyState(title, hint = '', actionHtml = '') {
  return html`
    <div class="mi-empty">
      <div class="mi-empty__mark" aria-hidden="true">◈</div>
      <h3>${title}</h3>
      ${hint ? raw(`<p>${escapeHtml(hint)}</p>`) : ''}
      ${actionHtml ? raw(actionHtml) : ''}
    </div>`;
}

export function sectionHeader(title, subtitle = '', actionsHtml = '') {
  return html`
    <header class="mi-section-head">
      <div>
        <h2>${title}</h2>
        ${subtitle ? raw(`<p class="mi-section-head__sub">${escapeHtml(subtitle)}</p>`) : ''}
      </div>
      ${actionsHtml ? raw(`<div class="mi-section-head__actions">${actionsHtml}</div>`) : ''}
    </header>`;
}

export function definitionList(pairs) {
  const rows = pairs.map(([k, v]) => html`<div class="mi-dl__row"><dt>${k}</dt><dd>${raw(typeof v === 'string' ? escapeHtml(v || '—') : String(v ?? '—'))}</dd></div>`).join('');
  return html`<dl class="mi-dl">${raw(rows)}</dl>`;
}
