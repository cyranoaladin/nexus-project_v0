/**
 * GET /api/quotes/leads/search?q=... — staff-only ContactLead typeahead
 * backing the assistante devis workspace's lead picker (replaces pasting a
 * raw ContactLead id by hand).
 */
import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { searchContactLeads } from '@/lib/quotes/persistence.server';
import { serializeError } from '@/lib/utils/serialize-error';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ q: z.string().trim().min(2).max(200) });

export async function GET(request: Request) {
  const session = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(session)) return session;

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'quotes-lead-search',
    identity: session.user.id,
  });
  if (blocked) return blocked;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ q: url.searchParams.get('q') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  try {
    const found = await searchContactLeads(parsed.data.q);
    // Re-project explicitly rather than trust the persistence layer's
    // `select` alone — defense in depth against a future accidental
    // over-select (e.g. `notes`, which can carry freeform internal text).
    const leads = found.map((lead) => ({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
    }));
    return NextResponse.json({ leads }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[quotes/leads/search] error', serializeError(error));
    return NextResponse.json({ error: 'search_failed' }, { status: 400 });
  }
}
