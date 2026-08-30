import { NextRequest } from 'next/server';

import { candidatIndividuelStudentSearchRequestSchema } from '@/lib/quotes/candidat-individuel-search-contracts';
import { searchCandidatIndividuelStudents } from '@/lib/quotes/candidat-individuel-staff-search.server';
import { handleCandidatIndividuelStaffSearch } from '@/lib/quotes/candidat-individuel-staff-search-route.server';

export async function POST(request: NextRequest) {
  return handleCandidatIndividuelStaffSearch({
    request,
    requestSchema: candidatIndividuelStudentSearchRequestSchema,
    scope: 'candidat-individuel-student-search',
    search: searchCandidatIndividuelStudents,
  });
}
