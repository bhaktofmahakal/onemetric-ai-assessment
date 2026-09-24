import { NextResponse } from 'next/server';
import { demoStore } from '@/src/engine/demo-store';

export async function GET() {
  try {
    const state = demoStore.getState();
    return NextResponse.json({ success: true, data: state });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
