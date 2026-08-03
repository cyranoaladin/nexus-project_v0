import { auth } from '@/auth';
import { checkCsrf } from '@/lib/csrf';
import { initiateParentOwnedStudentActivation } from '@/lib/services/student-activation.service';
import { isStudentLoginIdentifierConflict } from '@/lib/services/student-login-identifier';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type RouteContext = Readonly<{
  params: Promise<{ studentId: string }>;
}>;

function notFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session || session.user.role !== 'PARENT') return notFound();

  const csrfResponse = checkCsrf(request);
  if (csrfResponse !== null) return csrfResponse;

  const { studentId } = await context.params;
  try {
    const result = await initiateParentOwnedStudentActivation({
      parentUserId: session.user.id,
      studentId,
    });
    if (!result.success) {
      if (result.error === 'NOT_FOUND') return notFound();
      return NextResponse.json({ error: 'STUDENT_ALREADY_ACTIVE' }, { status: 409 });
    }

    return NextResponse.json(
      {
        activation: {
          activationUrl: result.activationUrl,
          expiresAt: result.expiresAt.toISOString(),
          loginIdentifier: result.loginIdentifier,
          studentName: result.studentName,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
  } catch (error) {
    if (isStudentLoginIdentifierConflict(error)) {
      return NextResponse.json(
        { error: 'STUDENT_LOGIN_IDENTIFIER_CONFLICT' },
        { status: 409 },
      );
    }
    console.error('[parent-student-activation] issuance failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
      code: typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : undefined,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
