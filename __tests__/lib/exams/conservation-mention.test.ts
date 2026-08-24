import { requireExamPolicy, isMentionEligible } from '@/lib/exams/catalog';

describe('T-mention — conservation de notes et perte de la mention', () => {
  const policy = requireExamPolicy(2027);

  test('aucune mention ne peut être attribuée si le candidat demande la conservation de notes', () => {
    expect(isMentionEligible(policy, { hasRequestedNoteConservation: true })).toBe(false);
  });

  test('la mention reste possible si le candidat ne conserve aucune note', () => {
    expect(isMentionEligible(policy, { hasRequestedNoteConservation: false })).toBe(true);
  });

  test('le policy porte la source de cette règle (articles D. 334-13 et D. 336-13)', () => {
    expect(policy.candidatIndividuelRules.noteConservation.perteDeMention).toBe(true);
    expect(policy.candidatIndividuelRules.noteConservation.sourceMention).toMatch(/D\. 334-13|D\. 336-13/);
  });
});
