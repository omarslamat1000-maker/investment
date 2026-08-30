// مزوّد Supabase — اختياري، يُفعَّل فقط عند تعبئة supabaseUrl/supabaseAnonKey في config.local.js
// يستخدم واجهة REST (PostgREST) مباشرة بلا مكتبات خارجية، بنفس عقد idbProvider.
// المخطط المطابق موجود في ../../supabase/schema.sql

let cfg = { url: '', anonKey: '' };

export function configureSupabase({ supabaseUrl, supabaseAnonKey }) {
  cfg = { url: (supabaseUrl || '').replace(/\/$/, ''), anonKey: supabaseAnonKey || '' };
}

export function isSupabaseConfigured() {
  return Boolean(cfg.url && cfg.anonKey);
}

function headers(extra = {}) {
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${cfg.anonKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function request(path, options = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase غير مُهيأ — عبّئ supabaseUrl وsupabaseAnonKey في config.local.js');
  }
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, { ...options, headers: headers(options.headers) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// أسماء الجداول في Supabase snake_case بينما المخازن camelCase
function tableName(store) {
  return store.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export const supabaseProvider = {
  name: 'supabase',

  async getAll(store) {
    return request(`${tableName(store)}?select=*`);
  },

  async get(store, id) {
    const rows = await request(`${tableName(store)}?id=eq.${encodeURIComponent(id)}&select=*`);
    return rows[0] || undefined;
  },

  async put(store, record) {
    await request(tableName(store), {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(record)
    });
    return record;
  },

  async bulkPut(store, records) {
    if (!records.length) return records;
    await request(tableName(store), {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(records)
    });
    return records;
  },

  async remove(store, id) {
    return request(`${tableName(store)}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async clear(store) {
    return request(`${tableName(store)}?id=neq.__none__`, { method: 'DELETE' });
  },

  async count(store) {
    const rows = await request(`${tableName(store)}?select=id`);
    return rows.length;
  },

  async byIndex(store, indexName, value) {
    const col = tableName(indexName);
    return request(`${tableName(store)}?${col}=eq.${encodeURIComponent(value)}&select=*`);
  }
};
