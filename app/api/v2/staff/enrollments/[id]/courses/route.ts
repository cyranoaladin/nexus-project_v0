export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { setCourseEnrollments } from '@/lib/core-v2/services';

export const PUT = defineStaffRoute({
  body: z.object({ courses: z.array(z.object({ courseKey: z.string(), kind: z.enum(['SPECIALTY', 'OPTION']) })) }),
  handler: async ({ client, ctx, body, params }) => ({
    data: await setCourseEnrollments(client, ctx, { enrollmentId: params.id, courses: body.courses }),
  }),
});
