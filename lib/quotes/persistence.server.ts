/**
 * Server-only persistence for the Quote domain (CDC §24-26, §45-46).
 *
 * A quote's pricing/regulatory context is frozen at creation
 * (snapshot.server.ts) and never silently recomputed. Creation is
 * idempotent (a retried request with the same idempotencyKey returns the
 * existing row, never a duplicate).
 */
import 'server-only';
import type { Quote, QuoteLine, QuoteSource, QuoteStrategy, QuoteStatus, ContactLeadStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildQuoteContextSnapshot, generateQuotePublicToken } from './snapshot.server';
import { canTransition } from './status';
import { hashToken } from '@/lib/invoice/access-token';
import type { QuoteScenario } from './schemas';

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
  const existing = await prisma.quote.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { lines: true },
  });
  if (existing) {
    return { quote: existing, rawToken: null, alreadyExisted: true };
  }

  const snapshot = buildQuoteContextSnapshot(input.examSession);
  const token = generateQuotePublicToken();

  const quote = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        publicTokenHash: token.tokenHash,
        publicTokenExpiresAt: token.expiresAt,
        idempotencyKey: input.idempotencyKey,
        status: 'ESTIMATION',
        source: input.source,
        contactLeadId: input.contactLeadId,
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
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day estimation validity
        createdByUserId: input.createdByUserId,
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

    return created;
  });

  return { quote, rawToken: token.rawToken, alreadyExisted: false };
}

export interface QuoteLookupResult {
  quote: (Quote & { lines: QuoteLine[] }) | null;
  reason?: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED';
}

/** Public lookup by raw token — never leaks which failure mode applies beyond NOT_FOUND/EXPIRED to a client, callers should render a generic "lien invalide" message either way. */
export async function getQuoteByPublicToken(rawToken: string): Promise<QuoteLookupResult> {
  const tokenHash = hashToken(rawToken);
  const quote = await prisma.quote.findUnique({ where: { publicTokenHash: tokenHash }, include: { lines: true } });
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
