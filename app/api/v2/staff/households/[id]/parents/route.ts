export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { attachExistingParent, createParent } from '@/lib/core-v2/services';

const body = z.union([
  z.object({
    parent: z.object({ firstName: z.string(), lastName: z.string(), email: z.string(), phone: z.string().optional() }),
    isPrimaryContact: z.boolean().optional(),
  }),
  z.object({ existingParentUserId: z.string(), isPrimaryContact: z.boolean().optional() }),
]);

/** Adds a parent to a household: either a brand-new account or an existing PARENT account. */
export const POST = defineStaffRoute({
  body,
  handler: async ({ client, ctx, body, params }) => {
    if ('existingParentUserId' in body) {
      const membership = await attachExistingParent(client, ctx, {
        householdId: params.id,
        parentUserId: body.existingParentUserId,
        isPrimaryContact: body.isPrimaryContact,
      });
      return { status: 201, data: { membership } };
    }
    const { parent, membership } = await createParent(client, ctx, {
      householdId: params.id,
      parent: body.parent,
      isPrimaryContact: body.isPrimaryContact,
    });
    return { status: 201, data: { parent: publicUser(parent), membership } };
  },
});
