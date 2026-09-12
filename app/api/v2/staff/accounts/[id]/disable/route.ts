export const dynamic = 'force-dynamic';

import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { disableAccount } from '@/lib/core-v2/services';

export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params }) => ({ data: publicUser(await disableAccount(client, ctx, params.id)) }),
});
