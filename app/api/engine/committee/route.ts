import { NextRequest, NextResponse } from 'next/server';
import { evaluateAccountBuyingCommittee } from '@/src/engine/multi-contact-evaluator';
import type { IntentEvent } from '@/src/types';
import { HubSpotContactSchemaError, inspectHubSpotContactSchema } from '@/src/engine/hubspot-reader';

function dependencyErrorResponse(error: unknown, fallback: string) {
  if (error instanceof HubSpotContactSchemaError) {
    return NextResponse.json({
      success: false,
      code: 'HUBSPOT_CONTACT_SCHEMA_INCOMPLETE',
      error: error.message,
      missingProperties: error.missingProperties,
      action: 'Create/read current_campaign and touch_count_7d in HubSpot, then retry.',
    }, { status: error.statusCode });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
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
    const domain = body.domain || 'techcorp.com';
    const targetProduct = body.targetProduct || 'product_a';
    const surgeScore = body.surgeScore ?? 88;

    const surgeEvent: IntentEvent = {
      eventId: `evt_surge_${Date.now()}`,
      accountId: 'acc_001',
      contactId: 'con_001',
      productId: targetProduct,
      source: 'bombora',
      sourceType: '3rd_party',
      rawScore: surgeScore,
      timestamp: new Date().toISOString(),
    };

    const committeeResolution = await evaluateAccountBuyingCommittee(domain, surgeEvent);

    return NextResponse.json({
      success: true,
      data: committeeResolution,
    });
  } catch (error: unknown) {
    return dependencyErrorResponse(error, 'Committee evaluation failed');
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
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
    const domain = (url.searchParams.get('domain') || 'techcorp.com').trim().toLowerCase();
    const targetProduct = url.searchParams.get('productId') || 'product_a';
    const surgeScore = Number(url.searchParams.get('score')) || 88;

    const surgeEvent: IntentEvent = {
      eventId: `evt_surge_query_${Date.now()}`,
      accountId: `acc_${domain.replace(/[^a-z0-9]/g, '_')}`,
      contactId: 'con_001',
      productId: targetProduct,
      source: 'bombora',
      sourceType: '3rd_party',
      rawScore: surgeScore,
      timestamp: new Date().toISOString(),
    };

    const committeeResolution = await evaluateAccountBuyingCommittee(domain, surgeEvent);
    return NextResponse.json({
      success: true,
      data: committeeResolution,
    });
  } catch (error: unknown) {
    return dependencyErrorResponse(error, 'Committee query failed');
  }
}
