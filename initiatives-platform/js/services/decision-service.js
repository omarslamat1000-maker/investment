// خدمة قرارات البوابات بسلسلة اعتماد متسلسلة — الإنشاء، التوقيع، واكتمال السلسلة ينقل حال المبادرة
import { repos } from '../data/repositories.js';
import { dataProvider } from '../data/data-provider.js';
import { buildDecision, signDecision, sanitizeChains, isFinal, nextStep, roleLabel, DEFAULT_CHAINS } from '../domain/approval-chain.js';
import { statusLabel } from '../domain/workflow.js';
import { notify } from './notification-service.js';
import { nowIso } from '../core/date-time.js';

const CHAINS_ID = 'approval-chains';

export async function getChains() {
  try {
    const saved = await dataProvider.get('settings', CHAINS_ID);
    return sanitizeChains(saved?.chains || {});
  } catch { return sanitizeChains({}); }
}

export async function saveChains(chains) {
  const clean = sanitizeChains(chains);
  await dataProvider.put('settings', { id: CHAINS_ID, chains: clean, updatedAt: nowIso() });
  return clean;
}

export function defaultChains() { return sanitizeChains(DEFAULT_CHAINS); }

// إنشاء قرار بوابة: يوقّع المنشئ خطوته، وإن اكتملت السلسلة يُنفَّذ الانتقال فورًا
export async function createGateDecision({ initiative, gateId = null, outcome = 'pass', rationale, to, session }) {
  const chains = await getChains();
  const draft = buildDecision({
    initiativeId: initiative.id, gateId, outcome, rationale, to,
    by: session?.name || '', byRole: session?.role || '', chains, now: nowIso()
  });
  const saved = await repos.decisions.create(draft);
  if (isFinal(saved)) {
    await finalize(saved, initiative);
    return { decision: saved, transitioned: true };
  }
  const step = nextStep(saved);
  await notify('قرار بوابة بانتظار التوقيع',
    `${saved.id} — «${initiative.title}»: ${step ? 'بانتظار توقيع ' + roleLabel(step.role) : ''}`, 'info');
  return { decision: saved, transitioned: false };
}

// توقيع خطوة من سلسلة قرار — عند اكتمالها يُنفَّذ الانتقال
export async function signGateDecision(decisionId, session) {
  const decision = await repos.decisions.get(decisionId);
  if (!decision) throw new Error('القرار غير موجود');
  const next = signDecision(decision, { role: session.role, name: session.name, now: nowIso() });
  const saved = await repos.decisions.update(decisionId, next);
  if (isFinal(saved)) {
    const initiative = await repos.initiatives.get(saved.initiativeId);
    if (initiative && initiative.status !== saved.to) await finalize(saved, initiative);
    return { decision: saved, transitioned: true };
  }
  const step = nextStep(saved);
  await notify('توقيع على قرار بوابة', `${saved.id} — وقّع ${session.name}؛ الخطوة التالية: ${step ? roleLabel(step.role) : '—'}`, 'info');
  return { decision: saved, transitioned: false };
}

export async function cancelGateDecision(decisionId, by = '') {
  return repos.decisions.update(decisionId, { status: 'cancelled', cancelledAt: nowIso(), cancelledBy: by });
}

async function finalize(decision, initiative) {
  const lastSigner = [...decision.approvals].reverse().find((a) => a.signedBy)?.signedBy || decision.by;
  await repos.initiatives.transition(initiative.id, decision.to, { reason: decision.rationale, by: lastSigner, decisionId: decision.id });
  await notify(decision.gateId ? `قرار بوابة ${decision.gateId} مكتمل` : 'قرار مكتمل',
    `«${initiative.title}» — ${statusLabel(decision.to)} (${decision.id})`, 'info');
}

// القرار المعلق الحالي لمبادرة (إن وجد)
export async function pendingDecisionFor(initiativeId) {
  const list = await repos.decisions.byInitiative(initiativeId).catch(() => []);
  return list.find((d) => d.status === 'pending') || null;
}
