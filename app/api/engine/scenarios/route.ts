import { NextResponse } from 'next/server';
import { ALL_SCENARIOS } from '@/src/data/mock-scenarios';

export async function GET() {
  const scenarios = ALL_SCENARIOS.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    expectedDecision: s.expectedDecision,
    expectedState: s.expectedState,
    expectedReasoning: s.expectedReasoning,
    eventCount: s.incomingEvents.length,
    events: s.incomingEvents,
  }));

  return NextResponse.json({ success: true, data: scenarios });
}
