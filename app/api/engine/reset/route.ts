import { NextRequest, NextResponse } from 'next/server';
import { demoStore } from '@/src/engine/demo-store';

export async function POST(req: NextRequest) {
  try {
    let scenarioId: string | undefined;
    try {
      const body = await req.json();
      scenarioId = body?.scenarioId;
    } catch {
      // Body is optional
    }

    const state = demoStore.reset(scenarioId);
    return NextResponse.json({ success: true, data: state });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Reset failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
