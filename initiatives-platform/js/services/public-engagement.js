// تفاعل الجمهور مع المبادرات — تأييد (مرة لكل متصفح) وتعليقات موجزة تُراجع قبل النشر
// تُخزَّن في مخزن comments بحقل kind: 'support' | 'comment'
import { repos } from '../data/repositories.js';
import { uid } from '../core/utils.js';
import { nowIso } from '../core/date-time.js';
import { STORAGE_PREFIX } from '../core/constants.js';

const SUPPORT_KEY = STORAGE_PREFIX + 'supported';

function supportedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(SUPPORT_KEY) || '[]')); } catch { return new Set(); }
}
export function hasSupported(initiativeId) { return supportedSet().has(initiativeId); }

export async function engagementFor(initiativeId) {
  const all = await repos.comments.byInitiative(initiativeId).catch(() => []);
  return {
    supports: all.filter((c) => c.kind === 'support').length,
    approved: all.filter((c) => c.kind === 'comment' && c.status === 'approved'),
    pending: all.filter((c) => c.kind === 'comment' && c.status === 'pending'),
    all
  };
}

export async function supportInitiative(initiativeId) {
  const set = supportedSet();
  if (set.has(initiativeId)) throw new Error('سبق أن أيّدت هذه المبادرة من هذا الجهاز');
  await repos.comments.create({ id: uid('sup'), initiativeId, kind: 'support', at: nowIso() });
  set.add(initiativeId);
  try { localStorage.setItem(SUPPORT_KEY, JSON.stringify([...set])); } catch { /* محظور */ }
}

export async function submitPublicComment(initiativeId, { name = '', text = '' }) {
  const clean = String(text || '').trim();
  if (clean.length < 5) throw new Error('اكتب تعليقًا من 5 أحرف على الأقل');
  if (clean.length > 400) throw new Error('التعليق طويل — الحد 400 حرف');
  return repos.comments.create({
    id: uid('cmt'), initiativeId, kind: 'comment', status: 'pending',
    name: String(name || '').trim().slice(0, 60) || 'مواطن', text: clean, at: nowIso()
  });
}

export async function moderateComment(id, approve) {
  return approve ? repos.comments.update(id, { status: 'approved', moderatedAt: nowIso() }) : repos.comments.remove(id);
}

// إحصاء التأييد لكل مبادرة (للجداول والصفحات العامة)
export async function supportCounts() {
  const all = await repos.comments.getAll().catch(() => []);
  const out = {};
  for (const c of all) if (c.kind === 'support') out[c.initiativeId] = (out[c.initiativeId] || 0) + 1;
  return out;
}
