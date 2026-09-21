export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { idSchema } from '@/lib/core-v2/services/validation';
import { attributeDiagnostic, listDiagnosticAssignmentsForStudent } from '@/lib/core-v2/services/diagnostics';

/** Dossier candidat — "Diagnostics" tab: every attribution for this student, with its full submission history. */
export const GET = defineStaffRoute({
  handler: async ({ client, ctx, params }) => ({
    data: await listDiagnosticAssignmentsForStudent(client, ctx, params.id),
  }),
});

const attributeBodySchema = z.object({
  instrumentRefId: idSchema,
  dueAt: z.coerce.date().optional(),
  modalities: z.string().trim().min(1).max(500).optional(),
  reviewerId: idSchema.optional(),
});

/** Attribution from the candidate's own dossier — the student id comes from the URL, never the body. */
export const POST = defineStaffRoute({
  body: attributeBodySchema,
  handler: async ({ client, ctx, params, body }) => ({
    status: 201,
    data: await attributeDiagnostic(client, ctx, { studentId: params.id, ...body }),
  }),
});
