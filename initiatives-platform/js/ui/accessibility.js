// إتاحة الوصول — رابط تخطٍّ، إدارة تركيز عند تغيّر المسار، إعلانات لقارئ الشاشة
let liveRegion = null;

export function initAccessibility() {
  // منطقة إعلانات حية واحدة للصفحة
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.className = 'mi-visually-hidden';
    liveRegion.setAttribute('aria-live', 'polite');
    document.body.appendChild(liveRegion);
  }
}

export function announce(message) {
  if (!liveRegion) initAccessibility();
  liveRegion.textContent = '';
  // فاصل زمني بسيط ليُلتقط النص الجديد
  setTimeout(() => { liveRegion.textContent = message; }, 30);
}

// عند تغيّر المسار: انقل التركيز لعنوان المحتوى وأعلن اسم الصفحة
export function focusMain(title = '') {
  const main = document.querySelector('main, [role="main"]');
  if (main) {
    main.setAttribute('tabindex', '-1');
    main.focus({ preventScroll: false });
  }
  if (title) announce(`انتقلت إلى ${title}`);
}

// احترام تفضيل تقليل الحركة
export function prefersReducedMotion() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
