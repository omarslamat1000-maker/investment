// التصدير — CSV (متوافق مع Excel بترميز UTF-8 BOM) وJSON
import { escapeHtml } from '../core/sanitizer.js';

function csvCell(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// rows: مصفوفة كائنات، columns: [{key, label, map?}]
export function toCsv(rows, columns) {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const lines = rows.map((r) =>
    columns.map((c) => csvCell(c.map ? c.map(r) : r[c.key])).join(','));
  return '﻿' + [header, ...lines].join('\r\n');
}

export function downloadText(content, fileName, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(rows, columns, fileName) {
  downloadText(toCsv(rows, columns), fileName, 'text/csv;charset=utf-8');
}

export function downloadJson(data, fileName) {
  downloadText(JSON.stringify(data, null, 2), fileName, 'application/json;charset=utf-8');
}

// جدول HTML بسيط للتضمين في تقرير الطباعة
export function toHtmlTable(rows, columns) {
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
  const body = rows.map((r) =>
    `<tr>${columns.map((c) => `<td>${escapeHtml(c.map ? c.map(r) : (r[c.key] ?? '—'))}</td>`).join('')}</tr>`
  ).join('');
  return `<table class="mi-print-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
