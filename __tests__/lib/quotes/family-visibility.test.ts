import type { Quote } from '@prisma/client';
import { collectFamilyVisibilityBlockers, type QuoteWithProfilIdentity } from '@/lib/quotes/family-visibility';

function completeQuote(overrides: Partial<QuoteWithProfilIdentity> = {}): QuoteWithProfilIdentity {
  return {
    id: 'quote-1',
    regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
    profilId: 'profil-1',
    pricingVersion: 'v1',
    snapshotRegles: { note: 'test' },
    snapshotCarte: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
    contactLeadId: 'lead-1',
    studentId: 'student-1',
    profil: { contactLeadId: 'lead-1', studentId: 'student-1' },
    ...overrides,
  } as QuoteWithProfilIdentity;
}

function legacyQuote(overrides: Partial<Quote> = {}): QuoteWithProfilIdentity {
  return {
    id: 'quote-legacy',
    regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED',
    profilId: null,
    pricingVersion: 'v1',
    snapshotRegles: null,
    snapshotCarte: null,
    contactLeadId: null,
    studentId: null,
    profil: null,
    ...overrides,
  } as QuoteWithProfilIdentity;
}

describe('collectFamilyVisibilityBlockers — FAMILY_VISIBILITY_INVARIANTS (P0-B)', () => {
  test('healthy published quote: no blockers', () => {
    expect(collectFamilyVisibilityBlockers(completeQuote())).toEqual([]);
  });

  test('published quote + contactLead detached (SetNull) -> blocked', () => {
    const reasons = collectFamilyVisibilityBlockers(
      completeQuote({ contactLeadId: null, profil: { contactLeadId: null, studentId: 'student-1' } }),
    );
    expect(reasons).toContain('contactLeadId missing (Responsable detached)');
  });

  test('published quote + student detached (SetNull) -> blocked', () => {
    const reasons = collectFamilyVisibilityBlockers(
      completeQuote({ studentId: null, profil: { contactLeadId: 'lead-1', studentId: null } }),
    );
    expect(reasons).toContain('studentId missing (Élève detached)');
  });

  test('Quote.contactLeadId diverges from profil.contactLeadId (profil re-pointed) -> blocked', () => {
    const reasons = collectFamilyVisibilityBlockers(
      completeQuote({ profil: { contactLeadId: 'lead-OTHER', studentId: 'student-1' } }),
    );
    expect(reasons).toContain('contactLeadId diverges from profil.contactLeadId');
  });

  test('Quote.studentId diverges from profil.studentId (profil re-pointed) -> blocked', () => {
    const reasons = collectFamilyVisibilityBlockers(
      completeQuote({ profil: { contactLeadId: 'lead-1', studentId: 'student-OTHER' } }),
    );
    expect(reasons).toContain('studentId diverges from profil.studentId');
  });

  test('still runs the base emission gate (e.g. non-CARTE_VALIDATED_DEFINITIVE) alongside identity checks', () => {
    const reasons = collectFamilyVisibilityBlockers(completeQuote({ regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED' }));
    expect(reasons).toContain('regulatoryMaturity != CARTE_VALIDATED_DEFINITIVE');
  });

  test('non-regression: legacy/public-simulator quote (profilId null) is never scoped by this gate, whatever its identity fields', () => {
    expect(collectFamilyVisibilityBlockers(legacyQuote())).toEqual([]);
  });
});
