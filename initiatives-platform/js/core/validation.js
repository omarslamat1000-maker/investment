// قواعد التحقق من صحة المدخلات — رسائل عربية واضحة قابلة للعرض بجوار الحقول
export function required(value, label) {
  const v = typeof value === 'string' ? value.trim() : value;
  if (v === undefined || v === null || v === '') return `${label} حقل إلزامي`;
  return null;
}

export function minLength(value, len, label) {
  if (typeof value === 'string' && value.trim().length < len) {
    return `${label} يجب ألا يقل عن ${len} حرفًا`;
  }
  return null;
}

export function maxLength(value, len, label) {
  if (typeof value === 'string' && value.trim().length > len) {
    return `${label} يجب ألا يتجاوز ${len} حرفًا`;
  }
  return null;
}

export function isPositiveNumber(value, label) {
  const n = Number(value);
  if (value === '' || value === null || value === undefined) return null;
  if (Number.isNaN(n) || n < 0) return `${label} يجب أن يكون رقمًا موجبًا`;
  return null;
}

export function isEmail(value, label = 'البريد الإلكتروني') {
  if (!value) return null;
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
  return ok ? null : `${label} غير صالح`;
}

export function isSaudiPhone(value, label = 'رقم الجوال') {
  if (!value) return null;
  const clean = String(value).replace(/[\s-]/g, '');
  const ok = /^(\+9665|05)\d{8}$/.test(clean);
  return ok ? null : `${label} غير صالح — مثال: 05xxxxxxxx`;
}

export function isDateYmd(value, label = 'التاريخ') {
  if (!value) return null;
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
  return ok ? null : `${label} غير صالح`;
}

export function oneOf(value, allowed, label) {
  if (!value) return null;
  return allowed.includes(value) ? null : `${label} خارج القيم المسموحة`;
}

// تشغيل مجموعة قواعد على كائن: rules = { field: [fn, fn...] } حيث fn(value) => رسالة أو null
export function validate(record, rules) {
  const errors = {};
  for (const [field, fns] of Object.entries(rules)) {
    for (const fn of fns) {
      const msg = fn(record[field]);
      if (msg) { errors[field] = msg; break; }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
