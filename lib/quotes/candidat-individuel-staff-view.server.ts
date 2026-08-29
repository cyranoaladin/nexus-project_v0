import 'server-only';

import { prisma } from '@/lib/prisma';

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
    canDownloadPdf: boolean;
    canCreateRevision: boolean;
    hasFamilyLink: boolean;
  };
}

interface StaffQuoteSource {
  id: string;
  status: string;
  regulatoryMaturity: string;
  updatedAt: Date;
  monthlyTotal: number;
  grandTotal: number;
  deposit: number | null;
  paymentPolicy: string | null;
  publicTokenHash: string | null;
  snapshotRegles: unknown;
  lines: Array<{
    subject: string;
    modality: string;
    hoursPerMonth: number | null;
    unitPrice: number;
    sortOrder: number;
    reason?: string;
    offerId?: string | null;
  }>;
}

const quoteSelect = {
  id: true,
  status: true,
  regulatoryMaturity: true,
  updatedAt: true,
  monthlyTotal: true,
  grandTotal: true,
  deposit: true,
  paymentPolicy: true,
  publicTokenHash: true,
  snapshotRegles: true,
  lines: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      subject: true,
      modality: true,
      hoursPerMonth: true,
      unitPrice: true,
      sortOrder: true,
    },
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

function humanMargin(snapshotRegles: unknown): CandidatIndividuelStaffQuoteView['margin'] {
  const snapshot = asRecord(snapshotRegles);
  const margin = asRecord(snapshot?.margin);
  const percentage = margin?.marginPct;
  const gate = margin?.gate;
  if (typeof percentage !== 'number' || !Number.isFinite(percentage) || typeof gate !== 'string') return null;
  const statusLabel =
    gate === 'MARGIN_OK'
      ? 'Marge conforme'
      : gate === 'HUMAN_REVIEW_REQUIRED'
        ? 'Validation de la marge requise'
        : 'Proposition bloquée';
  return { percentage: Math.round(percentage * 10) / 10, statusLabel };
}

function humanQuoteStatus(source: StaffQuoteSource): string {
  if (source.regulatoryMaturity === 'CARTE_VALIDATED_DEFINITIVE') return 'Validé pour la famille';
  const labels: Record<string, string> = {
    ESTIMATION: 'Brouillon interne',
    DEVIS_ENVOYE: 'Envoyé',
    DEVIS_CONSULTE: 'Consulté',
    ACCEPTE: 'Accepté',
    REFUSE: 'Refusé',
    EXPIRE: 'Expiré',
  };
  return labels[source.status] ?? 'Brouillon interne';
}

export function toCandidatIndividuelStaffQuoteView(source: StaffQuoteSource): CandidatIndividuelStaffQuoteView {
  const familyReady = source.regulatoryMaturity === 'CARTE_VALIDATED_DEFINITIVE';
  return {
    id: source.id,
    statusLabel: humanQuoteStatus(source),
    updatedAt: source.updatedAt.toISOString(),
    totals: {
      annualTnd: source.grandTotal,
      depositTnd: source.deposit ?? 0,
      installmentTnd: source.monthlyTotal,
      installmentCount: source.paymentPolicy === 'PAY_IN_FULL_AT_BOOKING' ? 1 : 10,
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
      canPublish: !familyReady,
      canIssueFamilyLink: familyReady,
      canDownloadPdf: true,
      canCreateRevision: true,
      hasFamilyLink: source.publicTokenHash != null,
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
