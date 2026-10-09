import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { familyAuthorityAvailable, familyReadAllowed, resolveParentStudentAccess } from '@/lib/families/student-access-authority';
import { buildAssessmentAccessWhere, buildBilanReadWhere } from './ownership';

type Subject = { id?: string | null; role?: string | null; email?: string | null };
interface ReadAuthority<T> {
  readonly where: T | null;
  readonly response?: NextResponse;
}

function authorityUnavailable(): ReadAuthority<never> {
  return { where: null, response: NextResponse.json({ error: 'Family authority unavailable' },
    { status: 503, headers: { 'cache-control': 'private, no-store' } }) };
}

async function authorizeParent(parentUserId: string, studentId: string | null): Promise<ReadAuthority<string>> {
  if (!studentId) {
    // Absent or unlinked rows answer like existing ones while the authority is down.
    return await familyAuthorityAvailable(parentUserId) ? { where: null } : authorityUnavailable();
  }
  const decision = await resolveParentStudentAccess(parentUserId, studentId, 'read');
  if (decision.status === 'AUTHORITY_UNAVAILABLE') return authorityUnavailable();
  return { where: familyReadAllowed(decision) ? studentId : null };
}

/** Only authorization identifiers may be loaded before the family decision. */
export async function resolveAssessmentReadAuthority(id: string, subject: Subject): Promise<ReadAuthority<Prisma.AssessmentWhereInput>> {
  if (subject.role !== 'PARENT') return { where: buildAssessmentAccessWhere(id, subject) };
  if (!id || !subject.id) return { where: null };
  const scope = await prisma.assessment.findUnique({ where: { id }, select: { studentId: true } });
  const access = await authorizeParent(subject.id, scope?.studentId ?? null);
  if (access.response) return { where: null, response: access.response };
  return { where: access.where ? { id, studentId: access.where } : null };
}

/** Publication remains necessary in addition to administrative family authority. */
export async function resolveBilanReadAuthority(id: string, subject: Subject): Promise<ReadAuthority<Prisma.BilanWhereInput>> {
  if (subject.role !== 'PARENT') return { where: buildBilanReadWhere(id, subject) };
  if (!id || !subject.id) return { where: null };
  const scope = await prisma.bilan.findUnique({ where: { id }, select: { studentId: true } });
  const access = await authorizeParent(subject.id, scope?.studentId ?? null);
  if (access.response) return { where: null, response: access.response };
  return { where: access.where ? { id, studentId: access.where, isPublished: true } : null };
}
