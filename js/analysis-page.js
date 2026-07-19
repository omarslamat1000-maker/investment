/**
 * analysis-page.js — صفحة تحليل الموقع والمسافات
 * تحديد موقع (قطعة/نقرة/إحداثيات/بحث) ثم حساب المسافات لجميع المعالم
 * مع الاتجاه الجغرافي والترتيب من الأقرب، ومسافة الطريق عبر OSRM اختيارياً
 */
(function () {
  'use strict';

  let mapApi = null;
  let currentPoint = null;        // [lng, lat]
  let currentLandId = null;       // إن كان الموقع قطعة أرض
  /* قائمة الطباعة المتعددة: عناصر {landId} لقطع الأراضي أو {name, point} لمواقع الخريطة */
  let printList = [];
  let currentResults = [];        // نتائج التحليل الحالية
  /* الفئات النشطة تُشتق من الإعداد المشترك المحفوظ (hiddenLandmarkCats)
   * فتبقى موحّدة مع صفحتي الخريطة وإدارة المعالم */
  let activeCats = new Set(Object.keys(Landmarks.CATEGORIES));
  let pointMarker = null;

  /** قراءة الفئات النشطة من الإعدادات المشتركة */
  function loadActiveCats() {
    const hidden = LandManager.state.settings.hiddenLandmarkCats || [];
    activeCats = new Set(Object.keys(Landmarks.CATEGORIES).filter((k) => !hidden.includes(k)));
  }

  /** حفظ الفئات المخفية في الإعدادات المشتركة وبثها لبقية الصفحات */
  function saveActiveCats() {
    LandManager.state.settings.hiddenLandmarkCats =
      Object.keys(Landmarks.CATEGORIES).filter((k) => !activeCats.has(k));
    LandManager.persistSettings();
  }

  /** إعادة رسم طبقة المعالم على خريطة التحليل وفق الفلاتر الحالية */
  function renderLandmarksLayer() {
    mapApi.renderLandmarks({
      hiddenCats: LandManager.state.settings.hiddenLandmarkCats || [],
      onClick: (lm) => UI.toast(lm.name, 'warn'),
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await UI.initTheme();
    UI.showProgress('جارٍ تحميل البيانات...');
    await LandManager.init((d, t) => UI.updateProgress(d, t));
    UI.hideProgress();

    mapApi = MapFactory.createMap('map', { basemap: LandManager.state.settings.basemap });
    mapApi.renderLands(LandManager.state.features);
    loadActiveCats();
    renderLandmarksLayer();
    mapApi.fitAllLands();

    mapApi.onLandClick = (feature) => setLocationFromLand(feature.id);
    mapApi.onPick = (lat, lng) => setLocation([lng, lat], null, 'موقع محدد من الخريطة');

    buildLandSelect();
    buildCatChips();
    wirePanel();

    // مزامنة فورية: تعديلات المعالم تنعكس على الخريطة وتعاد التحليلات الجارية
    Landmarks.onChanged(() => {
      renderLandmarksLayer();
      buildCatChips();
      if (currentPoint) runAnalysis();
    });
    // مزامنة فلاتر الفئات القادمة من صفحة الخريطة أو إدارة المعالم
    LandManager.onSettingsChanged(() => {
      loadActiveCats();
      buildCatChips();
      renderLandmarksLayer();
      if (currentPoint) runAnalysis();
    });

    // فتح قطعة من رابط ?land=ID
    const params = new URLSearchParams(location.search);
    const landId = params.get('land');
    if (landId && LandManager.getFeature(landId)) setLocationFromLand(landId);
  }

  function buildLandSelect() {
    const sel = document.getElementById('landSelect');
    const frag = document.createDocumentFragment();
    LandManager.state.features.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.id;
      const m = LandManager.state.metrics[f.id];
      opt.textContent = LandManager.displayName(f.id) + (m ? ' — ' + UI.fmtNum(m.areaM2) + ' م²' : '');
      frag.appendChild(opt);
    });
    sel.appendChild(frag);
    sel.onchange = () => { if (sel.value) setLocationFromLand(sel.value); };
  }

  function buildCatChips() {
    const wrap = document.getElementById('catChips');
    wrap.innerHTML = '';
    Object.entries(Landmarks.CATEGORIES).forEach(([key, cat]) => {
      const chip = document.createElement('span');
      chip.className = 'chip' + (activeCats.has(key) ? ' active' : '');
      chip.innerHTML = '<i class="fa-solid ' + cat.icon + '"></i> ' + cat.name;
      chip.onclick = () => {
        chip.classList.toggle('active');
        if (activeCats.has(key)) activeCats.delete(key);
        else activeCats.add(key);
        saveActiveCats();          // يُحفظ ويُبث لبقية الصفحات
        renderLandmarksLayer();    // الخريطة تتفاعل فوراً
        if (currentPoint) runAnalysis();
      };
      wrap.appendChild(chip);
    });
  }

  function wirePanel() {
    document.getElementById('btnPickMap').onclick = () => {
      mapApi.startMeasure('pick');
      UI.toast('انقر على أي موقع في الخريطة', 'warn');
    };
    document.getElementById('btnPickLand').onclick = () => {
      UI.toast('انقر على أي قطعة أرض في الخريطة', 'warn');
    };
    document.getElementById('btnAnalyzeCoords').onclick = () => {
      const lat = parseFloat(document.getElementById('inpLat').value);
      const lng = parseFloat(document.getElementById('inpLng').value);
      if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return UI.toast('الرجاء إدخال إحداثيات صحيحة', 'error');
      }
      setLocation([lng, lat], null, 'إحداثيات مدخلة يدوياً');
    };

    // البحث عن عنوان
    const doPlaceSearch = async () => {
      const q = document.getElementById('searchPlace').value.trim();
      if (!q) return;
      const results = document.getElementById('placeResults');
      results.innerHTML = '<div class="result">جارٍ البحث...</div>';
      results.classList.add('open');
      try {
        const geo = await mapApi.geocode(q);
        results.innerHTML = '';
        if (!geo.length) results.innerHTML = '<div class="result">لا توجد نتائج</div>';
        geo.forEach((g) => {
          const div = document.createElement('div');
          div.className = 'result';
          div.textContent = g.display_name;
          div.onclick = () => {
            results.classList.remove('open');
            setLocation([parseFloat(g.lon), parseFloat(g.lat)], null, g.display_name.split(',')[0]);
          };
          results.appendChild(div);
        });
      } catch (e) {
        results.innerHTML = '<div class="result">فشل البحث — تحقق من الإنترنت</div>';
      }
    };
    document.getElementById('btnSearchPlace').onclick = doPlaceSearch;
    document.getElementById('searchPlace').addEventListener('keydown', (e) => { if (e.key === 'Enter') doPlaceSearch(); });

    document.getElementById('chkNearestPerCat').onchange = () => { if (currentPoint) runAnalysis(); };
    document.getElementById('chkRouting').onchange = () => { if (currentPoint) runAnalysis(); };
    document.getElementById('resLimit').oninput = () => { if (currentPoint) runAnalysis(); };
    // تصدير خريطة التحليل كصورة PNG
    document.getElementById('btnMapImage').onclick = () => mapApi.screenshot();

    document.getElementById('btnExportExcel').onclick = exportExcel;
    document.getElementById('btnExportPDF').onclick = exportPDF;
    document.getElementById('btnSaveAnalysis').onclick = saveToLand;

    /* قائمة الطباعة المتعددة */
    document.getElementById('btnAddToPrintList').onclick = addCurrentToPrintList;
    document.getElementById('btnPrintAll').onclick = printAllSites;
    document.getElementById('btnClearPrintList').onclick = () => { printList = []; renderPrintList(); };
  }

  /* ========== قائمة طباعة عدة مواقع في ملف واحد ========== */
  function addCurrentToPrintList() {
    if (!currentPoint) return UI.toast('حدد موقعاً أولاً', 'warn');
    if (currentLandId) {
      if (printList.some((it) => it.landId === currentLandId)) return UI.toast('القطعة موجودة في القائمة', 'warn');
      printList.push({ landId: currentLandId });
    } else {
      const name = 'موقع (' + currentPoint[1].toFixed(5) + ', ' + currentPoint[0].toFixed(5) + ')';
      if (printList.some((it) => it.name === name)) return UI.toast('الموقع موجود في القائمة', 'warn');
      printList.push({ name, point: [...currentPoint] });
    }
    renderPrintList();
    UI.toast('أُضيف الموقع إلى قائمة الطباعة (' + printList.length + ')');
  }

  function renderPrintList() {
    const section = document.getElementById('printListSection');
    const box = document.getElementById('printListItems');
    section.style.display = printList.length ? 'block' : 'none';
    document.getElementById('printListCount').textContent = '(' + printList.length + ')';
    box.innerHTML = '';
    printList.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      const label = it.landId ? LandManager.displayName(it.landId) : it.name;
      row.innerHTML = `<span>${i + 1}. ${UI.escapeHtml(label)}</span>
        <button class="icon-btn danger" title="إزالة"><i class="fa-solid fa-xmark"></i></button>`;
      row.querySelector('button').onclick = () => { printList.splice(i, 1); renderPrintList(); };
      box.appendChild(row);
    });
  }

  /** بطاقة طباعة لموقع من الخريطة (بلا بيانات قطعة) */
  function pointCardData(item) {
    // تُطبَّق فلاتر الفئات وحد عدد المعالم نفسها على بطاقة الطباعة
    const lms = Landmarks.getAll({ includeHidden: false }).filter((lm) => activeCats.has(lm.category));
    let results = DistanceAnalysis.analyzePoint(item.point, lms);
    const limit = parseInt(document.getElementById('resLimit').value, 10);
    results = results.slice(0, isFinite(limit) && limit > 0 ? limit : 12);
    return {
      geometry: null,
      land: { name: item.name, center: item.point },
      distances: results.map((r) => ({
        name: r.landmark.name,
        category: (Landmarks.CATEGORIES[r.landmark.category] || {}).name || '',
        km: r.km,
        direction: r.direction,
      })),
    };
  }

  function printAllSites() {
    if (!printList.length) return UI.toast('قائمة الطباعة فارغة', 'warn');
    const lands = printList
      .map((it) => (it.landId ? ExportUtils.buildLandCardData(it.landId) : pointCardData(it)))
      .filter(Boolean);
    if (lands.length === 1) {
      ExportUtils.openPrintPage({ type: 'landCard', title: 'بطاقة موقع: ' + lands[0].land.name, ...lands[0] });
      return;
    }
    ExportUtils.openPrintPage({
      type: 'landCards',
      title: 'تقرير تحليل مواقع متعددة (' + lands.length + ' موقع)',
      lands,
    });
  }

  function setLocationFromLand(landId) {
    const m = LandManager.state.metrics[landId];
    if (!m || !m.center) return;
    currentLandId = landId;
    document.getElementById('landSelect').value = landId;
    mapApi.zoomToLand(landId);
    mapApi.setHighlight(landId);
    setLocation(m.center, landId, LandManager.displayName(landId));
  }

  function setLocation(lngLat, landId, label) {
    currentPoint = lngLat;
    currentLandId = landId || null;
    if (!landId) mapApi.setHighlight(null);

    // علامة الموقع المحدد
    if (pointMarker) mapApi.map.removeLayer(pointMarker);
    pointMarker = L.marker([lngLat[1], lngLat[0]], {
      icon: L.divIcon({
        className: 'landmark-marker',
        html: '<div class="lm-pin" style="background:#be123c"><i class="fa-solid fa-crosshairs"></i></div><div class="lm-label">' + UI.escapeHtml(label || 'الموقع المحدد') + '</div>',
        iconSize: [34, 34], iconAnchor: [17, 17],
      }),
    }).addTo(mapApi.map);

    document.getElementById('inpLat').value = lngLat[1].toFixed(6);
    document.getElementById('inpLng').value = lngLat[0].toFixed(6);
    document.getElementById('btnSaveAnalysis').style.display = landId ? 'inline-flex' : 'none';
    runAnalysis();
  }

  async function runAnalysis() {
    if (!currentPoint) return;
    const landmarks = Landmarks.getAll({ includeHidden: false }).filter((lm) => activeCats.has(lm.category));
    let results = DistanceAnalysis.analyzePoint(currentPoint, landmarks);
    if (document.getElementById('chkNearestPerCat').checked) {
      results = DistanceAnalysis.nearestPerCategory(results);
    }
    // حد عدد المعالم في جدول النتائج — ينعكس أيضاً على التصدير والطباعة
    const limit = parseInt(document.getElementById('resLimit').value, 10);
    if (isFinite(limit) && limit > 0) results = results.slice(0, limit);
    currentResults = results;
    renderResults(results);

    // مسافات الطريق عبر OSRM (تباعاً حتى لا نغرق الخدمة)
    if (document.getElementById('chkRouting').checked) {
      for (let i = 0; i < Math.min(results.length, 10); i++) {
        const r = results[i];
        if (r.landmark.ring) continue; // الطرق الدائرية لا تحتاج توجيهاً
        const route = await DistanceAnalysis.routeDistance(currentPoint, [r.landmark.lng, r.landmark.lat]);
        if (route) {
          r.route = route;
          updateRouteCell(i, r);
        }
      }
    }
  }

  function renderResults(results) {
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('resultsPoint').textContent =
      '(' + currentPoint[1].toFixed(5) + ', ' + currentPoint[0].toFixed(5) + ')';
    const tbody = document.querySelector('#resultsTable tbody');
    tbody.innerHTML = '';
    results.forEach((r, i) => {
      const cat = Landmarks.CATEGORIES[r.landmark.category] || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${UI.escapeHtml(r.landmark.name)}</td>
        <td style="font-size:11.5px;color:var(--text-2)">${cat.name || ''}</td>
        <td class="num" id="dist-${i}">
          <b>${r.km.toFixed(2)} كم</b><br><small>${UI.fmtNum(r.meters)} م</small>
        </td>
        <td>${r.direction}</td>
        <td style="white-space:nowrap">
          <button class="icon-btn" title="إظهار المسار على الخريطة" data-idx="${i}"><i class="fa-solid fa-route"></i></button>
          <button class="icon-btn" title="إخفاء المعلم من كل الجداول والخريطة والطباعة" data-hide="${i}"><i class="fa-solid fa-eye-slash"></i></button>
        </td>
      `;
      tr.querySelector('[data-idx]').onclick = () => showRouteFor(i);
      // إخفاء المعلم كلياً: يختفي من هذا الجدول والخريطة وكل الصفحات والطباعة (يُستعاد من صفحة إدارة المعالم)
      tr.querySelector('[data-hide]').onclick = () => {
        Landmarks.update(r.landmark.id, { visible: false });
        UI.toast('أُخفي «' + r.landmark.name + '» من كل الجداول والخريطة والطباعة — يمكن استعادته من صفحة إدارة المعالم', 'warn', 4500);
        renderLandmarksLayer();
        runAnalysis();
      };
      tbody.appendChild(tr);
    });
    UI.toast('تم حساب المسافات لـ ' + results.length + ' معلماً');
  }

  function updateRouteCell(i, r) {
    const cell = document.getElementById('dist-' + i);
    if (!cell || !r.route) return;
    cell.innerHTML = `
      <b>${r.km.toFixed(2)} كم</b> <small>مباشر</small><br>
      <span style="color:var(--info)"><i class="fa-solid fa-car" style="font-size:10px"></i> ${r.route.km.toFixed(1)} كم — ${DistanceAnalysis.fmtMinutes(r.route.minutes)}</span>
    `;
  }

  async function showRouteFor(i) {
    const r = currentResults[i];
    if (!r) return;
    if (r.landmark.ring) {
      // للطرق الدائرية: خط مستقيم لأقرب نقطة تقريبية
      mapApi.map.setView([r.landmark.lat, r.landmark.lng], 12);
      UI.toast('الطرق الدائرية تظهر كحلقات على الخريطة', 'warn');
      return;
    }
    UI.toast('جارٍ حساب المسار...', 'warn');
    let route = r.route || (await DistanceAnalysis.routeDistance(currentPoint, [r.landmark.lng, r.landmark.lat]));
    if (route) {
      r.route = route;
      updateRouteCell(i, r);
      mapApi.showRoute(route.geometry, r.landmark.name + ': ' + route.km.toFixed(1) + ' كم — ' + DistanceAnalysis.fmtMinutes(route.minutes));
    } else {
      // بدون إنترنت: خط مستقيم
      const line = { type: 'LineString', coordinates: [currentPoint, [r.landmark.lng, r.landmark.lat]] };
      mapApi.showRoute(line, r.landmark.name + ': ' + r.km.toFixed(2) + ' كم (خط مستقيم)');
      UI.toast('خدمة المسارات غير متاحة — تم عرض الخط المستقيم', 'warn');
    }
  }

  function resultsToRows() {
    return currentResults.map((r, i) => ({
      '#': i + 1,
      'المعلم': r.landmark.name,
      'النوع': (Landmarks.CATEGORIES[r.landmark.category] || {}).name || '',
      'المسافة (كم)': +r.km.toFixed(2),
      'المسافة (م)': Math.round(r.meters),
      'الاتجاه': r.direction,
      'مسافة الطريق (كم)': r.route ? +r.route.km.toFixed(1) : '',
      'زمن الوصول': r.route ? DistanceAnalysis.fmtMinutes(r.route.minutes) : '',
    }));
  }

  function exportExcel() {
    if (!currentResults.length) return UI.toast('لا توجد نتائج للتصدير', 'warn');
    ExportUtils.toExcel(resultsToRows(), 'تقرير-المسافات.xlsx', 'المسافات');
  }

  function exportPDF() {
    if (!currentResults.length) return UI.toast('لا توجد نتائج للتصدير', 'warn');
    ExportUtils.openPrintPage({
      type: 'distances',
      title: 'تقرير تحليل الموقع والمسافات',
      subtitle: currentLandId
        ? 'الموقع: ' + LandManager.displayName(currentLandId)
        : 'الموقع: ' + currentPoint[1].toFixed(6) + ', ' + currentPoint[0].toFixed(6),
      point: currentPoint,
      geometry: currentLandId ? (LandManager.getFeature(currentLandId) || {}).geometry : null,
      land: currentLandId ? {
        name: LandManager.displayName(currentLandId),
        areaM2: (LandManager.state.metrics[currentLandId] || {}).areaM2,
        parcelNo: LandManager.getProp(LandManager.getFeature(currentLandId), 'parcelNo'),
      } : null,
      distances: currentResults.map((r) => ({
        name: r.landmark.name,
        category: (Landmarks.CATEGORIES[r.landmark.category] || {}).name || '',
        km: r.km,
        direction: r.direction,
        routeKm: r.route ? r.route.km : null,
        routeMin: r.route ? r.route.minutes : null,
      })),
    });
  }

  function saveToLand() {
    if (!currentLandId || !currentResults.length) return;
    LandManager.setEdit(currentLandId, {
      savedAnalysis: {
        at: new Date().toISOString(),
        results: currentResults.slice(0, 15).map((r) => ({
          name: r.landmark.name, km: +r.km.toFixed(2), direction: r.direction,
        })),
      },
    });
    UI.toast('تم حفظ نتيجة التحليل ضمن بيانات الأرض');
  }
})();
