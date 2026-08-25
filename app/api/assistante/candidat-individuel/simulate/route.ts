/**
 * POST /api/assistante/candidat-individuel/simulate — runs the new
 * carte-aware pipeline directly (buildCandidateQuoteRecommendation), pure
 * — no persistence, no contractual Quote written (mission recâblage §5:
 * "launch a pricing simulation", distinct from creating a Quote). Returns
 * the full discriminated CandidateQuotePipelineResult so the workspace can
 * render validation, the carte, selected modules, non-chiffrable elements,
 * scenarios, and guardrails from a single call.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse } from '@/lib/guards';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { candidatIndividuelSimulateBodySchema } from '@/lib/quotes/candidat-individuel-api-schemas';
import { buildCandidateQuoteRecommendation } from '@/lib/quotes/pipeline';

export async function POST(request: NextRequest) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;

  const json = await request.json().catch(() => null);
  const parsed = candidatIndividuelSimulateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const { publicInput, staffExtension, budget, diagnostic, monthsRemaining } = parsed.data;

  try {
    const result = buildCandidateQuoteRecommendation({
      publicInput,
      staffExtension: staffExtension ?? undefined,
      budget,
      diagnostic: diagnostic ? { raw: diagnostic.raw, overconfidentDomainKeys: diagnostic.overconfidentDomainKeys ? new Set(diagnostic.overconfidentDomainKeys) : undefined } : null,
      monthsRemaining,
    });
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Simulation failed', message }, { status: 422 });
  }
}
