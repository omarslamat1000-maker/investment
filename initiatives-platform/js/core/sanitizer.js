// تعقيم النصوص قبل إدراجها في DOM — الدفاع الأول ضد XSS
const ESCAPE_MAP = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

// يسمح فقط بنص عادي — يزيل أي وسوم
export function stripTags(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '');
}

// تعقيم قيمة لاستخدامها داخل خاصية HTML
export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

// تعقيم كائن كامل (سطحي) — يُستخدم قبل حفظ مدخلات النماذج
export function sanitizeRecord(record, textFields = []) {
  const out = { ...record };
  for (const f of textFields) {
    if (typeof out[f] === 'string') out[f] = stripTags(out[f]).trim();
  }
  return out;
}

// قالب آمن: html`...` يعقّم القيم المُدرجة تلقائيًا، وraw() للإدراج الموثوق
const RAW = Symbol('raw');
export function raw(str) {
  return { [RAW]: String(str) };
}
export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) {
      const v = values[i];
      if (v && typeof v === 'object' && RAW in v) out += v[RAW];
      else if (Array.isArray(v)) out += v.map((x) => (x && typeof x === 'object' && RAW in x) ? x[RAW] : escapeHtml(x)).join('');
      else out += escapeHtml(v);
    }
  });
  return out;
}
