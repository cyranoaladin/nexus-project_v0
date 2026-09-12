export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { pageQuerySchema, searchStudents } from '@/lib/core-v2/queries/staff';
import { createStudent } from '@/lib/core-v2/services';

export const GET = defineStaffRoute({
  query: pageQuerySchema,
  handler: async ({ client, ctx, query }) => ({ data: await searchStudents(client, ctx, query) }),
});

export const POST = defineStaffRoute({
  body: z.object({
    householdId: z.string(),
    student: z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().optional(),
      birthDate: z.coerce.date().optional(),
    }),
  }),
  handler: async ({ client, ctx, body }) => {
    const { student, user } = await createStudent(client, ctx, body);
    return { status: 201, data: { student, user: publicUser(user) } };
  },
});
