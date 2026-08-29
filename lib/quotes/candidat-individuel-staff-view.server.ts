import 'server-only';

import type { Quote, QuoteStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  collectFamilyLinkIssuanceBlockers,
  collectQuotePromotionBlockers,
} from '@/lib/quotes/emission-guard';
import { humanizeQuoteStatus } from '@/lib/quotes/pdf-adapter.server';
import { canTransition } from '@/lib/quotes/status';

export interface CandidatIndividuelStaffQuoteLine {
  subject: string;
  modality: string;
  hoursPerMonth: number | null;
  monthlyAmountTnd: number;
}

export interface CandidatIndividuelStaffQuoteView {
  id: string;
  statusLabel: string;
  updatedAt: string;
  totals: {
    annualTnd: number;
    depositTnd: number;
    installmentTnd: number;
    installmentCount: number;
  };
  lines: CandidatIndividuelStaffQuoteLine[];
  margin: { percentage: number; statusLabel: string } | null;
  actions: {
    canPublish: boolean;
    canIssueFamilyLink: boolean;
    canRotateFamilyLink: boolean;
    canDownloadPdf: boolean;
    canCreateRevision: boolean;
    hasFamilyLink: boolean;
  };
}

interface StaffQuoteSource {
  id: string;
  status: QuoteStatus;
  regulatoryMaturity: string;
  profilId: string | null;
  contactLeadId: string | null;
  studentId: string | null;
  pricingVersion: string;
  updatedAt: Date;
  monthlyTotal: number;
  grandTotal: number;
  deposit: number | null;
  paymentPolicy: string | null;
  snapshotCarte: unknown;
  snapshotRegles: unknown;
  lines: Array<{
    subject: string;
    modality: string;
    hoursPerMonth: number | null;
    unitPrice: number;
    months: number;
    sortOrder: number;
  }>;
  auditLogs: Array<{ action: string }>;
}

const quoteSelect = {
  id: true,
  status: true,
  regulatoryMaturity: true,
  profilId: true,
  contactLeadId: true,
  studentId: true,
  pricingVersion: true,
  updatedAt: true,
  monthlyTotal: true,
  grandTotal: true,
  deposit: true,
  paymentPolicy: true,
  snapshotCarte: true,
  snapshotRegles: true,
  lines: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      subject: true,
      modality: true,
      hoursPerMonth: true,
      unitPrice: true,
      months: true,
      sortOrder: true,
    },
  },
  auditLogs: {
    where: { action: { in: ['LINK_ISSUED', 'LINK_ROTATED'] } },
    take: 1,
    select: { action: true },
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function humanSubject(raw: string): string {
  const known: Record<string, string> = {
    MATHEMATIQUES: 'Mathématiques',
    NSI: 'Numérique et sciences informatiques (NSI)',
    FRANCAIS: 'Français',
    PHILOSOPHIE: 'Philosophie',
    GRAND_ORAL: 'Grand oral',
    LVA: 'Langue vivante A',
    LVB: 'Langue vivante B',
    PILOTAGE: 'Pilotage Nexus',
  };
  if (known[raw]) return known[raw];
  if (/^(?:MOD_|SVC_|[A-Z][A-Z0-9_]+$)/.test(raw)) return 'Matière à vérifier';
  return raw.trim() || 'Matière à vérifier';
}

function humanModality(raw: string): string {
  const labels: Record<string, string> = {
    INDIVIDUEL: 'Individuel',
    DUO: 'Duo',
    GROUPE: 'Petit groupe',
    PILOTAGE: 'Pilotage Nexus',
    PACK: 'Parcours combiné',
  };
  return labels[raw] ?? 'Modalité à vérifier';
}

function hasValidMarginOverride(value: unknown): boolean {
  const override = asRecord(value);
  return typeof override?.reason === 'string'
    && override.reason.trim().length > 0
    && typeof override.byUserId === 'string'
    && override.byUserId.trim().length > 0
    && typeof override.at === 'string'
    && Number.isFinite(Date.parse(override.at));
}

function humanMargin(snapshotRegles: unknown): CandidatIndividuelStaffQuoteView['margin'] {
  const snapshot = asRecord(snapshotRegles);
  const margin = asRecord(snapshot?.margin);
  const percentage = margin?.marginPct;
  const gate = margin?.gate;
  if (typeof percentage !== 'number' || !Number.isFinite(percentage) || typeof gate !== 'string') return null;
  const statusLabel = gate === 'MARGIN_OK'
    ? 'Marge conforme'
    : gate === 'HUMAN_REVIEW_REQUIRED' && hasValidMarginOverride(snapshot?.marginOverride)
      ? 'Marge validée par le staff'
      : gate === 'HUMAN_REVIEW_REQUIRED'
        ? 'Validation de la marge requise'
        : 'Proposition bloquée';
  return { percentage: Math.round(percentage * 10) / 10, statusLabel };
}

export function toCandidatIndividuelStaffQuoteView(source: StaffQuoteSource): CandidatIndividuelStaffQuoteView {
  const gateSource = source as unknown as Quote;
  const hasFamilyLink = source.auditLogs.some((log) => log.action === 'LINK_ISSUED' || log.action === 'LINK_ROTATED');
  const canPublish = canTransition(source.status, 'DEVIS_ENVOYE') && collectQuotePromotionBlockers(gateSource).length === 0;
  const canIssueFamilyLink = collectFamilyLinkIssuanceBlockers(gateSource).length === 0;
  const installmentCount = source.paymentPolicy === 'PAY_IN_FULL_AT_BOOKING'
    ? 1
    : Math.max(0, ...source.lines.map((line) => line.months));

  return {
    id: source.id,
    statusLabel: humanizeQuoteStatus(source.status),
    updatedAt: source.updatedAt.toISOString(),
    totals: {
      annualTnd: source.grandTotal,
      depositTnd: source.deposit ?? 0,
      installmentTnd: source.monthlyTotal,
      installmentCount,
    },
    lines: [...source.lines]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((line) => ({
        subject: humanSubject(line.subject),
        modality: humanModality(line.modality),
        hoursPerMonth: line.hoursPerMonth,
        monthlyAmountTnd: line.unitPrice,
      })),
    margin: humanMargin(source.snapshotRegles),
    actions: {
      canPublish,
      canIssueFamilyLink,
      canRotateFamilyLink: canIssueFamilyLink && hasFamilyLink,
      canDownloadPdf: source.profilId != null,
      canCreateRevision: source.profilId != null,
      hasFamilyLink,
    },
  };
}

export async function getCandidatIndividuelStaffQuoteView(quoteId: string): Promise<CandidatIndividuelStaffQuoteView | null> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, profilId: { not: null } },
    select: quoteSelect,
  });
  return quote ? toCandidatIndividuelStaffQuoteView(quote as StaffQuoteSource) : null;
}

export async function getCandidatIndividuelStaffQuoteViewByIdempotencyKey(
  profileId: string,
  idempotencyKey: string,
): Promise<CandidatIndividuelStaffQuoteView | null> {
  const quote = await prisma.quote.findFirst({
    where: { profilId: profileId, idempotencyKey },
    select: quoteSelect,
  });
  return quote ? toCandidatIndividuelStaffQuoteView(quote as StaffQuoteSource) : null;
}

export async function getCandidatIndividuelStaffProfileView(profileId: string) {
  const profile = await prisma.profilCandidat.findUnique({
    where: { id: profileId },
    include: {
      contactLead: { select: { id: true, name: true, email: true, phone: true, status: true } },
      student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      quotes: { orderBy: { updatedAt: 'desc' }, take: 1, select: quoteSelect },
    },
  });
  if (!profile) return null;
  const { quotes, ...candidateProfile } = profile;
  return {
    ...candidateProfile,
    lastQuote: quotes[0] ? toCandidatIndividuelStaffQuoteView(quotes[0] as StaffQuoteSource) : null,
  };
}

export async function listCandidatIndividuelStaffProfileViews(filter: {
  contactLeadId?: string;
  studentId?: string;
  limit?: number;
} = {}) {
  const profiles = await prisma.profilCandidat.findMany({
    where: { contactLeadId: filter.contactLeadId, studentId: filter.studentId },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(filter.limit ?? 25, 100),
    include: {
      contactLead: { select: { id: true, name: true, email: true, phone: true, status: true } },
      student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      quotes: { orderBy: { updatedAt: 'desc' }, take: 1, select: quoteSelect },
    },
  });
  return profiles.map(({ quotes, ...profile }) => ({
    ...profile,
    lastQuote: quotes[0] ? toCandidatIndividuelStaffQuoteView(quotes[0] as StaffQuoteSource) : null,
  }));
}
