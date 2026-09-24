import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { IntentEvent, SourceType } from '@/src/types';
import { runIntentAgentCycle } from '@/src/engine/agent-runtime';
import { PersistentAgentStore, persistentAgentStore } from '@/src/engine/persistent-agent-store';
import { inspectHubSpotContactSchema } from '@/src/engine/hubspot-reader';
import { isSupportedProductId } from '@/src/engine/product-catalog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SOURCE_TYPES: SourceType[] = [
  '1st_party_direct',
  '1st_party_passive',
  '2nd_party',
  '3rd_party',
  'firmographic',
];

function validSignature(rawBody: string, provided: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.INTENT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'INTENT_WEBHOOK_SECRET is required in production.' }, { status: 503 });
    }
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 64 * 1024) {
    return NextResponse.json({ success: false, error: 'Request body exceeds the 64 KB limit.' }, { status: 413 });
  }
  if (webhookSecret) {
    const signature = req.headers.get('x-onemetric-signature') || '';
    if (!validSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ success: false, error: 'Invalid webhook signature.' }, { status: 401 });
    }
  }

  if (!PersistentAgentStore.isConfigured()) {
    return NextResponse.json({ success: false, error: 'Durable Redis storage is required for webhook processing.' }, { status: 503 });
  }
  const clientIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  try {
    if (!await persistentAgentStore.consumeRateLimit('intent-webhook', clientIp, 60, 60)) {
      return NextResponse.json({ success: false, error: 'Webhook rate limit exceeded.' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Rate-limit storage is unavailable.' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const domain = typeof body.domain === 'string' ? body.domain.trim().toLowerCase() : '';
  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  const source = typeof body.source === 'string' ? body.source.trim() : '';
  const sourceType = body.sourceType as SourceType;
  const rawScore = Number(body.rawScore);
  const timestamp = typeof body.timestamp === 'string' ? body.timestamp : '';
  const timestampMs = Date.parse(timestamp);

  if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain)) {
    return NextResponse.json({ success: false, error: 'A valid account domain is required.' }, { status: 400 });
  }
  if (!eventId || eventId.length > 200 || !productId || productId.length > 100 || !source || source.length > 100) {
    return NextResponse.json({ success: false, error: 'eventId, productId, and source are required bounded strings.' }, { status: 400 });
  }
  if (!isSupportedProductId(productId)) {
    return NextResponse.json({ success: false, error: 'productId must be one of product_a, product_b, or product_c.' }, { status: 400 });
  }
  if (!SOURCE_TYPES.includes(sourceType)) {
    return NextResponse.json({ success: false, error: 'sourceType is invalid.' }, { status: 400 });
  }
  if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > 100) {
    return NextResponse.json({ success: false, error: 'rawScore must be a number from 0 to 100.' }, { status: 400 });
  }
  if (!Number.isFinite(timestampMs) || timestampMs > Date.now() + 5 * 60 * 1000 || Date.now() - timestampMs > 30 * 86400000) {
    return NextResponse.json({ success: false, error: 'timestamp must be valid, no more than 5 minutes in the future, and no older than 30 days.' }, { status: 400 });
  }

  const event: IntentEvent = {
    eventId,
    accountId: typeof body.accountId === 'string' && body.accountId.trim()
      ? body.accountId.trim()
      : `acc_${domain.replace(/[^a-z0-9]/g, '_')}`,
    ...(typeof body.contactId === 'string' && body.contactId.trim() ? { contactId: body.contactId.trim() } : {}),
    productId,
    source,
    sourceType,
    rawScore,
    timestamp: new Date(timestampMs).toISOString(),
    metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata as Record<string, unknown>
      : {},
  };

  try {
    const result = await runIntentAgentCycle(domain, event);
    const agentStatus = result.session?.status;
    const failed = !result.duplicate && agentStatus === 'failed';
    const httpStatus = result.duplicate ? 200
      : agentStatus === 'complete' ? 200
      : failed ? 502
      : 202;
    return NextResponse.json({
      success: !failed,
      duplicate: result.duplicate,
      agent: result.session ? {
        sessionId: result.session.id,
        status: result.session.status,
        turns: result.session.steps.length,
        pendingTool: result.session.pendingTool,
        journal: result.session.steps,
      } : null,
      data: result.resolution,
    }, { status: httpStatus });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Agent execution failed';
    const status = message.includes('HubSpot contact schema is incomplete') ? 424
      : message.includes('Durable agent memory is required') ? 503
      : message.includes('already running') || message.includes('already being processed') ? 409
      : 502;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function GET() {
  const schema = await inspectHubSpotContactSchema();
  const redisConnected = PersistentAgentStore.isConfigured() && await persistentAgentStore.ping();
  const configuration = {
    webhookSecret: Boolean(process.env.INTENT_WEBHOOK_SECRET),
    hubspotToken: Boolean(process.env.HUBSPOT_ACCESS_TOKEN),
    hubspotContactSchema: schema.ready,
    redisUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL),
    redisToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
    redisConnected,
    typeSafeKey: Boolean(process.env.TYPESAFE_API_KEY),
    geminiKey: Boolean(process.env.GEMINI_API_KEY),
  };
  const ready = configuration.webhookSecret && configuration.hubspotToken && configuration.hubspotContactSchema &&
    configuration.redisUrl && configuration.redisToken && configuration.redisConnected &&
    (configuration.typeSafeKey || configuration.geminiKey);
  const campaignExecutionConnected = false;
  return NextResponse.json({
    status: ready
      ? campaignExecutionConnected
        ? (configuration.typeSafeKey ? 'ready' : 'ready_with_gemini_planner')
        : 'agent_ready_campaign_disabled'
      : 'configuration_required',
    endpoint: '/api/engine/webhook',
    configuration,
    capabilities: {
      durableAgent: ready,
      campaignEnrollment: campaignExecutionConnected ? 'connected' : 'not_connected',
      rollingTouchCounter: 'not_connected',
    },
    requiredFields: ['eventId', 'domain', 'productId', 'source', 'sourceType', 'rawScore', 'timestamp'],
    blockers: [
      ...(!configuration.hubspotContactSchema ? ['HubSpot contact properties current_campaign and touch_count_7d must exist and be readable.'] : []),
      ...(!(configuration.typeSafeKey || configuration.geminiKey) ? ['Configure TYPESAFE_API_KEY or GEMINI_API_KEY for live agent planning.'] : []),
      ...(!configuration.redisConnected ? ['Upstash Redis connectivity check failed; durable agent work is unavailable.'] : []),
      ...(!campaignExecutionConnected ? ['Campaign sequence enrollment and suppression are not connected; switch decisions do not send or enroll contacts.'] : []),
      'The seven-day touch counter has no connected outbound-activity source and must not be inferred from CRM notes.',
    ],
    missingContactProperties: schema.missingProperties,
    signatureHeader: 'x-onemetric-signature: sha256=<HMAC-SHA256 of the raw request body>',
  });
}
