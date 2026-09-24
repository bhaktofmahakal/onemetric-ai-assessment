import { NextRequest, NextResponse } from 'next/server';
import type { IntentEvent } from '@/src/types';
import { runIntentAgentCycle } from '@/src/engine/agent-runtime';
import { PersistentAgentStore } from '@/src/engine/persistent-agent-store';
import { inspectHubSpotContactSchema } from '@/src/engine/hubspot-reader';
import { readSignedJsonWebhook } from '@/src/engine/webhook-security';
import { isSupportedProductId } from '@/src/engine/product-catalog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function inferProductFromTopic(topic: string): string | null {
  const lower = topic.toLowerCase();
  if (lower.includes('secur') || lower.includes('cloud') || lower.includes('protect') || lower.includes('compliance')) return 'product_a';
  if (lower.includes('analyt') || lower.includes('data') || lower.includes('flow') || lower.includes('metric')) return 'product_b';
  if (lower.includes('finan') || lower.includes('erp') || lower.includes('account') || lower.includes('billing')) return 'product_c';
  return null;
}

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
  const topic = typeof payload.topic === 'string' ? payload.topic : typeof payload.topicName === 'string' ? payload.topicName : '';
  const rawScore = Number(payload.surgeScore ?? payload.score);
  const productId = typeof payload.productId === 'string' ? payload.productId : inferProductFromTopic(topic || 'Cloud Security');

  if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain)) {
    return NextResponse.json({ success: false, error: 'A valid company domain is required.' }, { status: 400 });
  }
  if (!eventId || eventId.length > 200 || !productId || productId.length > 100 || !isSupportedProductId(productId) ||
      !Number.isFinite(rawScore) || rawScore < 0 || rawScore > 100 || !validTimestamp(payload.timestamp)) {
    return NextResponse.json({ success: false, error: 'eventId, a supported productId (or mappable topic), a score from 0 to 100, and a valid timestamp are required.' }, { status: 400 });
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
    source: 'bombora_company_surge',
    sourceType: '3rd_party',
    rawScore,
    timestamp: new Date(payload.timestamp).toISOString(),
    metadata: {
      provider: 'Bombora',
      topic,
      compositeScore: payload.compositeScore,
      companyName: payload.companyName,
    },
  };

  try {
    const result = await runIntentAgentCycle(domain, event);
    const success = result.session?.status !== 'failed';
    return NextResponse.json({
      success,
      provider: 'Bombora Company Surge normalized adapter',
      mode: 'durable_redis_agent',
      domain,
      resolution: result.resolution,
      agentSession: result.session,
      ...(success ? {} : { error: 'Agent session failed; inspect its persisted journal before retrying.' }),
    }, { status: success ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bombora event processing failed';
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
    provider: 'Bombora Company Surge normalized adapter',
    endpoint: '/api/engine/webhook/bombora',
    auth: 'HMAC-SHA256 of the raw request body in x-onemetric-signature',
    requiredFields: ['domain', 'eventId', 'productId (or topic/topicName)', 'surgeScore/score', 'timestamp'],
    mappedChannel: '3rd_party',
    targetProducts: ['product_a', 'product_b', 'product_c'],
    missingContactProperties: schema.missingProperties,
  });
}
