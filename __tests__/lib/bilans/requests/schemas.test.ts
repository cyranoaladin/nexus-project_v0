import {
  bilanChildSchema,
  bilanRequestAdmissionSchema,
  bilanTeamAssignmentSchema,
  bilanTeamOperationalActionSchema,
  bilanTeamReviewSchema,
} from '@/lib/bilans/requests/schemas';

const validAdmission = {
  parent: {
    firstName: 'Samira',
    lastName: 'Ben Salah',
    email: 'samira@example.com',
    phone: '+216 99 19 28 29',
  },
  child: {
    firstName: 'Yasmine',
    lastName: 'Ben Salah',
    schoolName: 'Lycée pilote',
  },
  schoolYear: '2026-2027',
  level: 'TERMINALE',
  subject: 'MATHEMATIQUES',
  mainNeed: 'Consolider les acquis et préparer la spécialité.',
  message: 'Yasmine souhaite identifier ses priorités de travail.',
  consent: true,
  consentVersion: 'bilan-public-v1',
};

describe('bilan request schemas', () => {
  it('accepts the minimal pilot admission and normalizes contact data', () => {
    const result = bilanRequestAdmissionSchema.parse(validAdmission);

    expect(result.parent.email).toBe('samira@example.com');
    expect(result.parent.phone).toBe('+21699192829');
    expect(result).not.toHaveProperty('password');
    expect(result.parent).not.toHaveProperty('password');
  });

  it.each([
    ['PREMIERE', 'NSI'],
    ['TROISIEME', 'FRANCAIS'],
  ] as const)('accepts the recognized %s + %s intake outside the pilot', (level, subject) => {
    expect(
      bilanRequestAdmissionSchema.safeParse({
        ...validAdmission,
        level,
        subject,
      }).success,
    ).toBe(true);
  });

  it.each([
    ['school year', { schoolYear: '2025-2026' }],
    ['level', { level: 'UNKNOWN' }],
    ['subject', { subject: 'UNKNOWN' }],
  ])('rejects an unrecognized %s', (_label, replacement) => {
    expect(
      bilanRequestAdmissionSchema.safeParse({ ...validAdmission, ...replacement }).success,
    ).toBe(false);
  });

  it('rejects unknown keys at every public boundary', () => {
    expect(
      bilanRequestAdmissionSchema.safeParse({ ...validAdmission, password: 'secret123' }).success,
    ).toBe(false);
    expect(
      bilanRequestAdmissionSchema.safeParse({
        ...validAdmission,
        child: { ...validAdmission.child, birthDate: '2008-01-01' },
      }).success,
    ).toBe(false);
    expect(
      bilanRequestAdmissionSchema.safeParse({
        ...validAdmission,
        parent: { ...validAdmission.parent, internalRole: 'ADMIN' },
      }).success,
    ).toBe(false);
  });

  it('requires explicit consent', () => {
    expect(
      bilanRequestAdmissionSchema.safeParse({ ...validAdmission, consent: false }).success,
    ).toBe(false);
  });

  it.each([
    [{ parent: { ...validAdmission.parent, email: 'not-an-email' } }],
    [{ parent: { ...validAdmission.parent, phone: '123' } }],
    [{ parent: { ...validAdmission.parent, phone: '+000000000' } }],
  ])('rejects invalid parent contact data', (replacement) => {
    expect(
      bilanRequestAdmissionSchema.safeParse({ ...validAdmission, ...replacement }).success,
    ).toBe(false);
  });

  it.each([
    [{ mainNeed: 'x'.repeat(501) }],
    [{ message: 'x'.repeat(1_001) }],
    [{ child: { ...validAdmission.child, schoolName: 'x'.repeat(161) } }],
  ])('rejects oversized free text', (replacement) => {
    expect(
      bilanRequestAdmissionSchema.safeParse({ ...validAdmission, ...replacement }).success,
    ).toBe(false);
  });

  it('keeps the child payload minimal and strict', () => {
    expect(bilanChildSchema.safeParse({ firstName: 'Yasmine' }).success).toBe(true);
    expect(
      bilanChildSchema.safeParse({
        firstName: 'Yasmine',
        medicalNotes: 'Donnée non nécessaire',
      }).success,
    ).toBe(false);
  });

  it('validates strict assignment actions', () => {
    expect(bilanTeamAssignmentSchema.safeParse({ coachId: 'coach_123' }).success).toBe(true);
    expect(
      bilanTeamAssignmentSchema.safeParse({ coachId: 'coach_123', role: 'ADMIN' }).success,
    ).toBe(false);
    expect(bilanTeamAssignmentSchema.safeParse({ coachId: '' }).success).toBe(false);
  });

  it('requires a bounded reason when a review is rejected', () => {
    expect(bilanTeamReviewSchema.safeParse({ decision: 'APPROVE' }).success).toBe(true);
    expect(bilanTeamReviewSchema.safeParse({ decision: 'REJECT' }).success).toBe(false);
    expect(
      bilanTeamReviewSchema.safeParse({
        decision: 'REJECT',
        note: 'Les recommandations doivent être précisées.',
      }).success,
    ).toBe(true);
    expect(
      bilanTeamReviewSchema.safeParse({
        decision: 'REJECT',
        note: 'x'.repeat(1_001),
      }).success,
    ).toBe(false);
  });

  it('validates strict, reasoned operational actions', () => {
    expect(
      bilanTeamOperationalActionSchema.safeParse({
        action: 'MARK_HUMAN_FOLLOWUP',
        reason: 'Aucun pack publié ne correspond à la demande.',
      }).success,
    ).toBe(true);
    expect(
      bilanTeamOperationalActionSchema.safeParse({
        action: 'CANCEL',
        reason: '',
      }).success,
    ).toBe(false);
    expect(
      bilanTeamOperationalActionSchema.safeParse({
        action: 'RETRY_TECHNICAL',
        reason: 'Relancer le traitement.',
        force: true,
      }).success,
    ).toBe(false);
  });
});
