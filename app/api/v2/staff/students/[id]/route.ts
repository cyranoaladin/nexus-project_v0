export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { correctStudentIdentity } from '@/lib/core-v2/services';

export const PATCH = defineStaffRoute({
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().nullable().optional(),
    birthDate: z.coerce.date().nullable().optional(),
  }),
  handler: async ({ client, ctx, body, params }) => {
    const { student, user } = await correctStudentIdentity(client, ctx, { studentId: params.id, changes: body });
    return { data: { student, user: publicUser(user) } };
  },
});
