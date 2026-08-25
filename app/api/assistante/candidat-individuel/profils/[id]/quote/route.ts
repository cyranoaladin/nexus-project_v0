/**
 * POST /api/assistante/candidat-individuel/profils/:id/quote — turns a
 * validated simulation into a draft Quote (mission "vers un produit
 * complet" §4). Every condition the mission lists is enforced here:
 *
 * - rôle autorisé + feature flag interne: requireInternalPipelineAccess()
 *   (same guard as every other route under this path).
 * - profil persisté: fetched by id, 404 if missing.
 * - validation réglementaire / carte générée / modules tarifables /
 *   coût actif: the pipeline is re-run SERVER-SIDE from the persisted
 *   profil — a client-supplied pricing result is never trusted. Only a
 *   READY result can produce a Quote (any other status is 422 with the
 *   real reason).
 * - marge conforme ou override autorisé: computeMargin (lib/quotes/
 *   margin.server.ts, the existing sanctioned server-only margin engine —
 *   not a new calculation) gates the scenario's own lines against
 *   quotes.costPolicy; a BLOCKED gate requires an explicit, audited
 *   marginOverride.reason, never a silent bypass.
 * - snapshot complet: pricingVersion/examPolicyVersion (existing
 *   snapshot.server.ts mechanism, reused via createQuote unchanged) plus
 *   snapshotCarte (validation + carte) and snapshotRegles (cost policy +
 *   margin result + override, if any) — server-only fields, never read by
 *   any public/family-facing route (verified: no route or the PDF adapter
 *   references them).
 * - absence de doublon / idempotence: the existing idempotencyKey
 *   mechanism on createQuote (already transactional, already tested) —
 *   no new dedup logic invented.
 * - audit: createQuote already writes a QuoteAuditLog "CREATED" row.
 *
 * regulatoryMaturity is deliberately left at its column default
 * (LEGACY_ESTIMATE_UNVERIFIED) — this route never promotes it. The draft
 * therefore stays blocked from send/accept by the existing, unchanged
 * emission guard (lib/quotes/emission-guard.ts), exactly matching the
 * mission's "l'état doit rester provisoire ; l'envoi doit rester interdit ;
 * l'acceptation doit rester interdite" — satisfied by an existing gate's
 * default behavior, not a new check this route would have to get right.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { isErrorResponse, type AuthSession } from '@/lib/guards';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { createQuoteFromProfilBodySchema } from '@/lib/quotes/candidat-individuel-api-schemas';
import { getProfilCandidat, profilCandidatToPipelineInput } from '@/lib/quotes/profil-candidat.server';
import { buildCandidateQuoteRecommendation } from '@/lib/quotes/pipeline';
import { getCommercialCostPolicy, computeMargin } from '@/lib/quotes/margin.server';
import { createQuote } from '@/lib/quotes/persistence.server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;
  const session = access as AuthSession;

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = createQuoteFromProfilBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const { idempotencyKey, budget, diagnostic, monthsRemaining, scenarioTier, marginOverride } = parsed.data;

  const profil = await getProfilCandidat(id);
  if (!profil) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  const pipelineInput = profilCandidatToPipelineInput(
    profil,
    budget,
    monthsRemaining,
  );
  if (diagnostic) pipelineInput.diagnostic = { raw: diagnostic.raw, overconfidentDomainKeys: diagnostic.overconfidentDomainKeys ? new Set(diagnostic.overconfidentDomainKeys) : undefined };

  let result;
  try {
    result = buildCandidateQuoteRecommendation(pipelineInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Simulation failed', message }, { status: 422 });
  }

  if (result.status !== 'READY') {
    return NextResponse.json(
      { error: 'Profil non prêt pour un devis', status: result.status, detail: 'reasons' in result ? result.reasons : 'avertissements' in result ? result.avertissements : undefined },
      { status: 422 },
    );
  }

  const scenario = result.scenarios.find((s) => s.tier === scenarioTier);
  if (!scenario) {
    return NextResponse.json({ error: `Scénario ${scenarioTier} introuvable` }, { status: 400 });
  }

  const costPolicy = await getCommercialCostPolicy();
  const margin = computeMargin(scenario.lines, costPolicy);
  if (margin.gate === 'BLOCKED' && !marginOverride) {
    return NextResponse.json(
      { error: 'Marge insuffisante — override requis', marginPct: margin.marginPct, gate: margin.gate },
      { status: 422 },
    );
  }

  const created = await createQuote({
    idempotencyKey,
    source: 'STAFF_WORKSPACE',
    contactLeadId: profil.contactLeadId ?? undefined,
    studentId: profil.studentId ?? undefined,
    examSession: profil.examSession,
    budget: budget.monthlyBudgetTnd,
    strategy: budget.strategy,
    scenario,
    createdByUserId: session.user.id,
    profilId: profil.id,
    snapshotCarte: {
      carte: result.carte,
      emissionAutomatiqueAutorisee: result.validation.emissionAutomatiqueAutorisee,
      necessiteVerificationHumaine: result.validation.necessiteVerificationHumaine,
    } as unknown as Prisma.InputJsonValue,
    snapshotRegles: {
      costPolicy,
      margin: { marginPct: margin.marginPct, gate: margin.gate },
      marginOverride: marginOverride ? { reason: marginOverride.reason, byUserId: session.user.id, at: new Date().toISOString() } : null,
    } as unknown as Prisma.InputJsonValue,
  });

  return NextResponse.json({ quote: created.quote, alreadyExisted: created.alreadyExisted, marginGate: margin.gate }, { status: created.alreadyExisted ? 200 : 201 });
}
