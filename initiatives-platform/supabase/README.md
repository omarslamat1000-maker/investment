# تفعيل Supabase (اختياري)

المنصة تعمل افتراضيًا بقاعدة IndexedDB محلية ولا تحتاج أي خادم.
لتشغيلها على Supabase كمخزن مشترك بين المستخدمين:

## الخطوات

1. أنشئ مشروع Supabase جديدًا.
2. نفّذ `schema.sql` في SQL Editor (ينشئ 23 جدولًا مطابقة لمخازن المنصة).
3. نفّذ `rls.sql` لتفعيل سياسات أمان الصفوف — راجعها وعدّلها حسب نموذج الأدوار لديك قبل أي استخدام فعلي.
4. (اختياري) نفّذ `seed.sql` لبذور توضيحية مختصرة.
5. انسخ `js/config.example.js` إلى `js/config.local.js` وعبّئ:

```js
export const APP_CONFIG = {
  // …بقية الإعدادات كما هي
  storageMode: 'supabase',
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR-ANON-KEY'
};
```

6. عدّل استيراد الإعدادات في الصفحات من `config.example.js` إلى `config.local.js`
   (أو أبقِ النسختين وبدّل وقت البناء).

## تحذيرات

- **لا ترفع `config.local.js` إلى المستودع** — مضاف إلى `.gitignore`.
- مفتاح `anon` عام بطبيعته لكنه محكوم بسياسات RLS — لا تمنح `anon` أكثر من
  قراءة المنشور والتقديم العام كما في `rls.sql`.
- المزوّد في `js/data/supabase-provider.js` يستخدم REST (PostgREST) مباشرة بلا مكتبات،
  وأسماء الجداول snake_case مقابل مخازن camelCase محليًا.
