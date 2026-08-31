// فحص أمان السحابة — طلبات REST مباشرة إلى Supabase للتحقق من RLS ودورة العمل
// الاستخدام (بلا أسرار في المستودع):
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... PW_ADMIN=... PW_SUPERVISOR=... PW_ROADS=... PW_PARKS=... node tools/cloud-check.mjs
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
if (!URL_ || !KEY) { console.error('يلزم SUPABASE_URL وSUPABASE_ANON_KEY'); process.exit(2); }

const ACCOUNTS = {
  admin: ['admin@amanah.example', process.env.PW_ADMIN],
  supervisor: ['supervisor@amanah.example', process.env.PW_SUPERVISOR],
  roads: ['roads@amanah.example', process.env.PW_ROADS],
  parks: ['parks@amanah.example', process.env.PW_PARKS]
};

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`OK   ${name}`); }
  else { fail++; console.error(`FAIL ${name} ${extra}`); }
};

async function login(who) {
  const [email, password] = ACCOUNTS[who];
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`فشل دخول ${who}: ${JSON.stringify(data).slice(0, 200)}`);
  return data.access_token;
}

function rest(token) {
  return async (path, { method = 'GET', body, headers = {} } = {}) => {
    const res = await fetch(`${URL_}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* نص */ }
    return { status: res.status, json, text };
  };
}

const t = {};
for (const who of Object.keys(ACCOUNTS)) t[who] = rest(await login(who));
console.log('سُجل الدخول للحسابات الأربعة\n');

// بيانات مرجعية
const orgs = (await t.admin('organizations?select=id,code')).json;
const ROADS = orgs.find((o) => o.code === 'ROADS').id;
const PARKS = orgs.find((o) => o.code === 'PARKS').id;
const profiles = (await t.admin('profiles?select=id,role')).json;
const roadsUid = (await t.roads('profiles?select=id')).json[0].id;
const parksUid = (await t.parks('profiles?select=id')).json[0].id;
const supervisorUid = profiles.find((p) => p.role === 'supervisor').id;

// 1) الطرق تنشئ مسودة
const created = await t.roads('initiatives', {
  method: 'POST',
  body: { organization_id: ROADS, created_by: roadsUid, title: 'اختبار أمان — مبادرة طرق', summary: 'مبادرة اختبار للفصل بين الجهات', category: 'safety', district: 'العزيزية' }
});
ok('الطرق: إنشاء مسودة', created.status === 201, created.text.slice(0, 120));
const ini = created.json?.[0];
ok('الترقيم التلقائي INIT-YYYY-NNNN', /^INIT-\d{4}-\d{4}$/.test(ini?.initiative_number || ''), ini?.initiative_number);

// 2) الحدائق لا ترى مبادرة الطرق
const parksView = await t.parks(`initiatives?id=eq.${ini.id}&select=id`);
ok('الحدائق لا ترى مبادرة الطرق (طلب مباشر)', parksView.json?.length === 0);

// 3) الحدائق لا تستطيع تعديلها
const parksEdit = await t.parks(`initiatives?id=eq.${ini.id}`, { method: 'PATCH', body: { title: 'اختراق' } });
ok('الحدائق لا تعدل مبادرة الطرق', (parksEdit.json?.length ?? 0) === 0);

// 4) الطرق لا تغير الجهة المالكة
const orgChange = await t.roads(`initiatives?id=eq.${ini.id}`, { method: 'PATCH', body: { organization_id: PARKS } });
ok('منع تغيير الجهة المالكة', orgChange.status >= 400, orgChange.text.slice(0, 100));

// 5) الطرق لا تغير الحالة مباشرة (فقط عبر الدالة)
const directStatus = await t.roads(`initiatives?id=eq.${ini.id}`, { method: 'PATCH', body: { current_status: 'approved' } });
ok('منع تغيير الحالة مباشرة', directStatus.status >= 400, directStatus.text.slice(0, 100));

// 6) الطرق تقدّم للمراجعة عبر الدالة
const submit = await t.roads('rpc/change_initiative_status', { method: 'POST', body: { p_initiative: ini.id, p_new_status: 'submitted' } });
ok('الطرق: تقديم للمراجعة', submit.status === 200 && submit.json?.current_status === 'submitted', submit.text.slice(0, 120));

// 7) بعد التقديم: الجهة لا تعدل ولا تحذف
const postSubmitEdit = await t.roads(`initiatives?id=eq.${ini.id}`, { method: 'PATCH', body: { title: 'تعديل بعد التقديم' } });
ok('منع تعديل الجهة بعد التقديم', (postSubmitEdit.json?.length ?? 0) === 0);
const del = await t.roads(`initiatives?id=eq.${ini.id}`, { method: 'DELETE' });
ok('منع الحذف بعد التقديم', del.status >= 400 || (del.json?.length ?? 0) === 0, del.text.slice(0, 100));

// 8) الجهة لا تعتمد مبادرتها
const selfApprove = await t.roads('rpc/change_initiative_status', { method: 'POST', body: { p_initiative: ini.id, p_new_status: 'under_review' } });
ok('الجهة لا تحرك المراجعة', selfApprove.status >= 400);

// 9) المشرف: مراجعة ثم إعادة بلا سبب (مرفوضة) ثم بسبب (مقبولة)
await t.supervisor('rpc/change_initiative_status', { method: 'POST', body: { p_initiative: ini.id, p_new_status: 'under_review' } });
const noReason = await t.supervisor('rpc/change_initiative_status', { method: 'POST', body: { p_initiative: ini.id, p_new_status: 'returned' } });
ok('الإعادة بلا سبب مرفوضة', noReason.status >= 400);
const returned = await t.supervisor('rpc/change_initiative_status', { method: 'POST', body: { p_initiative: ini.id, p_new_status: 'returned', p_reason: 'استكمال بيانات الموقع والتكلفة' } });
ok('المشرف: إعادة للاستكمال بسبب', returned.status === 200 && returned.json?.current_status === 'returned');

// 10) أثناء الإعادة: الجهة تعدل ثم تعيد الإرسال
const editReturned = await t.roads(`initiatives?id=eq.${ini.id}`, { method: 'PATCH', body: { summary: 'استُكملت بيانات الموقع والتكلفة التقديرية للمبادرة' } });
ok('الجهة تعدل المبادرة المعادة', editReturned.json?.length === 1);
const resubmit = await t.roads('rpc/change_initiative_status', { method: 'POST', body: { p_initiative: ini.id, p_new_status: 'resubmitted' } });
ok('الجهة: إعادة الإرسال', resubmit.status === 200 && resubmit.json?.current_status === 'resubmitted');

// 11) المشرف يقبل مبدئيًا؛ الاعتماد للمدير فقط
await t.supervisor('rpc/change_initiative_status', { method: 'POST', body: { p_initiative: ini.id, p_new_status: 'under_review' } });
const initAccept = await t.supervisor('rpc/change_initiative_status', { method: 'POST', body: { p_initiative: ini.id, p_new_status: 'initially_accepted' } });
ok('المشرف: قبول مبدئي', initAccept.status === 200);
const supApprove = await t.supervisor('rpc/change_initiative_status', { method: 'POST', body: { p_initiative: ini.id, p_new_status: 'approved' } });
ok('الاعتماد ممنوع على المشرف', supApprove.status >= 400);
const adminApprove = await t.admin('rpc/change_initiative_status', { method: 'POST', body: { p_initiative: ini.id, p_new_status: 'approved' } });
ok('المدير: اعتماد', adminApprove.status === 200 && adminApprove.json?.current_status === 'approved');

// 12) تجاوز التسلسل ممنوع
const skip = await t.admin('rpc/change_initiative_status', { method: 'POST', body: { p_initiative: ini.id, p_new_status: 'completed' } });
ok('منع تجاوز تسلسل الحالات', skip.status >= 400);

// 13) المشرف يحدّث المرحلة ونسبة الإنجاز ويعين مشرفًا
await t.admin('rpc/change_initiative_status', { method: 'POST', body: { p_initiative: ini.id, p_new_status: 'planning' } });
const progress = await t.supervisor(`initiatives?id=eq.${ini.id}`, { method: 'PATCH', body: { current_stage: 'التخطيط التفصيلي', progress_percentage: 25, assigned_supervisor_id: supervisorUid } });
ok('المشرف: تحديث المرحلة والنسبة وتعيين المشرف', progress.json?.length === 1);

// 14) الملاحظات الداخلية محجوبة عن الجهة
await t.supervisor('initiative_comments', { method: 'POST', body: { initiative_id: ini.id, user_id: supervisorUid, comment: 'ملاحظة داخلية للإشراف فقط', is_internal: true } });
await t.supervisor('initiative_comments', { method: 'POST', body: { initiative_id: ini.id, user_id: supervisorUid, comment: 'يرجى تزويدنا بجدول زمني محدث', is_internal: false } });
const roadsComments = await t.roads(`initiative_comments?initiative_id=eq.${ini.id}&select=comment,is_internal`);
ok('الجهة ترى الملاحظات العامة فقط', roadsComments.json?.length === 1 && roadsComments.json[0].is_internal === false, JSON.stringify(roadsComments.json));
const agencyInternal = await t.roads('initiative_comments', { method: 'POST', body: { initiative_id: ini.id, user_id: roadsUid, comment: 'محاولة داخلية', is_internal: true } });
ok('الجهة لا تكتب ملاحظات داخلية', agencyInternal.status >= 400);

// 15) سجل الحالات مكتمل وغير قابل للكتابة من الواجهة
const history = await t.roads(`initiative_status_history?initiative_id=eq.${ini.id}&select=new_status,reason&order=created_at`);
ok('سجل الحالات يشمل كل الانتقالات مع الأسباب', history.json?.length >= 6 && history.json.some((h) => h.reason));
const forgeHistory = await t.roads('initiative_status_history', { method: 'POST', body: { initiative_id: ini.id, new_status: 'approved', action: 'forge' } });
ok('سجل الحالات غير قابل للتزوير', forgeHistory.status >= 400);

// 16) الإشعارات وصلت للجهة
const notifs = await t.roads('notifications?select=title&order=created_at.desc&limit=5');
ok('إشعارات تغير الحالة وصلت للجهة', (notifs.json?.length ?? 0) >= 1);

// 17) سجل التدقيق للمدير فقط
const auditRoads = await t.roads('audit_logs?select=id&limit=1');
ok('سجل التدقيق محجوب عن الجهة', auditRoads.json?.length === 0);
const auditAdmin = await t.admin('audit_logs?select=id&limit=1');
ok('سجل التدقيق متاح للمدير', auditAdmin.json?.length === 1);

// 18) الحدائق تنشئ مبادرتها والطرق لا تراها
const parksIni = await t.parks('initiatives', { method: 'POST', body: { organization_id: PARKS, created_by: parksUid, title: 'اختبار أمان — مبادرة حدائق', summary: 'مبادرة اختبار للفصل العكسي بين الجهات', category: 'parks', district: 'النخيل' } });
ok('الحدائق: إنشاء مسودة', parksIni.status === 201);
const roadsSeesParks = await t.roads(`initiatives?id=eq.${parksIni.json?.[0]?.id}&select=id`);
ok('الطرق لا ترى مبادرة الحدائق', roadsSeesParks.json?.length === 0);

// 19) غير المسجل لا يصل للبيانات
const anon = await fetch(`${URL_}/rest/v1/initiatives?select=id`, { headers: { apikey: KEY } });
const anonRows = await anon.json();
ok('غير المسجل لا يرى المبادرات', Array.isArray(anonRows) && anonRows.length === 0);

// 20) المشرف يرى مبادرات الجهتين
const supAll = await t.supervisor('initiatives?select=id,organization_id');
const supOrgs = new Set((supAll.json || []).map((r) => r.organization_id));
ok('المشرف يرى مبادرات كل الجهات', supOrgs.has(ROADS) && supOrgs.has(PARKS));

console.log(`\nالنتيجة: ${pass} ناجح / ${fail} فاشل`);
process.exit(fail ? 1 : 0);
