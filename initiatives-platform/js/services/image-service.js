// خدمة صور المبادرات — اختيار صورة وضغطها إلى Data URL مناسب للتخزين المحلي
export const IMAGE_MAX_DIMENSION = 1280;
export const IMAGE_MAX_SOURCE_BYTES = 8 * 1024 * 1024; // 8MB قبل الضغط
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// يفتح حوار اختيار ملف ويعيد Data URL مضغوطًا (JPEG) أو null عند الإلغاء
export function pickInitiativeImage() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = IMAGE_TYPES.join(',');
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) { resolve(null); return; }
      try { resolve(await compressImage(file)); }
      catch (err) { reject(err); }
    };
    // إغلاق الحوار بلا اختيار
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!IMAGE_TYPES.includes(file.type)) {
      reject(new Error('نوع الصورة غير مدعوم — استخدم PNG أو JPEG أو WebP'));
      return;
    }
    if (file.size > IMAGE_MAX_SOURCE_BYTES) {
      reject(new Error('حجم الصورة يتجاوز 8 ميجابايت'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذرت قراءة الصورة')); };
    img.src = url;
  });
}
