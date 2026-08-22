/**
 * Server-only persistence for the Quote domain (CDC §24-26, §45-46).
 *
 * A quote's pricing/regulatory context is frozen at creation
 * (snapshot.server.ts) and never silently recomputed. Creation is
 * idempotent (a retried request with the same idempotencyKey returns the
 * existing row, never a duplicate). A quote already sent is never mutated
 * in place — reviseQuote() always creates a new row.
 */
import 'server-only';
import type { Quote, QuoteLine, QuoteSource, QuoteStrategy, QuoteStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildQuoteContextSnapshot, generateQuotePublicToken } from './snapshot.server';
import { canTransition, requiresRevisionOnEdit } from './status';
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
   * receiving the first response, staff must issue a fresh link via
   * reviseQuote(), not by re-deriving this one.
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

export interface ReviseQuoteInput {
  quoteId: string;
  scenario: QuoteScenario;
  actorUserId: string;
  note?: string;
}

/**
 * Edits a quote. If it's still in a pre-send status, mutates in place
 * (with an audit entry). If it has already been sent to the family
 * (status >= DEVIS_ENVOYE per requiresRevisionOnEdit), creates a brand new
 * Quote row instead — the original is left untouched, forever reproducible
 * exactly as the family saw it (CDC §46).
 */
export async function reviseQuote(input: ReviseQuoteInput): Promise<Quote & { lines: QuoteLine[] }> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.quote.findUniqueOrThrow({ where: { id: input.quoteId }, include: { lines: true } });

    if (!requiresRevisionOnEdit(current.status)) {
      await tx.quoteLine.deleteMany({ where: { quoteId: current.id } });
      const updated = await tx.quote.update({
        where: { id: current.id },
        data: {
          monthlyTotal: input.scenario.monthlyTotal,
          grandTotal: input.scenario.grandTotal,
          matchedOfferId: input.scenario.matchedOfferId,
          updatedByUserId: input.actorUserId,
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
        data: { quoteId: current.id, action: 'LINE_EDITED', actorUserId: input.actorUserId, note: input.note },
      });
      return updated;
    }

    const token = generateQuotePublicToken();
    const revision = await tx.quote.create({
      data: {
        publicTokenHash: token.tokenHash,
        publicTokenExpiresAt: token.expiresAt,
        status: 'ESTIMATION',
        source: current.source,
        contactLeadId: current.contactLeadId,
        studentId: current.studentId,
        diagnosticId: current.diagnosticId,
        diagnosticChecksum: current.diagnosticChecksum,
        examSession: current.examSession,
        pricingVersion: current.pricingVersion,
        examPolicyVersion: current.examPolicyVersion,
        budget: current.budget,
        strategy: current.strategy,
        matchedOfferId: input.scenario.matchedOfferId,
        monthlyTotal: input.scenario.monthlyTotal,
        grandTotal: input.scenario.grandTotal,
        validUntil: current.validUntil,
        previousRevisionId: current.id,
        revisionNumber: current.revisionNumber + 1,
        createdByUserId: input.actorUserId,
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
        quoteId: revision.id,
        action: 'REVISION_CREATED',
        actorUserId: input.actorUserId,
        beforeSnapshot: { previousRevisionId: current.id },
        note: input.note,
      },
    });

    return revision;
  });
}
