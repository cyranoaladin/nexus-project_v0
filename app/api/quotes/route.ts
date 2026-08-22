/**
 * POST /api/quotes — persists a devis after the family asks to receive it
 * (CDC §23/§24). This is the ONLY point in the public flow that collects
 * PII — /api/quotes/recommend never does. The chosen scenario is never
 * trusted from the client: every price is recomputed server-side from the
 * same situation/diagnostic/budget the client already saw, and only the
 * matching scenario tier is persisted.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireParentOwnsStudent, isErrorResponse } from '@/lib/guards';
import { UserRole } from '@prisma/client';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { buildRecommendation } from '@/lib/quotes/recommendation';
import { loadRawDomainScores } from '@/lib/quotes/diagnostic.server';
import { computeDiagnosticChecksum, projectDiagnostic, type RawDomainScores } from '@/lib/quotes/diagnostic';
import { createQuote } from '@/lib/quotes/persistence.server';
import { situationSchema, budgetSchema } from '@/lib/quotes/http-schemas';
import { captureContactLead, ContactLeadValidationError } from '@/lib/crm/contact-leads';
import { serializeError } from '@/lib/utils/serialize-error';

export const dynamic = 'force-dynamic';

const contactSchema = z
  .object({
    parentName: z.string().trim().min(1).max(200),
    studentFirstName: z.string().trim().min(1).max(100),
    whatsapp: z.string().trim().min(1).max(40),
    email: z.string().trim().email().max(320),
    consent: z.literal(true),
  })
  .strict();

const requestSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(128),
    situation: situationSchema,
    diagnosticId: z.string().trim().min(1).max(80).optional(),
    budget: budgetSchema,
    scenarioTier: z.enum(['ESSENTIEL', 'RECOMMANDE', 'COMPLET']),
    contact: contactSchema,
    studentId: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'quotes-create',
    dimensions: ['ip'],
  });
  if (blocked) return blocked;

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

  const identityBlocked = await guardSensitiveRateLimit(request, {
    scope: 'quotes-create',
    identity: input.contact.email,
    dimensions: ['identity'],
  });
  if (identityBlocked) return identityBlocked;

  // studentId is never trusted blindly — a signed-in parent must own it,
  // an ELEVE must be it, and an anonymous caller (no session) may not
  // attach one at all (CDC §43: "ne jamais accepter un studentId
  // arbitraire sans ownership").
  let verifiedStudentId: string | undefined;
  let diagnosticDomainScores: RawDomainScores | null = null;
  let overconfidentDomainKeys: Set<string> | undefined;

  if (input.studentId || input.diagnosticId) {
    const session = await requireAuth();
    if (isErrorResponse(session)) {
      return NextResponse.json({ error: 'ownership_verification_required' }, { status: 401 });
    }

    if (input.studentId) {
      if (session.user.role === UserRole.ELEVE) {
        verifiedStudentId = input.studentId;
      } else if (session.user.role === UserRole.PARENT) {
        const ownership = await requireParentOwnsStudent(session.user.id, input.studentId);
        if (isErrorResponse(ownership)) return ownership;
        verifiedStudentId = input.studentId;
      } else if (session.user.role === UserRole.ADMIN || session.user.role === UserRole.ASSISTANTE) {
        verifiedStudentId = input.studentId;
      } else {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    }

    if (input.diagnosticId) {
      const loaded = await loadRawDomainScores(session, input.diagnosticId);
      if (!isErrorResponse(loaded)) {
        diagnosticDomainScores = loaded.raw;
        overconfidentDomainKeys = loaded.overconfidentDomainKeys;
      }
    }
  }

  let diagnosticChecksum: string | undefined;
  if (diagnosticDomainScores) {
    const projection = projectDiagnostic(input.situation, diagnosticDomainScores, overconfidentDomainKeys);
    diagnosticChecksum = computeDiagnosticChecksum(projection);
  }

  let recommendation;
  try {
    recommendation = buildRecommendation({
      situation: input.situation,
      diagnosticDomainScores,
      overconfidentDomainKeys,
      budget: input.budget,
    });
  } catch (error) {
    console.error('[quotes/create] recommendation error', serializeError(error));
    return NextResponse.json({ error: 'recommendation_failed' }, { status: 400 });
  }

  const scenario = recommendation.scenarios.find((s) => s.tier === input.scenarioTier);
  if (!scenario) {
    return NextResponse.json({ error: 'scenario_not_found' }, { status: 400 });
  }

  let contactLeadId: string;
  try {
    const lead = await captureContactLead({
      name: input.contact.parentName,
      email: input.contact.email,
      phone: input.contact.whatsapp,
      profile: 'candidat_individuel',
      interest: `Devis Bac ${input.situation.level === 'premiere' ? 'Première' : 'Terminale'} — ${input.contact.studentFirstName}`,
      source: 'devis-bac',
      notes: `Scénario retenu: ${scenario.tier} — ${scenario.monthlyTotal} TND/mois`,
      type: 'contact',
      consent: true,
    });
    contactLeadId = lead.id;
  } catch (error) {
    if (error instanceof ContactLeadValidationError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    console.error('[quotes/create] lead capture error', serializeError(error));
    return NextResponse.json({ error: 'lead_capture_failed' }, { status: 500 });
  }

  try {
    const result = await createQuote({
      idempotencyKey: input.idempotencyKey,
      source: 'PUBLIC_SIMULATOR',
      contactLeadId,
      studentId: verifiedStudentId,
      diagnosticId: input.diagnosticId,
      diagnosticChecksum,
      examSession: input.situation.examSession,
      budget: input.budget.monthlyBudgetTnd,
      strategy: input.budget.strategy,
      scenario,
    });

    return NextResponse.json(
      {
        ok: true,
        quoteId: result.quote.id,
        token: result.rawToken,
        alreadyExisted: result.alreadyExisted,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[quotes/create] persistence error', serializeError(error));
    return NextResponse.json({ error: 'quote_creation_failed' }, { status: 500 });
  }
}
