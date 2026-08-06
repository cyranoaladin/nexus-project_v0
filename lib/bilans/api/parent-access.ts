import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';

import { CanonicalApiError } from './errors';

export const PARENT_PRIVATE_NO_STORE_HEADERS = Object.freeze({
  'cache-control': 'private, no-store, max-age=0',
  pragma: 'no-cache',
  expires: '0',
});

export function currentParentLinkOrderBy(): Array<
  Readonly<{ updatedAt: 'desc' }> | Readonly<{ id: 'asc' }>
> {
  return [{ updatedAt: 'desc' }, { id: 'asc' }];
}

export type CurrentParentLink = Readonly<{
  id: string;
  state: 'PENDING_PARENT_CONSENT' | 'VERIFIED' | 'REVOKED' | 'EXPIRED';
  verifiedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date | null;
}>;

export type ParentAccessDatabase = Readonly<{
  student: {
    findFirst(args: unknown): Promise<Readonly<{ id: string }> | null>;
  };
  parentStudentLink: {
    findFirst(args: unknown): Promise<CurrentParentLink | null>;
  };
}>;

export function withParentPrivateNoStore(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(PARENT_PRIVATE_NO_STORE_HEADERS)) {
    response.headers.set(name, value);
  }
  response.headers.delete('etag');
  response.headers.delete('last-modified');
  return response;
}

export function validParentResourceId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function currentParentLinkIsVerified(
  link: CurrentParentLink | null,
  now: Date,
): link is CurrentParentLink {
  return link !== null
    && link.state === 'VERIFIED'
    && link.verifiedAt !== null
    && link.revokedAt === null
    && (link.expiresAt === null || link.expiresAt > now);
}

export async function resolveParentOwnedStudent(
  session: Session | null,
  studentId: string,
  database: ParentAccessDatabase,
  now: Date,
): Promise<Readonly<{ id: string }>> {
  if (session?.user === undefined || session.user.role !== 'PARENT' || !validParentResourceId(studentId)) {
    throw CanonicalApiError.notFound();
  }

  const student = await database.student.findFirst({
    where: { id: studentId, parent: { userId: session.user.id } },
    select: { id: true },
  });
  if (student === null) throw CanonicalApiError.notFound();

  const currentLink = await database.parentStudentLink.findFirst({
    where: { parentUserId: session.user.id, studentId },
    orderBy: currentParentLinkOrderBy(),
    select: { id: true, state: true, verifiedAt: true, revokedAt: true, expiresAt: true },
  });
  if (!currentParentLinkIsVerified(currentLink, now)) throw CanonicalApiError.notFound();
  return student;
}
