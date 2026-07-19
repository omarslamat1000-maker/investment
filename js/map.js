/**
 * map.js — تهيئة خريطة Leaflet وأدواتها المشتركة بين الصفحات
 * - خرائط أساس متعددة (شوارع، أقمار صناعية، فاتحة، داكنة)
 * - عرض الأراضي بألوان التصنيف على Canvas لأداء عالٍ مع 1000+ قطعة
 * - طبقة المعالم مع أيقونات وفئات قابلة للإظهار/الإخفاء
 * - أدوات: قياس مسافة/مساحة، رسم، بحث جغرافي، موقعي، ملء الشاشة، لقطة، طباعة
 */
(function () {
  'use strict';

  const MEDINA_CENTER = [24.4672, 39.6111];

  const BASEMAPS = {
    streets: {
      name: 'خريطة الشوارع',
      layer: () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap', crossOrigin: true,
      }),
    },
    satellite: {
      name: 'صور الأقمار الصناعية',
      layer: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: '&copy; Esri', crossOrigin: true,
      }),
    },
    light: {
      name: 'خريطة فاتحة',
      layer: () => L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20, attribution: '&copy; CARTO', crossOrigin: true,
      }),
    },
    dark: {
      name: 'خريطة داكنة',
      layer: () => L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20, attribution: '&copy; CARTO', crossOrigin: true,
      }),
    },
  };

  function createMap(elId, opts = {}) {
    const map = L.map(elId, {
      center: opts.center || MEDINA_CENTER,
      zoom: opts.zoom || 12,
      zoomControl: false,
      preferCanvas: true, // أداء أفضل مع آلاف المضلعات
    });
    L.control.zoom({ position: 'topleft' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    let currentBasemapKey = opts.basemap || 'streets';
    let baseLayer = BASEMAPS[currentBasemapKey].layer().addTo(map);

    function setBasemap(key) {
      if (!BASEMAPS[key]) return;
      map.removeLayer(baseLayer);
      baseLayer = BASEMAPS[key].layer().addTo(map);
      currentBasemapKey = key;
    }

    /* ============ طبقة الأراضي ============ */
    const landsLayer = L.geoJSON(null, {
      style: (f) => landStyle(f),
      onEachFeature: (feature, layer) => {
        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (api.onLandClick) api.onLandClick(feature, e);
        });
      },
    }).addTo(map);

    let selectedSet = new Set();
    let highlightId = null;

    function landStyle(feature) {
      const m = LandManager.state.metrics[feature.id];
      const colors = LandManager.state.settings.catColors;
      const color = m ? colors[m.sizeCat] : '#888';
      const isSelected = selectedSet.has(feature.id);
      const isHighlight = highlightId === feature.id;
      return {
        color: isHighlight ? '#0ea5e9' : isSelected ? '#111827' : color,
        weight: isHighlight ? 3 : isSelected ? 2.5 : 1,
        fillColor: color,
        fillOpacity: isHighlight ? 0.65 : isSelected ? 0.55 : 0.35,
      };
    }

    /** إعادة عرض الأراضي (بعد فلترة أو تغيير ألوان) */
    function renderLands(features) {
      landsLayer.clearLayers();
      landsLayer.addData({ type: 'FeatureCollection', features });
    }

    function refreshLandStyles() {
      landsLayer.setStyle((f) => landStyle(f));
    }

    function setSelectedIds(ids) { selectedSet = ids instanceof Set ? ids : new Set(ids); refreshLandStyles(); }
    function setHighlight(id) { highlightId = id; refreshLandStyles(); }

    function zoomToLand(id) {
      let target = null;
      landsLayer.eachLayer((l) => { if (l.feature && l.feature.id === id) target = l; });
      if (target) map.fitBounds(target.getBounds(), { maxZoom: 17, padding: [30, 30] });
    }

    function fitAllLands() {
      const b = landsLayer.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });
    }

    /* ============ طبقة المعالم ============ */
    const landmarksGroup = L.layerGroup().addTo(map);

    function landmarkIcon(lm) {
      const cat = Landmarks.CATEGORIES[lm.category] || Landmarks.CATEGORIES.user;
      const color = lm.color || cat.color;
      return L.divIcon({
        className: 'landmark-marker',
        html: '<div class="lm-pin" style="background:' + color + '"><i class="fa-solid ' + (lm.icon || cat.icon) + '"></i></div>' +
              '<div class="lm-label">' + lm.name + '</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
    }

    /**
     * عرض المعالم — الحلقية (الطرق الدائرية) تعرض كدوائر متقطعة
     * options: {draggable, onClick, onDrag, hiddenCats}
     */
    function renderLandmarks(options = {}) {
      landmarksGroup.clearLayers();
      const hidden = options.hiddenCats || [];
      Landmarks.getAll({ includeHidden: false }).forEach((lm) => {
        if (hidden.includes(lm.category)) return;
        const cat0 = Landmarks.CATEGORIES[lm.category] || Landmarks.CATEGORIES.user;
        // معلم خطي (طريق) أو مضلع (مشروع) — يرسم بمساره الفعلي
        if (lm.path && lm.path.length >= 2) {
          const style = { color: lm.color || cat0.color, weight: lm.geomType === 'polygon' ? 2.5 : 4, opacity: 0.9 };
          const layer = lm.geomType === 'polygon' && lm.path.length >= 3
            ? L.polygon(lm.path, { ...style, fillColor: lm.color || cat0.color, fillOpacity: 0.22 })
            : L.polyline(lm.path, style);
          layer.bindTooltip(lm.name, { sticky: true, direction: 'top' });
          layer.on('click', (e) => { L.DomEvent.stopPropagation(e); if (options.onClick) options.onClick(lm, e); });
          landmarksGroup.addLayer(layer);
          return;
        }
        if (lm.ring && lm.ring.radiusKm) {
          const cat = Landmarks.CATEGORIES[lm.category] || Landmarks.CATEGORIES.road;
          const circle = L.circle([lm.lat, lm.lng], {
            radius: lm.ring.radiusKm * 1000,
            color: lm.color || cat.color,
            weight: 2.5,
            dashArray: '8 6',
            fill: false,
            interactive: true,
          });
          circle.bindTooltip(lm.name, { sticky: true, direction: 'top' });
          circle.on('click', (e) => { L.DomEvent.stopPropagation(e); if (options.onClick) options.onClick(lm, e); });
          landmarksGroup.addLayer(circle);
        } else {
          const marker = L.marker([lm.lat, lm.lng], {
            icon: landmarkIcon(lm),
            draggable: !!options.draggable,
          });
          marker.on('click', (e) => { L.DomEvent.stopPropagation(e); if (options.onClick) options.onClick(lm, e); });
          if (options.draggable && options.onDrag) {
            marker.on('dragend', () => {
              const p = marker.getLatLng();
              options.onDrag(lm, p.lat, p.lng);
            });
          }
          landmarksGroup.addLayer(marker);
        }
      });
    }

    function setLandmarksVisible(visible) {
      if (visible) map.addLayer(landmarksGroup);
      else map.removeLayer(landmarksGroup);
    }

    /* ============ أدوات القياس والرسم ============ */
    const measureGroup = L.layerGroup().addTo(map);
    let measureMode = null; // 'distance' | 'area' | 'point' | 'line' | 'polygon' | 'pick'
    let measurePts = [];
    let tempLine = null;
    let measureTooltip = null;

    function startMeasure(mode) {
      stopMeasure();
      measureMode = mode;
      measurePts = [];
      map.getContainer().style.cursor = 'crosshair';
      map.on('click', onMeasureClick);
      map.on('dblclick', finishMeasure);
      map.doubleClickZoom.disable();
    }

    function stopMeasure() {
      measureMode = null;
      measurePts = [];
      if (tempLine) { measureGroup.removeLayer(tempLine); tempLine = null; }
      map.getContainer().style.cursor = '';
      map.off('click', onMeasureClick);
      map.off('dblclick', finishMeasure);
      map.doubleClickZoom.enable();
    }

    function clearMeasurements() { measureGroup.clearLayers(); stopMeasure(); }

    function onMeasureClick(e) {
      if (!measureMode) return;
      const ll = e.latlng;

      if (measureMode === 'pick') {
        // اختيار موقع واحد (لتحليل الموقع أو إضافة معلم)
        stopMeasure();
        if (api.onPick) api.onPick(ll.lat, ll.lng);
        return;
      }
      if (measureMode === 'point') {
        L.circleMarker(ll, { radius: 6, color: '#0e7a4f', fillOpacity: 0.9 }).addTo(measureGroup);
        stopMeasure();
        return;
      }

      measurePts.push([ll.lng, ll.lat]);
      L.circleMarker(ll, { radius: 4, color: '#0e7a4f', fillOpacity: 1 }).addTo(measureGroup);

      if (measurePts.length >= 2) {
        if (tempLine) measureGroup.removeLayer(tempLine);
        const latlngs = measurePts.map((c) => [c[1], c[0]]);
        if (measureMode === 'area' || measureMode === 'polygon') {
          tempLine = L.polygon(latlngs, { color: '#0e7a4f', weight: 2, fillOpacity: 0.15 }).addTo(measureGroup);
        } else {
          tempLine = L.polyline(latlngs, { color: '#0e7a4f', weight: 3, dashArray: '6 4' }).addTo(measureGroup);
        }
        // عرض القياس الجاري
        let label = '';
        if (measureMode === 'distance' || measureMode === 'line') {
          const line = turf.lineString(measurePts);
          label = 'المسافة: ' + DistanceAnalysis.fmtKm(turf.length(line, { units: 'kilometers' }));
        } else if (measurePts.length >= 3) {
          const ring = measurePts.concat([measurePts[0]]);
          const poly = turf.polygon([ring]);
          const a = turf.area(poly);
          label = 'المساحة: ' + Math.round(a).toLocaleString('en-US') + ' م²';
        }
        if (label) {
          tempLine.bindTooltip(label + '<br><small>انقر نقراً مزدوجاً للإنهاء</small>', { permanent: true, direction: 'top' }).openTooltip();
        }
      }
    }

    function finishMeasure(e) {
      if (e) L.DomEvent.stop(e);
      const mode = measureMode;
      const pts = measurePts.slice();
      // تثبيت الشكل النهائي
      if (tempLine) {
        tempLine.unbindTooltip();
        let label = '';
        if ((mode === 'distance' || mode === 'line') && pts.length >= 2) {
          label = 'المسافة: ' + DistanceAnalysis.fmtKm(turf.length(turf.lineString(pts), { units: 'kilometers' }));
        } else if ((mode === 'area' || mode === 'polygon') && pts.length >= 3) {
          const a = turf.area(turf.polygon([pts.concat([pts[0]])]));
          label = 'المساحة: ' + Math.round(a).toLocaleString('en-US') + ' م² (' + (a / 10000).toFixed(2) + ' هكتار)';
        }
        if (label) tempLine.bindTooltip(label, { permanent: true, direction: 'top' }).openTooltip();
        tempLine = null; // يبقى على الخريطة
      }
      stopMeasure();
    }

    /* ============ رسم مسار يُرجع النقاط (لإضافة طريق أو مشروع) ============ */
    const pathTemp = L.layerGroup().addTo(map);
    let pathKind = null;   // 'line' | 'polygon'
    let pathPts = [];      // [[lat,lng],...]
    let pathDone = null;
    let pathShape = null;

    /**
     * بدء رسم مسار على الخريطة: نقر لإضافة نقطة، نقر مزدوج للإنهاء
     * onFinish(points) تستقبل [[lat,lng],...]
     */
    function startPath(kind, onFinish) {
      stopMeasure();
      stopPath();
      pathKind = kind;
      pathPts = [];
      pathDone = onFinish;
      map.getContainer().style.cursor = 'crosshair';
      map.on('click', onPathClick);
      map.on('dblclick', finishPath);
      map.doubleClickZoom.disable();
    }

    function onPathClick(e) {
      pathPts.push([e.latlng.lat, e.latlng.lng]);
      L.circleMarker(e.latlng, { radius: 5, color: '#be123c', fillOpacity: 1 }).addTo(pathTemp);
      if (pathPts.length >= 2) {
        if (pathShape) pathTemp.removeLayer(pathShape);
        pathShape = pathKind === 'polygon'
          ? L.polygon(pathPts, { color: '#be123c', weight: 2, fillOpacity: 0.15, dashArray: '6 4' })
          : L.polyline(pathPts, { color: '#be123c', weight: 3, dashArray: '6 4' });
        pathShape.addTo(pathTemp);
        pathShape.bindTooltip('النقاط: ' + pathPts.length + '<br><small>نقر مزدوج للإنهاء</small>', { permanent: true, direction: 'top' }).openTooltip();
      }
    }

    function finishPath(e) {
      if (e) L.DomEvent.stop(e);
      const pts = pathPts.slice();
      const cb = pathDone;
      stopPath();
      if (cb) cb(pts);
    }

    function stopPath() {
      pathKind = null;
      pathPts = [];
      pathDone = null;
      pathShape = null;
      pathTemp.clearLayers();
      map.getContainer().style.cursor = '';
      map.off('click', onPathClick);
      map.off('dblclick', finishPath);
      map.doubleClickZoom.enable();
    }

    /* ============ البحث الجغرافي (Nominatim) ============ */
    async function geocode(query) {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=ar' +
        '&viewbox=39.35,24.65,39.85,24.25&bounded=0&q=' + encodeURIComponent(query);
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('فشل البحث');
      return res.json();
    }

    /* ============ تحديد الموقع الحالي ============ */
    let locateMarker = null;
    function locateMe(onError) {
      if (!navigator.geolocation) { if (onError) onError('المتصفح لا يدعم تحديد الموقع'); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const ll = [pos.coords.latitude, pos.coords.longitude];
          if (locateMarker) map.removeLayer(locateMarker);
          locateMarker = L.circleMarker(ll, { radius: 8, color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.8 })
            .addTo(map).bindPopup('موقعك الحالي').openPopup();
          map.setView(ll, 15);
        },
        (err) => { if (onError) onError('تعذر تحديد الموقع: ' + err.message); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    /* ============ ملء الشاشة ============ */
    function toggleFullscreen() {
      const el = document.getElementById(elId).closest('.map-wrap') || document.getElementById(elId);
      if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
      else document.exitFullscreen();
      setTimeout(() => map.invalidateSize(), 400);
    }

    /* ============ لقطة للخريطة ============ */
    let screenshoter = null;
    function screenshot() {
      // المكتبة تصدّر الدالة المصنعية L.simpleMapScreenshoter
      if (typeof L.simpleMapScreenshoter !== 'function') {
        alert('أداة اللقطات غير متاحة — تحقق من الاتصال بالإنترنت');
        return;
      }
      if (!screenshoter) screenshoter = L.simpleMapScreenshoter({ hidden: true }).addTo(map);
      screenshoter.takeScreen('blob').then((blob) => {
        ExportUtils.downloadBlob(blob, 'خريطة-الأراضي-' + new Date().toISOString().slice(0, 10) + '.png');
      }).catch(() => alert('تعذر التقاط الصورة'));
    }

    /* ============ طبقة مسار (لخدمة التوجيه) ============ */
    const routeGroup = L.layerGroup().addTo(map);
    function showRoute(geojsonLine, popupText) {
      routeGroup.clearLayers();
      const line = L.geoJSON(geojsonLine, { style: { color: '#1d4ed8', weight: 5, opacity: 0.8 } });
      routeGroup.addLayer(line);
      if (popupText) line.bindTooltip(popupText, { permanent: true, direction: 'top' }).openTooltip();
      map.fitBounds(line.getBounds(), { padding: [40, 40] });
    }
    function clearRoute() { routeGroup.clearLayers(); }

    const api = {
      map,
      BASEMAPS,
      setBasemap,
      getBasemapKey: () => currentBasemapKey,
      landsLayer,
      renderLands,
      refreshLandStyles,
      setSelectedIds,
      setHighlight,
      zoomToLand,
      fitAllLands,
      renderLandmarks,
      setLandmarksVisible,
      startMeasure,
      stopMeasure,
      clearMeasurements,
      startPath,
      stopPath,
      geocode,
      locateMe,
      toggleFullscreen,
      screenshot,
      showRoute,
      clearRoute,
      onLandClick: null, // تحددها الصفحة
      onPick: null,      // عند اختيار موقع من الخريطة
    };
    return api;
  }

  window.MapFactory = { createMap, MEDINA_CENTER, BASEMAPS };
})();
