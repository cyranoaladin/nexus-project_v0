export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { revokeDiagnosticAssignment } from '@/lib/core-v2/services/diagnostics';

const revokeBodySchema = z.object({ reason: z.string().trim().min(1).max(500) });

/** Security-suspension policy (§4/§6): flips the assignment to REVOKED, keeps full history. */
export const POST = defineStaffRoute({
  body: revokeBodySchema,
  handler: async ({ client, ctx, params, body }) => ({
    data: await revokeDiagnosticAssignment(client, ctx, { assignmentId: params.assignmentId, reason: body.reason }),
  }),
});
