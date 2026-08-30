// المستودعات — واجهة كل كيان فوق dataProvider مع الطوابع الزمنية وسجل التدقيق
import { dataProvider } from './data-provider.js';
import { uid, officialId, sortBy } from '../core/utils.js';
import { nowIso, currentYear } from '../core/date-time.js';
import { ID_PREFIXES } from '../core/constants.js';
import { getUserName, getRole } from '../core/state.js';

async function audit(action, store, recordId, note = '') {
  const entry = {
    id: uid('audit'),
    at: nowIso(),
    actor: getUserName(),
    role: getRole(),
    action, store, recordId, note
  };
  // سجل التدقيق لا يُعطّل العملية الأصلية إذا فشل
  try { await dataProvider.put('auditLogs', entry); } catch (err) { console.warn('تعذر تسجيل التدقيق', err); }
}

function makeRepo(store, { prefix = null, auditLabel = store } = {}) {
  return {
    store,
    getAll: () => dataProvider.getAll(store),
    get: (id) => dataProvider.get(store, id),
    count: () => dataProvider.count(store),
    byInitiative: (initiativeId) => dataProvider.byIndex(store, 'initiativeId', initiativeId),

    async create(data) {
      const record = { ...data, createdAt: nowIso(), updatedAt: nowIso() };
      if (!record.id) {
        record.id = prefix ? await nextOfficialId(store, prefix) : uid(store.slice(0, 4));
      }
      await dataProvider.put(store, record);
      await audit('إنشاء', auditLabel, record.id, record.title || record.name || '');
      return record;
    },

    async update(id, patch) {
      const existing = await dataProvider.get(store, id);
      if (!existing) throw new Error(`السجل ${id} غير موجود في ${store}`);
      const record = { ...existing, ...patch, id, updatedAt: nowIso() };
      await dataProvider.put(store, record);
      await audit('تحديث', auditLabel, id, Object.keys(patch).join('، '));
      return record;
    },

    async remove(id) {
      await dataProvider.remove(store, id);
      await audit('حذف', auditLabel, id);
    },

    bulkPut: (records) => dataProvider.bulkPut(store, records)
  };
}

// توليد معرّف رسمي تسلسلي MDN-XXXX-YYYY-NNNN حسب أعلى تسلسل موجود
async function nextOfficialId(store, prefix) {
  const all = await dataProvider.getAll(store);
  const year = currentYear();
  const re = new RegExp(`^${prefix}-${year}-(\\d{4})$`);
  let max = 0;
  for (const r of all) {
    const m = re.exec(r.id || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return officialId(prefix, year, max + 1);
}

export const repos = {
  initiatives: makeRepo('initiatives', { prefix: ID_PREFIXES.initiative, auditLabel: 'مبادرة' }),
  needs: makeRepo('infrastructureNeeds', { prefix: ID_PREFIXES.need, auditLabel: 'احتياج' }),
  partners: makeRepo('partners', { prefix: ID_PREFIXES.partner, auditLabel: 'شريك' }),
  initiativePartners: makeRepo('initiativePartners'),
  campaigns: makeRepo('campaigns'),
  reviews: makeRepo('reviews', { auditLabel: 'مراجعة' }),
  decisions: makeRepo('decisions', { prefix: ID_PREFIXES.decision, auditLabel: 'قرار' }),
  gateChecklists: makeRepo('gateChecklists'),
  kpis: makeRepo('kpis'),
  benefits: makeRepo('benefits', { auditLabel: 'منفعة' }),
  risks: makeRepo('risks', { auditLabel: 'خطر' }),
  milestones: makeRepo('milestones'),
  deliverables: makeRepo('deliverables'),
  qualityChecks: makeRepo('qualityChecks'),
  changeRequests: makeRepo('changeRequests'),
  comments: makeRepo('comments'),
  attachments: makeRepo('attachments'),
  users: makeRepo('users'),
  organizationalUnits: makeRepo('organizationalUnits'),
  notifications: makeRepo('notifications'),
  auditLogs: makeRepo('auditLogs'),
  settings: makeRepo('settings'),
  savedViews: makeRepo('savedViews')
};

export async function latestAuditLogs(limit = 30) {
  const all = await dataProvider.getAll('auditLogs');
  return sortBy(all, (a) => a.at, 'desc').slice(0, limit);
}
