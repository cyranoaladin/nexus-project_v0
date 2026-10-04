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
import { assertRateLimitStoreReady, getRateLimitRuntimeMode } from '@/lib/rate-limit';
import { isProductionAriaRagRuntimeFullyConfigured } from '@/lib/aria/rag';
import { resolveDeploymentRagProfile } from '@/lib/deployment/rag-profile';
import { checkAuthAuthorityReadiness } from '@/lib/auth/auth-rollout-startup';

export async function GET() {
  // 1. Auth check
  const sessionOrResponse = await enforcePolicy('admin.dashboard');
  if (isErrorResponse(sessionOrResponse)) {
    return sessionOrResponse;
  }

  const checks: Record<string, { ok: boolean; detail?: string; scope: 'runtime' | 'configuration' | 'process' }> = {};

  // 2. Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { ok: true, scope: 'runtime' };
  } catch {
    checks.db = { ok: false, detail: 'database-unavailable', scope: 'runtime' };
  }

  try {
    const authority = await checkAuthAuthorityReadiness();
    checks.authAuthority = { ok: true, detail: authority.coreV2, scope: 'runtime' };
  } catch {
    checks.authAuthority = { ok: false, detail: 'authority-unavailable', scope: 'runtime' };
  }

  // 3. SMTP (config only — no actual send)
  checks.smtp = {
    ok: !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS),
    detail: process.env.SMTP_HOST ? 'configured' : 'missing env',
    scope: 'configuration',
  };

  // 4. RAG v2 configuration. Live reachability is checked by the manifest
  // runtime gate because a search health probe requires a real signed student
  // identity and must never forge one.
  const ragProfile = resolveDeploymentRagProfile(process.env);
  const ragConfigured = ragProfile === 'RAG_ENABLED' && isProductionAriaRagRuntimeFullyConfigured();
  checks.rag = {
    ok: ragProfile === 'CORE_ONLY' || ragConfigured,
    detail: ragProfile === 'CORE_ONLY' ? 'not-applicable' : ragConfigured ? 'v2 configured; runtime gate required' : 'v2 configuration missing',
    scope: 'configuration',
  };

  // 5. Redis
  const rateLimitMode = getRateLimitRuntimeMode();
  let rateLimitReady = true;
  try {
    await assertRateLimitStoreReady();
  } catch {
    rateLimitReady = false;
  }
  checks.redis = {
    ok: rateLimitReady,
    detail: rateLimitReady ? rateLimitMode : 'rate-limit-unavailable',
    scope: 'runtime',
  };

  // 6. Disk (basic check via cwd access)
  try {
    process.cwd();
    checks.disk = { ok: true, detail: 'process-cwd-only; storage-not-probed', scope: 'process' };
  } catch {
    checks.disk = { ok: false, detail: 'process-cwd-unavailable', scope: 'process' };
  }

  // 7. Worker queue (NPC — basic env check)
  checks.npc = {
    ok: !!process.env.NPC_LLM_MODE,
    detail: process.env.NPC_LLM_MODE ? 'configured; worker-not-probed' : 'not configured',
    scope: 'configuration',
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  const coreReady = checks.db.ok && checks.authAuthority.ok && checks.redis.ok && checks.disk.ok;

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      readiness: { core: { ok: coreReady }, rag: { profile: ragProfile, configured: ragConfigured, runtimeVerified: false } },
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: coreReady ? 200 : 503 }
  );
}
