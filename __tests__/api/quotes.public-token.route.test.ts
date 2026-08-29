jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  getQuoteByPublicToken: jest.fn(),
  markQuoteConsultedIfSent: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contactLead: { findUnique: jest.fn() },
  },
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/quotes/public/[token]/route';
import { getQuoteByPublicToken, markQuoteConsultedIfSent } from '@/lib/quotes/persistence.server';
import { prisma } from '@/lib/prisma';

const mockLookup = getQuoteByPublicToken as jest.Mock;
const mockMarkConsulted = markQuoteConsultedIfSent as jest.Mock;
const mockContactLeadFindUnique = prisma.contactLead.findUnique as jest.Mock;

function makeRequest(token: string) {
  return new NextRequest(`http://localhost:3000/api/quotes/public/${token}`);
}

describe('GET /api/quotes/public/[token]', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 for a token that does not resolve', async () => {
    mockLookup.mockResolvedValue({ quote: null, reason: 'NOT_FOUND' });
    const res = await GET(makeRequest('does-not-exist'), { params: Promise.resolve({ token: 'does-not-exist' }) });
    expect(res.status).toBe(404);
  });

  test('returns an exact humanized allowlist and never leaks engine, pricing or token internals', async () => {
    mockLookup.mockResolvedValue({
      quote: {
        id: 'quote-1',
        status: 'DEVIS_ENVOYE',
        examSession: 2027,
        budget: 1000,
        strategy: 'BEST_BALANCE',
        matchedOfferId: null,
        currency: 'TND',
        monthlyTotal: 790,
        grandTotal: 7900,
        validUntil: new Date().toISOString(),
        contactLeadId: 'lead-secret-id',
        idempotencyKey: 'should-not-appear',
        createdByUserId: 'staff-should-not-appear',
        diagnosticChecksum: 'diagnostic-secret',
        snapshotRegles: { costPolicy: 'BUSINESS_CONFIG', margin: 45, moduleId: 'MOD_EDS1' },
        parcours: 'P1_LIBRE_2ANS_MODALITE_A',
        student: { user: { firstName: 'Inès', lastName: 'Ben Salem' } },
        profil: {
          level: 'TERMINALE',
          specialite1: 'MATHEMATIQUES',
          specialite2: 'NSI',
          specialiteAbandonnee: null,
        },
        lines: [
          {
            id: 'line-secret-id',
            subject: 'Enseignement de spécialité 1',
            modality: 'GROUPE',
            hoursPerMonth: 8,
            unitPrice: 470,
            months: 10,
            lineTotal: 4700,
            reason: 'MOD_EDS1 internal reason',
            offerId: 'MOD_EDS1',
            priority: 'INTERNAL_PRIORITY',
            sortOrder: 0,
          },
        ],
      },
    });
    mockContactLeadFindUnique.mockResolvedValue({
      name: 'Mme Amel Ben Salem',
      email: 'amel@example.test',
      phone: null,
    });
    mockMarkConsulted.mockResolvedValue(new Date('2027-01-02T03:04:05.000Z'));

    const res = await GET(makeRequest('valid-token'), { params: Promise.resolve({ token: 'valid-token' }) });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(Object.keys(json.quote).sort()).toEqual([
      'acompte',
      'currency',
      'echeancier',
      'eleve',
      'examSession',
      'lines',
      'mensualite',
      'nombreMensualites',
      'profil',
      'responsable',
      'statusLabel',
      'totalAnnuel',
      'validUntil',
      'warnings',
    ]);
    expect(json.quote.lines[0]).toEqual({
      subject: 'Mathématiques',
      format: 'Petit groupe',
      hoursPerMonth: 8,
      unitPrice: 470,
      months: 10,
      lineTotal: 4700,
    });
    expect(json.quote.responsable.name).toBe('Mme Amel Ben Salem');
    expect(json.quote.eleve.displayName).toBe('Inès Ben Salem');
    expect(json.quote.profil).toEqual({
      level: 'Terminale',
      parcours: 'Candidat individuel — parcours sur deux ans',
      specialites: ['Mathématiques', 'NSI'],
      specialiteAbandonnee: null,
    });

    const serialized = JSON.stringify(json);
    for (const forbidden of [
      'raw-family-token-secret',
      'idempotencyKey',
      'createdByUserId',
      'teacherCost',
      'margin',
      'strategy',
      'matchedOfferId',
      'reason',
      'offerId',
      'priority',
      'costPolicy',
      'diagnostic',
      'MOD_',
      'BEST_BALANCE',
      'GROUPE',
      'TERMINALE',
      'P1_LIBRE_2ANS_MODALITE_A',
      'DEVIS_CONSULTE',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(json.quote.mensualite).toBe(790);
    expect(json.quote.statusLabel).toBe('Devis consulté');
  });

  test('auto-advances DEVIS_ENVOYE to DEVIS_CONSULTE on first view', async () => {
    mockLookup.mockResolvedValue({
      quote: {
        id: 'quote-1',
        status: 'DEVIS_ENVOYE',
        examSession: 2027,
        budget: 1000,
        strategy: 'BEST_BALANCE',
        matchedOfferId: null,
        currency: 'TND',
        monthlyTotal: 790,
        grandTotal: 7900,
        validUntil: new Date().toISOString(),
        contactLeadId: null,
        student: null,
        profil: null,
        lines: [],
      },
    });
    mockMarkConsulted.mockResolvedValue(new Date('2027-01-02T03:04:05.000Z'));
    mockContactLeadFindUnique.mockResolvedValue(null);

    await GET(makeRequest('valid-token'), { params: Promise.resolve({ token: 'valid-token' }) });
    expect(mockMarkConsulted).toHaveBeenCalledWith('quote-1');
  });

  test('a failed auto-transition never breaks the read', async () => {
    mockLookup.mockResolvedValue({
      quote: {
        id: 'quote-1',
        status: 'DEVIS_ENVOYE',
        examSession: 2027,
        budget: 1000,
        strategy: 'BEST_BALANCE',
        matchedOfferId: null,
        currency: 'TND',
        monthlyTotal: 790,
        grandTotal: 7900,
        validUntil: new Date().toISOString(),
        lines: [],
      },
    });
    mockMarkConsulted.mockRejectedValue(new Error('boom'));

    const res = await GET(makeRequest('valid-token'), { params: Promise.resolve({ token: 'valid-token' }) });
    expect(res.status).toBe(200);
  });

  test('sets Cache-Control: private, no-store', async () => {
    mockLookup.mockResolvedValue({ quote: null, reason: 'NOT_FOUND' });
    const res = await GET(makeRequest('x'), { params: Promise.resolve({ token: 'x' }) });
    expect(res.headers.get('Cache-Control')).toMatch(/no-store/);
  });
});
