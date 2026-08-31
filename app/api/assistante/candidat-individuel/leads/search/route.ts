import { NextRequest } from 'next/server';

import { candidatIndividuelLeadSearchRequestSchema, candidatIndividuelLeadSearchSuccessSchema } from '@/lib/quotes/candidat-individuel-search-contracts';
import { searchCandidatIndividuelLeads } from '@/lib/quotes/candidat-individuel-staff-search.server';
import { handleCandidatIndividuelStaffSearch } from '@/lib/quotes/candidat-individuel-staff-search-route.server';

export async function POST(request: NextRequest) {
  return handleCandidatIndividuelStaffSearch({
    request,
    requestSchema: candidatIndividuelLeadSearchRequestSchema,
    responseSchema: candidatIndividuelLeadSearchSuccessSchema,
    scope: 'candidat-individuel-lead-search',
    operation: 'candidate-lead-search',
    search: searchCandidatIndividuelLeads,
  });
}
