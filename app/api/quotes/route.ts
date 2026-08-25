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
import { requireAuth, requireParentOwnsStudent, requireAnyRole, isErrorResponse } from '@/lib/guards';
import { UserRole } from '@prisma/client';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { buildRecommendation } from '@/lib/quotes/recommendation';
import { loadRawDomainScores } from '@/lib/quotes/diagnostic.server';
import { computeDiagnosticChecksum, projectDiagnostic, type RawDomainScores } from '@/lib/quotes/diagnostic';
import { createQuote, listQuotesForLeadOrStudent } from '@/lib/quotes/persistence.server';
import { situationSchema, budgetSchema } from '@/lib/quotes/http-schemas';
import { ContactLeadValidationError } from '@/lib/crm/contact-leads';
import { serializeError } from '@/lib/utils/serialize-error';
import { isShadowModeEnabled } from '@/lib/quotes/pipeline-flag';
import { runShadowComparison } from '@/lib/quotes/shadow-comparison';
import { logShadowComparisonWithTimeout } from '@/lib/quotes/shadow-persistence.server';

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
    // Public flow: fresh PII, captured via captureContactLead.
    contact: contactSchema.optional(),
    // Staff flow (ADMIN/ASSISTANTE only, verified below): the lead already
    // exists — no PII re-capture, no consent checkbox to fake.
    existingContactLeadId: z.string().trim().min(1).max(80).optional(),
    studentId: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .refine((v) => v.contact != null || v.existingContactLeadId != null, {
    message: 'Either contact or existingContactLeadId is required',
  });

const historyQuerySchema = z
  .object({
    contactLeadId: z.string().trim().min(1).max(80).optional(),
    studentId: z.string().trim().min(1).max(80).optional(),
  })
  .refine((v) => v.contactLeadId != null || v.studentId != null, {
    message: 'contactLeadId or studentId is required',
  });

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

  if (input.contact) {
    const identityBlocked = await guardSensitiveRateLimit(request, {
      scope: 'quotes-create',
      identity: input.contact.email,
      dimensions: ['identity'],
    });
    if (identityBlocked) return identityBlocked;
  }

  // studentId is never trusted blindly — a signed-in parent must own it,
  // an ELEVE must be it, and an anonymous caller (no session) may not
  // attach one at all (CDC §43: "ne jamais accepter un studentId
  // arbitraire sans ownership"). existingContactLeadId is staff-only —
  // never accepted from an unauthenticated caller.
  let verifiedStudentId: string | undefined;
  let verifiedStaffUserId: string | undefined;
  let diagnosticDomainScores: RawDomainScores | null = null;
  let overconfidentDomainKeys: Set<string> | undefined;

  if (input.studentId || input.diagnosticId || input.existingContactLeadId) {
    const session = await requireAuth();
    if (isErrorResponse(session)) {
      return NextResponse.json({ error: 'ownership_verification_required' }, { status: 401 });
    }

    if (input.existingContactLeadId) {
      if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.ASSISTANTE) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      verifiedStaffUserId = session.user.id;
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

  // Shadow mode (recâblage mission §2/§3) — the new carte-aware pipeline runs
  // in parallel, purely for comparison. Never affects the response above,
  // never blocks it on failure, never produces a visible result or a
  // contractual Quote. Transitional: see lib/quotes/shadow-comparison.ts
  // for scope/owner/removal condition.
  if (isShadowModeEnabled()) {
    try {
      const shadowRecord = runShadowComparison(input.situation, {
        situation: input.situation,
        diagnosticDomainScores,
        overconfidentDomainKeys,
        budget: input.budget,
      });
      await logShadowComparisonWithTimeout(shadowRecord);
    } catch (error) {
      console.error('[quotes/create] shadow comparison failed (isolated, non-blocking)', serializeError(error));
    }
  }

  if (!input.contact && !(verifiedStaffUserId && input.existingContactLeadId)) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  try {
    const result = await createQuote({
      idempotencyKey: input.idempotencyKey,
      source: verifiedStaffUserId ? 'STAFF_WORKSPACE' : 'PUBLIC_SIMULATOR',
      contactLeadId: verifiedStaffUserId ? input.existingContactLeadId : undefined,
      contact: !verifiedStaffUserId && input.contact
        ? {
            name: input.contact.parentName,
            email: input.contact.email,
            phone: input.contact.whatsapp,
            profile: 'candidat_individuel',
            interest: `Devis Bac ${input.situation.level === 'premiere' ? 'Première' : 'Terminale'} — ${input.contact.studentFirstName}`,
            source: 'devis-bac',
            notes: `Scénario retenu: ${scenario.tier} — ${scenario.monthlyTotal} TND/mois`,
            type: 'contact',
            consent: true,
          }
        : undefined,
      studentId: verifiedStudentId,
      diagnosticId: input.diagnosticId,
      diagnosticChecksum,
      examSession: input.situation.examSession,
      budget: input.budget.monthlyBudgetTnd,
      strategy: input.budget.strategy,
      scenario,
      createdByUserId: verifiedStaffUserId,
    });

    // The persisted Quote does not snapshot the complete SituationInput. A
    // replay with a reused key therefore cannot safely echo the newly
    // recomputed situation/scenario beside the identity of an older quote.
    // Fail closed: the caller must issue a fresh creation request/key.
    if (result.alreadyExisted) {
      return NextResponse.json(
        { error: 'idempotency_key_reused' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        quoteId: result.quote.id,
        token: result.rawToken,
        alreadyExisted: result.alreadyExisted,
        scenario,
        situation: input.situation,
        validUntil: result.quote.validUntil.toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof ContactLeadValidationError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    console.error('[quotes/create] persistence error', serializeError(error));
    return NextResponse.json({ error: 'quote_creation_failed' }, { status: 500 });
  }
}

/**
 * GET /api/quotes?contactLeadId=...|studentId=... — staff-only "historique
 * des devis" for the assistante workspace. Read-only, narrow field set (see
 * listQuotesForLeadOrStudent) — no cost/margin data, never has been.
 */
export async function GET(request: Request) {
  const session = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(session)) return session;

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'quotes-history-read',
    identity: session.user.id,
  });
  if (blocked) return blocked;

  const url = new URL(request.url);
  const parsed = historyQuerySchema.safeParse({
    contactLeadId: url.searchParams.get('contactLeadId') ?? undefined,
    studentId: url.searchParams.get('studentId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  try {
    const found = await listQuotesForLeadOrStudent(parsed.data);
    // Re-project explicitly rather than trust the persistence layer's
    // `select` alone — defense in depth against a future accidental
    // over-select of a cost/margin field.
    const quotes = found.map((quote) => ({
      id: quote.id,
      status: quote.status,
      monthlyTotal: quote.monthlyTotal,
      grandTotal: quote.grandTotal,
      examSession: quote.examSession,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      validUntil: quote.validUntil,
    }));
    return NextResponse.json({ quotes }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[quotes] GET error', serializeError(error));
    return NextResponse.json({ error: 'history_lookup_failed' }, { status: 400 });
  }
}
