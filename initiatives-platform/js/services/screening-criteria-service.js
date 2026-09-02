// معايير الفرز — العامة تُحفظ في الإعدادات، والإضافية الخاصة بكل فرصة على سجل الاحتياج
import { dataProvider } from '../data/data-provider.js';
import { repos } from '../data/repositories.js';
import { DEFAULT_SCREENING_CRITERIA, sanitizeCriteria, effectiveCriteria } from '../domain/applicant-scoring.js';
import { nowIso } from '../core/date-time.js';

const CONFIG_ID = 'screening-criteria';

export async function getGlobalCriteria() {
  try {
    const saved = await dataProvider.get('settings', CONFIG_ID);
    const list = sanitizeCriteria(saved?.criteria || []);
    return list.length ? list : DEFAULT_SCREENING_CRITERIA.map((c) => ({ ...c }));
  } catch { return DEFAULT_SCREENING_CRITERIA.map((c) => ({ ...c })); }
}

export async function saveGlobalCriteria(criteria) {
  const clean = sanitizeCriteria(criteria);
  if (!clean.length) throw new Error('يلزم معيار واحد على الأقل بوزن موجب');
  await dataProvider.put('settings', { id: CONFIG_ID, criteria: clean, updatedAt: nowIso() });
  return clean;
}

export async function resetGlobalCriteria() {
  return saveGlobalCriteria(DEFAULT_SCREENING_CRITERIA);
}

// المعايير الإضافية لفرصة بعينها
export async function saveNeedCriteria(needId, extraCriteria) {
  const clean = sanitizeCriteria(extraCriteria).map((c) => ({ ...c, scope: 'need' }));
  return repos.needs.update(needId, { extraCriteria: clean });
}

export async function criteriaForNeed(need) {
  const global = await getGlobalCriteria();
  return effectiveCriteria(global, need);
}
