import { buildBilanPedagogicalProfile } from '@/lib/bilan-generation/buildBilanPedagogicalProfile';
import type { NormalizedBilanInput } from '@/lib/bilan-generation/types';

const baseInput: NormalizedBilanInput = {
  bilanId: 'bilan-test',
  student: { id: 'stu-1', displayName: 'Alice Martin', firstName: 'Alice', gender: 'female', gradeLevel: 'Première' },
  context: { bilanKind: 'MATHS_PREMIERE_STAGE_PRINTEMPS', subject: 'Mathématiques', durationHours: 14 },
  coachInputs: {
    mainMessage: 'Alice progresse bien mais doit consolider les probabilités.',
    doNotSay: 'ne pas mentionner les mauvaises notes du lycée',
    tone: 'équilibré',
    urgencyLevel: 'suivi normal',
  },
  chapters: [
    { key: 'secondDegree', label: 'Second degré', mastery: 4, specificStrength: 'Bonne maîtrise des discriminants' },
    { key: 'probabilities', label: 'Probabilités conditionnelles', mastery: 2, vigilancePoints: ['P(A|B) mal appliquée'], recurringErrors: ['confusion indépendance/incompatibilité'], priorityRemediation: 'Refaire les exercices P(A|B) et Bayes' },
    { key: 'derivation', label: 'Dérivation', mastery: 3 },
  ],
  finalAssessment: {
    completed: true,
    approximateScore: 11,
    timeManagement: 4,
    writtenJustification: 2,
    mostAvoidableMistake: 'Oubli de la formule P(A|B)',
    strongestFinalTestPoint: 'Bonne gestion du temps',
  },
  priorityAxes: ['Probabilités conditionnelles', 'Rédaction mathématique'],
  rawSourceData: {},
};

describe('buildBilanPedagogicalProfile', () => {
  it('detects high-priority chapter (mastery <= 2)', () => {
    const profile = buildBilanPedagogicalProfile(baseInput);
    const highPrio = profile.chapterPriorities.find(c => c.chapter === 'Probabilités conditionnelles');
    expect(highPrio).toBeDefined();
    expect(highPrio?.priority).toBe('high');
  });

  it('detects key strengths from high-mastery chapters', () => {
    const profile = buildBilanPedagogicalProfile(baseInput);
    const strengthTitles = profile.keyStrengths.map(s => s.title);
    expect(strengthTitles).toContain('Second degré');
  });

  it('includes final assessment strength', () => {
    const profile = buildBilanPedagogicalProfile(baseInput);
    const finalStrength = profile.keyStrengths.find(s => s.title === 'Épreuve finale');
    expect(finalStrength).toBeDefined();
    expect(finalStrength?.evidence).toContain('Bonne gestion du temps');
  });

  it('includes avoidable mistake in weaknesses', () => {
    const profile = buildBilanPedagogicalProfile(baseInput);
    const mistakeWeakness = profile.priorityWeaknesses.find(w => w.title === "Erreur évitable à l'épreuve");
    expect(mistakeWeakness).toBeDefined();
    expect(mistakeWeakness?.evidence).toContain('P(A|B)');
  });

  it('interprets score in finalAssessmentReading', () => {
    const profile = buildBilanPedagogicalProfile(baseInput);
    expect(profile.finalAssessmentReading).toBeDefined();
    expect(profile.finalAssessmentReading?.score).toBe('11/20');
    expect(profile.finalAssessmentReading?.interpretation).toBeTruthy();
  });

  it('propagates doNotSay to parentGuidance', () => {
    const profile = buildBilanPedagogicalProfile(baseInput);
    expect(profile.parentGuidance.whatToAvoidSaying).toContain('mauvaises notes');
  });

  it('flags missing data when no chapters', () => {
    const inputNoChapters = { ...baseInput, chapters: [] };
    const profile = buildBilanPedagogicalProfile(inputNoChapters);
    expect(profile.dataQuality.missingImportantFields).toContain('diagnostic par chapitre');
  });

  it('returns correct urgency from coach inputs', () => {
    const profile = buildBilanPedagogicalProfile(baseInput);
    expect(profile.parentGuidance.urgency).toBe('suivi normal');
  });
});
