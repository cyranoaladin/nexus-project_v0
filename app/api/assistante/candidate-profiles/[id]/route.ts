/**
 * GET /api/assistante/candidate-profiles/[id] — reads a ProfilCandidat
 * (Track A, Section 12). Staff-only (ADMIN/ASSISTANTE).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma, Subject, UserRole } from '@prisma/client';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getCandidateProfileWorkflowStatus } from '@/lib/quotes/candidate-profile-flag';
import {
  getProfilCandidatById,
  reviseProfilCandidat,
} from '@/lib/quotes/candidate-profile-persistence.server';

import { getSupportedSessions } from '@/lib/exams/catalog';
import { KNOWN_SPECIALITIES } from '@/lib/exams/specialities';
import { isLanguageCode } from '@/lib/exams/languages';

export const dynamic = 'force-dynamic';

const subjectEnum = z.nativeEnum(Subject);

const reviseProfilCandidatSchema = z
  .object({
    level: z.enum(['PREMIERE', 'TERMINALE']).optional(),
    examSession: z
      .number()
      .int()
      .refine((s) => (getSupportedSessions() as number[]).includes(s), {
        message: 'Unsupported examSession; must match a registered exam policy',
      })
      .optional(),
    modalite: z.enum(['A', 'B']).optional(),
    specialite1: subjectEnum
      .refine((s) => KNOWN_SPECIALITIES.has(s), { message: 'Invalid speciality for specialite1' })
      .optional(),
    specialite2: subjectEnum
      .refine((s) => KNOWN_SPECIALITIES.has(s), { message: 'Invalid speciality for specialite2' })
      .optional(),
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
  .refine(
    (v) => {
      if (v.specialite1 && v.specialite2) return v.specialite1 !== v.specialite2;
      return true;
    },
    {
      message: 'specialite1 and specialite2 must be distinct',
      path: ['specialite2'],
    },
  );

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'candidate-profile-read',
    identity: sessionOrError.user.id,
  });
  if (blocked) return blocked;

  const { id } = await params;
  const profil = await getProfilCandidatById(id);
  if (!profil) {
    return NextResponse.json({ error: 'candidate_profile_not_found' }, { status: 404 });
  }

  return NextResponse.json(profil, { status: 200 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'candidate-profile-update',
    identity: sessionOrError.user.id,
  });
  if (blocked) return blocked;

  const workflowStatus = await getCandidateProfileWorkflowStatus();
  if (workflowStatus !== 'ACTIVE_INTERNAL') {
    return NextResponse.json({ error: 'candidate_profile_workflow_disabled' }, { status: 403 });
  }

  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = reviseProfilCandidatSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const revised = await reviseProfilCandidat(id, {
      ...parsed.data,
      createdByUserId: sessionOrError.user.id,
    });
    return NextResponse.json(revised, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'candidate_profile_not_found' }, { status: 404 });
      }
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'candidate_profile_concurrent_revision' }, { status: 409 });
      }
    }
    throw error;
  }
}

