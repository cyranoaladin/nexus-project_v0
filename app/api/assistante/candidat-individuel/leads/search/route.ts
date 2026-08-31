import { NextRequest } from 'next/server';

import { candidatIndividuelLeadSearchSuccessSchema } from '@/lib/quotes/candidat-individuel-search-contracts';
import { searchCandidatIndividuelLeads } from '@/lib/quotes/candidat-individuel-staff-search.server';
import { handleCandidatIndividuelStaffSearch } from '@/lib/quotes/candidat-individuel-staff-search-route.server';
import { staffLeadSearchRequestSchema } from '@/lib/quotes/staff-directory-search-contracts';

export async function POST(request: NextRequest) {
  return handleCandidatIndividuelStaffSearch({
    request,
    requestSchema: staffLeadSearchRequestSchema,
    responseSchema: candidatIndividuelLeadSearchSuccessSchema,
    scope: 'candidat-individuel-lead-search',
    operation: 'candidate-lead-search',
    search: searchCandidatIndividuelLeads,
  });
}
