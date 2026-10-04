import { NextResponse } from 'next/server';
import { familyReadAllowed, resolveParentStudentAccess } from './student-access-authority';

/** Application composition boundary: Core authority remains outside lib/aria. */
export async function refuseUnauthorizedParentAriaRead(parentUserId: string, studentId: string): Promise<NextResponse | null> {
  const decision = await resolveParentStudentAccess(parentUserId, studentId, 'read');
  if (decision.status === 'AUTHORITY_UNAVAILABLE') {
    return privateParentAriaResponse(NextResponse.json({ error: 'FAMILY_AUTHORITY_UNAVAILABLE' }, { status: 503 }));
  }
  if (!familyReadAllowed(decision)) {
    return privateParentAriaResponse(NextResponse.json({ error: 'NOT_ENROLLED' }, { status: 403 }));
  }
  return null;
}

export function privateParentAriaResponse(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store');
  const vary = response.headers.get('Vary');
  response.headers.set('Vary', vary ? `${vary}, Cookie, Authorization` : 'Cookie, Authorization');
  return response;
}
