// رسوم بيانية SVG خفيفة بلا مكتبات — أعمدة، دائري مجوّف، شرائط أفقية
import { escapeHtml } from '../core/sanitizer.js';
import { fmtNumber } from '../core/utils.js';

const PALETTE = ['#0E5A44', '#C9A227', '#2C7A63', '#8A6D1F', '#4E8F7B', '#B8B29A', '#1E3B33', '#D9C476'];

export function colorAt(i) { return PALETTE[i % PALETTE.length]; }

// أعمدة رأسية: data = [{label, value}]
export function barChart(data, { height = 220, valueSuffix = '' } = {}) {
  if (!data.length) return '<p class="mi-chart-empty">لا توجد بيانات</p>';
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 100 / data.length;
  const bars = data.map((d, i) => {
    const h = (d.value / max) * 78;
    const x = i * barW + barW * 0.18;
    const w = barW * 0.64;
    return `
      <rect x="${x}%" y="${92 - h}%" width="${w}%" height="${h}%" rx="3" fill="${colorAt(i)}">
        <title>${escapeHtml(d.label)}: ${fmtNumber(d.value)}${valueSuffix}</title>
      </rect>
      <text x="${i * barW + barW / 2}%" y="${88 - h}%" text-anchor="middle" class="mi-chart-val">${fmtNumber(d.value)}</text>
      <text x="${i * barW + barW / 2}%" y="98%" text-anchor="middle" class="mi-chart-lbl">${escapeHtml(short(d.label))}</text>`;
  }).join('');
  return `<svg class="mi-chart" viewBox="0 0 400 ${height}" preserveAspectRatio="none" role="img" aria-label="رسم أعمدة">${bars}</svg>`;
}

// دائري مجوّف: data = [{label, value}]
export function donutChart(data, { size = 180, centerLabel = '' } = {}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return '<p class="mi-chart-empty">لا توجد بيانات</p>';
  const r = 70; const c = 2 * Math.PI * r;
  let offset = 0;
  const segs = data.map((d, i) => {
    const frac = d.value / total;
    const dash = frac * c;
    const seg = `<circle r="${r}" cx="100" cy="100" fill="none" stroke="${colorAt(i)}" stroke-width="34"
      stroke-dasharray="${dash} ${c - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)">
      <title>${escapeHtml(d.label)}: ${fmtNumber(d.value)} (${Math.round(frac * 100)}٪)</title></circle>`;
    offset += dash;
    return seg;
  }).join('');
  const legend = data.map((d, i) =>
    `<li><span class="mi-legend-dot" style="background:${colorAt(i)}"></span>${escapeHtml(d.label)} <b>${fmtNumber(d.value)}</b></li>`).join('');
  return `
    <div class="mi-donut-wrap">
      <svg class="mi-chart mi-chart--donut" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="رسم دائري">
        ${segs}
        <text x="100" y="96" text-anchor="middle" class="mi-donut-total">${fmtNumber(total)}</text>
        <text x="100" y="116" text-anchor="middle" class="mi-donut-caption">${escapeHtml(centerLabel)}</text>
      </svg>
      <ul class="mi-legend">${legend}</ul>
    </div>`;
}

// شرائط أفقية: data = [{label, value, max?}]
export function hbarChart(data, { valueSuffix = '' } = {}) {
  if (!data.length) return '<p class="mi-chart-empty">لا توجد بيانات</p>';
  const max = Math.max(...data.map((d) => d.max ?? d.value), 1);
  const rows = data.map((d, i) => {
    const p = Math.min(100, (d.value / max) * 100);
    return `
      <div class="mi-hbar">
        <span class="mi-hbar__label">${escapeHtml(d.label)}</span>
        <span class="mi-hbar__track"><span class="mi-hbar__fill" style="width:${p}%;background:${colorAt(i)}"></span></span>
        <span class="mi-hbar__val">${fmtNumber(d.value)}${valueSuffix}</span>
      </div>`;
  }).join('');
  return `<div class="mi-hbars">${rows}</div>`;
}

function short(label) {
  return label.length > 14 ? label.slice(0, 13) + '…' : label;
}
