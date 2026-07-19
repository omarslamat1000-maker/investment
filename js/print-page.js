/**
 * print-page.js — عرض التقارير القابلة للطباعة (PDF)
 * يقرأ البيانات من sessionStorage (يمررها التطبيق عبر ExportUtils.openPrintPage)
 * أنواع التقارير: summary (تقرير عام)، landCard (بطاقة أرض)، distances (تقرير مسافات)
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * وسم اسم الموقع فوق العلامة مباشرة — divIcon مرتكز على الإحداثية نفسها
   * (بديل عن تلميح Leaflet الذي ينزاح أفقياً في صفحات RTL)
   */
  function addSiteLabel(map, latLng, text, color) {
    const icon = L.divIcon({
      className: 'print-lm',
      html: '<span class="site-lbl" style="border-color:' + color + '">' + esc(text) + '</span>',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    L.marker(latLng, { icon, interactive: false }).addTo(map);
  }

  /* زر إخفاء معلم من التقرير: يزيل صفه من الجدول ويحذفه من خرائط التقرير (لا يُطبع) */
  function rowHideBtn(name) {
    return `<button class="row-hide-btn" data-lmname="${esc(name)}" title="إخفاء هذا المعلم من التقرير والخرائط قبل الطباعة"><i>👁</i></button>`;
  }
  function fmt(n, d = 0) {
    if (n == null || !isFinite(Number(n))) return '—'; // مواقع بلا بيانات مساحية (نقطة من الخريطة)
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
  }
  function fmtKm(km) {
    return km >= 1 ? km.toFixed(2) + ' كم' : Math.round(km * 1000) + ' م';
  }
  function fmtMin(min) {
    if (min == null) return '';
    if (min < 60) return Math.round(min) + ' دقيقة';
    const h = Math.floor(min / 60);
    return h + ' ساعة ' + Math.round(min % 60) + ' دقيقة';
  }

  function header(title, subtitle) {
    const now = new Date();
    return `
      <div class="report-header">
        <div class="emblem">🗺️</div>
        <div>
          <h1>${esc(title)}</h1>
          <div class="sub">${esc(subtitle || 'منصة المواقع الاستثمارية بالمدينة المنورة')}</div>
        </div>
        <div class="date">
          تاريخ التقرير<br><b>${now.toLocaleDateString('ar-SA')}</b><br>${now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>`;
  }

  function footer() {
    return `
      <div class="footer">
        <span>المسافات المباشرة محسوبة بخط مستقيم — مسافات الطريق تقديرية</span>
      </div>`;
  }

  /* شريط سفلي نحيف باسم الأمانة (بدون شعار) — يتكرر في كل صفحة مطبوعة */
  function brandFooter() {
    return `
      <div class="brand-footer">
        <div class="brand-text">
          <b>أمانة منطقة المدينة المنورة</b>
          <small>Madinah Regional Municipality</small>
        </div>
      </div>`;
  }

  /* صفحة الخرائط أسفل التقرير: الموقع العام من المدينة + الموقع المباشر
   * suffix يجعل معرّفات الخرائط فريدة عند طباعة عدة مواقع في ملف واحد */
  function mapsSection(suffix = '') {
    return `
      <div class="maps-page">
        <h2>خريطة الموقع</h2>
        <div class="map-block">
          <div class="map-frame"><div id="mapOverview${suffix}" class="lmap"></div></div>
          <div class="map-caption">الموقع العام من المدينة المنورة</div>
        </div>
        <div class="map-block">
          <div class="map-frame"><div id="mapDirect${suffix}" class="lmap"></div></div>
          <div class="map-caption">الموقع المباشر</div>
        </div>
      </div>`;
  }

  /* ========== سجلّ خرائط التقرير + أدوات التحكم (خريطة الأساس + فلاتر الفئات) ========== */
  const BASEMAPS = {
    streets: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
    light: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '© CARTO' },
    dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '© CARTO' },
  };
  const CAT_NAMES = {
    religious: 'معالم دينية', transport: 'محطات نقل', airport: 'مطارات', road: 'طرق رئيسة',
    tourism: 'مواقع سياحية', services: 'خدمات ومرافق', project: 'مشاريع', user: 'معالم المستخدم',
  };
  const printMaps = [];       // {map, tile, lmGroup}
  let allLandmarks = [];      // معالم التقرير كما وصلت في الحمولة
  let activeCats = new Set(); // الفئات الظاهرة حالياً
  let currentBasemap = 'streets';

  function makeTile(kind) {
    const b = BASEMAPS[kind] || BASEMAPS.streets;
    return L.tileLayer(b.url, { maxZoom: 19, attribution: b.attribution, crossOrigin: true });
  }

  /** إعادة رسم طبقة المعالم في كل الخرائط وفق الفئات المفعّلة */
  function refreshLandmarkLayers() {
    printMaps.forEach((entry) => {
      entry.lmGroup.clearLayers();
      addLandmarksToLayer(entry.lmGroup, allLandmarks.filter((lm) => activeCats.has(lm.category)));
    });
  }

  /** تبديل خريطة الأساس في كل الخرائط */
  function switchBasemap(kind) {
    currentBasemap = kind;
    printMaps.forEach((entry) => {
      entry.map.removeLayer(entry.tile);
      entry.tile = makeTile(kind).addTo(entry.map);
    });
  }

  /** بناء شريط التحكم (يظهر فقط عند وجود خرائط في التقرير) */
  function setupMapControls() {
    if (!printMaps.length) return;
    const bar = document.getElementById('mapControls');
    if (!bar) return;
    bar.style.display = 'flex';
    document.getElementById('basemapSel').onchange = (e) => switchBasemap(e.target.value);
    const wrap = document.getElementById('catFilterChips');
    wrap.innerHTML = '';
    [...new Set(allLandmarks.map((lm) => lm.category))].forEach((cat) => {
      const chip = document.createElement('span');
      chip.className = 'cat-chip active';
      chip.textContent = CAT_NAMES[cat] || cat;
      chip.onclick = () => {
        chip.classList.toggle('active');
        if (activeCats.has(cat)) activeCats.delete(cat);
        else activeCats.add(cat);
        refreshLandmarkLayers();
      };
      wrap.appendChild(chip);
    });
  }

  /* رسم المعالم داخل مجموعة طبقات: نقاط ملوّنة بوسم + خطوط الطرق + مضلعات المشاريع + الحلقات */
  function addLandmarksToLayer(group, landmarks, { labels = true } = {}) {
    (landmarks || []).forEach((lm) => {
      if (lm.path && lm.path.length >= 2) {
        // معلم خطي (طريق) أو مضلع (مشروع)
        const layer = lm.geomType === 'polygon' && lm.path.length >= 3
          ? L.polygon(lm.path, { color: lm.color, weight: 2, fillColor: lm.color, fillOpacity: 0.2 })
          : L.polyline(lm.path, { color: lm.color, weight: 3, opacity: 0.85 });
        layer.addTo(group);
        if (labels) {
          layer.bindTooltip(esc(lm.name), { permanent: true, direction: 'center', className: 'pm-lbl-tip' });
        }
      } else if (lm.ring && lm.ring.radiusKm) {
        L.circle([lm.lat, lm.lng], {
          radius: lm.ring.radiusKm * 1000,
          color: lm.color, weight: 1.5, dashArray: '6 5', fill: false,
        }).addTo(group);
      } else {
        const icon = L.divIcon({
          className: 'print-lm',
          html: '<span class="pm-dot" style="background:' + lm.color + '"></span>' +
                (labels ? '<span class="pm-lbl">' + esc(lm.name) + '</span>' : ''),
          iconSize: [10, 10], iconAnchor: [5, 5],
        });
        L.marker([lm.lat, lm.lng], { icon, interactive: false }).addTo(group);
      }
    });
  }

  /**
   * تهيئة خريطتي الموقع بعد إدراج التقرير
   * point: [lng, lat] — geometry: مضلع القطعة (اختياري) — landmarks: معالم المدينة
   */
  function initMaps(point, geometry, label, landmarks, suffix = '') {
    if (typeof L === 'undefined' || (!point && !geometry)) return;
    const MEDINA = [24.4672, 39.6111];
    const latLng = point ? [point[1], point[0]] : null;

    // تسجيل معالم التقرير مرة واحدة (كل الفئات مفعّلة ابتداءً)
    if (!allLandmarks.length && landmarks && landmarks.length) {
      allLandmarks = landmarks;
      activeCats = new Set(landmarks.map((lm) => lm.category));
    }

    /** إنشاء خريطة مسجلة في سجل التحكم مع طبقة أساس ومجموعة معالم وزر تصدير صورة */
    function createRegisteredMap(elId) {
      const map = L.map(elId, { zoomControl: true, attributionControl: true });
      const tile = makeTile(currentBasemap).addTo(map);
      const lmGroup = L.layerGroup().addTo(map);
      addLandmarksToLayer(lmGroup, (landmarks || []).filter((lm) => activeCats.has(lm.category)));
      const entry = { map, tile, lmGroup, shooter: null };
      printMaps.push(entry);
      // زر تنزيل الخريطة كصورة PNG (يختفي عند الطباعة)
      const frame = document.getElementById(elId).parentElement;
      if (frame && typeof L.simpleMapScreenshoter === 'function') {
        const btn = document.createElement('button');
        btn.className = 'img-export-btn';
        btn.innerHTML = '📷 تصدير صورة';
        btn.onclick = () => {
          if (!entry.shooter) entry.shooter = L.simpleMapScreenshoter({ hidden: true }).addTo(map);
          entry.shooter.takeScreen('blob').then((blob) => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'خريطة-' + elId + '.png';
            a.click();
            URL.revokeObjectURL(a.href);
          }).catch(() => alert('تعذر التقاط الصورة'));
        };
        frame.appendChild(btn);
      }
      return map;
    }

    // 1) الموقع العام: المدينة المنورة كاملة مع المعالم وتحديد الموقع
    const overview = createRegisteredMap('mapOverview' + suffix);
    overview.setView(MEDINA, 11);
    if (geometry) {
      L.geoJSON({ type: 'Feature', geometry }, {
        style: { color: '#dc2626', weight: 2, fillColor: '#dc2626', fillOpacity: 0.4 },
      }).addTo(overview);
    }
    if (latLng) {
      L.circleMarker(latLng, { radius: 8, color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.9, weight: 2 }).addTo(overview);
      addSiteLabel(overview, latLng, label || 'الموقع', '#b91c1c');
    }

    // 2) الموقع المباشر: تكبير على القطعة/النقطة مع المعالم القريبة
    const direct = createRegisteredMap('mapDirect' + suffix);
    if (geometry) {
      const geomLayer = L.geoJSON({ type: 'Feature', geometry }, {
        style: { color: '#0e7a4f', weight: 3, fillColor: '#0e7a4f', fillOpacity: 0.35 },
      }).addTo(direct);
      direct.fitBounds(geomLayer.getBounds(), { padding: [30, 30], maxZoom: 17 });
      // وسم اسم القطعة فوق مركزها في خريطة الموقع المباشر
      const c = latLng || geomLayer.getBounds().getCenter();
      addSiteLabel(direct, c, label || 'الموقع', '#0a5c3b');
    } else if (latLng) {
      direct.setView(latLng, 16);
      L.circleMarker(latLng, { radius: 9, color: '#0a5c3b', fillColor: '#0e7a4f', fillOpacity: 0.9, weight: 2 }).addTo(direct);
      addSiteLabel(direct, latLng, label || 'الموقع', '#0a5c3b');
    }

    // إعادة ضبط الأبعاد بعد اكتمال التخطيط لضمان تحميل جميع البلاطات قبل الطباعة
    setTimeout(() => {
      overview.invalidateSize();
      direct.invalidateSize();
      // إعادة تموضع الوسوم الدائمة (اسم الموقع) بعد تصحيح الأبعاد —
      // كانت تُحسب مواضعها قبل اكتمال تخطيط الصفحة فتظهر بعيدة عن العلامة
      [overview, direct].forEach((mp) => {
        mp.eachLayer((layer) => {
          const t = layer.getTooltip && layer.getTooltip();
          if (t && t.options.permanent) {
            layer.closeTooltip();
            layer.openTooltip();
          }
        });
      });
    }, 350);
  }

  /* تقرير عام (لوحة معلومات + جدول أراضٍ) */
  function renderSummary(p) {
    const s = p.stats;
    const rows = (p.rows || []).map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(r['الاسم'])}</td>
        <td class="num">${esc(r['رقم القطعة'])}</td>
        <td class="num">${fmt(r['المساحة (م²)'])}</td>
        <td>${esc(r['التصنيف'])}</td>
        <td>${esc(r['الشارع'])}</td>
        <td>${esc(r['الحالة'])}</td>
        <td>${esc(r['الأقسام'])}</td>
      </tr>`).join('');
    return `
      ${header(p.title)}
      <h2>ملخص إحصائي</h2>
      <div class="stat-cards">
        <div class="card"><b>${fmt(s.total)}</b><span>إجمالي الأراضي</span></div>
        <div class="card"><b>${fmt(s.totalArea / 1e6, 2)}</b><span>المساحة الكلية (كم²)</span></div>
        <div class="card"><b>${fmt(s.avgArea)}</b><span>متوسط المساحة (م²)</span></div>
        <div class="card"><b>${fmt(s.sectionsCount)}</b><span>الأقسام المخصصة</span></div>
        <div class="card"><b>${fmt(s.counts.small)}</b><span>أقل من 50 ألف م²</span></div>
        <div class="card"><b>${fmt(s.counts.medium)}</b><span>50 – 100 ألف م²</span></div>
        <div class="card"><b>${fmt(s.counts.large)}</b><span>أكثر من 100 ألف م²</span></div>
        <div class="card"><b>${fmt(s.totalArea / 10000, 0)}</b><span>المساحة الكلية (هكتار)</span></div>
      </div>
      <h2>قائمة الأراضي (${fmt((p.rows || []).length)})</h2>
      <table>
        <thead><tr><th>#</th><th>الاسم</th><th>رقم القطعة</th><th>المساحة (م²)</th><th>التصنيف</th><th>الشارع</th><th>الحالة</th><th>الأقسام</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${footer()}
      ${brandFooter()}`;
  }

  /* جسم بطاقة أرض (بيانات + ملاحظات + جدول مسافات) — يعاد استخدامه للطباعة المفردة والمتعددة */
  function landCardBody(l, distances) {
    const distRows = (distances || []).map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(d.name)} ${rowHideBtn(d.name)}</td>
        <td>${esc(d.category)}</td>
        <td class="num">${d.km.toFixed(2)} كم</td>
        <td class="num">${fmt(d.km * 1000)} م</td>
        <td>${esc(d.direction)}</td>
      </tr>`).join('');
    return `
      <h2>بيانات الأرض</h2>
      <div class="kv">
        <div class="row"><span>الاسم</span><b>${esc(l.name)}</b></div>
        <div class="row"><span>رقم القطعة</span><b>${esc(l.parcelNo || '—')}</b></div>
        <div class="row"><span>المساحة</span><b>${fmt(l.areaM2)} م² (${fmt(l.areaM2 / 10000, 2)} هكتار)</b></div>
        <div class="row"><span>تصنيف المساحة</span><b>${esc(l.sizeCat || '—')}</b></div>
        <div class="row"><span>المحيط</span><b>${fmt(l.perimeterM)} م</b></div>
        <div class="row"><span>الإحداثيات</span><b style="direction:ltr">${l.center ? l.center[1].toFixed(6) + ', ' + l.center[0].toFixed(6) : '—'}</b></div>
        <div class="row"><span>الشارع</span><b>${esc(l.street || '—')}</b></div>
        <div class="row"><span>رقم الصك</span><b>${esc(l.deed || '—')}</b></div>
        <div class="row"><span>رقم المخطط</span><b>${esc(l.plan || '—')}</b></div>
        <div class="row"><span>الحالة</span><b>${esc(l.status || '—')}</b></div>
        <div class="row"><span>الأولوية</span><b>${esc(l.priority || '—')}</b></div>
        <div class="row"><span>الأقسام</span><b>${esc((l.sections || []).join('، ') || '—')}</b></div>
      </div>
      ${l.notes ? '<h2>الملاحظات</h2><p style="font-size:13px;line-height:1.8">' + esc(l.notes) + '</p>' : ''}
      <h2>المسافات من المعالم (من الأقرب إلى الأبعد)</h2>
      <table>
        <thead><tr><th>#</th><th>المعلم</th><th>النوع</th><th>المسافة (كم)</th><th>المسافة (م)</th><th>الاتجاه</th></tr></thead>
        <tbody>${distRows}</tbody>
      </table>`;
  }

  /* بطاقة أرض واحدة — البيانات والجدول يميناً والخريطتان يساراً (نموذج الأمانة) */
  function renderLandCard(p) {
    return `
      ${header(p.title)}
      <div class="report-grid">
        <div class="col-data">
          ${landCardBody(p.land, p.distances)}
          ${footer()}
        </div>
        ${mapsSection()}
      </div>
      ${brandFooter()}`;
  }

  /* عدة مواقع في ملف واحد — كل موقع في صفحة عرضية: بياناته يميناً وخرائطه يساراً */
  function renderLandCards(p) {
    const blocks = (p.lands || []).map((x, i) => `
      <div class="land-block${i > 0 ? ' break-before' : ''}">
        <h2 class="land-sep">الموقع ${i + 1} من ${p.lands.length}: ${esc(x.land.name)}</h2>
        <div class="report-grid">
          <div class="col-data">${landCardBody(x.land, x.distances)}</div>
          ${mapsSection('-' + i)}
        </div>
      </div>`).join('');
    return `${header(p.title, 'تقرير متعدد المواقع — ' + p.lands.length + ' موقع')}${blocks}${footer()}${brandFooter()}`;
  }

  /* تقرير مسافات كامل */
  function renderDistances(p) {
    const hasRoute = (p.distances || []).some((d) => d.routeKm != null);
    const rows = (p.distances || []).map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(d.name)} ${rowHideBtn(d.name)}</td>
        <td>${esc(d.category)}</td>
        <td class="num">${d.km.toFixed(2)}</td>
        <td class="num">${fmt(d.km * 1000)}</td>
        <td>${esc(d.direction)}</td>
        ${hasRoute ? `<td class="num">${d.routeKm != null ? d.routeKm.toFixed(1) : '—'}</td><td>${d.routeMin != null ? fmtMin(d.routeMin) : '—'}</td>` : ''}
      </tr>`).join('');
    return `
      ${header(p.title, p.subtitle)}
      <div class="report-grid">
        <div class="col-data">
          ${p.land ? `
          <div class="stat-cards" style="grid-template-columns:repeat(3,1fr);margin-top:0">
            <div class="card"><b>${esc(p.land.name)}</b><span>الأرض المحللة</span></div>
            <div class="card"><b>${esc(p.land.parcelNo || '—')}</b><span>رقم القطعة</span></div>
            <div class="card"><b>${fmt(p.land.areaM2)}</b><span>المساحة (م²)</span></div>
          </div>` : ''}
          <h2>جدول المسافات (${(p.distances || []).length} معلماً — من الأقرب إلى الأبعد)</h2>
          <table>
            <thead><tr>
              <th>#</th><th>المعلم</th><th>النوع</th><th>المسافة (كم)</th><th>المسافة (م)</th><th>الاتجاه</th>
              ${hasRoute ? '<th>مسافة الطريق (كم)</th><th>زمن الوصول</th>' : ''}
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          ${footer()}
        </div>
        ${mapsSection()}
      </div>
      ${brandFooter()}`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const raw = sessionStorage.getItem('printPayload');
    if (!raw) return;
    let payload;
    try { payload = JSON.parse(raw); } catch (e) { return; }
    const sheet = document.getElementById('sheet');
    document.title = payload.title || document.title;
    if (payload.type === 'summary') {
      sheet.innerHTML = renderSummary(payload);
    } else if (payload.type === 'landCard') {
      sheet.innerHTML = renderLandCard(payload);
      initMaps(payload.land && payload.land.center, payload.geometry, payload.land && payload.land.name, payload.landmarks);
    } else if (payload.type === 'landCards') {
      sheet.innerHTML = renderLandCards(payload);
      (payload.lands || []).forEach((x, i) => {
        initMaps(x.land && x.land.center, x.geometry, x.land && x.land.name, payload.landmarks, '-' + i);
      });
    } else if (payload.type === 'distances') {
      sheet.innerHTML = renderDistances(payload);
      initMaps(payload.point, payload.geometry, payload.land ? payload.land.name : 'الموقع المحلل', payload.landmarks);
    }
    // شريط التحكم بخريطة الأساس وفلاتر المعالم (إن وُجدت خرائط في التقرير)
    setupMapControls();

    // إخفاء معلم من التقرير: إزالة صفه من كل الجداول وحذفه من كل خرائط التقرير
    sheet.addEventListener('click', (e) => {
      const btn = e.target.closest('.row-hide-btn');
      if (!btn) return;
      const name = btn.dataset.lmname;
      // إزالة كل الصفوف التي تحمل هذا المعلم (قد يتكرر في تقرير متعدد المواقع)
      sheet.querySelectorAll('.row-hide-btn').forEach((b) => {
        if (b.dataset.lmname === name) b.closest('tr').remove();
      });
      // حذفه من خرائط التقرير
      allLandmarks = allLandmarks.filter((lm) => lm.name !== name);
      refreshLandmarkLayers();
    });
  });
})();
