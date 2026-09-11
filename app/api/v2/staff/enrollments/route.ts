export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { createAnnualEnrollment } from '@/lib/core-v2/services';

const academicMapBody = z.object({
  gradeLevel: z.string(),
  academicTrack: z.string().optional(),
  stmgPathway: z.string().nullable().optional(),
  schoolingStatus: z.string().nullable().optional(),
  school: z.string().nullable().optional(),
});

export const POST = defineStaffRoute({
  body: z.object({ studentId: z.string(), academicYearId: z.string(), academicMap: academicMapBody }),
  handler: async ({ client, ctx, body }) => ({
    status: 201,
    data: await createAnnualEnrollment(client, ctx, body as Parameters<typeof createAnnualEnrollment>[2]),
  }),
});
