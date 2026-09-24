import { NextRequest, NextResponse } from 'next/server';
import { processDueAgentWork } from '@/src/engine/agent-runtime';

function authorizeCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'CRON_SECRET is required in production.' }, { status: 503 });
    }
    return null;
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }
  return null;
}

async function handleWorkerRequest(req: NextRequest) {
  const denied = authorizeCron(req);
  if (denied) return denied;
  try {
    const result = await processDueAgentWork();
    const success = result.errors.length === 0;
    return NextResponse.json({ success, ...result }, { status: success ? 200 : 502 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Agent worker failed';
    const status = message.includes('Durable agent memory is required') ? 503 : 502;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

// Vercel Cron invokes this GET handler. It now processes due retries and cooldowns.
export async function GET(req: NextRequest) {
  return handleWorkerRequest(req);
}

export async function POST(req: NextRequest) {
  return handleWorkerRequest(req);
}
