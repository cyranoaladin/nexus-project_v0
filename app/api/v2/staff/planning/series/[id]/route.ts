export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { changePlanningSeries } from '@/lib/core-v2/services';

/** Optimistic change: the caller states the revision it read; a stale one is a 409 CONFLICT. */
export const PATCH = defineStaffRoute({
  body: z.object({
    expectedRevision: z.number().int(),
    changes: z.object({
      startDate: z.coerce.date().optional(),
      localStartTime: z.string().optional(),
      localEndTime: z.string().optional(),
      recurrenceRule: z.string().optional(),
      recurrenceCount: z.number().nullable().optional(),
      recurrenceUntil: z.coerce.date().nullable().optional(),
      modality: z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']).optional(),
      location: z.string().nullable().optional(),
      status: z.enum(['ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED']).optional(),
    }),
  }),
  handler: async ({ client, ctx, body, params }) => ({
    data: await changePlanningSeries(client, ctx, { seriesId: params.id, ...body }),
  }),
});
