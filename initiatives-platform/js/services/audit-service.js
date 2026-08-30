// سجل التدقيق — قراءة وتصفية وتنقية دورية
import { dataProvider } from '../data/data-provider.js';
import { sortBy } from '../core/utils.js';

export async function getAuditLogs({ limit = 100, store = null, actor = null } = {}) {
  let logs = await dataProvider.getAll('auditLogs');
  if (store) logs = logs.filter((l) => l.store === store);
  if (actor) logs = logs.filter((l) => l.actor === actor);
  return sortBy(logs, (l) => l.at, 'desc').slice(0, limit);
}

// إبقاء آخر keep سجلًا فقط — تُستدعى من صفحة الإعدادات
export async function pruneAuditLogs(keep = 500) {
  const logs = sortBy(await dataProvider.getAll('auditLogs'), (l) => l.at, 'desc');
  const excess = logs.slice(keep);
  for (const l of excess) await dataProvider.remove('auditLogs', l.id);
  return excess.length;
}
