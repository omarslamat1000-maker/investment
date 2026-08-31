// المرفقات — محليًا داخل IndexedDB، وسحابيًا في Supabase Storage (خاص + روابط موقعة)
import { repos } from '../data/repositories.js';
import { uid } from '../core/utils.js';
import { nowIso } from '../core/date-time.js';
import { getSession } from '../core/state.js';

// ————— وضع السحابة: bucket خاص initiative-attachments بمسار organization_id/initiative_id/file —————
export const CLOUD_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const CLOUD_ALLOWED = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/jpeg': 'jpg',
  'image/png': 'png'
};
const BUCKET = 'initiative-attachments';

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files[0] || null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function uploadCloudAttachment(initiative) {
  const file = await pickFile('.pdf,.docx,.xlsx,.jpg,.jpeg,.png');
  if (!file) return null;
  if (!CLOUD_ALLOWED[file.type]) throw new Error('النوع غير مسموح — PDF, DOCX, XLSX, JPG, PNG فقط');
  if (file.size > CLOUD_MAX_BYTES) throw new Error('الحد الأقصى للمرفق 10 ميجابايت');

  const { getSupabase } = await import('../data/supabase-client.js');
  const { initiativeUuid } = await import('../data/cloud-provider.js');
  const client = await getSupabase();
  const session = getSession();
  const uuid = initiative._uuid || await initiativeUuid(initiative.id);
  const orgId = initiative.organizationId || session?.organizationId;
  if (!uuid || !orgId) throw new Error('تعذر تحديد مسار الجهة للمرفق');

  const safeName = file.name.replace(/[^\w.؀-ۿ-]+/g, '_');
  const path = `${orgId}/${uuid}/${Date.now()}-${safeName}`;

  const { error: upErr } = await client.storage.from(BUCKET).upload(path, file, {
    contentType: file.type, upsert: false
  });
  if (upErr) throw new Error(upErr.message);

  const { error: rowErr } = await client.from('attachments').insert({
    initiative_id: uuid, file_name: file.name, file_path: path,
    file_type: file.type, file_size: file.size, uploaded_by: session.userId
  });
  if (rowErr) throw new Error(rowErr.message);
  return { name: file.name, path };
}

export async function listCloudAttachments(initiativeId) {
  try {
    const { cloudProvider } = await import('../data/cloud-provider.js');
    return await cloudProvider.byIndex('attachments', 'initiativeId', initiativeId);
  } catch { return []; }
}

// فتح مرفق برابط موقّع مؤقت (ساعة واحدة)
export async function openCloudAttachment(attachmentId) {
  const { getSupabase } = await import('../data/supabase-client.js');
  const client = await getSupabase();
  const { data: row, error } = await client.from('attachments')
    .select('file_path').eq('id', attachmentId).single();
  if (error || !row) throw new Error('المرفق غير موجود أو لا صلاحية عليه');
  const { data, error: signErr } = await client.storage.from(BUCKET)
    .createSignedUrl(row.file_path, 3600);
  if (signErr || !data?.signedUrl) throw new Error('تعذر توليد رابط مؤقت للمرفق');
  window.open(data.signedUrl, '_blank', 'noopener');
}

export async function removeCloudAttachment(attachmentId) {
  const { getSupabase } = await import('../data/supabase-client.js');
  const client = await getSupabase();
  const { data: row } = await client.from('attachments')
    .select('file_path').eq('id', attachmentId).single();
  const { error } = await client.from('attachments').delete().eq('id', attachmentId);
  if (error) throw new Error(error.message);
  if (row?.file_path) await client.storage.from(BUCKET).remove([row.file_path]);
}

// ————— الوضع المحلي (كما كان) —————

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
