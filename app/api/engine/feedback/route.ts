import { NextRequest, NextResponse } from 'next/server';
import type { FeedbackEvent, FeedbackEventType, SourceType } from '@/src/types';
import { PersistentAgentStore, persistentAgentStore } from '@/src/engine/persistent-agent-store';
import { readSignedJsonWebhook } from '@/src/engine/webhook-security';
import { calculateBayesianCalibratedWeight } from '@/src/engine/scoring';
import { isSupportedProductId } from '@/src/engine/product-catalog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EVENT_TYPES: FeedbackEventType[] = ['email_open', 'email_reply', 'meeting_booked', 'deal_won', 'deal_lost', 'unsubscribed'];
const SOURCE_TYPES: SourceType[] = ['1st_party_direct', '1st_party_passive', '2nd_party', '3rd_party', 'firmographic'];
const DELTAS: Record<FeedbackEventType, number> = {
  email_open: 0.01,
  email_reply: 0.05,
  meeting_booked: 0.08,
  deal_won: 0.08,
  deal_lost: -0.05,
  unsubscribed: -0.08,
};

export async function POST(req: NextRequest) {
  const parsed = await readSignedJsonWebhook(req, 'OUTCOME_WEBHOOK_SECRET');
  if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: parsed.status });
  if (!PersistentAgentStore.isConfigured()) {
    return NextResponse.json({ success: false, code: 'DURABLE_FEEDBACK_STORAGE_UNAVAILABLE', error: 'Outcome feedback requires durable Redis storage.' }, { status: 503 });
  }

  const body = parsed.body;
  const domain = typeof body.domain === 'string' ? body.domain.trim().toLowerCase() : '';
  const feedbackId = typeof body.feedbackId === 'string' ? body.feedbackId.trim() : '';
  const eventType = body.eventType as FeedbackEventType;
  const sourceType = body.sourceType as SourceType;
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain) ||
      !feedbackId || feedbackId.length > 200 || !productId || productId.length > 100 ||
      !isSupportedProductId(productId) ||
      !EVENT_TYPES.includes(eventType) || !SOURCE_TYPES.includes(sourceType)) {
    return NextResponse.json({ success: false, error: 'Valid domain, feedbackId, productId, eventType, and sourceType are required.' }, { status: 400 });
  }

  const clientIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  try {
    const allowed = await persistentAgentStore.consumeRateLimit('outcome-feedback', clientIp, 30, 60);
    if (!allowed) return NextResponse.json({ success: false, error: 'Feedback rate limit exceeded.' }, { status: 429 });
  } catch {
    return NextResponse.json({ success: false, error: 'Feedback rate-limit storage is unavailable.' }, { status: 503 });
  }

  const lock = await persistentAgentStore.acquireDomainLock(domain).catch(() => null);
  if (!lock) return NextResponse.json({ success: false, error: 'Account is busy; retry the feedback event.' }, { status: 409 });
  let claimed = false;
  try {
    claimed = await persistentAgentStore.claimFeedback(feedbackId);
    if (!claimed) return NextResponse.json({ success: true, duplicate: true, feedbackId });

    const memory = await persistentAgentStore.getMemory(domain);
    const previousWeight = memory.sourceWeights[sourceType];
    const feedback: FeedbackEvent = {
      feedbackId,
      eventType,
      sourceType,
      productId,
      ...(typeof body.contactId === 'string' ? { contactId: body.contactId } : {}),
      domain,
      metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata as Record<string, unknown>
        : {},
      timestamp: new Date().toISOString(),
    };
    memory.feedbackEventIds = [...memory.feedbackEventIds, feedbackId].slice(-5000);
    memory.outcomeFeedback = [...memory.outcomeFeedback, feedback].slice(-500);

    const bayesianCalibration = calculateBayesianCalibratedWeight(sourceType, previousWeight, memory.outcomeFeedback);
    const useBayesian = body.mode === 'bayesian';
    const delta = DELTAS[eventType];
    const newWeight = useBayesian
      ? bayesianCalibration.posteriorWeight
      : Math.round(Math.min(1, Math.max(0.1, previousWeight + delta)) * 100) / 100;
    memory.sourceWeights[sourceType] = newWeight;
    memory.updatedAt = new Date().toISOString();
    await persistentAgentStore.saveMemory(memory);

    return NextResponse.json({
      success: true,
      duplicate: false,
      persistence: 'upstash_redis',
      feedback: { feedbackId, eventType, sourceType, previousWeight, newWeight, delta: newWeight - previousWeight },
      bayesianCalibration,
      sourceWeights: memory.sourceWeights,
    });
  } catch (error) {
    if (claimed) await persistentAgentStore.releaseFeedbackClaim(feedbackId).catch(() => undefined);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Feedback persistence failed.' }, { status: 502 });
  } finally {
    await persistentAgentStore.releaseDomainLock(domain, lock).catch(() => undefined);
  }
}

export async function GET() {
  const ready = Boolean(process.env.OUTCOME_WEBHOOK_SECRET && PersistentAgentStore.isConfigured());
  return NextResponse.json({
    status: ready ? 'ready' : 'configuration_required',
    endpoint: '/api/engine/feedback',
    requiredConfiguration: ['OUTCOME_WEBHOOK_SECRET', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    signatureHeader: 'x-onemetric-signature: sha256=<HMAC-SHA256 of the raw request body>',
    supportedEventTypes: EVENT_TYPES,
    supportedSourceTypes: SOURCE_TYPES,
  });
}
