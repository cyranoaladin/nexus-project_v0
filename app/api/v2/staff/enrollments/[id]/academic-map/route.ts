export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { setAcademicMap } from '@/lib/core-v2/services';

export const PUT = defineStaffRoute({
  body: z.object({
    gradeLevel: z.string(),
    academicTrack: z.string().optional(),
    stmgPathway: z.string().nullable().optional(),
    schoolingStatus: z.string().nullable().optional(),
    school: z.string().nullable().optional(),
  }),
  handler: async ({ client, ctx, body, params }) => ({
    data: await setAcademicMap(client, ctx, {
      enrollmentId: params.id,
      academicMap: body as Parameters<typeof setAcademicMap>[2]['academicMap'],
    }),
  }),
});
