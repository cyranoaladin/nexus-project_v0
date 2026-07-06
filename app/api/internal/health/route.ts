/**
 * GET /api/internal/health
 *
 * Protected healthcheck for infrastructure monitoring.
 * Covers: DB, SMTP, RAG, Redis/Upstash, disk, worker queue.
 *
 * Access: ADMIN or ASSISTANTE only (enforced by enforcePolicy).
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { enforcePolicy } from '@/lib/rbac';
import { isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { getRateLimitProductionGate } from '@/lib/rate-limit';
import { ragSearch } from '@/lib/rag-client';
import { getConfigSnapshotRuntimeStatus } from '@/lib/config/snapshot';

export async function GET() {
  // 1. Auth check
  const sessionOrResponse = await enforcePolicy('admin.dashboard');
  if (isErrorResponse(sessionOrResponse)) {
    return sessionOrResponse;
  }

  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // 2. Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { ok: true };
  } catch (err) {
    checks.db = { ok: false, detail: err instanceof Error ? err.message : 'unknown' };
  }

  // 3. SMTP (config only — no actual send)
  checks.smtp = {
    ok: !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS),
    detail: process.env.SMTP_HOST ? 'configured' : 'missing env',
  };

  // 4. RAG (lightweight ping)
  try {
    const ragHits = await ragSearch({ query: 'ping', k: 1 });
    checks.rag = { ok: true, detail: `hits=${ragHits.length}` };
  } catch (err) {
    checks.rag = { ok: false, detail: err instanceof Error ? err.message : 'unknown' };
  }

  // 5. Redis / Upstash
  const rateLimitGate = getRateLimitProductionGate();
  checks.redis = {
    ok: rateLimitGate.ok,
    detail: rateLimitGate.mode,
  };

  // 6. Disk (basic check via cwd access)
  try {
    process.cwd();
    checks.disk = { ok: true };
  } catch (err) {
    checks.disk = { ok: false, detail: err instanceof Error ? err.message : 'unknown' };
  }

  // 7. Worker queue (NPC — basic env check)
  checks.npc = {
    ok: !!process.env.NPC_LLM_MODE,
    detail: process.env.NPC_LLM_MODE || 'not configured',
  };

  // 8. BusinessConfig snapshot (DB-backed overrides or classified static fallback)
  const businessConfigStatus = getConfigSnapshotRuntimeStatus();
  checks.businessConfig = {
    ok: businessConfigStatus.ok,
    detail: businessConfigStatus.lastError
      ? `${businessConfigStatus.mode}:${businessConfigStatus.lastError.kind}`
      : businessConfigStatus.mode,
  };

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      checks,
      runtime: {
        rateLimit: {
          mode: rateLimitGate.mode,
          distributed: rateLimitGate.ok,
          goLiveLarge: rateLimitGate.decision,
        },
        businessConfig: businessConfigStatus,
      },
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  );
}
