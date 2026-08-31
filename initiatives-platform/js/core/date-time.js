// التاريخ والوقت — توقيت الرياض وتنسيقات عربية
const LOCALE = 'ar-SA-u-ca-gregory-nu-latn';
const TZ = 'Asia/Riyadh';

export function nowIso() {
  return new Date().toISOString();
}

export function todayYmd() {
  // YYYY-MM-DD بتوقيت الرياض
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  return parts;
}

export function fmtDate(iso, opts = {}) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric', ...opts
  }).format(d);
}

export function fmtDateTime(iso) {
  return fmtDate(iso, { hour: '2-digit', minute: '2-digit' });
}

export function fmtHijri(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
    timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric'
  }).format(d);
}

// عدد الأيام بين تاريخين (سالب إذا كان b قبل a)
export function daysBetween(aIso, bIso) {
  const a = new Date(aIso); const b = new Date(bIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function addDays(iso, days) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function isOverdue(dueIso, doneIso = null) {
  if (!dueIso || doneIso) return false;
  return new Date(dueIso).getTime() < Date.now();
}

export function currentYear() {
  return Number(new Intl.DateTimeFormat('en', { timeZone: TZ, year: 'numeric' }).format(new Date()));
}
