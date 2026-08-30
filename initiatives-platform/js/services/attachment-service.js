// المرفقات — تخزين الملفات الصغيرة داخل IndexedDB كـ Base64 مع حدود حجم صريحة
import { repos } from '../data/repositories.js';
import { uid } from '../core/utils.js';
import { nowIso } from '../core/date-time.js';

export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024; // 2MB لكل ملف
export const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'application/pdf',
  'text/plain', 'text/csv'
];

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('تعذرت قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

export async function addAttachment(initiativeId, file, note = '') {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`حجم الملف يتجاوز الحد (2 ميجابايت): ${file.name}`);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`نوع الملف غير مسموح: ${file.type || 'غير معروف'}`);
  }
  const dataUrl = await fileToDataUrl(file);
  return repos.attachments.create({
    id: uid('att'),
    initiativeId,
    name: file.name,
    type: file.type,
    size: file.size,
    note,
    dataUrl,
    uploadedAt: nowIso()
  });
}

export async function attachmentsFor(initiativeId) {
  return repos.attachments.byInitiative(initiativeId);
}

export function downloadAttachment(att) {
  const a = document.createElement('a');
  a.href = att.dataUrl;
  a.download = att.name;
  a.click();
}

export async function removeAttachment(id) {
  return repos.attachments.remove(id);
}
