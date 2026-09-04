/**
 * POST /api/assistante/candidate-profiles — creates a ProfilCandidat
 * (Track A, Section 12). Staff-only (ADMIN/ASSISTANTE); the workflow
 * feature flag is checked server-side in addition to RBAC (Section A12 —
 * must govern server-side, not just UI). createdByUserId is always the
 * authenticated session's own id, never client-supplied.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Subject } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getCandidateProfileWorkflowStatus } from '@/lib/quotes/candidate-profile-flag';
import { getSupportedSessions } from '@/lib/exams/catalog';
import { KNOWN_SPECIALITIES } from '@/lib/exams/specialities';
import { isLanguageCode } from '@/lib/exams/languages';
import { createProfilCandidat } from '@/lib/quotes/candidate-profile-persistence.server';

export const dynamic = 'force-dynamic';

const subjectEnum = z.nativeEnum(Subject);

const createProfilCandidatSchema = z
  .object({
    contactLeadId: z.string().trim().min(1).max(80).optional(),
    studentId: z.string().trim().min(1).max(80).optional(),
    level: z.enum(['PREMIERE', 'TERMINALE']),
    examSession: z
      .number()
      .int()
      .refine((s) => (getSupportedSessions() as number[]).includes(s), {
        message: 'Unsupported examSession; must match a registered exam policy',
      }),
    modalite: z.enum(['A', 'B']),
    specialite1: subjectEnum.refine((s) => KNOWN_SPECIALITIES.has(s), {
      message: 'Invalid speciality for specialite1',
    }),
    specialite2: subjectEnum.refine((s) => KNOWN_SPECIALITIES.has(s), {
      message: 'Invalid speciality for specialite2',
    }),
    specialiteAbandonnee: subjectEnum
      .refine((s) => KNOWN_SPECIALITIES.has(s), { message: 'Invalid speciality for specialiteAbandonnee' })
      .optional(),
    langueA: subjectEnum
      .refine((s) => isLanguageCode(s), { message: 'Invalid language for langueA' })
      .optional(),
    langueB: subjectEnum
      .refine((s) => isLanguageCode(s), { message: 'Invalid language for langueB' })
      .optional(),
    estRedoublant: z.boolean().optional(),
    estTitulaireBacDejaObtenu: z.boolean().optional(),
    changementSpecialite: z.boolean().optional(),
    intentionAmelioration: z.boolean().optional(),
    intentionCycleComplet: z.boolean().optional(),
    brancheBascule: z.enum(['CONSERVATION_MOYENNES_PREMIERE', 'RENONCIATION_MOYENNES_PREMIERE']).optional(),
    optionsTerminale: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    moyenneRattrapage: z.number().min(0).max(20).nullable().optional(),
    etalementPlurisessionsDeclare: z.boolean().optional(),
    epreuvesDispenseesDeclarees: z.array(z.string().trim().min(1).max(80)).optional(),
    dispensesDeclarees: z.array(z.record(z.unknown())).optional(),
    notesConservees: z.array(z.record(z.unknown())).optional(),
    p3EligibiliteAudit: z.record(z.unknown()).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.contactLeadId) !== Boolean(v.studentId), {
    message: 'Exactly one of contactLeadId/studentId is required',
  })
  .refine((v) => v.specialite1 !== v.specialite2, {
    message: 'specialite1 and specialite2 must be distinct',
    path: ['specialite2'],
  });

export async function POST(request: Request) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'candidate-profile-create',
    identity: sessionOrError.user.id,
  });
  if (blocked) return blocked;

  const workflowStatus = await getCandidateProfileWorkflowStatus();
  if (workflowStatus !== 'ACTIVE_INTERNAL') {
    return NextResponse.json({ error: 'candidate_profile_workflow_disabled' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = createProfilCandidatSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const profil = await createProfilCandidat({
      ...input,
      // Never trusted from the client — always the authenticated staff session.
      createdByUserId: sessionOrError.user.id,
    });
    return NextResponse.json(profil, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2003') {
      return NextResponse.json({ error: 'referenced_entity_not_found' }, { status: 400 });
    }
    throw error;
  }
}
