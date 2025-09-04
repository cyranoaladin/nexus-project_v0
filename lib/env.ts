import { z } from 'zod';

// Validation stricte des variables d'environnement, adaptée par environnement.
// - En production: clés critiques requises, sinon l'app refuse de démarrer
// - En dev/test: valeurs par défaut permissives, mais schéma homogène

const BaseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Base de données
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // NextAuth
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),

  // SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_FALLBACK_MODEL: z.string().optional(),
  OPENAI_EMBEDDINGS_MODEL: z.string().default('text-embedding-3-large'),
  VECTOR_DIM: z.string().default('3072'),

  // Services internes optionnels
  USE_LLM_SERVICE: z.string().optional(),
  LLM_SERVICE_URL: z.string().optional(),
  PDF_GENERATOR_SERVICE_URL: z.string().optional(),
  RAG_SERVICE_URL: z.string().optional(),

  // URL publiques
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Divers
  TEXBIN: z.string().optional(),
});

const raw = BaseSchema.parse({
  NODE_ENV: process.env.NODE_ENV,

  DATABASE_URL: process.env.DATABASE_URL,

  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,

  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM: process.env.SMTP_FROM,

  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_FALLBACK_MODEL: process.env.OPENAI_FALLBACK_MODEL,
  OPENAI_EMBEDDINGS_MODEL: process.env.OPENAI_EMBEDDINGS_MODEL,
  VECTOR_DIM: process.env.VECTOR_DIM,

  USE_LLM_SERVICE: process.env.USE_LLM_SERVICE,
  LLM_SERVICE_URL: process.env.LLM_SERVICE_URL,
  PDF_GENERATOR_SERVICE_URL: process.env.PDF_GENERATOR_SERVICE_URL,
  RAG_SERVICE_URL: process.env.RAG_SERVICE_URL,

  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,

  TEXBIN: process.env.TEXBIN,
});

// Renforcement des exigences en production
if (raw.NODE_ENV === 'production') {
  const errors: string[] = [];

  // Base
  if (!raw.DATABASE_URL || !/^postgresql:\/\//.test(raw.DATABASE_URL)) {
    errors.push('DATABASE_URL must be a valid PostgreSQL URL in production');
  }

  // NextAuth
  if (!raw.NEXTAUTH_URL) errors.push('NEXTAUTH_URL is required in production');
  if (!raw.NEXTAUTH_SECRET || raw.NEXTAUTH_SECRET.length < 32) errors.push('NEXTAUTH_SECRET (>= 32 chars) is required in production');

  // OpenAI (au moins un modèle principal explicite, même si microservice)
  if (!raw.OPENAI_MODEL) errors.push('OPENAI_MODEL is required in production');
  // Embeddings requis en production (Option A)
  if (!raw.OPENAI_EMBEDDINGS_MODEL) errors.push('OPENAI_EMBEDDINGS_MODEL is required in production');
  if (!raw.VECTOR_DIM) errors.push('VECTOR_DIM is required in production');
  if (raw.OPENAI_EMBEDDINGS_MODEL === 'text-embedding-3-large' && String(raw.VECTOR_DIM) !== '3072') {
    errors.push('VECTOR_DIM must be 3072 when using text-embedding-3-large');
  }

  // Services IA si activés explicitement
  if (raw.USE_LLM_SERVICE === '1' && (!raw.LLM_SERVICE_URL || !/^https?:\/\//.test(raw.LLM_SERVICE_URL))) {
    errors.push('LLM_SERVICE_URL is required and must be http(s) when USE_LLM_SERVICE=1');
  }

  // SMTP (emails transactionnels prod)
  if (!raw.SMTP_HOST) errors.push('SMTP_HOST is required in production');
  if (!raw.SMTP_PORT) errors.push('SMTP_PORT is required in production');
  if (!raw.SMTP_USER) errors.push('SMTP_USER is required in production');
  if (!raw.SMTP_PASSWORD) errors.push('SMTP_PASSWORD is required in production');
  if (!raw.SMTP_FROM) errors.push('SMTP_FROM is required in production');

  // URL publique (pour liens absolus)
  if (!raw.NEXT_PUBLIC_APP_URL) errors.push('NEXT_PUBLIC_APP_URL is required in production');

  if (errors.length) {
    throw new Error(`[ENV_VALIDATION_PROD] Missing/invalid variables:\n- ${errors.join('\n- ')}`);
  }
}

export const env = raw;
