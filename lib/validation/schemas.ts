import { z } from 'zod';

export const PricingSchema = z.object({
  service: z.string().min(2),
  variable: z.string().min(2),
  valeur: z.number().nonnegative(),
  devise: z.string().min(3).default('TND'),
});
export const PricingPatchSchema = PricingSchema.partial();

export const CreditPackSchema = z.object({
  credits: z.number().int().positive(),
  priceTnd: z.number().positive(),
  bonus: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

export const CreditUsageSchema = z.object({
  key: z.string().min(2),
  credits: z.number().int().positive(),
});

export const PaymentSettingsSchema = z.object({
  allowCard: z.boolean(),
  allowWire: z.boolean(),
  allowCash: z.boolean(),
  iban: z.string().optional().nullable(),
  cashNote: z.string().optional().nullable(),
});

export const BillingPolicySchema = z.object({
  annualDepositPct: z.number().int().min(0).max(100),
  scheduleEndISO: z.string().min(10),
});

export const OfferBindingRefSchema = z.object({
  variable: z.string().min(2),
  label: z.string().min(1),
});
export const OfferBindingSchema = z.object({
  code: z.string().min(2),
  label: z.string().min(2),
  includeAria: z.boolean().default(false),
  pricingRefs: z.array(OfferBindingRefSchema).min(1),
});
export const OfferBindingsSchema = z.object({ offers: z.array(OfferBindingSchema) });

export const SpendCreditsSchema = z.object({
  userId: z.string().min(1),
  usageKey: z.string().min(1).optional(),
  credits: z.number().int().positive().optional(),
  idempotencyKey: z.string().min(6).optional(),
  metadata: z.record(z.any()).optional(),
}).refine((d) => !!d.usageKey || !!d.credits, { message: 'usageKey ou credits requis' });
