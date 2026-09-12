export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { createPlanningSeries } from '@/lib/core-v2/services';

export const POST = defineStaffRoute({
  body: z.object({
    assignmentId: z.string(),
    startDate: z.coerce.date(),
    localStartTime: z.string(),
    localEndTime: z.string(),
    recurrenceRule: z.string(),
    recurrenceCount: z.number().nullable().optional(),
    recurrenceUntil: z.coerce.date().nullable().optional(),
    modality: z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']),
    location: z.string().nullable().optional(),
  }),
  handler: async ({ client, ctx, body }) => ({ status: 201, data: await createPlanningSeries(client, ctx, body) }),
});
