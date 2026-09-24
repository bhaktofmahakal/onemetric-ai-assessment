import { NextRequest, NextResponse } from 'next/server';
import { demoStore } from '@/src/engine/demo-store';
import { HubSpotContactSchemaError, inspectHubSpotContactSchema } from '@/src/engine/hubspot-reader';
import { PersistentAgentStore, persistentAgentStore } from '@/src/engine/persistent-agent-store';
import { runIntentAgentCycle } from '@/src/engine/agent-runtime';
import type { FeedbackEvent, IntentEvent, SourceType } from '@/src/types';
import { isSupportedProductId } from '@/src/engine/product-catalog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SOURCE_TYPES: SourceType[] = [
  '1st_party_direct', '1st_party_passive', '2nd_party', '3rd_party', 'firmographic',
];

function parseLiveEvent(value: unknown, domain: string): IntentEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const eventId = typeof input.eventId === 'string' ? input.eventId.trim() : '';
  const productId = typeof input.productId === 'string' ? input.productId.trim() : '';
  const source = typeof input.source === 'string' ? input.source.trim() : '';
  const sourceType = input.sourceType as SourceType;
  const rawScore = Number(input.rawScore);
  const timestampMs = typeof input.timestamp === 'string' ? Date.parse(input.timestamp) : Number.NaN;
  if (!eventId || eventId.length > 200 || !isSupportedProductId(productId) || !source || source.length > 100 ||
      !SOURCE_TYPES.includes(sourceType) || !Number.isFinite(rawScore) || rawScore < 0 || rawScore > 100 ||
      !Number.isFinite(timestampMs) || timestampMs > Date.now() + 5 * 60_000 || Date.now() - timestampMs > 30 * 86_400_000) {
    return null;
  }
  return {
    eventId,
    accountId: typeof input.accountId === 'string' && input.accountId.trim()
      ? input.accountId.trim()
      : `acc_${domain.replace(/[^a-z0-9]/g, '_')}`,
    ...(typeof input.contactId === 'string' && input.contactId.trim() ? { contactId: input.contactId.trim() } : {}),
    productId,
    source,
    sourceType,
    rawScore,
    timestamp: new Date(timestampMs).toISOString(),
    metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? input.metadata as Record<string, unknown>
      : {},
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let updatedState;
    let agentSession: Awaited<ReturnType<typeof runIntentAgentCycle>>['session'] = null;
    let executionMode = 'sandbox_simulation';

    if (body.action === 'evaluate_domain' || (!body.action && body.domain && !body.scenarioId && !body.customEvent && !body.feedbackEvent)) {
      const domain = typeof body.domain === 'string' ? body.domain.toLowerCase().trim() : '';
      if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain)) {
        return NextResponse.json({ success: false, error: 'A valid company domain is required.' }, { status: 400 });
      }
      const schema = await inspectHubSpotContactSchema();
      if (!schema.ready) {
        return NextResponse.json({
          success: false,
          code: 'HUBSPOT_CONTACT_SCHEMA_INCOMPLETE',
          error: 'Live account evaluation is paused because required HubSpot contact properties are missing or unreadable.',
          missingProperties: schema.missingProperties,
          action: 'Create/read current_campaign and touch_count_7d in HubSpot, then retry.',
        }, { status: 424 });
      }
      if (!PersistentAgentStore.isConfigured()) {
        return NextResponse.json({
          success: false,
          code: 'DURABLE_AGENT_STORAGE_UNAVAILABLE',
          error: 'Live account evaluation requires durable Redis storage; no demo fallback was executed.',
        }, { status: 503 });
      }
      executionMode = 'durable_redis_agent';
      const incomingEvent: IntentEvent | null = body.surgeEvent !== undefined
        ? parseLiveEvent(body.surgeEvent, domain)
        : {
            eventId: `evt_eval_${Date.now()}`,
            accountId: `acc_${domain.replace(/[^a-z0-9]/g, '_')}`,
            productId: 'product_a',
            source: 'live_domain_evaluation',
            sourceType: '1st_party_direct',
            rawScore: 88,
            timestamp: new Date().toISOString(),
          };
      if (!incomingEvent) {
        return NextResponse.json({
          success: false,
          code: 'INVALID_SURGE_EVENT',
          error: 'surgeEvent must include a unique eventId, supported productId, source, valid sourceType, score, and a recent timestamp.',
        }, { status: 400 });
      }
      const agentResult = await runIntentAgentCycle(domain, incomingEvent);
      agentSession = agentResult.session;
      if (!agentSession) {
        return NextResponse.json({
          success: false,
          code: 'AGENT_SESSION_UNAVAILABLE',
          error: 'The durable agent did not return a session for this event.',
        }, { status: 409 });
      }

      const syncStep = agentSession.steps.filter((step) => step.phase === 'reflect' && step.tool === 'sync_contacts').slice(-1)[0];
      const taskStep = agentSession.steps.filter((step) =>
        step.phase === 'reflect' && (step.tool === 'create_ae_task' || step.tool === 'request_human_review')
      ).slice(-1)[0];
      updatedState = demoStore.recordCommitteeResolution(
        agentSession.resolution,
        syncStep?.result as Record<string, unknown> | undefined ?? { success: false, error: 'Contact synchronization is not confirmed.' },
        taskStep?.result as Record<string, unknown> | undefined ?? null,
      );
      if (agentSession.status === 'failed') {
        return NextResponse.json({
          success: false,
          executionMode,
          agentSession,
          data: updatedState,
          error: 'The live agent failed. Review its persisted session before retrying.',
        }, { status: 502 });
      }
    } else if (body.scenarioId) {
      updatedState = await demoStore.dispatchScenario(body.scenarioId);
    } else if (body.action === 'advance_timer') {
      updatedState = await demoStore.advanceCooldownTimer(body.hours ?? 48);
    } else if (body.customEvent) {
      updatedState = await demoStore.dispatchCustomEvent(body.customEvent);
    } else if (body.action === 'feedback' || body.feedbackEvent) {
      const fb = body.feedbackEvent || body;
      const domain = typeof fb.domain === 'string' ? fb.domain.trim().toLowerCase() : 'techcorp.com';
      const feedback: FeedbackEvent = {
        feedbackId: `fb_dash_${Date.now()}`,
        eventType: fb.eventType,
        sourceType: fb.sourceType || '3rd_party',
        productId: fb.productId || 'product_a',
        domain,
        timestamp: new Date().toISOString(),
      };
      const feedbackResult = demoStore.applyFeedback(feedback);
      if (PersistentAgentStore.isConfigured()) {
        try {
          const memory = await persistentAgentStore.getMemory(domain);
          memory.sourceWeights[feedback.sourceType] = feedbackResult.newWeight;
          memory.outcomeFeedback = [...memory.outcomeFeedback, feedback].slice(-500);
          memory.updatedAt = new Date().toISOString();
          await persistentAgentStore.saveMemory(memory);
        } catch {
          // ignore redis error in demo mode
        }
      }
      updatedState = demoStore.getState();
      return NextResponse.json({
        success: true,
        executionMode: 'dashboard_recalibration',
        feedbackResult,
        data: updatedState,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Must provide domain, scenarioId, customEvent, feedback, or action="advance_timer"' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      executionMode,
      ...(agentSession ? { agentSession } : {}),
      data: updatedState,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Evaluation failed';
    const status = error instanceof HubSpotContactSchemaError ? error.statusCode
      : message.includes('already running') || message.includes('already being processed') ? 409
      : message.includes('Durable agent memory is required') ? 503
      : 502;
    return NextResponse.json({
      success: false,
      ...(error instanceof HubSpotContactSchemaError ? {
        code: 'HUBSPOT_CONTACT_SCHEMA_INCOMPLETE',
        missingProperties: error.missingProperties,
        action: 'Create/read current_campaign and touch_count_7d in HubSpot, then retry.',
      } : {}),
      error: message,
    }, { status });
  }
}
