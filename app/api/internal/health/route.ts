/**
 * GET /api/internal/health
 *
 * Protected healthcheck for infrastructure monitoring.
 * Covers: DB, SMTP, RAG, Redis, disk, worker queue.
 *
 * Access: ADMIN or ASSISTANTE only (enforced by enforcePolicy).
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { enforcePolicy } from '@/lib/rbac';
import { isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { assertRateLimitRuntimeConfiguration, getRateLimitRuntimeMode } from '@/lib/rate-limit';
import { isProductionAriaRagRuntimeFullyConfigured } from '@/lib/aria/rag';

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

  // 4. RAG v2 configuration. Live reachability is checked by the manifest
  // runtime gate because a search health probe requires a real signed student
  // identity and must never forge one.
  const ragConfigured = isProductionAriaRagRuntimeFullyConfigured();
  checks.rag = {
    ok: ragConfigured,
    detail: ragConfigured ? 'v2 configured' : 'v2 configuration missing',
  };

  // 5. Redis
  const rateLimitMode = getRateLimitRuntimeMode();
  let rateLimitConfigurationValid = true;
  try {
    assertRateLimitRuntimeConfiguration();
  } catch {
    rateLimitConfigurationValid = false;
  }
  checks.redis = {
    ok: rateLimitConfigurationValid && rateLimitMode !== 'memory' && rateLimitMode !== 'invalid',
    detail: rateLimitConfigurationValid ? rateLimitMode : 'configuration-invalid',
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

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  );
}
