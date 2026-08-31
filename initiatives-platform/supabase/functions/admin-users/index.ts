// admin-users — عمليات إدارة الحسابات التي تتطلب service_role
// تُنفذ على الخادم فقط؛ المستدعي يجب أن يكون admin نشطًا (يُتحقق من JWT + جدول profiles)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function tempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const buf = new Uint8Array(14);
  crypto.getRandomValues(buf);
  for (const b of buf) out += chars[b % chars.length];
  return out + 'Aa1';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST فقط' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // التحقق من هوية المستدعي ودوره
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  const { data: caller, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !caller?.user) return json({ error: 'غير مصرح' }, 401);

  const { data: profile } = await admin
    .from('profiles')
    .select('role,is_active')
    .eq('id', caller.user.id)
    .single();
  if (!profile || !profile.is_active || profile.role !== 'admin') {
    return json({ error: 'هذه العملية لمدير النظام فقط' }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'جسم الطلب غير صالح' }, 400); }
  const action = String(body.action ?? '');

  try {
    if (action === 'create_user') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'بريد غير صالح' }, 400);
      const role = String(body.role ?? 'agency_user');
      if (!['admin', 'supervisor', 'agency_user'].includes(role)) return json({ error: 'دور غير معروف' }, 400);
      const pw = tempPassword();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: pw,
        email_confirm: true,
        user_metadata: {
          full_name: String(body.full_name ?? ''),
          role,
          organization_code: body.organization_code ?? null,
          must_change_password: true,
        },
      });
      if (error) return json({ error: error.message }, 400);
      // كلمة المرور المؤقتة تُعرض لمدير النظام مرة واحدة لتسليمها للمستخدم
      return json({ ok: true, user_id: data.user?.id, temp_password: pw });
    }

    if (action === 'invite') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: String(body.full_name ?? ''),
          role: String(body.role ?? 'agency_user'),
          organization_code: body.organization_code ?? null,
          must_change_password: false,
        },
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, user_id: data.user?.id, invited: true });
    }

    if (action === 'set_active') {
      const userId = String(body.user_id ?? '');
      const isActive = Boolean(body.is_active);
      const { error } = await admin.from('profiles').update({ is_active: isActive }).eq('id', userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'reset_password') {
      const userId = String(body.user_id ?? '');
      const pw = tempPassword();
      const { error } = await admin.auth.admin.updateUserById(userId, { password: pw });
      if (error) return json({ error: error.message }, 400);
      await admin.from('profiles').update({ must_change_password: true }).eq('id', userId);
      return json({ ok: true, temp_password: pw });
    }

    if (action === 'update_profile') {
      const userId = String(body.user_id ?? '');
      const patch: Record<string, unknown> = {};
      if (typeof body.full_name === 'string') patch.full_name = body.full_name;
      if (typeof body.role === 'string' && ['admin', 'supervisor', 'agency_user'].includes(String(body.role))) patch.role = body.role;
      if (body.organization_id !== undefined) patch.organization_id = body.organization_id;
      if (body.overrides !== undefined) patch.overrides = body.overrides;
      const { error } = await admin.from('profiles').update(patch).eq('id', userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'عملية غير معروفة' }, 400);
  } catch (err) {
    return json({ error: String((err as Error).message ?? err) }, 500);
  }
});
