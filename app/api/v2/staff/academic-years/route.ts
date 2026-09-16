export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { listAcademicYears } from '@/lib/core-v2/queries/staff';
import { createAcademicYear } from '@/lib/core-v2/services';

export const GET = defineStaffRoute({
  handler: async ({ client, ctx }) => ({ data: await listAcademicYears(client, ctx) }),
});

export const POST = defineStaffRoute({
  body: z.object({ startYear: z.number().int(), startsAt: z.coerce.date(), endsAt: z.coerce.date() }),
  handler: async ({ client, ctx, body }) => ({ status: 201, data: await createAcademicYear(client, ctx, body) }),
});
