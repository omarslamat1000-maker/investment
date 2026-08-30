// إعدادات منصة مبادرات البنية التحتية والشراكات المجتمعية — نسخة مثال
// انسخ هذا الملف إلى config.local.js لتخصيص الإعدادات محليًا (config.local.js خارج المستودع).
export const APP_CONFIG = {
  appName: 'منصة مبادرات البنية التحتية والشراكات المجتمعية',
  entityName: 'أمانة منطقة المدينة المنورة',
  appVersion: '1.0.0',
  basePath: './',
  storageMode: 'indexeddb', // 'indexeddb' أو 'supabase'
  databaseName: 'madinah-initiatives-platform-db',
  serviceWorkerScope: './',
  timeZone: 'Asia/Riyadh',
  locale: 'ar-SA',
  supabaseUrl: '',
  supabaseAnonKey: ''
};
