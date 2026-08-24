import { requireExamPolicy, isMentionEligible } from '@/lib/exams/catalog';
import { requireResolved } from '@/lib/exams/a-verifier';

describe('T-mention — conservation de notes et perte de la mention', () => {
  const policy = requireExamPolicy(2027);
  const rules = requireResolved(policy.candidatIndividuelRules, 'session 2027 candidatIndividuelRules');

  test('aucune mention ne peut être attribuée si le candidat demande la conservation de notes', () => {
    expect(isMentionEligible(policy, { hasRequestedNoteConservation: true })).toBe(false);
  });

  test('la mention reste possible si le candidat ne conserve aucune note', () => {
    expect(isMentionEligible(policy, { hasRequestedNoteConservation: false })).toBe(true);
  });

  test('le policy porte la source de cette règle (articles D. 334-13 et D. 336-13)', () => {
    expect(rules.noteConservation.perteDeMention).toBe(true);
    expect(rules.noteConservation.sourceMention).toMatch(/D\. 334-13|D\. 336-13/);
  });
});
