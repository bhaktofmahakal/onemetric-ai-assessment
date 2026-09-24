import { randomUUID } from 'node:crypto';
import type { IntentEvent } from '../types/index.js';
import { getDefaultConfig } from './scoring.js';
import { evaluateAccountBuyingCommittee, type BuyingCommitteeResolution } from './multi-contact-evaluator.js';
import { batchSyncContacts, createConsolidatedAETask } from './hubspot-sync.js';
import {
  persistentAgentStore,
  PersistentAgentStore,
  type AgentStep,
  type PersistedAgentSession,
  type PersistentAgentMemory,
} from './persistent-agent-store.js';

type AgentTool = 'sync_contacts' | 'create_ae_task' | 'request_human_review' | 'complete';

export interface ToolPlan {
  tool: AgentTool;
  confidence: number;
  planner: AgentStep['planner'];
}

function time(): string {
  return new Date().toISOString();
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function deterministicTool(session: PersistedAgentSession): AgentTool {
  return toolsAvailable(session)[0] ?? 'request_human_review';
}

export async function selectWithGemini(
  session: PersistedAgentSession,
  available: AgentTool[]
): Promise<ToolPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length <= 10 || apiKey.includes('your_gemini_api_key')) {
    throw new Error('No live decision planner is configured. Set TYPESAFE_API_KEY or GEMINI_API_KEY.');
  }

  const models = [
    process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
  ].filter((model, index, all) => all.indexOf(model) === index);
  const requestBody = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: [
          'Choose exactly one safest next tool for this account-resolution agent.',
          'Only choose from availableTools. Never claim a CRM action succeeded; tools execute separately.',
          'Choose complete only after required writes are confirmed in priorToolResults.',
          JSON.stringify({
            goal: 'Resolve one account intent event and safely complete required CRM actions.',
            domain: session.domain,
            fsmDecisions: session.resolution.contactOutcomes.map((contact) => ({
              decision: contact.decision,
              state: contact.fsmState,
              action: contact.actionTaken,
              guards: contact.guards.map((guard) => ({ name: guard.guardName, passed: guard.passed })),
            })),
            accountEscalated: session.resolution.accountEscalated,
            priorToolResults: session.steps.filter((step) => step.phase === 'reflect').map((step) => step.result),
            availableTools: available,
          }),
        ].join('\n') }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              tool: { type: 'STRING', enum: available },
              confidence: { type: 'NUMBER' },
            },
            required: ['tool', 'confidence'],
          },
        },
      });
  let response: Response | null = null;
  for (const model of models) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: AbortSignal.timeout(8000),
      }
    );
    if (response.ok) break;
    if (response.status !== 429 && response.status !== 503 && response.status !== 404) {
      throw new Error(`Gemini planner returned HTTP ${response.status}`);
    }
  }
  if (!response?.ok) throw new Error(`Gemini planner models unavailable (last HTTP ${response?.status ?? 'no response'})`);
  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini planner returned no structured decision');
  const answer = JSON.parse(text) as { tool?: AgentTool; confidence?: number };
  if (!answer.tool || !available.includes(answer.tool) || typeof answer.confidence !== 'number' ||
      !Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) {
    throw new Error('Gemini planner returned an unavailable or malformed tool choice');
  }
  if (answer.confidence < 0.65 && available.includes('request_human_review')) {
    return { tool: 'request_human_review', confidence: answer.confidence, planner: 'gemini' };
  }
  return { tool: answer.tool, confidence: answer.confidence, planner: 'gemini' };
}

export async function selectNextTool(
  session: PersistedAgentSession,
  available: AgentTool[]
): Promise<ToolPlan> {
  const fallback: ToolPlan = {
    tool: deterministicTool(session),
    confidence: 1,
    planner: 'deterministic_fallback',
  };
  const apiKey = process.env.TYPESAFE_API_KEY;
  const typesafeConfigured = Boolean(apiKey && apiKey.trim().length > 10 && !apiKey.includes('your_typesafe_api_key'));
  if (!typesafeConfigured) {
    try {
      return await selectWithGemini(session, available);
    } catch (error) {
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw error;
      return fallback;
    }
  }

  const criteria = Object.fromEntries(available.map((tool) => [tool, {
    sync_contacts: 'Write the evaluated contact dispositions to HubSpot in one batch.',
    create_ae_task: 'Create the required consolidated account executive task for an escalated account.',
    request_human_review: 'Stop automated progression and send the existing evidence to a human reviewer.',
    complete: 'All required safe actions are complete and the goal can be closed.',
  }[tool]]));

  try {
    const requestBody = JSON.stringify({
        model: 'jev-latest',
        state: {
          goal: 'Safely resolve this account intent change and synchronize required CRM actions.',
          domain: session.domain,
          fsmDecisions: session.resolution.contactOutcomes.map((contact) => ({
            contactId: contact.contactId,
            decision: contact.decision,
            state: contact.fsmState,
            action: contact.actionTaken,
            guards: contact.guards.map((guard) => ({ name: guard.guardName, passed: guard.passed })),
          })),
          accountEscalated: session.resolution.accountEscalated,
          priorToolResults: session.steps.filter((step) => step.phase === 'reflect').map((step) => step.result),
          availableTools: available,
        },
        questions: {
          next_tool: {
            type: 'choice',
            instructions: 'Which single available tool is the safest next step toward the stated goal? Select complete only when every required CRM write and required human handoff has succeeded.',
            criteria,
          },
        },
      });
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: requestBody,
        signal: AbortSignal.timeout(5000),
      });
      if ((response.status === 429 || response.status === 529) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 200 * (2 ** attempt)));
        continue;
      }
      break;
    }

    if (!response?.ok) throw new Error(`TypeSafe planner returned HTTP ${response?.status ?? 'no response'}`);
    const payload = await response.json() as {
      answers?: { next_tool?: { choice?: string; confidence?: number } };
    };
    const answer = payload.answers?.next_tool;
    if (!answer || !available.includes(answer.choice as AgentTool) ||
        typeof answer.confidence !== 'number' || !Number.isFinite(answer.confidence) ||
        answer.confidence < 0 || answer.confidence > 1) {
      throw new Error('TypeSafe planner returned an unavailable or malformed tool choice');
    }
    if (answer.confidence < 0.65 && available.includes('request_human_review')) {
      return { tool: 'request_human_review', confidence: answer.confidence, planner: 'typesafe' };
    }
    return { tool: answer.choice as AgentTool, confidence: answer.confidence, planner: 'typesafe' };
  } catch (error) {
    console.warn('[AgentRuntime] TypeSafe planning unavailable; trying Gemini planner:', safeError(error));
    try {
      return await selectWithGemini(session, available);
    } catch (geminiError) {
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw geminiError;
      return fallback;
    }
  }
}

function toolsAvailable(session: PersistedAgentSession): AgentTool[] {
  const syncResult = session.steps
    .filter((step) => step.phase === 'reflect' && step.tool === 'sync_contacts')
    .at(-1)?.result;
  if (syncResult?.requiresHumanReview === true) return ['request_human_review'];
  if (!session.completedTools.includes('sync_contacts')) return ['sync_contacts'];
  if (session.resolution.accountEscalated && !session.completedTools.includes('create_ae_task')) {
    return ['create_ae_task'];
  }
  return ['complete'];
}

async function executeTool(session: PersistedAgentSession, tool: AgentTool): Promise<Record<string, unknown>> {
  if (tool === 'sync_contacts') {
    const result = await batchSyncContacts(session.resolution.contactOutcomes);
    return result as unknown as Record<string, unknown>;
  }
  if (tool === 'create_ae_task' || tool === 'request_human_review') {
    const result = await createConsolidatedAETask({
      domain: session.domain,
      accountId: session.resolution.account.accountId,
      accountName: session.resolution.account.name,
      dealAmount: session.resolution.account.activeDeals[0]?.amount,
      outcomes: session.resolution.contactOutcomes.map((outcome) => ({
        contactId: outcome.contactId,
        name: outcome.name,
        role: outcome.role,
        actionTaken: outcome.actionTaken,
        actionSummary: outcome.actionSummary,
      })),
      briefing: session.resolution.briefing,
    });
    return result as unknown as Record<string, unknown>;
  }
  return { success: true, completed: true };
}

function resultSucceeded(result: Record<string, unknown>): boolean {
  return result.success === true;
}

async function persistMemoryFromSession(session: PersistedAgentSession, previous: PersistentAgentMemory): Promise<void> {
  const incomingEventIds = new Set(previous.events.map((event) => event.eventId));
  const events = [...previous.events];
  if (!incomingEventIds.has(session.event.eventId)) events.push(session.event);
  const contacts = { ...previous.contacts };
  for (const outcome of session.resolution.contactOutcomes) {
    contacts[outcome.contactId] = {
      fsmState: outcome.fsmState,
      cooldownStartedAt: outcome.cooldownStartedAt,
      // Preserve only CRM-observed enrollment until a real sequence enrollment is confirmed.
      currentCampaign: outcome.currentCampaign,
    };
  }
  const memory: PersistentAgentMemory = {
    ...previous,
    events: events.slice(-200),
    contacts,
    latestSessionId: session.id,
    updatedAt: time(),
  };
  await persistentAgentStore.saveMemory(memory);
}

async function runToolLoop(
  session: PersistedAgentSession,
  memory: PersistentAgentMemory
): Promise<PersistedAgentSession> {
  session.status = 'running';
  for (let turn = 1; turn <= 5; turn++) {
    const available = toolsAvailable(session);
    let plan: ToolPlan;
    try {
      plan = await selectNextTool(session, available);
    } catch (error) {
      session.status = 'failed';
      session.pendingTool = null;
      session.steps.push({
        turn,
        phase: 'reflect',
        planner: 'deterministic_fallback',
        result: { success: false, error: safeError(error) },
        at: time(),
      });
      session.updatedAt = time();
      await persistentAgentStore.saveSession(session);
      break;
    }
    const selectedTool = plan.tool;
    session.steps.push({ turn, phase: 'plan', tool: selectedTool, planner: plan.planner, confidence: plan.confidence, at: time() });
    session.updatedAt = time();
    await persistentAgentStore.saveSession(session);

    if (selectedTool === 'complete') {
      session.steps.push({ turn, phase: 'reflect', tool: selectedTool, planner: plan.planner, result: { verified: true }, at: time() });
      session.status = 'complete';
      session.pendingTool = null;
      break;
    }

    if (!available.includes(selectedTool)) {
      session.status = 'failed';
      session.pendingTool = null;
      session.steps.push({ turn, phase: 'reflect', tool: selectedTool, planner: plan.planner, result: { success: false, error: 'Planner selected an unavailable tool.' }, at: time() });
      break;
    }

    session.steps.push({ turn, phase: 'execute', tool: selectedTool, planner: plan.planner, at: time() });
    let result: Record<string, unknown>;
    try {
      result = await executeTool(session, selectedTool);
    } catch (error) {
      result = { success: false, error: safeError(error) };
    }
    session.steps.push({ turn, phase: 'reflect', tool: selectedTool, planner: plan.planner, result, at: time() });
    session.updatedAt = time();

    if (selectedTool === 'request_human_review' && resultSucceeded(result)) {
      session.completedTools.push(selectedTool);
      session.status = 'human_review';
      session.pendingTool = null;
      break;
    }

    if (resultSucceeded(result)) {
      session.completedTools.push(selectedTool);
      session.pendingTool = null;
    } else {
      session.attempts[selectedTool] = (session.attempts[selectedTool] ?? 0) + 1;
      if (session.attempts[selectedTool] >= 3) {
        session.status = 'retry_wait';
        session.pendingTool = selectedTool;
        await persistentAgentStore.schedule(session.id, Date.now() + 5 * 60 * 1000, 'retry');
        break;
      }
    }
    await persistentAgentStore.saveSession(session);
  }

  if (session.status === 'running') {
    session.status = 'failed';
    session.pendingTool = null;
    session.steps.push({ turn: session.steps.length + 1, phase: 'reflect', planner: 'deterministic_fallback', result: { error: 'Agent turn limit reached without completing required actions.' }, at: time() });
  }

  session.updatedAt = time();
  await persistentAgentStore.saveSession(session);
  await persistMemoryFromSession(session, memory);

  if (session.resolution.contactOutcomes.some((outcome) => outcome.fsmState === 'EVALUATION_COOLDOWN' && outcome.cooldownStartedAt)) {
    const dueAt = Math.min(...session.resolution.contactOutcomes
      .filter((outcome) => outcome.fsmState === 'EVALUATION_COOLDOWN' && outcome.cooldownStartedAt)
      .map((outcome) => new Date(outcome.cooldownStartedAt as string).getTime() + 48 * 60 * 60 * 1000));
    await persistentAgentStore.schedule(session.id, dueAt, 'cooldown');
  }
  return session;
}

export async function runIntentAgentCycle(domain: string, event: IntentEvent): Promise<{
  duplicate: boolean;
  session: PersistedAgentSession | null;
  resolution: BuyingCommitteeResolution | null;
}> {
  if (!PersistentAgentStore.isConfigured()) {
    throw new Error('Durable agent memory is required. Configure Upstash Redis REST credentials before enabling the production webhook.');
  }
  const lock = await persistentAgentStore.acquireDomainLock(domain);
  if (!lock) throw new Error('Another agent cycle is already running for this account. Retry the event later.');

  let claimed = false;
  try {
    claimed = await persistentAgentStore.claimEvent(event.eventId);
    if (!claimed) {
      const completedSessionId = await persistentAgentStore.getEventSessionId(event.eventId);
      if (!completedSessionId || completedSessionId === 'processing') {
        throw new Error('This event ID is already being processed. Retry it later.');
      }
      const completedSession = await persistentAgentStore.getSession(completedSessionId);
      return { duplicate: true, session: completedSession, resolution: completedSession?.resolution ?? null };
    }

    const memory = await persistentAgentStore.getMemory(domain);
    const scoringConfig = { ...getDefaultConfig(), sourceWeights: memory.sourceWeights };
    const resolution = await evaluateAccountBuyingCommittee(domain, event, {
      historyEvents: memory.events,
      priorContacts: memory.contacts,
      scoringConfig,
    });
    const session: PersistedAgentSession = {
      id: randomUUID(),
      domain: domain.toLowerCase().trim(),
      event,
      resolution,
      status: 'running',
      steps: [{
        turn: 0,
        phase: 'observe',
        planner: 'deterministic_fallback',
        result: {
          contactsObserved: resolution.totalContactsEvaluated,
          webSource: resolution.webCorroboration?.source ?? 'unavailable',
          webStatus: resolution.webCorroboration?.status ?? 'unavailable',
          activeDeals: resolution.account.activeDeals.length,
          memoryEvents: memory.events.length,
        },
        at: time(),
      }],
      completedTools: [],
      attempts: {},
      pendingTool: null,
      updatedAt: time(),
    };
    await persistentAgentStore.saveSession(session);
    const completed = await runToolLoop(session, memory);
    await persistentAgentStore.completeEvent(event.eventId, completed.id);
    return { duplicate: false, session: completed, resolution };
  } catch (error) {
    if (claimed) await persistentAgentStore.releaseEventClaim(event.eventId).catch(() => undefined);
    throw error;
  } finally {
    await persistentAgentStore.releaseDomainLock(domain, lock);
  }
}

async function resumeRetry(session: PersistedAgentSession): Promise<boolean> {
  const lock = await persistentAgentStore.acquireDomainLock(session.domain);
  if (!lock) return false;
  try {
    const memory = await persistentAgentStore.getMemory(session.domain);
    const tool = session.pendingTool as AgentTool | null;
    if (!tool || (tool !== 'sync_contacts' && tool !== 'create_ae_task' && tool !== 'request_human_review')) {
      session.status = 'failed';
      session.pendingTool = null;
      await persistentAgentStore.saveSession(session);
      return true;
    }
    const result = await executeTool(session, tool).catch((error) => ({ success: false, error: safeError(error) }));
    session.steps.push({ turn: session.steps.length + 1, phase: 'reflect', tool, planner: 'deterministic_fallback', result, at: time() });
    if (resultSucceeded(result)) {
      if (!session.completedTools.includes(tool)) session.completedTools.push(tool);
      session.status = 'running';
      session.pendingTool = null;
      await runToolLoop(session, memory);
    } else {
      session.attempts[tool] = (session.attempts[tool] ?? 0) + 1;
      session.status = session.attempts[tool] >= 8 ? 'failed' : 'retry_wait';
      session.updatedAt = time();
      if (session.status === 'retry_wait') {
        const delay = Math.min(60, 5 * (2 ** Math.min(session.attempts[tool] - 3, 4)));
        await persistentAgentStore.schedule(session.id, Date.now() + delay * 60 * 1000, 'retry');
      } else {
        session.pendingTool = null;
      }
      await persistentAgentStore.saveSession(session);
    }
    return true;
  } finally {
    await persistentAgentStore.releaseDomainLock(session.domain, lock);
  }
}

async function resumeCooldown(session: PersistedAgentSession): Promise<boolean> {
  const lock = await persistentAgentStore.acquireDomainLock(session.domain);
  if (!lock) return false;
  try {
    const memory = await persistentAgentStore.getMemory(session.domain);
    const productId = session.event.productId;
    const event: IntentEvent = {
      eventId: `cooldown_${session.id}`,
      accountId: session.event.accountId,
      productId,
      source: 'autonomous_cooldown_recheck',
      sourceType: '1st_party_direct',
      rawScore: 0,
      timestamp: time(),
      metadata: { action: 'cooldown_expiry', priorSessionId: session.id },
    };
    const resolution = await evaluateAccountBuyingCommittee(session.domain, event, {
      historyEvents: memory.events,
      priorContacts: memory.contacts,
      scoringConfig: { ...getDefaultConfig(), sourceWeights: memory.sourceWeights },
    });
    await persistentAgentStore.removeSchedule(session.id, 'cooldown');
    const next: PersistedAgentSession = {
      id: randomUUID(),
      domain: session.domain,
      event,
      resolution,
      status: 'running',
      steps: [{ turn: 0, phase: 'observe', planner: 'deterministic_fallback', result: { reason: 'cooldown_expired', priorSessionId: session.id }, at: time() }],
      completedTools: [],
      attempts: {},
      pendingTool: null,
      updatedAt: time(),
    };
    await persistentAgentStore.saveSession(next);
    await runToolLoop(next, memory);
    return true;
  } finally {
    await persistentAgentStore.releaseDomainLock(session.domain, lock);
  }
}

export async function processDueAgentWork(): Promise<{ retries: number; cooldowns: number; errors: string[] }> {
  if (!PersistentAgentStore.isConfigured()) {
    throw new Error('Durable agent memory is required. Configure Upstash Redis REST credentials before running the agent worker.');
  }
  const errors: string[] = [];
  let retries = 0;
  let cooldowns = 0;
  const retryIds = await persistentAgentStore.dueSessions('retry');
  for (const id of retryIds) {
    const session = await persistentAgentStore.getSession(id);
    if (!session) {
      await persistentAgentStore.removeSchedule(id, 'retry');
      continue;
    }
    try {
      if (await resumeRetry(session)) {
        const latest = await persistentAgentStore.getSession(id);
        if (latest?.status !== 'retry_wait') await persistentAgentStore.removeSchedule(id, 'retry');
        retries++;
      }
    } catch (error) {
      errors.push(`retry ${id}: ${safeError(error)}`);
    }
  }
  const cooldownIds = await persistentAgentStore.dueSessions('cooldown');
  for (const id of cooldownIds) {
    const session = await persistentAgentStore.getSession(id);
    if (!session) {
      await persistentAgentStore.removeSchedule(id, 'cooldown');
      continue;
    }
    try {
      if (await resumeCooldown(session)) {
        await persistentAgentStore.removeSchedule(id, 'cooldown');
        cooldowns++;
      }
    } catch (error) {
      errors.push(`cooldown ${id}: ${safeError(error)}`);
    }
  }
  return { retries, cooldowns, errors };
}
