/**
 * POST /api/assistante/candidate-profiles/[id]/quotes — creates a Quote
 * from a ProfilCandidat (Track A, Section 11/12). Staff-only. The ONLY
 * path from ProfilCandidat to Quote:
 *
 *   ProfilCandidat -> Canonical Quote Context Adapter -> the EXISTING
 *   buildRecommendation/computeCandidatLibreSchedule/createQuote — never a
 *   second engine.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { UserRole, type ProfilCandidat, type Prisma } from '@prisma/client';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getCandidateProfileWorkflowStatus } from '@/lib/quotes/candidate-profile-flag';
import { getProfilCandidatById } from '@/lib/quotes/candidate-profile-persistence.server';
import { buildCandidateQuoteContext } from '@/lib/quotes/candidate-quote-context';
import { buildRecommendation } from '@/lib/quotes/recommendation';
import { computeCandidatLibreSchedule } from '@/lib/quotes/pricing';
import { createQuote } from '@/lib/quotes/persistence.server';
import type { ProfilCandidatInput } from '@/lib/exams/parcours';

export const dynamic = 'force-dynamic';

const requestSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(128),
    budget: z.number().int().positive().max(50_000),
    strategy: z.enum(['RESPECT_BUDGET', 'BEST_BALANCE', 'MOST_COMPLETE']),
    scenarioTier: z.enum(['ESSENTIEL', 'RECOMMANDE', 'COMPLET']),
  })
  .strict();

/** Plain, DB-independent mirror the P1-P12 engine expects — never partial, never guessed. */
function toProfilCandidatInput(profil: ProfilCandidat): ProfilCandidatInput {
  return {
    level: profil.level,
    examSession: profil.examSession,
    modalite: profil.modalite,
    specialite1: profil.specialite1,
    specialite2: profil.specialite2,
    specialiteAbandonnee: profil.specialiteAbandonnee,
    langueA: profil.langueA,
    langueB: profil.langueB,
    estRedoublant: profil.estRedoublant,
    estTitulaireBacDejaObtenu: profil.estTitulaireBacDejaObtenu,
    changementSpecialite: profil.changementSpecialite,
    intentionAmelioration: profil.intentionAmelioration,
    intentionCycleComplet: profil.intentionCycleComplet,
    brancheBascule: profil.brancheBascule,
    epreuvesDispenseesDeclarees: profil.epreuvesDispenseesDeclarees ?? [],
    dispensesDeclarees: profil.dispensesDeclarees as ProfilCandidatInput['dispensesDeclarees'],
    etalementPlurisessionsDeclare: profil.etalementPlurisessionsDeclare ?? false,
    moyenneRattrapage: profil.moyenneRattrapage,
    optionsTerminale: profil.optionsTerminale ?? [],
    notesConservees: profil.notesConservees as ProfilCandidatInput['notesConservees'],
    p3EligibiliteAudit: profil.p3EligibiliteAudit as ProfilCandidatInput['p3EligibiliteAudit'],
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'candidate-profile-create',
    identity: sessionOrError.user.id,
  });
  if (blocked) return blocked;

  const { id } = await params;
  const profil = await getProfilCandidatById(id);
  if (!profil) {
    return NextResponse.json({ error: 'candidate_profile_not_found' }, { status: 404 });
  }

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
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  const context = buildCandidateQuoteContext(toProfilCandidatInput(profil), profil.examSession);

  const recommendation = buildRecommendation({
    situation: context.situation,
    diagnosticDomainScores: null,
    budget: { monthlyBudgetTnd: input.budget, strategy: input.strategy },
  });

  const scenario = recommendation.scenarios.find((s) => s.tier === input.scenarioTier);
  if (!scenario) {
    return NextResponse.json({ error: 'scenario_not_found' }, { status: 400 });
  }

  const schedule = computeCandidatLibreSchedule(scenario.grandTotal);

  const result = await createQuote({
    idempotencyKey: input.idempotencyKey,
    source: 'STAFF_WORKSPACE',
    contactLeadId: profil.contactLeadId ?? undefined,
    studentId: profil.studentId ?? undefined,
    examSession: profil.examSession,
    budget: input.budget,
    strategy: input.strategy,
    scenario,
    createdByUserId: sessionOrError.user.id,
    profilId: profil.id,
    snapshotCarte: context.carte as unknown as Prisma.InputJsonValue,
    snapshotRegles: context.validation as unknown as Prisma.InputJsonValue,
    parcours: context.carte.parcours.parcoursPrincipal,
    deposit: schedule.deposit,
    lastInstallmentAmount: schedule.lastInstallmentAmount,
    regulatoryMaturity: context.regulatoryMaturity,
    paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
  });

  return NextResponse.json(result, { status: 201 });
}
