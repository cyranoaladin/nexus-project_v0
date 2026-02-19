/**
 * POST /api/analytics/event
 *
 * Lightweight analytics event ingestion endpoint.
 * Currently a no-op stub — accepts events silently to prevent 404 errors
 * from client-side tracking calls (NextStepCard, etc.).
 *
 * TODO: Wire to a real analytics backend (PostHog, Plausible, or DB table).
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Parse body to validate it's proper JSON, but discard
    await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
