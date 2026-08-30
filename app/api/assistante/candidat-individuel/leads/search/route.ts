import { NextRequest } from 'next/server';

import { candidatIndividuelLeadSearchRequestSchema } from '@/lib/quotes/candidat-individuel-search-contracts';
import { searchCandidatIndividuelLeads } from '@/lib/quotes/candidat-individuel-staff-search.server';
import { handleCandidatIndividuelStaffSearch } from '@/lib/quotes/candidat-individuel-staff-search-route.server';

export async function POST(request: NextRequest) {
  return handleCandidatIndividuelStaffSearch({
    request,
    requestSchema: candidatIndividuelLeadSearchRequestSchema,
    scope: 'candidat-individuel-lead-search',
    search: searchCandidatIndividuelLeads,
  });
}
