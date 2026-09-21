export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { listDiagnosticInstruments } from '@/lib/core-v2/services/diagnostics';

/** Staff-facing catalog listing: every instrument, every status (§4 — the operator must see WHY something isn't selectable). */
export const GET = defineStaffRoute({
  handler: async ({ client, ctx }) => ({ data: await listDiagnosticInstruments(client, ctx) }),
});
