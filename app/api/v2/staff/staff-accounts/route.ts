export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { createStaffAccount, CREATABLE_STAFF_ROLES } from '@/lib/core-v2/services';

/**
 * Creates one ASSISTANTE or COACH account (ADMIN only — the capability is
 * asserted in the service, never here). The account arrives
 * PENDING_ACTIVATION without a password; invite it through
 * POST /api/v2/staff/accounts/[id]/invite.
 */
export const POST = defineStaffRoute({
  body: z.object({
    role: z.enum(CREATABLE_STAFF_ROLES),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string().optional(),
  }),
  handler: async ({ client, ctx, body }) => {
    const { user, coachProfile } = await createStaffAccount(client, ctx, body);
    return { status: 201, data: { user: publicUser(user), coachProfile } };
  },
});
