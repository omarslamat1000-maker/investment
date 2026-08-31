// أدوات مساعدة عامة — بلا اعتماد على DOM ليمكن اختبارها في Node
export function uid(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

// معرّف تسلسلي رسمي مثل MDN-INIT-2026-0001
export function officialId(prefix, year, seq) {
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function round(n, digits = 1) {
  const p = 10 ** digits;
  return Math.round((Number(n) || 0) * p) / p;
}

export function sum(arr, fn = (x) => x) {
  return (arr || []).reduce((acc, x) => acc + (Number(fn(x)) || 0), 0);
}

export function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr || []) {
    const k = keyFn(item);
    (out[k] = out[k] || []).push(item);
  }
  return out;
}

export function sortBy(arr, keyFn, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  return [...(arr || [])].sort((a, b) => {
    const ka = keyFn(a); const kb = keyFn(b);
    if (ka === kb) return 0;
    if (ka === null || ka === undefined) return 1;
    if (kb === null || kb === undefined) return -1;
    return ka > kb ? sign : -sign;
  });
}

export function unique(arr) {
  return [...new Set(arr || [])];
}

export function deepClone(obj) {
  return obj === undefined ? undefined : JSON.parse(JSON.stringify(obj));
}

export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in (obj || {})) out[k] = obj[k];
  return out;
}

export function percent(part, total) {
  if (!total) return 0;
  return round((part / total) * 100, 1);
}

// تنسيق الأرقام والعملة — نمط أرقام موحد (لاتيني 0-9) عبر كامل المنصة
// مطابق لأرقام التواريخ (nu-latn في date-time.js) والمعرفات الرسمية
export const NUMBER_LOCALE = 'ar-SA-u-nu-latn';

export function fmtNumber(n, locale = NUMBER_LOCALE) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(n) || 0);
}

export function fmtMoney(n, locale = NUMBER_LOCALE) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `${fmtNumber(round(v / 1_000_000, 2), locale)} مليون ريال`;
  if (Math.abs(v) >= 1_000) return `${fmtNumber(round(v / 1_000, 1), locale)} ألف ريال`;
  return `${fmtNumber(v, locale)} ريال`;
}

// مجموع تحقق بسيط (FNV-1a) للنسخ الاحتياطية
export function checksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function debounce(fn, ms = 250) {
  let t;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
