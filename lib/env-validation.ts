/**
 * Environment Variable Validation (Enhanced with Zod)
 * 
 * This module validates all required environment variables at startup using Zod schemas.
 * If any required variable is missing or invalid, the application will fail fast
 * with a clear error message before starting.
 * 
 * Called at server startup via Next.js instrumentation hook.
 * 
 * @module lib/env-validation
 */

import { z } from 'zod';

const nodeEnvEnum = z.enum(['development', 'production', 'test']);
const llmModeEnum = z.enum(['live', 'stub', 'off']);
const embeddingProviderEnum = z.enum(['openai', 'huggingface']);

/**
 * Environment variable schema with validation rules
 */
const envSchema = z.object({
  // ─── Application ────────────────────────────────────────────────────────
  NODE_ENV: nodeEnvEnum.default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  
  // ─── Database ───────────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Docker Compose variables (optional)
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DB: z.string().optional(),
  DATABASE_PASSWORD: z.string().optional(),
  
  // ─── NextAuth ───────────────────────────────────────────────────────────
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  
  // ─── Email / SMTP ───────────────────────────────────────────────────────
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  MAIL_REPLY_TO: z.string().optional(),
  INTERNAL_NOTIFICATION_EMAIL: z.string().optional(),
  MAIL_DISABLED: z.string().optional(),
  
  // ─── OpenAI ─────────────────────────────────────────────────────────────
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_EMBEDDINGS_MODEL: z.string().optional(),
  VECTOR_DIM: z.string().optional(),
  
  // ─── Hugging Face ───────────────────────────────────────────────────────
  EMBEDDING_PROVIDER: z.string().optional(),
  HUGGINGFACE_HUB_TOKEN: z.string().optional(),
  HF_EMBEDDING_MODEL: z.string().optional(),
  
  // ─── Ollama (Local LLM) ─────────────────────────────────────────────────
  OLLAMA_URL: z.string().optional(),
  OLLAMA_MODEL: z.string().optional(),
  OLLAMA_TIMEOUT: z.string().optional(),
  LLM_MODE: z.string().optional(),
  
  // ─── RAG Ingestor ───────────────────────────────────────────────────────
  RAG_INGESTOR_URL: z.string().optional(),
  RAG_SEARCH_TIMEOUT: z.string().optional(),
  
  // ─── Microservices (Legacy) ─────────────────────────────────────────────
  PDF_GENERATOR_SERVICE_URL: z.string().optional(),
  
  // ─── Payments - Konnect / ClicToPay ────────────────────────────────────
  KONNECT_API_KEY: z.string().optional(),
  KONNECT_WALLET_ID: z.string().optional(),
  KONNECT_BASE_URL: z.string().optional(),
  KONNECT_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_KONNECT_PUBLIC_KEY: z.string().optional(),
  CLICTOPAY_API_KEY: z.string().optional(),
  
  // ─── Payments - Wise ────────────────────────────────────────────────────
  WISE_API_KEY: z.string().optional(),
  WISE_PROFILE_ID: z.string().optional(),
  
  // ─── Jitsi ──────────────────────────────────────────────────────────────
  NEXT_PUBLIC_JITSI_SERVER_URL: z.string().optional(),
  
  // ─── Telegram ───────────────────────────────────────────────────────────
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_DISABLED: z.string().optional(),
  
  // ─── E2E Testing ────────────────────────────────────────────────────────
  E2E: z.string().optional(),
  NEXT_PUBLIC_E2E: z.string().optional(),
  E2E_RUN: z.string().optional(),
  
  // ─── Rate Limiting ──────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: z.string().optional(),
  RATE_LIMIT_MAX: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  
  // ─── Logging ────────────────────────────────────────────────────────────
  LOG_LEVEL: z.string().optional(),
  
  // ─── Telemetry ──────────────────────────────────────────────────────────
  NEXT_TELEMETRY_DISABLED: z.string().optional(),
  
  // ─── Sentry ─────────────────────────────────────────────────────────────
  SENTRY_DSN: z.string().optional(),
  
  // ─── Runtime / Testing ──────────────────────────────────────────────────
  SKIP_MIDDLEWARE: z.string().optional(),
  NEXT_RUNTIME: z.string().optional(),
  NEXT_PHASE: z.string().optional(),
});

interface EnvVar {
  /** Environment variable name */
  name: string;
  /** Criticality level */
  level: 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';
  /** Human-readable description */
  description: string;
  /** If true, only required in production */
  prodOnly?: boolean;
  /** Validation function */
  validate?: (value: string) => boolean;
  /** Expected format hint */
  format?: string;
}

/**
 * ENV contract for Nexus Réussite with enhanced validation.
 */
const ENV_CONTRACT: EnvVar[] = [
  // ─── REQUIRED (fail-fast in production) ────────────────────────────
  { 
    name: 'DATABASE_URL', 
    level: 'REQUIRED', 
    description: 'PostgreSQL connection string', 
    prodOnly: false,
    validate: (v) => v.startsWith('postgresql://'),
    format: 'postgresql://user:password@host:port/database'
  },
  { 
    name: 'NEXTAUTH_SECRET', 
    level: 'REQUIRED', 
    description: 'NextAuth.js signing secret (≥32 chars)', 
    prodOnly: true,
    validate: (v) => v.length >= 32,
    format: 'minimum 32 characters (use: openssl rand -hex 32)'
  },
  { 
    name: 'NEXTAUTH_URL', 
    level: 'REQUIRED', 
    description: 'Canonical app URL for NextAuth callbacks', 
    prodOnly: true,
    validate: (v) => v.startsWith('http://') || v.startsWith('https://'),
    format: 'http://localhost:3000 or https://example.com'
  },

  // ─── RECOMMENDED (graceful degradation) ────────────────────────────
  { name: 'OLLAMA_URL', level: 'RECOMMENDED', description: 'Ollama LLM service URL', format: 'http://ollama:11434' },
  { name: 'RAG_INGESTOR_URL', level: 'RECOMMENDED', description: 'RAG Ingestor service URL', format: 'http://ingestor:8001' },
  { 
    name: 'SMTP_HOST', 
    level: 'RECOMMENDED', 
    description: 'SMTP server for transactional emails',
    format: 'smtp.example.com'
  },
  { 
    name: 'SMTP_FROM', 
    level: 'RECOMMENDED', 
    description: 'Sender email address', 
    validate: (v) => v.includes('@'),
    format: 'Name <email@example.com>'
  },
  { name: 'OPENAI_API_KEY', level: 'RECOMMENDED', description: 'OpenAI API key for ARIA assistant', format: 'sk-...' },
  { name: 'CLICTOPAY_API_KEY', level: 'RECOMMENDED', description: 'ClicToPay payment gateway API key' },
  { name: 'TELEGRAM_BOT_TOKEN', level: 'RECOMMENDED', description: 'Telegram bot token for notifications' },

  // ─── OPTIONAL (silent if missing) ──────────────────────────────────
  { name: 'LLM_MODE', level: 'OPTIONAL', description: 'LLM behavior: live (default) | stub | off' },
  { name: 'OLLAMA_MODEL', level: 'OPTIONAL', description: 'Ollama model name', format: 'qwen2.5:32b' },
  { name: 'OLLAMA_TIMEOUT', level: 'OPTIONAL', description: 'Ollama request timeout in ms', format: '180000' },
  { name: 'RAG_SEARCH_TIMEOUT', level: 'OPTIONAL', description: 'RAG search timeout in ms', format: '10000' },
  { name: 'SENTRY_DSN', level: 'OPTIONAL', description: 'Sentry error tracking DSN' },
  { name: 'UPSTASH_REDIS_REST_URL', level: 'OPTIONAL', description: 'Upstash Redis URL for rate limiting' },
  { name: 'UPSTASH_REDIS_REST_TOKEN', level: 'OPTIONAL', description: 'Upstash Redis token for rate limiting' },
];

/**
 * Validate environment variables at boot with enhanced Zod validation.
 *
 * In production: throws on missing REQUIRED vars (fail-fast).
 * In dev/test: warns only.
 *
 * @returns Summary object for logging/ops.
 */
export function validateEnv(): { ok: boolean; missing: string[]; warnings: string[]; errors: string[] } {
  const isProd = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // First, run Zod schema validation
  const zodResult = envSchema.safeParse(process.env);
  if (!zodResult.success) {
    zodResult.error.issues.forEach(issue => {
      const path = issue.path.join('.');
      errors.push(`${path}: ${issue.message}`);
    });
  }

  // Then, run contract-based validation
  for (const v of ENV_CONTRACT) {
    const value = process.env[v.name];
    const isEmpty = !value || value.trim() === '';

    if (v.prodOnly && !isProd) continue;

    if (isEmpty) {
      if (v.level === 'REQUIRED') {
        missing.push(`${v.name} — ${v.description}${v.format ? ` (format: ${v.format})` : ''}`);
      } else if (v.level === 'RECOMMENDED') {
        warnings.push(`${v.name} — ${v.description}${v.format ? ` (format: ${v.format})` : ''}`);
      }
    } else if (v.validate && !v.validate(value)) {
      // Value exists but fails validation
      const msg = `${v.name} — Invalid format. Expected: ${v.format || v.description}`;
      if (v.level === 'REQUIRED') {
        missing.push(msg);
      } else if (v.level === 'RECOMMENDED') {
        warnings.push(msg);
      }
    }
  }

  // NEXTAUTH_SECRET length check (security hardening)
  const secret = process.env.NEXTAUTH_SECRET;
  if (isProd && secret && secret.length < 32) {
    warnings.push(`NEXTAUTH_SECRET is ${secret.length} chars — recommended ≥32 for production security`);
  }

  // Log results
  if (errors.length > 0 && isProd) {
    console.error(`[ENV] ❌ VALIDATION ERRORS (${errors.length}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
  }
  
  if (missing.length > 0) {
    console.error(`[ENV] ❌ MISSING REQUIRED (${missing.length}):`);
    missing.forEach((m) => console.error(`  - ${m}`));
  }
  
  if (warnings.length > 0) {
    console.warn(`[ENV] ⚠️  RECOMMENDED missing or invalid (${warnings.length}):`);
    warnings.forEach((w) => console.warn(`  - ${w}`));
  }
  
  if (missing.length === 0 && warnings.length === 0 && errors.length === 0) {
    console.log('[ENV] ✅ All environment variables validated successfully');
  } else if (missing.length === 0 && errors.length === 0) {
    console.log(`[ENV] ✅ Required OK — ${warnings.length} recommended missing (graceful degradation)`);
  }

  // Fail-fast in production
  if (isProd && (missing.length > 0 || errors.length > 0)) {
    const total = missing.length + errors.length;
    throw new Error(
      `[ENV] FATAL: ${total} required environment variable(s) missing or invalid in production.\n` +
      [...missing, ...errors].map((m) => `  - ${m}`).join('\n') +
      '\n\n💡 Check your .env file against .env.example'
    );
  }

  return { ok: missing.length === 0 && errors.length === 0, missing, warnings, errors };
}

/** Export contract for documentation/ops */
export { ENV_CONTRACT };
export type { EnvVar };
