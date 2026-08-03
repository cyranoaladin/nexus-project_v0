import { auth } from '@/auth';
import {
  ParentStudentConsentError,
  withParentStudentConsentTransaction,
} from '@/lib/bilans/parent-student-consent';
import { checkCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const consentSchema = z.object({ consent: z.literal(true) }).strict();

type RouteContext = Readonly<{
  params: Promise<{ studentId: string }>;
}>;

function notFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

function consentErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ParentStudentConsentError)) return null;
  if (error.code === 'NOT_FOUND') return notFound();
  return NextResponse.json({ error: error.code }, { status: 409 });
}

async function parentIdentity(): Promise<string | null> {
  const session = await auth();
  if (!session || session.user.role !== 'PARENT') return null;
  return session.user.id;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const parentUserId = await parentIdentity();
  if (parentUserId === null) return notFound();

  const { studentId } = await context.params;
  try {
    const result = await withParentStudentConsentTransaction(prisma, (consentContext) =>
      consentContext.getStatus({
        parentUserId,
        studentId,
        now: new Date(),
      })
    );
    return NextResponse.json({ state: result.state });
  } catch (error) {
    return consentErrorResponse(error) ??
      NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const parentUserId = await parentIdentity();
  if (parentUserId === null) return notFound();

  const csrfResponse = checkCsrf(request);
  if (csrfResponse !== null) return csrfResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid consent payload' }, { status: 400 });
  }
  if (!consentSchema.safeParse(body).success) {
    return NextResponse.json({ error: 'Invalid consent payload' }, { status: 400 });
  }

  const { studentId } = await context.params;
  try {
    await withParentStudentConsentTransaction(prisma, (consentContext) =>
      consentContext.verify({
        parentUserId,
        studentId,
        now: new Date(),
      })
    );
    return NextResponse.json({ state: 'VERIFIED' });
  } catch (error) {
    return consentErrorResponse(error) ??
      NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
