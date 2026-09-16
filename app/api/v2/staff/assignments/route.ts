export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { assignCoach } from '@/lib/core-v2/services';

export const POST = defineStaffRoute({
  body: z.object({ coachId: z.string(), enrollmentId: z.string(), courseKey: z.string() }),
  handler: async ({ client, ctx, body }) => ({ status: 201, data: await assignCoach(client, ctx, body) }),
});
