import type { Session } from 'next-auth';

import { CanonicalApiError } from './errors';

type StudentIdentity = Readonly<{ id: string; userId: string }>;

type StudentLookup = Readonly<{
  student: {
    findUnique(args: Readonly<{
      where: Readonly<{ userId: string }>;
      select: Readonly<{ id: true; userId: true }>;
    }>): Promise<StudentIdentity | null>;
  };
}>;

export { CanonicalApiError } from './errors';

export async function resolveSessionStudent(
  session: Session | null,
  database: StudentLookup,
): Promise<StudentIdentity> {
  if (session?.user === undefined) throw CanonicalApiError.unauthenticated();
  if (session.user.role !== 'ELEVE') throw CanonicalApiError.studentRequired();

  const student = await database.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, userId: true },
  });
  if (student === null) throw CanonicalApiError.studentRequired();
  return student;
}
