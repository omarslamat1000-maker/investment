// حسابات جغرافية — أطوال المسارات ومساحات المضلعات على سطح الأرض
// الإحداثيات دائمًا أزواج [lat, lng] بالدرجات
import { fmtNumber, round } from './utils.js';

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

// مسافة هافرساين بين نقطتين بالمتر
export function haversineMeters([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

// طول مسار (خط متعدد النقاط) بالمتر
export function pathLengthMeters(coords = []) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(coords[i - 1], coords[i]);
  }
  return round(total, 1);
}

// مساحة مضلع بالمتر المربع — صيغة المساحة الكروية (مرجع: Chamberlain & Duquette, NASA JPL)
export function polygonAreaM2(coords = []) {
  if (coords.length < 3) return 0;
  const ring = [...coords];
  // أغلق الحلقة إن لم تكن مغلقة
  const [f, l] = [ring[0], ring[ring.length - 1]];
  if (f[0] !== l[0] || f[1] !== l[1]) ring.push(f);
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lat1, lng1] = ring[i];
    const [lat2, lng2] = ring[i + 1];
    sum += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return round(Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2), 1);
}

// قياسات هندسة الموقع: { type: 'point'|'line'|'polygon', coords: [[lat,lng],...] }
export function measureGeometry(geometry) {
  if (!geometry || !Array.isArray(geometry.coords) || !geometry.coords.length) return null;
  if (geometry.type === 'line') {
    return { lengthM: pathLengthMeters(geometry.coords), areaM2: null };
  }
  if (geometry.type === 'polygon') {
    return {
      lengthM: pathLengthMeters([...geometry.coords, geometry.coords[0]]),
      areaM2: polygonAreaM2(geometry.coords)
    };
  }
  return { lengthM: null, areaM2: null }; // نقطة
}

// نص وصفي عربي للقياس بالأرقام الموحدة
export function measureLabel(geometry) {
  const m = measureGeometry(geometry);
  if (!m) return '';
  if (geometry.type === 'point') {
    const [lat, lng] = geometry.coords[0];
    return `نقطة (${round(lat, 5)}, ${round(lng, 5)})`;
  }
  if (geometry.type === 'line') {
    return m.lengthM >= 1000
      ? `مسار بطول ${fmtNumber(round(m.lengthM / 1000, 2))} كم`
      : `مسار بطول ${fmtNumber(m.lengthM)} م`;
  }
  const area = m.areaM2 >= 1_000_000
    ? `${fmtNumber(round(m.areaM2 / 1_000_000, 2))} كم²`
    : `${fmtNumber(round(m.areaM2))} م²`;
  return `نطاق بمساحة ${area}`;
}

// مركز الهندسة (لعرضها على خريطة المنصة)
export function geometryCenter(geometry) {
  if (!geometry?.coords?.length) return null;
  const lat = geometry.coords.reduce((a, c) => a + c[0], 0) / geometry.coords.length;
  const lng = geometry.coords.reduce((a, c) => a + c[1], 0) / geometry.coords.length;
  return { lat, lng };
}
