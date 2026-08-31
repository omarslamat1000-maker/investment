// المزوّد السحابي — نفس عقد مزوّد IndexedDB فوق Supabase:
// المبادرات وجداولها الرسمية علائقية، وبقية كيانات المنصة عبر المخزن العام app_store
// كل الصلاحيات مفروضة بسياسات RLS في القاعدة — الواجهة مجرد عرض
import { getSupabase } from './supabase-client.js';
import { CLOUD_TO_PLATFORM, cloudTargetFor, cloudPathTo } from './cloud-status-map.js';
import { getSession } from '../core/state.js';

const RELATIONAL = new Set(['initiatives', 'attachments', 'notifications', 'users', 'milestones', 'auditLogs']);
const numberToUuid = new Map(); // initiative_number → uuid

async function sb() { return getSupabase(); }

export async function initiativeUuid(numberOrUuid) {
  if (!numberOrUuid) return null;
  if (/^[0-9a-f-]{36}$/.test(numberOrUuid)) return numberOrUuid;
  if (numberToUuid.has(numberOrUuid)) return numberToUuid.get(numberOrUuid);
  const client = await sb();
  const { data } = await client.from('initiatives').select('id').eq('initiative_number', numberOrUuid).maybeSingle();
  if (data?.id) numberToUuid.set(numberOrUuid, data.id);
  return data?.id || null;
}

// ————— تحويل صف المبادرة ↔ سجل المنصة —————
function rowToInitiative(row) {
  const details = row.details || {};
  numberToUuid.set(row.initiative_number, row.id);
  return {
    ...details,
    id: row.initiative_number,
    _uuid: row.id,
    title: row.title,
    summary: row.summary || '',
    problem: row.problem || '',
    category: row.category || '',
    district: row.district || '',
    location: row.location || '',
    beneficiaryGroups: row.beneficiary_groups || '',
    beneficiaries: row.beneficiaries,
    expectedImpact: row.expected_impact || '',
    costBand: row.cost_band || '',
    durationBand: row.duration_band || '',
    readinessLevel: row.readiness_level || '',
    budget: row.budget === null ? null : Number(row.budget),
    spent: Number(row.spent) || 0,
    fundingModel: row.funding_model || '',
    startDate: row.start_date,
    endDate: row.end_date,
    status: details.platform_status || CLOUD_TO_PLATFORM[row.current_status] || 'draft',
    cloudStatus: row.current_status,
    currentStage: row.current_stage,
    progressPercentage: Number(row.progress_percentage) || 0,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    assignedSupervisorId: row.assigned_supervisor_id,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    statusHistory: details.statusHistory || []
  };
}

const INITIATIVE_COLUMNS = ['title', 'summary', 'problem', 'category', 'district', 'location',
  'beneficiaries', 'budget', 'spent', 'startDate', 'endDate'];
function initiativeToRow(record) {
  const row = {
    title: record.title,
    summary: record.summary || '',
    problem: record.problem || '',
    category: record.category || null,
    district: record.district || null,
    location: record.location || null,
    beneficiary_groups: record.beneficiaryGroups || '',
    beneficiaries: record.beneficiaries ?? null,
    expected_impact: record.expectedImpact || '',
    cost_band: record.costBand || null,
    duration_band: record.durationBand || null,
    readiness_level: record.readinessLevel || null,
    budget: record.budget ?? null,
    spent: record.spent ?? 0,
    funding_model: record.fundingModel || null,
    start_date: record.startDate || null,
    end_date: record.endDate || null
  };
  // بقية حقول المنصة الغنية → details (مع استبعاد أعمدة الصف والحقول المشتقة)
  const exclude = new Set([...Object.keys(row), 'id', '_uuid', 'status', 'cloudStatus', 'currentStage',
    'progressPercentage', 'organizationId', 'createdBy', 'assignedSupervisorId',
    'submittedAt', 'approvedAt', 'archivedAt', 'createdAt', 'updatedAt',
    'beneficiaryGroups', 'expectedImpact', 'costBand', 'durationBand', 'readinessLevel',
    'fundingModel', 'startDate', 'endDate', 'beneficiaries', 'budget', 'spent', 'lat', 'lng',
    'submitterName', 'submitterEntity', 'submitterEmail', 'submitterPhone', 'channel',
    'orgUnitId', 'ownerName', 'notes', 'scope', 'scores', 'sites', 'geometry', 'imageDataUrl',
    'statusHistory', 'portfolioId', 'campaignId']);
  const details = {
    platform_status: record.status,
    statusHistory: record.statusHistory || [],
    sites: record.sites || [],
    geometry: record.geometry || null,
    imageDataUrl: record.imageDataUrl || null,
    scores: record.scores || {},
    notes: record.notes || '',
    scope: record.scope || '',
    lat: record.lat ?? null, lng: record.lng ?? null,
    submitterName: record.submitterName || '', submitterEntity: record.submitterEntity || '',
    submitterEmail: record.submitterEmail || '', submitterPhone: record.submitterPhone || '',
    channel: record.channel || 'internal', orgUnitId: record.orgUnitId || null,
    ownerName: record.ownerName || '', portfolioId: record.portfolioId || null,
    campaignId: record.campaignId || null
  };
  for (const [k, v] of Object.entries(record)) {
    if (!exclude.has(k) && !(k in details)) details[k] = v;
  }
  row.details = details;
  return row;
}

// lat/lng للاستخدام في الخرائط تُقرأ من details عبر rowToInitiative (يعيد ...details أولًا)

// ————— محولات الجداول العلائقية —————
const adapters = {
  initiatives: {
    assignsIds: true,
    async getAll() {
      const client = await sb();
      const { data, error } = await client.from('initiatives').select('*').order('created_at');
      if (error) throw new Error(error.message);
      return (data || []).map(rowToInitiative);
    },
    async get(id) {
      const client = await sb();
      const { data, error } = await client.from('initiatives').select('*').eq('initiative_number', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToInitiative(data) : undefined;
    },
    async put(record) {
      const client = await sb();
      const row = initiativeToRow(record);
      if (record._uuid || numberToUuid.has(record.id)) {
        const uuid = record._uuid || numberToUuid.get(record.id);
        const { data, error } = await client.from('initiatives').update(row).eq('id', uuid).select().maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error('لا صلاحية لتعديل هذه المبادرة في حالتها الحالية');
        return rowToInitiative(data);
      }
      const session = getSession();
      row.organization_id = record.organizationId || session?.organizationId;
      row.created_by = record.createdBy || session?.userId;
      if (!row.organization_id) throw new Error('حسابك غير مرتبط بجهة — تواصل مع مدير النظام');
      const { data, error } = await client.from('initiatives').insert(row).select().single();
      if (error) throw new Error(error.message);
      return rowToInitiative(data);
    },
    async remove(id) {
      const client = await sb();
      const uuid = await initiativeUuid(id);
      const { error } = await client.from('initiatives').delete().eq('id', uuid);
      if (error) throw new Error(error.message);
    },
    async count() { return (await this.getAll()).length; },
    async byIndex(_i, value) {
      const all = await this.getAll();
      return all.filter((r) => r.status === value || r.category === value || r.district === value);
    }
  },

  milestones: { // مراحل المبادرة initiative_stages بواجهة المعالم القائمة
    async getAll() {
      const client = await sb();
      const { data, error } = await client.from('initiative_stages')
        .select('*, initiatives!inner(initiative_number)').order('stage_order');
      if (error) throw new Error(error.message);
      return (data || []).map((r) => ({
        id: r.id,
        initiativeId: r.initiatives.initiative_number,
        title: r.stage_name,
        due: r.planned_end_date,
        done: r.status === 'done',
        doneAt: r.status === 'done' ? r.updated_at : null,
        stageOrder: r.stage_order,
        progress: Number(r.progress_percentage) || 0,
        notes: r.notes || ''
      }));
    },
    async get(id) { return (await this.getAll()).find((r) => r.id === id); },
    async put(record) {
      const client = await sb();
      const row = {
        stage_name: record.title,
        planned_end_date: record.due || null,
        status: record.done ? 'done' : 'pending',
        stage_order: record.stageOrder || 1,
        progress_percentage: record.done ? 100 : (record.progress || 0),
        notes: record.notes || ''
      };
      if (/^[0-9a-f-]{36}$/.test(record.id || '')) {
        const { error } = await client.from('initiative_stages').update(row).eq('id', record.id);
        if (error) throw new Error(error.message);
        return record;
      }
      row.initiative_id = await initiativeUuid(record.initiativeId);
      const { data, error } = await client.from('initiative_stages').insert(row).select().single();
      if (error) throw new Error(error.message);
      return { ...record, id: data.id };
    },
    async remove(id) {
      const client = await sb();
      const { error } = await client.from('initiative_stages').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    async count() { return (await this.getAll()).length; },
    async byIndex(_i, value) {
      return (await this.getAll()).filter((r) => r.initiativeId === value);
    }
  },

  notifications: {
    async getAll() {
      const client = await sb();
      const { data, error } = await client.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw new Error(error.message);
      return (data || []).map((r) => ({
        id: r.id, title: r.title, body: r.message || '', level: 'info',
        at: r.created_at, read: r.is_read
      }));
    },
    async get(id) { return (await this.getAll()).find((r) => r.id === id); },
    async put(record) {
      const client = await sb();
      if (/^[0-9a-f-]{36}$/.test(record.id || '')) {
        await client.from('notifications').update({ is_read: Boolean(record.read) }).eq('id', record.id);
      }
      // الإشعارات تُنشأ من القاعدة (دالة الانتقال) — إنشاء العميل يُتجاهل بصمت
      return record;
    },
    async remove(id) {
      const client = await sb();
      await client.from('notifications').delete().eq('id', id);
    },
    async count() { return (await this.getAll()).length; },
    async byIndex() { return []; }
  },

  users: { // قراءة الملفات الشخصية لأغراض العرض — الإدارة عبر Edge Function
    async getAll() {
      const client = await sb();
      const { data, error } = await client.from('profiles')
        .select('*, organizations(name_ar, code)').order('created_at');
      if (error) throw new Error(error.message);
      return (data || []).map((r) => ({
        id: r.id,
        name: r.full_name || '—',
        username: r.id.slice(0, 8),
        role: r.role,
        orgUnitId: r.organization_id,
        orgName: r.organizations?.name_ar || null,
        orgCode: r.organizations?.code || null,
        active: r.is_active,
        mustChangePassword: r.must_change_password,
        grants: r.overrides?.grants || [],
        denies: r.overrides?.denies || []
      }));
    },
    async get(id) { return (await this.getAll()).find((r) => r.id === id); },
    async put(record) { return record; }, // الكتابة عبر Edge Function فقط
    async remove() { throw new Error('حذف الحسابات عبر مدير النظام في Supabase'); },
    async count() { return (await this.getAll()).length; },
    async byIndex() { return []; }
  },

  attachments: {
    async getAll() {
      const client = await sb();
      const { data, error } = await client.from('attachments')
        .select('*, initiatives!inner(initiative_number)').order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map((r) => ({
        id: r.id,
        initiativeId: r.initiatives.initiative_number,
        name: r.file_name,
        type: r.file_type,
        size: r.file_size,
        filePath: r.file_path,
        uploadedBy: r.uploaded_by,
        uploadedAt: r.created_at
      }));
    },
    async get(id) { return (await this.getAll()).find((r) => r.id === id); },
    async put(record) { return record; }, // الرفع عبر attachment-service (تخزين + صف)
    async remove(id) {
      const client = await sb();
      const { error } = await client.from('attachments').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    async count() { return (await this.getAll()).length; },
    async byIndex(_i, value) {
      return (await this.getAll()).filter((r) => r.initiativeId === value);
    }
  },

  auditLogs: {
    async getAll() {
      const client = await sb();
      const { data, error } = await client.from('audit_logs')
        .select('*').order('created_at', { ascending: false }).limit(200);
      if (error) return []; // محجوب عن غير المدير
      return (data || []).map((r) => ({
        id: r.id, at: r.created_at, actor: r.user_id ? r.user_id.slice(0, 8) : 'النظام',
        role: '', action: r.action, store: r.entity_type, recordId: r.entity_id, note: ''
      }));
    },
    async get() { return undefined; },
    async put(record) { return record; }, // التدقيق يكتبه الخادم حصريًا
    async remove() { /* غير مسموح */ },
    async count() { return (await this.getAll()).length; },
    async byIndex() { return []; }
  }
};

// ————— المخزن العام لبقية الكيانات —————
function appStoreAdapter(store) {
  return {
    async getAll() {
      const client = await sb();
      const { data, error } = await client.from('app_store').select('id, data').eq('store', store);
      if (error) throw new Error(error.message);
      return (data || []).map((r) => ({ id: r.id, ...r.data }));
    },
    async get(id) {
      const client = await sb();
      const { data, error } = await client.from('app_store').select('data').eq('store', store).eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id, ...data.data } : undefined;
    },
    async put(record) {
      const client = await sb();
      const { error } = await client.from('app_store')
        .upsert({ store, id: record.id, data: record, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      return record;
    },
    async remove(id) {
      const client = await sb();
      const { error } = await client.from('app_store').delete().eq('store', store).eq('id', id);
      if (error) throw new Error(error.message);
    },
    async count() { return (await this.getAll()).length; },
    async byIndex(indexName, value) {
      const client = await sb();
      const { data, error } = await client.from('app_store').select('id, data')
        .eq('store', store).eq(`data->>${indexName}`, value);
      if (error) throw new Error(error.message);
      return (data || []).map((r) => ({ id: r.id, ...r.data }));
    }
  };
}

function adapterFor(store) {
  if (RELATIONAL.has(store)) return adapters[store];
  return appStoreAdapter(store);
}

export const cloudProvider = {
  name: 'supabase',
  assignsIds(store) { return store === 'initiatives'; },
  getAll: (store) => adapterFor(store).getAll(),
  get: (store, id) => adapterFor(store).get(id),
  put: (store, record) => adapterFor(store).put(record),
  async bulkPut(store, records) {
    const a = adapterFor(store);
    for (const r of records) await a.put(r);
    return records;
  },
  remove: (store, id) => adapterFor(store).remove(id),
  async clear(store) {
    const a = adapterFor(store);
    for (const r of await a.getAll()) await a.remove(r.id);
  },
  count: (store) => adapterFor(store).count(),
  byIndex: (store, index, value) => adapterFor(store).byIndex(index, value)
};

// انتقال حالة مبادرة عبر دالة القاعدة (المسار الوحيد المسموح لتغيير الحالة)
export async function cloudTransition(initiativeId, platformTo, reason = null) {
  const client = await sb();
  const uuid = await initiativeUuid(initiativeId);
  if (!uuid) throw new Error('المبادرة غير موجودة');
  const { data: row } = await client.from('initiatives').select('current_status').eq('id', uuid).single();
  const target = cloudTargetFor(platformTo, row.current_status);
  if (!target) throw new Error(`لا حالة سحابية مقابلة لـ ${platformTo}`);
  const steps = cloudPathTo(row.current_status, target);
  let last = null;
  for (const step of steps) {
    const { data, error } = await client.rpc('change_initiative_status', {
      p_initiative: uuid,
      p_new_status: step,
      p_reason: reason,
      p_platform_status: step === steps[steps.length - 1] ? platformTo : null
    });
    if (error) throw new Error(error.message);
    last = data;
  }
  return last ? rowToInitiative(last) : null;
}

// سجل حالات مبادرة (للخط الزمني)
export async function cloudHistory(initiativeId) {
  const client = await sb();
  const uuid = await initiativeUuid(initiativeId);
  if (!uuid) return [];
  const { data } = await client.from('initiative_status_history')
    .select('*').eq('initiative_id', uuid).order('created_at');
  return data || [];
}
