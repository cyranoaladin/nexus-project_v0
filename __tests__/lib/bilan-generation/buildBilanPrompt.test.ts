import { buildBilanPrompt } from '@/lib/bilan-generation/buildBilanPrompt';
import { buildBilanPedagogicalProfile } from '@/lib/bilan-generation/buildBilanPedagogicalProfile';
import type { NormalizedBilanInput } from '@/lib/bilan-generation/types';

const input: NormalizedBilanInput = {
  bilanId: 'b-1',
  student: { id: 's-1', displayName: 'Marc Leroy', firstName: 'Marc', gender: 'male', gradeLevel: 'Première' },
  context: { bilanKind: 'MATHS_PREMIERE_STAGE_PRINTEMPS', subject: 'Mathématiques', durationHours: 14, periodLabel: 'Printemps 2026' },
  coachInputs: { mainMessage: 'Marc doit consolider les probabilités.', doNotSay: 'Ne pas mentionner les notes du lycée', tone: 'équilibré' },
  chapters: [
    { key: 'probabilities', label: 'Probabilités conditionnelles', mastery: 2, priorityRemediation: 'Exercices Bayes' },
    { key: 'secondDegree', label: 'Second degré', mastery: 4, specificStrength: 'Discriminant maîtrisé' },
  ],
  finalAssessment: { completed: true, approximateScore: 10, mostAvoidableMistake: 'Signe oublié' },
  rawSourceData: { secret: 'should_not_appear' },
  legacySummary: 'Synthèse legacy brute à ne pas recopier directement.',
};

describe('buildBilanPrompt', () => {
  const profile = buildBilanPedagogicalProfile(input);
  const messages = buildBilanPrompt(profile, input);

  it('returns exactly 2 messages: system + user', () => {
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('system prompt contains structure requirements', () => {
    expect(messages[0].content).toContain('## 1.');
    expect(messages[0].content).toContain('## 6.');
  });

  it('system prompt forbids "ton ferme"', () => {
    expect(messages[0].content).toContain('ton ferme');
  });

  it('user prompt contains student first name', () => {
    expect(messages[1].content).toContain('Marc');
  });

  it('user prompt contains subject and duration', () => {
    expect(messages[1].content).toContain('Mathématiques');
    expect(messages[1].content).toContain('14');
  });

  it('user prompt does NOT contain rawSourceData key', () => {
    expect(messages[1].content).not.toContain('should_not_appear');
  });

  it('user prompt does NOT include legacySummary text verbatim', () => {
    expect(messages[1].content).not.toContain('Synthèse legacy brute à ne pas recopier directement.');
  });

  it('user prompt includes doNotSay instruction', () => {
    expect(messages[1].content).toContain('lycée');
  });

  it('user prompt includes chapter data', () => {
    expect(messages[1].content).toContain('Probabilités conditionnelles');
    expect(messages[1].content).toContain('Exercices Bayes');
  });

  it('user prompt includes pedagogical profile diagnosis', () => {
    expect(messages[1].content).toContain('DIAGNOSTIC EXÉCUTIF');
  });
});
