import { NextRequest, NextResponse } from 'next/server';

import { candidatIndividuelLeadSearchRequestSchema } from '@/lib/quotes/candidat-individuel-search-contracts';
import { handleCandidatIndividuelStaffSearch } from '@/lib/quotes/candidat-individuel-staff-search-route.server';
import { searchContactLeads } from '@/lib/quotes/persistence.server';
import { devisLeadSearchSuccessSchema } from '@/lib/quotes/staff-directory-search-contracts';

export async function POST(request: NextRequest) {
  return handleCandidatIndividuelStaffSearch({
    request,
    requestSchema: candidatIndividuelLeadSearchRequestSchema,
    responseSchema: devisLeadSearchSuccessSchema,
    scope: 'quotes-lead-search',
    operation: 'quote-lead-search',
    requireInternalPipeline: false,
    search: async ({ query, limit }) => ({
      items: (await searchContactLeads(query)).slice(0, limit).map(({ id, name, email, phone }) => ({ id, name, email, phone })),
    }),
  });
}

export async function GET(_request: Request) {
  return NextResponse.json(
    { error: 'METHOD_NOT_ALLOWED' },
    {
      status: 405,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
      },
    }
  );
}
