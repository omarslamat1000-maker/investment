// خدمة وحدات التكلفة — حفظ/قراءة كتالوج الوحدات والأسعار من الإعدادات (مع دمج الافتراضي)
// وحفظ التقدير المعتمد على المبادرة (الميزانية ونطاقا التكلفة والمدة)
import { dataProvider } from '../data/data-provider.js';
import { repos } from '../data/repositories.js';
import { mergeUnits, sanitizeUnit, DEFAULT_COST_UNITS, DEFAULT_CONTINGENCY_PCT } from '../domain/cost-estimate.js';
import { nowIso } from '../core/date-time.js';

const CONFIG_ID = 'cost-units';

export async function getCostConfig() {
  let saved = null;
  try { saved = await dataProvider.get('settings', CONFIG_ID); } catch { saved = null; }
  return {
    units: mergeUnits(saved),
    removed: saved?.removed || [],
    contingencyPct: Number.isFinite(Number(saved?.contingencyPct)) ? Number(saved.contingencyPct) : DEFAULT_CONTINGENCY_PCT
  };
}

export async function saveCostConfig({ units, removed = [], contingencyPct = DEFAULT_CONTINGENCY_PCT }) {
  const clean = units.map(sanitizeUnit).filter(Boolean);
  await dataProvider.put('settings', { id: CONFIG_ID, units: clean, removed, contingencyPct: Number(contingencyPct) || 0, updatedAt: nowIso() });
  return getCostConfig();
}

export async function upsertUnit(unit) {
  const cfg = await getCostConfig();
  const u = sanitizeUnit(unit);
  if (!u) throw new Error('اسم الوحدة مطلوب');
  const units = cfg.units.filter((x) => x.id !== u.id).concat(u);
  return saveCostConfig({ units, removed: cfg.removed.filter((id) => id !== u.id), contingencyPct: cfg.contingencyPct });
}

export async function removeUnit(id) {
  const cfg = await getCostConfig();
  const removed = DEFAULT_COST_UNITS.some((u) => u.id === id) ? [...new Set([...cfg.removed, id])] : cfg.removed;
  return saveCostConfig({ units: cfg.units.filter((u) => u.id !== id), removed, contingencyPct: cfg.contingencyPct });
}

export async function resetUnits() {
  await dataProvider.put('settings', { id: CONFIG_ID, units: [], removed: [], contingencyPct: DEFAULT_CONTINGENCY_PCT, updatedAt: nowIso() });
  return getCostConfig();
}

// حفظ التقدير على المبادرة: الميزانية + النطاقان + تفاصيل البنود (للمرجعية والتقارير)
export async function saveEstimateToInitiative(initiativeId, estimate, { byName = '' } = {}) {
  const patch = {
    budget: estimate.total,
    costBand: estimate.costBand,
    costEstimate: {
      lines: estimate.lines.map(({ unitId, label, unit, qty, rate, cost, days }) => ({ unitId, label, unit, qty, rate, cost, days })),
      subtotal: estimate.subtotal, contingencyPct: estimate.contingencyPct, contingency: estimate.contingency,
      total: estimate.total, days: estimate.days, durationMode: estimate.durationMode,
      costBand: estimate.costBand, durationBand: estimate.durationBand, at: nowIso(), by: byName
    }
  };
  if (estimate.durationBand) patch.durationBand = estimate.durationBand;
  return repos.initiatives.update(initiativeId, patch);
}
