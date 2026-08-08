import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';

import { isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getStudentForActor, requireDiagnosticActor } from '@/lib/diagnostics/candidat-libre/access.server';
import {
  ConsentRecordingError,
  grantParentalConsent,
  recordStudentAssent,
  withdrawParentalConsent,
} from '@/lib/diagnostics/candidat-libre/consent-recording.server';
import { getCandidateDiagnosticConsentState } from '@/lib/diagnostics/candidat-libre/consent-gate.server';
import {
  guardCandidateDiagnosticFeature,
  guardCandidateDiagnosticForStudent,
} from '@/lib/diagnostics/candidat-libre/feature-flag';
import {
  CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
  CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE,
} from '@/lib/diagnostics/candidat-libre/privacy-notice';

/**
 * Recueil du consentement candidat libre.
 *
 * Cette route est la seule exception au garde-fou de consentement : elle doit
 * rester joignable **sans** consentement, puisque c'est précisément ce qu'elle
 * sert à recueillir. Elle reste en revanche soumise au kill switch et à
 * l'allowlist, et n'écrit aucune donnée de diagnostic — seulement le
 * consentement lui-même.
 *
 * `GET` sert la notice à présenter et l'état courant, pour que l'interface
 * sache quoi afficher et si le parcours est déjà fait.
 */

/** Résout l'élève visé, en refusant tout ce qui sort du périmètre autorisé. */
async function resolveStudent(request: Request, studentId?: string) {
  const disabled = guardCandidateDiagnosticFeature();
  if (disabled) return { error: disabled } as const;

  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return { error: sessionOrError } as const;

  const studentOrError = await getStudentForActor(sessionOrError, studentId);
  if (studentOrError instanceof NextResponse) return { error: studentOrError } as const;
  if (!studentOrError) {
    return { error: NextResponse.json({ error: 'Student not found' }, { status: 404 }) } as const;
  }

  const notAllowed = guardCandidateDiagnosticForStudent(studentOrError.id);
  if (notAllowed) return { error: notAllowed } as const;

  return { session: sessionOrError, student: studentOrError } as const;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resolved = await resolveStudent(request, url.searchParams.get('studentId') ?? undefined);
  if ('error' in resolved) return resolved.error;

  return NextResponse.json({
    notice: CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE,
    consentState: await getCandidateDiagnosticConsentState(resolved.student.id),
  });
}

export async function POST(request: Request) {
  const ipLimited = await guardSensitiveRateLimit(request, {
    scope: 'candidate-diagnostic-create',
    dimensions: ['ip'],
  });
  if (ipLimited) return ipLimited;

  let body: { action?: string; studentId?: string; noticeVersion?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const resolved = await resolveStudent(request, body.studentId);
  if ('error' in resolved) return resolved.error;
  const { session, student } = resolved;

  try {
    switch (body.action) {
      case 'GRANT_PARENTAL_CONSENT': {
        if (session.user.role !== UserRole.PARENT) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        // La version consentie vient du client : elle doit correspondre à celle
        // réellement présentée. Le service refuse toute autre valeur, ce qui
        // écarte un consentement donné sur un texte que la famille n'a pas vu.
        await grantParentalConsent({
          studentId: student.id,
          parentUserId: session.user.id,
          noticeVersion: body.noticeVersion ?? '',
        });
        break;
      }
      case 'RECORD_STUDENT_ASSENT': {
        if (session.user.role !== UserRole.ELEVE) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        await recordStudentAssent({ studentId: student.id });
        break;
      }
      case 'WITHDRAW_PARENTAL_CONSENT': {
        if (session.user.role !== UserRole.PARENT) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        await withdrawParentalConsent({
          studentId: student.id,
          parentUserId: session.user.id,
          reason: body.reason,
        });
        break;
      }
      default:
        return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof ConsentRecordingError) {
      return NextResponse.json({ error: 'Forbidden', code: error.message }, { status: 403 });
    }
    throw error;
  }

  return NextResponse.json({
    consentState: await getCandidateDiagnosticConsentState(student.id),
    noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
  });
}
