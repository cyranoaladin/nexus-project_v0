export const dynamic = 'force-dynamic';

import { NotFoundError } from '@/lib/core-v2/errors';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { getOwnStudent } from '@/lib/core-v2/queries/student';

/** The signed-in student's own enrollments (§AI). Scoped by the actor; no id is accepted. */
export const GET = defineStaffRoute({
  handler: async ({ client, ctx }) => {
    const student = await getOwnStudent(client, ctx);
    if (!student) throw new NotFoundError('No student record is attached to this account.');
    return { data: student };
  },
});
