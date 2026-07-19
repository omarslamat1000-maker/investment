/**
 * storage.js — طبقة الحفظ المحلي باستخدام IndexedDB
 * تحفظ: بيانات الأراضي المستوردة، تعديلات المستخدم، الأقسام، المعالم،
 * الإعدادات، ونتائج التحليل — مع فصل البيانات الأصلية عن التعديلات.
 */
(function () {
  'use strict';

  const DB_NAME = 'medina-lands-db';
  const DB_VERSION = 1;
  const STORE = 'kv';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function get(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function set(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function remove(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const keysReq = store.getAllKeys();
      const valsReq = store.getAll();
      tx.oncomplete = () => {
        const out = {};
        keysReq.result.forEach((k, i) => (out[k] = valsReq.result[i]));
        resolve(out);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clearAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ==== المفاتيح المعتمدة ====
   * dataset            : GeoJSON الأراضي المستوردة (الأصل، لا يُعدّل)
   * datasetMeta        : {fileName, importedAt, count}
   * edits              : {landId: {customName, notes, description, status, priority, savedAnalysis}}
   * sections           : [{id, name, color, createdAt, items:[{landId, customName}]}]
   * userLandmarks      : [معالم المستخدم]
   * landmarkOverrides  : {builtinId: {name, icon, category, lat, lng, description, hidden}}
   * settings           : {theme, basemap, catColors:{small,medium,large}, hiddenLandmarkCats:[]}
   */

  // حفظ مؤجل (debounce) لتجنب الكتابة المتكررة
  const timers = {};
  const pendingWrites = {}; // الكتابات المؤجلة المعلقة — تُفرَّغ عند إغلاق الصفحة
  function setDebounced(key, valueFn, delay = 400) {
    clearTimeout(timers[key]);
    pendingWrites[key] = valueFn;
    timers[key] = setTimeout(() => {
      delete pendingWrites[key];
      Promise.resolve(typeof valueFn === 'function' ? valueFn() : valueFn)
        .then((v) => set(key, v))
        .catch((e) => console.error('storage set failed:', key, e));
    }, delay);
  }

  // صمام أمان: عند إغلاق/مغادرة الصفحة تُنفَّذ فوراً أي كتابات مؤجلة لم تكتمل
  function flushPending() {
    Object.entries(pendingWrites).forEach(([key, valueFn]) => {
      clearTimeout(timers[key]);
      delete pendingWrites[key];
      try {
        const v = typeof valueFn === 'function' ? valueFn() : valueFn;
        set(key, v).catch(() => {});
      } catch (e) { /* تجاهل — أفضل جهد عند الإغلاق */ }
    });
  }
  window.addEventListener('beforeunload', flushPending);
  // pagehide أكثر موثوقية على الجوال والأجهزة اللوحية
  window.addEventListener('pagehide', flushPending);

  // نسخة احتياطية كاملة / استعادة
  async function exportBackup() {
    const all = await getAll();
    return {
      app: 'medina-lands',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: all,
    };
  }

  async function importBackup(backup) {
    if (!backup || backup.app !== 'medina-lands' || !backup.data) {
      throw new Error('ملف النسخة الاحتياطية غير صالح');
    }
    await clearAll();
    for (const [k, v] of Object.entries(backup.data)) {
      await set(k, v);
    }
  }

  window.Storage2 = { get, set, remove, getAll, clearAll, setDebounced, exportBackup, importBackup };
})();
