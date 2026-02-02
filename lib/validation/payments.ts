/**
 * Payment Validation Schemas
 *
 * Validation for payment-related API endpoints.
 */

import { z } from 'zod';
import { idSchema, amountSchema } from './common';

/**
 * Payment method enum
 */
export const paymentMethodSchema = z.enum(['konnect', 'cash', 'bank_transfer', 'check']);

/**
 * Payment type enum
 */
export const paymentTypeSchema = z.enum(['subscription', 'addon', 'pack']);

/**
 * Currency enum (support TND for Tunisia)
 */
export const currencySchema = z.enum(['TND', 'USD', 'EUR']).default('TND');

/**
 * Konnect payment creation schema (POST /api/payments/konnect)
 */
export const createKonnectPaymentSchema = z.object({
  type: paymentTypeSchema,
  key: z.string().trim().min(1, 'Payment key is required'),
  studentId: idSchema,
  amount: amountSchema,
  description: z.string().trim().min(1).max(500),
});

export type CreateKonnectPaymentInput = z.infer<typeof createKonnectPaymentSchema>;

/**
 * Generic payment creation schema (POST /api/admin/payments)
 */
export const createPaymentSchema = z.object({
  userId: idSchema,
  method: paymentMethodSchema,
  type: z.enum(['SUBSCRIPTION', 'CREDIT_PACK', 'SPECIAL_PACK']),
  amount: amountSchema,
  currency: currencySchema,
  description: z.string().trim().max(500).optional(),
  reference: z.string().trim().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/**
 * Payment webhook validation (POST /api/webhooks/konnect)
 */
export const konnectWebhookSchema = z.object({
  payment_ref: z.string(),
  order_id: z.string(),
  status: z.enum(['completed', 'failed', 'pending']),
  amount: z.number(),
  signature: z.string(),
});

export type KonnectWebhookPayload = z.infer<typeof konnectWebhookSchema>;

/**
 * Payment list filters (GET /api/payments)
 */
export const listPaymentsSchema = z.object({
  userId: idSchema.optional(),
  method: paymentMethodSchema.optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type ListPaymentsParams = z.infer<typeof listPaymentsSchema>;

/**
 * Refund request schema (POST /api/admin/payments/:id/refund)
 */
export const refundPaymentSchema = z.object({
  reason: z.string().trim().min(1, 'Refund reason is required').max(500),
  amount: amountSchema.optional(), // Partial refund if specified
});

export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
