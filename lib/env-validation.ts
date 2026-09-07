/**
 * Environment variable validation for production readiness.
 *
 * Called at server startup via Next.js instrumentation hook.
 * - REQUIRED: app crashes if missing in production (fail-fast).
 * - RECOMMENDED: warning logged if missing (graceful degradation).
 * - OPTIONAL: silent if missing.
 *
 * @module lib/env-validation
 */

import { assertRateLimitRuntimeConfiguration } from '@/lib/rate-limit';

interface EnvVar {
  /** Environment variable name */
  name: string;
  /** Criticality level */
  level: 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';
  /** Human-readable description */
  description: string;
  /** If true, only required in production */
  prodOnly?: boolean;
}

/**
 * ENV contract for Nexus Réussite.
 *
 * REQUIRED (prod fail-fast):
 *   DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
 *
 * RECOMMENDED (graceful degradation):
 *   OLLAMA_URL, RAG_API_BASE_URL, RAG_BFF_SERVICE_TOKEN,
 *   RAG_ENGINE_API_KEY, identity signer settings, SMTP_HOST, CLICTOPAY_API_KEY
 *
 * OPTIONAL:
 *   LLM_MODE, OLLAMA_MODEL, OLLAMA_TIMEOUT, SENTRY_DSN
 */
const ENV_CONTRACT: EnvVar[] = [
  // ─── REQUIRED (fail-fast in production) ────────────────────────────
  { name: 'DATABASE_URL', level: 'REQUIRED', description: 'PostgreSQL connection string', prodOnly: false },
  { name: 'NEXTAUTH_SECRET', level: 'REQUIRED', description: 'NextAuth.js signing secret (≥32 chars recommended)', prodOnly: true },
  { name: 'NEXTAUTH_URL', level: 'REQUIRED', description: 'Canonical app URL for NextAuth callbacks', prodOnly: true },
  { name: 'RATE_LIMIT_BACKEND', level: 'REQUIRED', description: 'Distributed rate-limit backend (redis)', prodOnly: true },
  { name: 'RATE_LIMIT_KEY_SECRET', level: 'REQUIRED', description: 'Dedicated HMAC secret for opaque rate-limit keys', prodOnly: true },
  { name: 'RATE_LIMIT_TRUST_PROXY_HOPS', level: 'REQUIRED', description: 'Exact trusted reverse-proxy hop count', prodOnly: true },

  // ─── RECOMMENDED (graceful degradation) ────────────────────────────
  { name: 'OLLAMA_URL', level: 'RECOMMENDED', description: 'Ollama LLM service URL (fallback: Docker service name in prod)' },
  { name: 'RAG_API_BASE_URL', level: 'RECOMMENDED', description: 'External RAG v2 API base URL' },
  { name: 'RAG_BFF_SERVICE_TOKEN', level: 'RECOMMENDED', description: 'Dedicated BFF bearer credential for RAG v2' },
  { name: 'RAG_ENGINE_API_KEY', level: 'RECOMMENDED', description: 'Scoped rag:search client key for RAG v2' },
  { name: 'NEXUS_INTERNAL_TOKEN_SECRET', level: 'RECOMMENDED', description: 'HMAC secret for signed RAG academic identities' },
  { name: 'NEXUS_INTERNAL_TOKEN_ISSUER', level: 'RECOMMENDED', description: 'Issuer for the RAG transport identity envelope' },
  { name: 'NEXUS_INTERNAL_TOKEN_AUDIENCE', level: 'RECOMMENDED', description: 'Audience for the RAG transport identity envelope' },
  { name: 'NEXUS_SSO_ISSUER', level: 'RECOMMENDED', description: 'Issuer for the nested Nexus academic identity' },
  { name: 'NEXUS_SSO_AUDIENCE', level: 'RECOMMENDED', description: 'Audience for the nested Nexus academic identity' },
  { name: 'SMTP_HOST', level: 'RECOMMENDED', description: 'SMTP server for transactional emails' },
  { name: 'SMTP_FROM', level: 'RECOMMENDED', description: 'Sender email address for transactional emails' },
  { name: 'CLICTOPAY_API_KEY', level: 'RECOMMENDED', description: 'ClicToPay payment gateway API key (Banque Zitouna)' },
  // ─── OPTIONAL (silent if missing) ──────────────────────────────────
  { name: 'LLM_MODE', level: 'OPTIONAL', description: 'LLM behavior: live (default) | stub | off' },
  { name: 'OLLAMA_MODEL', level: 'OPTIONAL', description: 'Ollama model name (default: qwen2.5:32b)' },
  { name: 'OLLAMA_TIMEOUT', level: 'OPTIONAL', description: 'Ollama request timeout in ms (default: 120000)' },
  { name: 'ARIA_RAG_ENGINE_TIMEOUT_MS', level: 'OPTIONAL', description: 'RAG v2 request timeout in ms' },
  { name: 'RAG_MANIFEST_API_KEY', level: 'OPTIONAL', description: 'Ops-only scoped rag:read-source key for the compatibility gate' },
  { name: 'SENTRY_DSN', level: 'OPTIONAL', description: 'Sentry error tracking DSN' },
  { name: 'REDIS_URL', level: 'OPTIONAL', description: 'Redis URL for distributed rate limiting' },
];

/**
 * Validate environment variables at boot.
 *
 * In production: throws on missing REQUIRED vars (fail-fast).
 * In dev/test: warns only.
 *
 * @returns Summary object for logging/ops.
 */
export function validateEnv(): { ok: boolean; missing: string[]; warnings: string[] } {
  const isProd = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const v of ENV_CONTRACT) {
    const value = process.env[v.name];
    const isEmpty = !value || value.trim() === '';

    if (v.prodOnly && !isProd) continue;

    if (isEmpty) {
      if (v.level === 'REQUIRED') {
        missing.push(`${v.name} — ${v.description}`);
      } else if (v.level === 'RECOMMENDED') {
        warnings.push(`${v.name} — ${v.description}`);
      }
      // OPTIONAL: silent
    }
  }

  // NEXTAUTH_SECRET length check (security hardening)
  const secret = process.env.NEXTAUTH_SECRET;
  if (isProd && secret && secret.length < 32) {
    warnings.push(`NEXTAUTH_SECRET is ${secret.length} chars — recommended ≥32 for production security`);
  }

  if (isProd) {
    try {
      assertRateLimitRuntimeConfiguration();
    } catch (error) {
      const code = error instanceof Error ? error.message : 'RATE_LIMIT_CONFIGURATION_INVALID';
      missing.push(`RATE_LIMIT_CONFIGURATION (${code})`);
    }
  }

  // Log results
  if (missing.length > 0) {
    console.error(`[ENV] ❌ MISSING REQUIRED (${missing.length}):`);
    missing.forEach((m) => console.error(`  - ${m}`));
  }
  if (warnings.length > 0) {
  }

  // Fail-fast in production
  if (isProd && missing.length > 0) {
    throw new Error(
      `[ENV] FATAL: ${missing.length} required environment variable(s) missing in production.\n` +
      missing.map((m) => `  - ${m}`).join('\n')
    );
  }

  return { ok: missing.length === 0, missing, warnings };
}

/** Export contract for documentation/ops */
export { ENV_CONTRACT };
export type { EnvVar };
