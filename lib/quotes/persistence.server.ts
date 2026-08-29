/**
 * Server-only persistence for the Quote domain (CDC §24-26, §45-46).
 *
 * A quote's pricing/regulatory context is frozen at creation
 * (snapshot.server.ts) and never silently recomputed. Creation is
 * idempotent (a retried request with the same idempotencyKey returns the
 * existing row, never a duplicate).
 */
import 'server-only';
import {
  Prisma,
  type CandidateLevel,
  type ContactLeadStatus,
  type Quote,
  type QuoteLine,
  type QuoteSource,
  type QuoteStatus,
  type QuoteStrategy,
  type Subject,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertQuoteCanBeAccepted, assertQuoteCanBeSent, collectFamilyLinkIssuanceBlockers, collectQuotePromotionBlockers } from './emission-guard';
import { buildQuoteContextSnapshot, generateQuotePublicToken } from './snapshot.server';
import { canTransition } from './status';
import { hashToken } from '@/lib/invoice/access-token';
import { getTrustedApplicationOrigin } from '@/lib/auth/parent-activation';
import type { QuoteScenario } from './schemas';
import {
  captureContactLeadInTransaction,
  notifyContactLeadCaptureCommitted,
  type ContactLeadInput,
} from '@/lib/crm/contact-leads';
import {
  lockProfilCandidatForQuote,
  ProfilCandidatVersionConflictError,
} from './profil-candidat-lock.server';

export interface CreateQuoteInput {
  idempotencyKey: string;
  source: QuoteSource;
  contactLeadId?: string;
  studentId?: string;
  diagnosticId?: string;
  diagnosticChecksum?: string;
  examSession: number;
  budget: number;
  strategy: QuoteStrategy;
  scenario: QuoteScenario;
  createdByUserId?: string;
  /** Public-flow PII, captured atomically with the Quote and its outbox intent. */
  contact?: ContactLeadInput;
  /**
   * Candidat-individuel carte-aware creation path only (mission "vers un
   * produit complet" §4) — profilId/snapshotCarte/snapshotRegles were
   * additive columns on Quote already (see prisma/schema.prisma), but no
   * caller ever populated them before this. Left undefined by every
   * existing legacy caller — zero behavior change for them (Prisma treats
   * an undefined create field as "not set", identical to before this
   * extension). regulatoryMaturity is deliberately NEVER set here: it
   * keeps its column default (LEGACY_ESTIMATE_UNVERIFIED), so
   * assertQuoteCanBeSent/assertQuoteCanBeAccepted (lib/quotes/emission-guard.ts)
   * keep blocking send/accept on every quote created through this path
   * too, until a separate, explicit staff review step (not built by this
   * lot) promotes it — "brouillon" stays "brouillon" by construction, not
   * by a check this function would have to get right.
   */
  profilId?: string;
  snapshotCarte?: Prisma.InputJsonValue;
  snapshotRegles?: Prisma.InputJsonValue;
  /** Exact profile version used by the simulation, checked under FOR UPDATE. */
  expectedProfilUpdatedAt?: Date;
}

export interface CreateQuoteResult {
  quote: Quote & { lines: QuoteLine[] };
  /**
   * Present only on first creation. A retried request with the same
   * idempotencyKey returns the existing row with rawToken = null — the raw
   * token is never recoverable once issued (only its hash is stored, same
   * as InvoiceAccessToken). If a client genuinely lost the token before
   * receiving the first response, a new quote must be issued; the token must
   * never be re-derived from its stored hash.
   */
  rawToken: string | null;
  alreadyExisted: boolean;
}

export async function createQuote(input: CreateQuoteInput): Promise<CreateQuoteResult> {
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.quote.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { lines: true },
      });
      if (existing) {
        return {
          result: { quote: existing, rawToken: null, alreadyExisted: true } satisfies CreateQuoteResult,
          contactCaptured: false,
        };
      }

      if (input.profilId) {
        if (!input.expectedProfilUpdatedAt) throw new ProfilCandidatVersionConflictError();
        const lockedProfil = await lockProfilCandidatForQuote(tx, input.profilId);
        if (!lockedProfil || lockedProfil.updatedAt.getTime() !== input.expectedProfilUpdatedAt.getTime()) {
          throw new ProfilCandidatVersionConflictError();
        }
      }

      const snapshot = buildQuoteContextSnapshot(input.examSession);
      const token = generateQuotePublicToken();
      const capturedLead = input.contact
        ? await captureContactLeadInTransaction(tx, input.contact)
        : null;
      const created = await tx.quote.create({
        data: {
          publicTokenHash: token.tokenHash,
          publicTokenExpiresAt: token.expiresAt,
          idempotencyKey: input.idempotencyKey,
          status: 'ESTIMATION',
          source: input.source,
          contactLeadId: capturedLead?.id ?? input.contactLeadId,
          studentId: input.studentId,
          diagnosticId: input.diagnosticId,
          diagnosticChecksum: input.diagnosticChecksum,
          examSession: input.examSession,
          pricingVersion: snapshot.pricingVersion,
          examPolicyVersion: snapshot.examPolicyVersion,
          budget: input.budget,
          strategy: input.strategy,
          matchedOfferId: input.scenario.matchedOfferId,
          monthlyTotal: input.scenario.monthlyTotal,
          grandTotal: input.scenario.grandTotal,
          paymentPolicy: input.scenario.paymentPolicy,
          deposit: input.scenario.deposit,
          lastInstallmentAmount: input.scenario.lastInstallmentAmount,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day estimation validity
          createdByUserId: input.createdByUserId,
          profilId: input.profilId,
          snapshotCarte: input.snapshotCarte ?? Prisma.JsonNull,
          snapshotRegles: input.snapshotRegles ?? Prisma.JsonNull,
          lines: {
            create: input.scenario.lines.map((line, index) => ({
              subject: line.label,
              modality: line.modality,
              hoursPerMonth: line.hoursPerMonth,
              unitPrice: line.unitPriceMonthly,
              months: input.scenario.months,
              lineTotal: line.unitPriceMonthly * input.scenario.months,
              offerId: line.offerId,
              priority: line.priorityLabel,
              reason: line.reason,
              sortOrder: index,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.quoteAuditLog.create({
        data: {
          quoteId: created.id,
          action: 'CREATED',
          actorUserId: input.createdByUserId,
          afterSnapshot: { status: created.status, monthlyTotal: created.monthlyTotal },
        },
      });

      return {
        result: { quote: created, rawToken: token.rawToken, alreadyExisted: false } satisfies CreateQuoteResult,
        contactCaptured: capturedLead != null,
      };
    });

    if (outcome.contactCaptured) notifyContactLeadCaptureCommitted();
    return outcome.result;
  } catch (error) {
    const target = error instanceof Prisma.PrismaClientKnownRequestError
      ? String(error.meta?.target ?? '').toLowerCase()
      : '';
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && target.includes('idempotency')) {
      const existing = await prisma.quote.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { lines: true },
      });
      if (existing) return { quote: existing, rawToken: null, alreadyExisted: true };
    }
    throw error;
  }
}

/**
 * T5R5 §FINDING_13 — the family view must clearly show who the quote is
 * for; this is the one Prisma lookup both the family HTML page and the
 * public JSON route read through (via getQuoteForFamilyView), so the
 * student's display name is fetched once here.
 */
export interface QuoteBeneficiaryStudent {
  user: { firstName: string | null; lastName: string | null };
}

/**
 * T5R6 §FINDING_15 — the same authoritative source
 * (ProfilCandidat.specialite1/specialite2/specialiteAbandonnee) the PDF
 * already reads, so the family HTML page and JSON route can humanize a
 * line's subject via lib/quotes/pdf-adapter.server.ts::humanizeLineSubject
 * instead of showing the raw generic catalogue label. null for a legacy
 * quote (profilId null) or a dangling profilId — never coerced to a guess.
 */
export interface QuoteBeneficiaryProfil {
  level: CandidateLevel;
  specialite1: Subject;
  specialite2: Subject;
  specialiteAbandonnee: Subject | null;
}

export interface QuoteLookupResult {
  quote: (Quote & { lines: QuoteLine[]; student: QuoteBeneficiaryStudent | null; profil: QuoteBeneficiaryProfil | null }) | null;
  reason?: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED';
}

/** Public lookup by raw token — never leaks which failure mode applies beyond NOT_FOUND/EXPIRED to a client, callers should render a generic "lien invalide" message either way. */
export async function getQuoteByPublicToken(rawToken: string): Promise<QuoteLookupResult> {
  const tokenHash = hashToken(rawToken);
  const quote = await prisma.quote.findUnique({
    where: { publicTokenHash: tokenHash },
    include: {
      lines: true,
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
      profil: { select: { level: true, specialite1: true, specialite2: true, specialiteAbandonnee: true } },
    },
  });
  if (!quote) return { quote: null, reason: 'NOT_FOUND' };
  if (quote.publicTokenExpiresAt.getTime() < Date.now()) return { quote: null, reason: 'EXPIRED' };
  return { quote };
}

export interface TransitionStatusInput {
  quoteId: string;
  toStatus: QuoteStatus;
  actorUserId?: string;
  note?: string;
}

export async function transitionQuoteStatus(input: TransitionStatusInput): Promise<Quote> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.quote.findUniqueOrThrow({ where: { id: input.quoteId } });
    if (!canTransition(current.status, input.toStatus)) {
      throw new Error(`Invalid quote status transition: ${current.status} -> ${input.toStatus}`);
    }
    // Lot 5 correctif §1 — the single canonical gate, applied here so every
    // caller (send route, accept route, staff workspace, future automation)
    // is protected without having to remember to call it separately.
    // The regulatory snapshots exist only on the candidat-individuel path.
    // Legacy quotes (profilId null) keep their established transition flow.
    if (current.profilId != null) {
      if (input.toStatus === 'DEVIS_ENVOYE') assertQuoteCanBeSent(current);
      if (input.toStatus === 'ACCEPTE') assertQuoteCanBeAccepted(current);
    }

    const timestampFields: Partial<Record<'sentAt' | 'consultedAt', Date>> = {};
    if (input.toStatus === 'DEVIS_ENVOYE') timestampFields.sentAt = new Date();
    if (input.toStatus === 'DEVIS_CONSULTE') timestampFields.consultedAt = new Date();

    const updated = await tx.quote.update({
      where: { id: input.quoteId },
      data: { status: input.toStatus, updatedByUserId: input.actorUserId, ...timestampFields },
    });

    await tx.quoteAuditLog.create({
      data: {
        quoteId: input.quoteId,
        action: 'STATUS_CHANGE',
        actorUserId: input.actorUserId,
        beforeSnapshot: { status: current.status },
        afterSnapshot: { status: input.toStatus },
        note: input.note,
      },
    });

    return updated;
  });
}

/**
 * Records the first family consultation without a read/write race.
 * The conditional update is the authority: if staff changed the status after
 * the public lookup, their newer state is preserved and no audit row is added.
 */
export async function markQuoteConsultedIfSent(quoteId: string): Promise<Date | null> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const updated = await tx.quote.updateMany({
      where: { id: quoteId, status: 'DEVIS_ENVOYE' },
      data: { status: 'DEVIS_CONSULTE', consultedAt: now },
    });
    if (updated.count !== 1) return null;

    await tx.quoteAuditLog.create({
      data: {
        quoteId,
        action: 'STATUS_CHANGE',
        beforeSnapshot: { status: 'DEVIS_ENVOYE' },
        afterSnapshot: { status: 'DEVIS_CONSULTE' },
        note: 'Première consultation du lien familial',
      },
    });
    return now;
  });
}

export type PromoteQuoteResult =
  | { ok: true; quote: Quote; alreadyPromoted: boolean }
  | { ok: false; reasons: string[] };

async function lockQuoteForMutation(tx: Prisma.TransactionClient, quoteId: string): Promise<Quote | null> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "quotes"
    WHERE "id" = ${quoteId}
    FOR UPDATE
  `);
  if (locked.length === 0) return null;
  return tx.quote.findUnique({ where: { id: quoteId } });
}

/**
 * T5R — RECETTE_FINDING_3. The single staff action that promotes a Quote
 * from LEGACY_ESTIMATE_UNVERIFIED to CARTE_VALIDATED_DEFINITIVE — the one
 * place outside a test's direct DB write this repo does so. Server-side
 * authoritative re-validation (collectQuotePromotionBlockers) — never
 * trusts that a client-side "ready to send" check was correct.
 * Idempotent: calling this again on an already-promoted quote succeeds
 * without re-validating or writing a second audit row (safe retry/double
 * click — the mutation already happened). Auditable: exactly one
 * QuoteAuditLog row per actual transition, same pattern as
 * transitionQuoteStatus above.
 */
export async function promoteQuoteToFamilyVisible(quoteId: string, actorUserId: string): Promise<PromoteQuoteResult> {
  return prisma.$transaction(async (tx) => {
    const current = await lockQuoteForMutation(tx, quoteId);
    if (!current) return { ok: false, reasons: ['Quote introuvable'] };

    if (
      current.regulatoryMaturity === 'CARTE_VALIDATED_DEFINITIVE'
      && current.status === 'DEVIS_ENVOYE'
    ) {
      return { ok: true, quote: current, alreadyPromoted: true };
    }

    const reasons = collectQuotePromotionBlockers(current);
    if (!canTransition(current.status, 'DEVIS_ENVOYE')) {
      reasons.push(`Quote status not publishable: ${current.status}`);
    }
    if (reasons.length > 0) return { ok: false, reasons };

    const sentAt = new Date();

    const updated = await tx.quote.update({
      where: { id: quoteId },
      data: {
        regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
        status: 'DEVIS_ENVOYE',
        sentAt,
        updatedByUserId: actorUserId,
      },
    });

    await tx.quoteAuditLog.create({
      data: {
        quoteId,
        action: 'PROMOTED_TO_FAMILY_VISIBLE',
        actorUserId,
        beforeSnapshot: { regulatoryMaturity: current.regulatoryMaturity, status: current.status },
        afterSnapshot: { regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE', status: 'DEVIS_ENVOYE' },
        note: 'Validation staff — devis rendu disponible à la famille',
      },
    });

    return { ok: true, quote: updated, alreadyPromoted: false };
  });
}

/**
 * T5R2 — RECETTE_FINDING (FAMILY_LINK_DISTRIBUTION, P1). Builds the
 * family-facing devis URL from the server's own trusted, validated
 * origin (lib/auth/parent-activation.ts::getTrustedApplicationOrigin —
 * the ONE existing, sanctioned base-URL primitive in this repo, already
 * used for parent-activation links; never a second one). Fails closed
 * (propagates getTrustedApplicationOrigin's own thrown error) if
 * NEXTAUTH_URL is missing/invalid — never a fabricated URL. Opens the
 * EXISTING family view (app/devis/[token]/page.tsx) — no new frontend.
 */
export function buildFamilyQuoteUrl(rawToken: string): string {
  const url = new URL(`/devis/${encodeURIComponent(rawToken)}`, getTrustedApplicationOrigin());
  return url.toString();
}

export type IssueFamilyLinkResult =
  | { ok: true; familyUrl: string; expiresAt: Date; action: 'LINK_ISSUED' | 'LINK_ROTATED' }
  | { ok: false; reasons: string[] }
  | { ok: false; conflict: true };

export interface QuoteMutationVersion {
  updatedAt: Date;
  publicTokenHash: string;
}

/**
 * T5R2 — the single staff action that issues or rotates a candidat-
 * individuel Quote's family link. Reuses the exact existing token engine
 * (lib/quotes/snapshot.server.ts::generateQuotePublicToken —
 * crypto.randomBytes(32) then SHA-256, the same primitive
 * InvoiceAccessToken already uses; never a second token scheme) and the
 * existing publicTokenHash column (a single @unique value per Quote —
 * overwriting it IS rotation: the previous raw token can never hash to
 * the new value again, so it stops resolving via getQuoteByPublicToken,
 * with no separate revocation table needed).
 *
 * RAW_TOKEN_PERSISTED = FALSE, always: only tokenHash is ever written.
 * The raw token exists only in this function's return value and the
 * caller's HTTP response — never logged, never put in an audit
 * beforeSnapshot/afterSnapshot (deliberately null below), never in
 * snapshotRegles.
 *
 * action = LINK_ISSUED the first time this repo's audit trail shows no
 * prior LINK_ISSUED/LINK_ROTATED row for this quote (the creation-time
 * token generated inline by createQuote above was never surfaced to any
 * caller, so it was never "issued" to anyone — this distinction is
 * staff-facing UI copy, not a security boundary; the underlying
 * mechanism is identical either way).
 */
export async function issueOrRotateFamilyLink(
  quoteId: string,
  actorUserId: string,
  expectedVersion: QuoteMutationVersion,
): Promise<IssueFamilyLinkResult> {
  return prisma.$transaction(async (tx) => {
    const current = await lockQuoteForMutation(tx, quoteId);
    if (!current) return { ok: false, reasons: ['Quote introuvable'] };

    if (
      current.updatedAt.getTime() !== expectedVersion.updatedAt.getTime()
      || current.publicTokenHash !== expectedVersion.publicTokenHash
    ) {
      return { ok: false, conflict: true };
    }

    const reasons = collectFamilyLinkIssuanceBlockers(current);
    if (reasons.length > 0) return { ok: false, reasons };

    const priorLinkEvents = await tx.quoteAuditLog.count({
      where: { quoteId, action: { in: ['LINK_ISSUED', 'LINK_ROTATED'] } },
    });
    const action: 'LINK_ISSUED' | 'LINK_ROTATED' = priorLinkEvents === 0 ? 'LINK_ISSUED' : 'LINK_ROTATED';

    const token = generateQuotePublicToken();
    await tx.quote.update({
      where: { id: quoteId },
      data: { publicTokenHash: token.tokenHash, publicTokenExpiresAt: token.expiresAt, updatedByUserId: actorUserId },
    });

    await tx.quoteAuditLog.create({
      data: {
        quoteId,
        action,
        actorUserId,
        // beforeSnapshot/afterSnapshot deliberately omitted — never the
        // raw token or the tokenized URL in any audit record.
        note: action === 'LINK_ISSUED' ? 'Lien famille émis' : 'Lien famille renouvelé — le précédent devient invalide',
      },
    });

    return { ok: true, familyUrl: buildFamilyQuoteUrl(token.rawToken), expiresAt: token.expiresAt, action };
  });
}

export interface ContactLeadSearchResult {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: ContactLeadStatus;
}

/**
 * Staff-only lookup backing the "lead search" typeahead in the assistante
 * workspace (replaces pasting a raw ContactLead id by hand). Returns only
 * the fields the workspace needs to identify and pre-fill a lead — never
 * `notes` (freeform internal text). Capped at 10 rows: an internal
 * lookup-as-you-type, not a paginated CRM listing.
 */
export async function searchContactLeads(query: string): Promise<ContactLeadSearchResult[]> {
  return prisma.contactLead.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true, phone: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
}

export interface QuoteHistoryEntry {
  id: string;
  status: QuoteStatus;
  monthlyTotal: number;
  grandTotal: number;
  examSession: number;
  createdAt: Date;
  updatedAt: Date;
  validUntil: Date;
}

/**
 * Staff-only "historique des devis" for a given lead and/or student.
 * Explicitly selects a narrow, non-sensitive field set — teacher cost and
 * margin are never columns on Quote/QuoteLine at all (see the model
 * comment in prisma/schema.prisma), so there is nothing to accidentally
 * over-select here, but the explicit `select` keeps it that way even if
 * the model grows fields later.
 */
export async function listQuotesForLeadOrStudent(input: {
  contactLeadId?: string;
  studentId?: string;
}): Promise<QuoteHistoryEntry[]> {
  const conditions = [
    input.contactLeadId ? { contactLeadId: input.contactLeadId } : null,
    input.studentId ? { studentId: input.studentId } : null,
  ].filter((c): c is { contactLeadId: string } | { studentId: string } => c != null);

  if (conditions.length === 0) return [];

  return prisma.quote.findMany({
    where: { OR: conditions },
    select: {
      id: true,
      status: true,
      monthlyTotal: true,
      grandTotal: true,
      examSession: true,
      createdAt: true,
      updatedAt: true,
      validUntil: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}
