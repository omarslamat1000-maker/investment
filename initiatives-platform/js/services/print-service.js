// خدمة الطباعة — تجهّز حمولة التقرير وتفتح print.html عبر sessionStorage ببادئة مستقلة
import { STORAGE_PREFIX } from '../core/constants.js';

const PAYLOAD_KEY = STORAGE_PREFIX + 'printPayload';

// payload: { title, subtitle, generatedAt, sections: [{heading, html}] }
export function openPrintReport(payload) {
  try {
    sessionStorage.setItem(PAYLOAD_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('تعذر تجهيز حمولة الطباعة', err);
    return;
  }
  window.open('./print.html', '_blank', 'noopener');
}

export function readPrintPayload() {
  try {
    const raw = sessionStorage.getItem(PAYLOAD_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
