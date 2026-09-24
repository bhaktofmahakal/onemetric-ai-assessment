import { NextRequest, NextResponse } from 'next/server';
import type { IntentEvent } from '@/src/types';
import { runIntentAgentCycle } from '@/src/engine/agent-runtime';
import { PersistentAgentStore } from '@/src/engine/persistent-agent-store';
import { inspectHubSpotContactSchema } from '@/src/engine/hubspot-reader';
import { readSignedJsonWebhook } from '@/src/engine/webhook-security';
import { isSupportedProductId } from '@/src/engine/product-catalog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EVENT_SCORES: Record<string, number> = {
  pricing_page_visit: 90,
  competitor_comparison: 85,
  review_read: 70,
  profile_view: 65,
};

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time <= Date.now() + 5 * 60_000 && Date.now() - time <= 30 * 86_400_000;
}

export async function POST(req: NextRequest) {
  const parsed = await readSignedJsonWebhook(req, 'INTENT_WEBHOOK_SECRET');
  if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: parsed.status });

  const payload = parsed.body;
  const domain = typeof payload.domain === 'string' ? payload.domain.trim().toLowerCase() : '';
  const eventId = typeof payload.eventId === 'string' ? payload.eventId.trim() : '';
  const eventType = typeof payload.eventType === 'string' ? payload.eventType : '';
  const suppliedScore = payload.intentScore;
  const rawScore = suppliedScore === undefined ? EVENT_SCORES[eventType] : Number(suppliedScore);
  const productId = typeof payload.productId === 'string' ? payload.productId.trim() : '';

  if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain)) {
    return NextResponse.json({ success: false, error: 'A valid company domain is required.' }, { status: 400 });
  }
  if (!eventId || eventId.length > 200 || !productId || productId.length > 100 || !isSupportedProductId(productId) ||
      (suppliedScore === undefined && !Object.hasOwn(EVENT_SCORES, eventType)) ||
      !Number.isFinite(rawScore) || rawScore < 0 || rawScore > 100 || !validTimestamp(payload.timestamp)) {
    return NextResponse.json({ success: false, error: 'eventId, productId, a supported eventType or score from 0 to 100, and a valid timestamp are required.' }, { status: 400 });
  }
  if (!PersistentAgentStore.isConfigured()) {
    return NextResponse.json({ success: false, error: 'Durable Redis storage is required; provider events are not run in simulation mode.' }, { status: 503 });
  }
  const schema = await inspectHubSpotContactSchema();
  if (!schema.ready) {
    return NextResponse.json({ success: false, code: 'HUBSPOT_CONTACT_SCHEMA_INCOMPLETE', missingProperties: schema.missingProperties }, { status: 424 });
  }

  const event: IntentEvent = {
    eventId,
    accountId: typeof payload.accountId === 'string' && payload.accountId.trim()
      ? payload.accountId.trim()
      : `acc_${domain.replace(/[^a-z0-9]/g, '_')}`,
    productId,
    source: 'g2_buyer_intent',
    sourceType: '2nd_party',
    rawScore,
    timestamp: new Date(payload.timestamp).toISOString(),
    metadata: {
      provider: 'G2',
      eventType: eventType || 'custom_score',
      competitorMentioned: typeof payload.competitorMentioned === 'string' ? payload.competitorMentioned : undefined,
      company: typeof payload.company === 'string' ? payload.company : undefined,
    },
  };

  try {
    const result = await runIntentAgentCycle(domain, event);
    const success = result.session?.status !== 'failed';
    return NextResponse.json({
      success,
      provider: 'G2 Buyer Intent normalized adapter',
      mode: 'durable_redis_agent',
      domain,
      resolution: result.resolution,
      agentSession: result.session,
      ...(success ? {} : { error: 'Agent session failed; inspect its persisted journal before retrying.' }),
    }, { status: success ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'G2 event processing failed';
    const status = message.includes('HubSpot contact schema is incomplete') ? 424
      : message.includes('already running') || message.includes('already being processed') ? 409
      : 502;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function GET() {
  const schema = await inspectHubSpotContactSchema();
  const configured = Boolean(process.env.INTENT_WEBHOOK_SECRET && process.env.HUBSPOT_ACCESS_TOKEN &&
    PersistentAgentStore.isConfigured() && schema.ready &&
    (process.env.TYPESAFE_API_KEY || process.env.GEMINI_API_KEY));
  return NextResponse.json({
    status: configured ? 'ready' : 'configuration_required',
    provider: 'G2 Buyer Intent normalized adapter',
    endpoint: '/api/engine/webhook/g2',
    auth: 'HMAC-SHA256 of the raw request body in x-onemetric-signature',
    requiredFields: ['domain', 'eventId', 'productId', 'eventType or intentScore', 'timestamp'],
    mappedChannel: '2nd_party',
    supportedEventTypes: EVENT_SCORES,
    missingContactProperties: schema.missingProperties,
  });
}
