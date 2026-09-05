// تحليل التغطية والفجوات الجغرافية — توزيع المبادرات والاحتياجات على الأحياء والتصنيفات،
// واكتشاف الأحياء بلا مبادرات والتصنيفات المهملة والاحتياجات المطروحة بلا استجابة
import { DISTRICTS, CATEGORIES, DISTRICT_CENTROIDS } from '../core/constants.js';
import { isActive } from './workflow.js';

const COUNTED = (i) => i.status !== 'rejected' && i.status !== 'draft';
const GENERIC = new Set(['', 'عموم المدينة', 'غير محدد']);

// أول إحداثية لسجل (مبادرة أو احتياج)
function firstCoord(r) {
  const sites = Array.isArray(r.sites) && r.sites.length ? r.sites : (r.geometry ? [{ geometry: r.geometry }] : []);
  for (const s of sites) { const c = s.geometry?.coords?.[0]; if (c) return c; }
  return r.lat && r.lng ? [r.lat, r.lng] : null;
}

// المنطقة تُستنتج من أقرب مركز حي إلى الإحداثيات (حقل الحي لم يعد يُدخل يدويًا)
export function inferDistrict(record, centroids = DISTRICT_CENTROIDS) {
  if (record.district && !GENERIC.has(record.district)) return record.district;
  const c = firstCoord(record);
  if (!c) return record.district || 'غير محدد';
  let best = null; let bd = Infinity;
  for (const [name, [lat, lng]] of Object.entries(centroids)) {
    const d = (lat - c[0]) ** 2 + ((lng - c[1]) * Math.cos((c[0] * Math.PI) / 180)) ** 2;
    if (d < bd) { bd = d; best = name; }
  }
  return best || 'غير محدد';
}

export function coverageAnalysis({ initiatives = [], needs = [], districts = DISTRICTS, categories = CATEGORIES } = {}) {
  const counted = initiatives.filter(COUNTED).map((i) => ({ ...i, district: inferDistrict(i) }));
  needs = needs.map((n) => ({ ...n, district: inferDistrict(n) }));
  const rows = districts.filter((d) => !GENERIC.has(d) || counted.some((i) => i.district === d) || needs.some((n) => n.district === d)).map((d) => {
    const mine = counted.filter((i) => i.district === d);
    const active = mine.filter((i) => isActive(i.status));
    const running = mine.filter((i) => ['execution', 'benefits'].includes(i.status));
    const closed = mine.filter((i) => i.status === 'closed');
    const dNeeds = needs.filter((n) => n.district === d);
    const openNeeds = dNeeds.filter((n) => n.status === 'published');
    const byCategory = {};
    for (const c of categories) byCategory[c.id] = mine.filter((i) => i.category === c.id).length;
    const budget = mine.reduce((a, i) => a + (Number(i.budget) || 0), 0);
    const beneficiaries = mine.reduce((a, i) => a + (Number(i.beneficiaries) || 0), 0);
    let gap = 'covered';
    if (mine.length === 0) gap = openNeeds.length ? 'critical' : 'high';
    else if (openNeeds.length && !active.length) gap = 'high';
    else if (mine.length === 1) gap = 'medium';
    return {
      district: d,
      total: mine.length, active: active.length, running: running.length, closed: closed.length,
      needs: dNeeds.length, openNeeds: openNeeds.length,
      budget, beneficiaries, byCategory, gap
    };
  });

  const categoryRows = categories.map((c) => {
    const mine = counted.filter((i) => i.category === c.id);
    const cNeeds = needs.filter((n) => n.category === c.id && n.status === 'published');
    return { id: c.id, label: c.label, total: mine.length, active: mine.filter((i) => isActive(i.status)).length, openNeeds: cNeeds.length };
  });

  const max = Math.max(1, ...rows.map((r) => r.total));
  const top3 = [...rows].sort((a, b) => b.total - a.total).slice(0, 3).reduce((a, r) => a + r.total, 0);
  return {
    rows,
    categoryRows,
    maxPerDistrict: max,
    gaps: {
      noInitiatives: rows.filter((r) => r.total === 0).map((r) => r.district),
      needsWithoutResponse: rows.filter((r) => r.openNeeds > 0 && r.active === 0).map((r) => ({ district: r.district, openNeeds: r.openNeeds })),
      neglectedCategories: categoryRows.filter((c) => c.active === 0).map((c) => c.label),
      underserved: rows.filter((r) => r.total > 0 && r.total <= max * 0.25).map((r) => r.district)
    },
    totals: {
      districts: rows.length,
      coveredDistricts: rows.filter((r) => r.total > 0).length,
      initiatives: counted.length,
      openNeeds: needs.filter((n) => n.status === 'published').length
    },
    // التركّز: نصيب أعلى 3 أحياء من كل المبادرات (كلما ارتفع كانت التغطية أقل عدالة)
    concentration: counted.length ? Math.round((top3 / counted.length) * 100) : 0
  };
}

export const GAP_LABELS = {
  critical: 'فجوة حرجة — احتياج مطروح بلا أي مبادرة',
  high: 'فجوة عالية — لا مبادرات',
  medium: 'تغطية محدودة',
  covered: 'مغطى'
};

// مركز تقريبي للحي من مواقع مبادراته واحتياجاته، وإلا من الجدول المرجعي
export function districtCenter(district, { initiatives = [], needs = [], fallback = {} } = {}) {
  const pts = [];
  for (const i of initiatives.filter((x) => x.district === district)) {
    const sites = Array.isArray(i.sites) && i.sites.length ? i.sites : (i.geometry ? [{ geometry: i.geometry }] : []);
    for (const s of sites) for (const c of (s.geometry?.coords || [])) pts.push(c);
    if (!sites.length && i.lat && i.lng) pts.push([i.lat, i.lng]);
  }
  for (const n of needs.filter((x) => x.district === district)) {
    for (const c of (n.geometry?.coords || [])) pts.push(c);
    if (!n.geometry?.coords?.length && n.lat && n.lng) pts.push([n.lat, n.lng]);
  }
  if (pts.length) {
    return { lat: pts.reduce((a, p) => a + p[0], 0) / pts.length, lng: pts.reduce((a, p) => a + p[1], 0) / pts.length, source: 'sites' };
  }
  const f = fallback[district];
  return f ? { lat: f[0], lng: f[1], source: 'reference' } : null;
}
