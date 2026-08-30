// خريطة المبادرات — لوحة SVG مبنية ذاتيًا (بلا مكتبات خارجية) بإسقاط خطي لإحداثيات المدينة
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, statusBadge } from '../../ui/components.js';
import { statusLabel } from '../../domain/workflow.js';
import { categoryLabel } from '../../domain/initiative-model.js';
import { navigate } from '../../router.js';

// إطار المدينة المنورة التقريبي
const BOUNDS = { minLat: 24.38, maxLat: 24.56, minLng: 39.50, maxLng: 39.70 };
const W = 800; const H = 620;

function project(lat, lng) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * W;
  const y = H - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H;
  return { x: Math.round(x), y: Math.round(y) };
}

const STATUS_DOT = {
  execution: '#1E7A5F', benefits: '#C9A227', closed: '#4E8F7B',
  readiness: '#8A6D1F', approval: '#8A6D1F', study: '#5B6E66',
  screening: '#5B6E66', submitted: '#5B6E66', draft: '#B8B29A',
  rejected: '#A34242', onHold: '#B8B29A'
};

export async function renderMap(container) {
  const [initiatives, needs] = await Promise.all([repos.initiatives.getAll(), repos.needs.getAll()]);
  const located = initiatives.filter((i) => i.lat && i.lng && i.status !== 'rejected');
  const locatedNeeds = needs.filter((n) => n.lat && n.lng && n.status === 'published');

  const landmarks = [
    { name: 'المسجد النبوي', lat: 24.4672, lng: 39.6111 },
    { name: 'مسجد قباء', lat: 24.4395, lng: 39.6168 },
    { name: 'جبل أحد', lat: 24.5100, lng: 39.6130 }
  ];

  const pins = located.map((i) => {
    const { x, y } = project(i.lat, i.lng);
    return `<g class="mi-map-pin" data-id="${escapeHtml(i.id)}" transform="translate(${x} ${y})" tabindex="0" role="button" aria-label="${escapeHtml(i.title)}">
      <circle r="11" fill="${STATUS_DOT[i.status] || '#5B6E66'}" stroke="#F6F8F5" stroke-width="2.5"/>
      <title>${escapeHtml(i.title)} — ${escapeHtml(statusLabel(i.status))}</title>
    </g>`;
  }).join('');

  const needPins = locatedNeeds.map((n) => {
    const { x, y } = project(n.lat, n.lng);
    return `<g class="mi-map-need" transform="translate(${x} ${y})">
      <rect x="-8" y="-8" width="16" height="16" rx="3" fill="none" stroke="#C9A227" stroke-width="2.5" stroke-dasharray="4 3"/>
      <title>احتياج مطروح: ${escapeHtml(n.title)}</title>
    </g>`;
  }).join('');

  const marks = landmarks.map((l) => {
    const { x, y } = project(l.lat, l.lng);
    return `<g transform="translate(${x} ${y})" class="mi-map-landmark">
      <path d="M0,-7 L4,3 L-4,3 Z" fill="currentColor" opacity="0.5"/>
      <text y="18" text-anchor="middle">${escapeHtml(l.name)}</text>
    </g>`;
  }).join('');

  container.innerHTML = html`
    ${raw(sectionHeader('خريطة المبادرات', 'التوزيع الجغرافي للمبادرات والاحتياجات المطروحة داخل نطاق الأمانة'))}
    <div class="mi-card mi-map-card">
      <svg class="mi-map" viewBox="0 0 ${String(W)} ${String(H)}" role="application" aria-label="خريطة توزيع المبادرات">
        <rect width="${String(W)}" height="${String(H)}" class="mi-map-bg" rx="12"/>
        <g class="mi-map-grid">${raw(gridLines())}</g>
        ${raw(marks)}
        ${raw(needPins)}
        ${raw(pins)}
      </svg>
      <div class="mi-map-legend">
        <span><i class="mi-legend-dot" style="background:#1E7A5F"></i> قيد التنفيذ</span>
        <span><i class="mi-legend-dot" style="background:#C9A227"></i> تحقق المنافع</span>
        <span><i class="mi-legend-dot" style="background:#5B6E66"></i> قبل التنفيذ</span>
        <span><i class="mi-legend-dot mi-legend-dot--need"></i> احتياج مطروح</span>
      </div>
      <div class="mi-map-info" aria-live="polite"></div>
    </div>`;

  const info = container.querySelector('.mi-map-info');
  container.querySelectorAll('.mi-map-pin').forEach((pin) => {
    const show = () => {
      const ini = located.find((i) => i.id === pin.dataset.id);
      if (!ini) return;
      info.innerHTML = html`
        <b>${ini.title}</b> ${raw(statusBadge(ini.status))}<br>
        <small class="mi-muted">${ini.id} • ${categoryLabel(ini.category)} • حي ${ini.district}</small>
        <a class="mi-btn mi-btn--ghost mi-btn--sm" href="#/initiatives/${ini.id}">فتح التفاصيل</a>`;
    };
    pin.addEventListener('click', show);
    pin.addEventListener('focus', show);
    pin.addEventListener('dblclick', () => navigate(`initiatives/${pin.dataset.id}`));
    pin.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(`initiatives/${pin.dataset.id}`); });
  });
}

function gridLines() {
  let out = '';
  for (let x = 100; x < W; x += 100) out += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
  for (let y = 100; y < H; y += 100) out += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
  return out;
}
