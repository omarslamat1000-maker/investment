/**
 * distance-analysis.js — حساب المسافات والاتجاهات وتحليل الموقع
 * - المسافة المباشرة (خط مستقيم) عبر Turf.js
 * - دعم المعالم الحلقية (الطرق الدائرية) بنموذج مركز + نصف قطر
 * - الاتجاه الجغرافي بالعربية
 * - مسافة الطريق الفعلية وزمن الوصول عبر خدمة OSRM العامة عند توفر الإنترنت
 */
(function () {
  'use strict';

  const ARABIC_DIRECTIONS = [
    'شمال', 'شمال شرق', 'شرق', 'جنوب شرق',
    'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب',
  ];

  // الاتجاه بالعربية من زاوية (درجات)
  function bearingToArabic(bearing) {
    const b = ((bearing % 360) + 360) % 360;
    const idx = Math.round(b / 45) % 8;
    return ARABIC_DIRECTIONS[idx];
  }

  /**
   * المسافة بالمتر من نقطة إلى معلم
   * landmark: {lat, lng, ring?, geomType?, path?}
   * - نقطة: مسافة مباشرة
   * - حلقة (طريق دائري): |المسافة للمركز − نصف القطر|
   * - خط (طريق): أقرب نقطة على الخط
   * - مضلع (مشروع): صفر إن كانت النقطة داخله، وإلا أقرب نقطة على حدوده
   */
  function distanceToLandmark(fromLngLat, landmark) {
    const from = turf.point(fromLngLat);
    const center = turf.point([landmark.lng, landmark.lat]);
    const dKm = turf.distance(from, center, { units: 'kilometers' });
    let distKm = dKm;

    if (landmark.path && landmark.path.length >= 2) {
      const coords = landmark.path.map((p) => [p[1], p[0]]); // [lng,lat]
      try {
        if (landmark.geomType === 'polygon' && landmark.path.length >= 3) {
          const ring = coords.concat([coords[0]]);
          if (turf.booleanPointInPolygon(from, turf.polygon([ring]))) {
            distKm = 0;
          } else {
            distKm = turf.pointToLineDistance(from, turf.lineString(ring), { units: 'kilometers' });
          }
        } else {
          distKm = turf.pointToLineDistance(from, turf.lineString(coords), { units: 'kilometers' });
        }
      } catch (e) {
        /* مسار غير صالح — نبقي مسافة المركز */
      }
    } else if (landmark.ring && landmark.ring.radiusKm) {
      distKm = Math.abs(dKm - landmark.ring.radiusKm);
    }

    const bearing = turf.bearing(from, center);
    return {
      km: distKm,
      meters: distKm * 1000,
      bearing: bearing,
      direction: bearingToArabic(bearing),
    };
  }

  /**
   * تحليل كامل: مسافات نقطة لقائمة معالم مرتبة من الأقرب للأبعد
   */
  function analyzePoint(lngLat, landmarks) {
    return landmarks
      .map((lm) => {
        const d = distanceToLandmark(lngLat, lm);
        return { landmark: lm, ...d };
      })
      .sort((a, b) => a.km - b.km);
  }

  // أقرب معلم من كل فئة
  function nearestPerCategory(results) {
    const seen = {};
    const out = [];
    for (const r of results) {
      const cat = r.landmark.category;
      if (!seen[cat]) {
        seen[cat] = true;
        out.push(r);
      }
    }
    return out;
  }

  /**
   * مسافة الطريق الفعلية وزمن الوصول بالسيارة عبر OSRM (يتطلب إنترنت)
   * ترجع {km, minutes, geometry} أو null عند الفشل
   */
  async function routeDistance(fromLngLat, toLngLat) {
    const url =
      'https://router.project-osrm.org/route/v1/driving/' +
      fromLngLat[0] + ',' + fromLngLat[1] + ';' +
      toLngLat[0] + ',' + toLngLat[1] +
      '?overview=full&geometries=geojson';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes || !data.routes.length) return null;
      const route = data.routes[0];
      return {
        km: route.distance / 1000,
        minutes: route.duration / 60,
        geometry: route.geometry, // GeoJSON LineString
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * مركز قطعة أرض (نقطة داخل المضلع)
   */
  function landCenter(feature) {
    try {
      const c = turf.pointOnFeature(feature);
      return c.geometry.coordinates;
    } catch (e) {
      const c = turf.centroid(feature);
      return c.geometry.coordinates;
    }
  }

  // مساحة قطعة بالمتر المربع ومحيطها بالمتر
  function landMetrics(feature) {
    let areaM2 = 0;
    let perimeterM = 0;
    try {
      areaM2 = turf.area(feature);
      perimeterM = turf.length(feature, { units: 'kilometers' }) * 1000;
    } catch (e) {
      /* شكل غير صالح */
    }
    return { areaM2, perimeterM };
  }

  // تنسيق مسافة للعرض
  function fmtKm(km) {
    return km >= 1 ? km.toFixed(1) + ' كم' : Math.round(km * 1000) + ' م';
  }

  function fmtMinutes(min) {
    if (min < 60) return Math.round(min) + ' دقيقة';
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h + ' ساعة' + (m ? ' و ' + m + ' دقيقة' : '');
  }

  window.DistanceAnalysis = {
    distanceToLandmark,
    analyzePoint,
    nearestPerCategory,
    routeDistance,
    landCenter,
    landMetrics,
    bearingToArabic,
    fmtKm,
    fmtMinutes,
  };
})();
