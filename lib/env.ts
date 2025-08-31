import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  TEXBIN: z.string().optional(),
});

export const env = EnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  TEXBIN: process.env.TEXBIN,
});
