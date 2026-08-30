// مزوّد IndexedDB — قاعدة مستقلة تمامًا: madinah-initiatives-platform-db
import { DB_NAME, DB_VERSION } from '../core/constants.js';
import { runMigrations } from './migrations.js';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => runMigrations(req.result, e.oldVersion);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn('قاعدة بيانات المنصة محجوزة من تبويب آخر بإصدار أقدم');
  });
  return dbPromise;
}

function tx(db, store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const idbProvider = {
  name: 'indexeddb',

  async getAll(store) {
    const db = await openDb();
    return promisify(tx(db, store).getAll());
  },

  async get(store, id) {
    const db = await openDb();
    return promisify(tx(db, store).get(id));
  },

  async put(store, record) {
    const db = await openDb();
    await promisify(tx(db, store, 'readwrite').put(record));
    return record;
  },

  async bulkPut(store, records) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      const os = t.objectStore(store);
      for (const r of records) os.put(r);
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
    return records;
  },

  async remove(store, id) {
    const db = await openDb();
    return promisify(tx(db, store, 'readwrite').delete(id));
  },

  async clear(store) {
    const db = await openDb();
    return promisify(tx(db, store, 'readwrite').clear());
  },

  async count(store) {
    const db = await openDb();
    return promisify(tx(db, store).count());
  },

  async byIndex(store, indexName, value) {
    const db = await openDb();
    return promisify(tx(db, store).index(indexName).getAll(value));
  }
};
