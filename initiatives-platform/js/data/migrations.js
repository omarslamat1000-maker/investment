// ترحيلات قاعدة البيانات — كل إصدار دالة تبني ما استجد من مخازن وفهارس
// عند رفع DB_VERSION أضف مدخلًا جديدًا هنا ولا تعدّل الترحيلات السابقة.
import { OBJECT_STORES } from '../core/constants.js';

export const MIGRATIONS = [
  {
    version: 1,
    describe: 'الإنشاء الأولي لجميع المخازن والفهارس الأساسية',
    run(db) {
      for (const name of OBJECT_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          if (name === 'initiatives') {
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('category', 'category', { unique: false });
            store.createIndex('district', 'district', { unique: false });
          }
          if (name === 'infrastructureNeeds') {
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('district', 'district', { unique: false });
          }
          if (name === 'auditLogs') store.createIndex('at', 'at', { unique: false });
          if (name === 'notifications') store.createIndex('at', 'at', { unique: false });
          if (['reviews', 'decisions', 'gateChecklists', 'kpis', 'benefits', 'risks',
            'milestones', 'deliverables', 'qualityChecks', 'changeRequests',
            'comments', 'attachments', 'initiativePartners',
            'progressReports', 'agreements'].includes(name)) {
            store.createIndex('initiativeId', 'initiativeId', { unique: false });
          }
          if (name === 'needApplications') store.createIndex('needId', 'needId', { unique: false });
        }
      }
    }
  },
  {
    version: 2,
    describe: 'مخزن المحافظ portfolios لتجميع المبادرات والحملات تحت هدف واحد',
    run(db) {
      if (!db.objectStoreNames.contains('portfolios')) {
        db.createObjectStore('portfolios', { keyPath: 'id' });
      }
    }
  },
  {
    version: 3,
    describe: 'مخزن معرض صور المبادرات gallery للصفحة الرئيسية',
    run(db) {
      if (!db.objectStoreNames.contains('gallery')) {
        db.createObjectStore('gallery', { keyPath: 'id' });
      }
    }
  },
  {
    version: 4,
    describe: 'طلبات تقديم الشركاء على الفرص المطروحة needApplications',
    run(db) {
      if (!db.objectStoreNames.contains('needApplications')) {
        const store = db.createObjectStore('needApplications', { keyPath: 'id' });
        store.createIndex('needId', 'needId', { unique: false });
      }
    }
  },
  {
    version: 5,
    describe: 'تقارير التقدم الميدانية من الشركاء progressReports واتفاقيات الشراكة الرقمية agreements',
    run(db) {
      for (const name of ['progressReports', 'agreements']) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          store.createIndex('initiativeId', 'initiativeId', { unique: false });
        }
      }
    }
  },
  {
    version: 6,
    describe: 'ضمان فهرس initiativeId على المخازن التي أُنشئت في الترحيل الأول دون فهرس (تصحيح)',
    run(db, tx) {
      for (const name of ['progressReports', 'agreements']) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          store.createIndex('initiativeId', 'initiativeId', { unique: false });
          continue;
        }
        const store = tx?.objectStore(name);
        if (store && !store.indexNames.contains('initiativeId')) {
          store.createIndex('initiativeId', 'initiativeId', { unique: false });
        }
      }
      const apps = db.objectStoreNames.contains('needApplications') ? tx?.objectStore('needApplications') : null;
      if (apps && !apps.indexNames.contains('needId')) apps.createIndex('needId', 'needId', { unique: false });
    }
  }
];

// تُستدعى من onupgradeneeded: تنفّذ الترحيلات من oldVersion+1 حتى الإصدار الحالي
// tx: معاملة versionchange — تتيح تعديل مخازن قائمة (إضافة فهارس)
export function runMigrations(db, oldVersion, tx = null) {
  for (const m of MIGRATIONS) {
    if (m.version > oldVersion) m.run(db, tx);
  }
}
