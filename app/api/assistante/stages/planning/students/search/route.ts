import { NextRequest } from 'next/server';

import { searchPlanningStudents } from '@/lib/planning/staff-student-search.server';
import { handleCandidatIndividuelStaffSearch } from '@/lib/quotes/candidat-individuel-staff-search-route.server';
import { planningStudentSearchRequestSchema, planningStudentSearchSuccessSchema } from '@/lib/quotes/staff-directory-search-contracts';

export async function POST(request: NextRequest) {
  return handleCandidatIndividuelStaffSearch({
    request,
    requestSchema: planningStudentSearchRequestSchema,
    responseSchema: planningStudentSearchSuccessSchema,
    scope: 'staff-planning-student-search',
    operation: 'planning-student-search',
    requireInternalPipeline: false,
    search: searchPlanningStudents,
  });
}
