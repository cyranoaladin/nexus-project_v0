import { StageType, Subject } from '@prisma/client';
import { z } from 'zod';

export const createStageSchema = z.object({
  slug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/),
  title: z.string().min(3).max(100),
  subtitle: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  type: z.nativeEnum(StageType),
  subject: z.array(z.nativeEnum(Subject)).min(1),
  level: z.array(z.string()).min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  capacity: z.number().int().min(1).max(50),
  priceAmount: z.number().min(0),
  priceCurrency: z.string().default('TND'),
  location: z.string().max(200).optional(),
  isVisible: z.boolean().default(true),
  isOpen: z.boolean().default(true),
});

export const updateStageSchema = createStageSchema.partial();

export const createSessionSchema = z.object({
  title: z.string().min(3).max(200),
  subject: z.nativeEnum(Subject),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  location: z.string().max(200).optional(),
  coachId: z.string().optional(),
  description: z.string().max(1000).optional(),
});

export const updateSessionSchema = createSessionSchema.partial();

export const assignCoachSchema = z.object({
  coachId: z.string().min(1),
  role: z.string().max(120).optional(),
});
