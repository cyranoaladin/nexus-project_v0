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
 *   OLLAMA_URL, RAG_INGESTOR_URL, SMTP_HOST, KONNECT_API_KEY
 *
 * OPTIONAL:
 *   LLM_MODE, OLLAMA_MODEL, OLLAMA_TIMEOUT, SENTRY_DSN
 */
const ENV_CONTRACT: EnvVar[] = [
  // ─── REQUIRED (fail-fast in production) ────────────────────────────
  { name: 'DATABASE_URL', level: 'REQUIRED', description: 'PostgreSQL connection string', prodOnly: false },
  { name: 'NEXTAUTH_SECRET', level: 'REQUIRED', description: 'NextAuth.js signing secret (≥32 chars recommended)', prodOnly: true },
  { name: 'NEXTAUTH_URL', level: 'REQUIRED', description: 'Canonical app URL for NextAuth callbacks', prodOnly: true },

  // ─── RECOMMENDED (graceful degradation) ────────────────────────────
  { name: 'OLLAMA_URL', level: 'RECOMMENDED', description: 'Ollama LLM service URL (fallback: Docker service name in prod)' },
  { name: 'RAG_INGESTOR_URL', level: 'RECOMMENDED', description: 'RAG Ingestor service URL (fallback: Docker service name in prod)' },
  { name: 'SMTP_HOST', level: 'RECOMMENDED', description: 'SMTP server for transactional emails' },
  { name: 'SMTP_FROM', level: 'RECOMMENDED', description: 'Sender email address for transactional emails' },
  { name: 'KONNECT_API_KEY', level: 'RECOMMENDED', description: 'Konnect payment gateway API key' },
  { name: 'TELEGRAM_BOT_TOKEN', level: 'RECOMMENDED', description: 'Telegram bot token for notifications' },

  // ─── OPTIONAL (silent if missing) ──────────────────────────────────
  { name: 'LLM_MODE', level: 'OPTIONAL', description: 'LLM behavior: live (default) | stub | off' },
  { name: 'OLLAMA_MODEL', level: 'OPTIONAL', description: 'Ollama model name (default: qwen2.5:32b)' },
  { name: 'OLLAMA_TIMEOUT', level: 'OPTIONAL', description: 'Ollama request timeout in ms (default: 120000)' },
  { name: 'RAG_SEARCH_TIMEOUT', level: 'OPTIONAL', description: 'RAG search timeout in ms (default: 10000)' },
  { name: 'SENTRY_DSN', level: 'OPTIONAL', description: 'Sentry error tracking DSN' },
  { name: 'UPSTASH_REDIS_REST_URL', level: 'OPTIONAL', description: 'Upstash Redis URL for rate limiting' },
  { name: 'UPSTASH_REDIS_REST_TOKEN', level: 'OPTIONAL', description: 'Upstash Redis token for rate limiting' },
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

  // Log results
  if (missing.length > 0) {
    console.error(`[ENV] ❌ MISSING REQUIRED (${missing.length}):`);
    missing.forEach((m) => console.error(`  - ${m}`));
  }
  if (warnings.length > 0) {
    console.warn(`[ENV] ⚠️  RECOMMENDED missing (${warnings.length}):`);
    warnings.forEach((w) => console.warn(`  - ${w}`));
  }
  if (missing.length === 0 && warnings.length === 0) {
    console.log('[ENV] ✅ All environment variables validated');
  } else if (missing.length === 0) {
    console.log(`[ENV] ✅ Required OK — ${warnings.length} recommended missing (graceful degradation)`);
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
