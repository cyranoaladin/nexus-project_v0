/**
 * Tests: generateParentEafStageReport
 * lib/coach/eaf-stage-printemps/generate-parent-report.ts
 */

import { generateParentEafStageReport } from '@/lib/coach/eaf-stage-printemps/generate-parent-report';
import type { CoachEafSourceData } from '@/lib/coach/eaf-stage-printemps/types';
import { COACH_EAF_META } from '@/lib/coach/eaf-stage-printemps/types';

const FULL_SOURCE_DATA: CoachEafSourceData = {
  meta: {
    ...COACH_EAF_META,
    studentId: 'student-1',
    coachId: 'coach-1',
    savedAt: '2026-04-30T10:00:00.000Z',
    completedAt: '2026-04-30T11:00:00.000Z',
  },
  attendanceAndEngagement: {
    attendance: 'reguliere',
    punctuality: 'satisfaisante',
    involvement: 4,
    concentration: 3,
    oralParticipation: 3,
    attitudeToDifficulty: 'volontaire-mais-hesitant',
    coachComment: 'Élève sérieux, a bien participé aux séances.',
  },
  examExpectations: {
    understandsWrittenExam: 3,
    distinguishesAnalysisAndSummary: 3,
    quoteVsAnalysis: 2,
    subjectRequirements: 3,
    avoidsOffTopic: 4,
    successCriteria: 3,
    coachComment: 'La distinction entre citer et analyser reste à consolider.',
  },
  commentary: {
    textUnderstanding: 4,
    textIssues: 3,
    readingProject: 2,
    relevantQuotes: 3,
    processAnalysis: 2,
    interpretation: 3,
    organization: 4,
    paragraphs: 3,
    transitions: 2,
    noParaphrase: 3,
    strengths: 'Bonne compréhension globale des textes.',
    difficulties: 'Formulation du projet de lecture encore hésitante.',
    priority: 'Travailler la construction du projet de lecture.',
  },
  dissertation: {
    subjectUnderstanding: 4,
    keywordsAnalysis: 3,
    problematique: 2,
    progressivePlan: 3,
    arguments: 3,
    workMobilization: 4,
    examplesUse: 4,
    answersSubject: 3,
    introduction: 3,
    conclusion: 2,
    strengths: 'Bonne mobilisation de l\'œuvre.',
    difficulties: 'La problématique reste trop générale.',
    priority: 'Construire une problématique précise.',
  },
  writing: {
    sentenceClarity: 4,
    grammar: 3,
    spelling: 3,
    lexicalPrecision: 3,
    literaryVocabulary: 2,
    fluency: 3,
    paragraphStructure: 4,
    ideaExplanation: 3,
    timedWriting: 3,
    observations: 'La rédaction est correcte dans l\'ensemble.',
    frequentErrors: 'Oubli des accords en genre et en nombre.',
    recommendations: 'Relire attentivement avant de rendre la copie.',
  },
  autonomyAndMethod: {
    autonomy: 3,
    methodApplication: 4,
    errorCorrection: 3,
    correctionReuse: 2,
    timeManagement: 3,
    personalWorkRegularity: 4,
    revisionOrganization: 3,
    observedMethod: 'Travaille de façon régulière.',
    advice: 'Continuer à s\'entraîner sur des sujets variés.',
  },
  progress: {
    globalProgress: 'nette',
    mostImprovedSkill: 'dissertation',
    prioritySkill: 'commentaire',
    observedProgressComment: 'Des progrès significatifs ont été observés en dissertation.',
  },
  parentRecommendations: {
    estimatedCurrentLevel: 'fragile-mais-en-progres',
    recommendedFollowUp: 'accompagnement-regulier',
    priorityAxes: ['commentaire', 'dissertation', 'confiance-a-lecrit'],
    parentSummaryMessage: 'Votre enfant a fourni un travail sérieux durant ce stage.',
    finalRecommendation: 'Un accompagnement régulier permettra de consolider ces acquis.',
  },
};

const STUDENT = { firstName: 'Ahmed', lastName: 'Ben Ali', gradeLevel: 'PREMIERE' };
const FIXED_DATE = new Date('2026-04-30');

describe('generateParentEafStageReport', () => {
  it('1. Génère un texte non vide avec des données complètes', () => {
    const result = generateParentEafStageReport(FULL_SOURCE_DATA, STUDENT, FIXED_DATE);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('2. Contient toutes les sections attendues', () => {
    const result = generateParentEafStageReport(FULL_SOURCE_DATA, STUDENT, FIXED_DATE);

    expect(result).toContain('1. ATTITUDE ET IMPLICATION');
    expect(result).toContain("2. COMPRÉHENSION DES ATTENTES DE L'ÉPREUVE");
    expect(result).toContain('3. COMMENTAIRE DE TEXTE');
    expect(result).toContain('4. DISSERTATION');
    expect(result).toContain('5. EXPRESSION ÉCRITE');
    expect(result).toContain('6. PROGRÈS OBSERVÉS');
    expect(result).toContain('7. PRIORITÉS DE TRAVAIL');
    expect(result).toContain('8. RECOMMANDATION FINALE');
  });

  it('3. Contient le nom de l\'élève', () => {
    const result = generateParentEafStageReport(FULL_SOURCE_DATA, STUDENT, FIXED_DATE);
    expect(result).toContain('Ahmed Ben Ali');
  });

  it('4. Contient les informations de progression', () => {
    const result = generateParentEafStageReport(FULL_SOURCE_DATA, STUDENT, FIXED_DATE);
    expect(result).toContain('nette');
  });

  it('5. Génère correctement avec des données partielles', () => {
    const partial: Partial<CoachEafSourceData> = {
      meta: { ...COACH_EAF_META, studentId: 'student-1', coachId: 'coach-1' },
      attendanceAndEngagement: { attendance: 'excellente' },
      progress: { globalProgress: 'tres-nette' },
    };

    const result = generateParentEafStageReport(partial, STUDENT, FIXED_DATE);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(50);
    expect(result).toContain('1. ATTITUDE ET IMPLICATION');
  });

  it('6. Génère un texte même avec sourceData complètement vide', () => {
    const result = generateParentEafStageReport({}, { firstName: 'Inconnu' }, FIXED_DATE);

    expect(typeof result).toBe('string');
    expect(result).toContain('BILAN PÉDAGOGIQUE');
  });

  it('7. Utilise "Votre enfant" si firstName et lastName manquent', () => {
    const result = generateParentEafStageReport({}, {}, FIXED_DATE);
    expect(result).toContain('Votre enfant');
  });

  it('8. Contient le message de synthèse aux parents', () => {
    const result = generateParentEafStageReport(FULL_SOURCE_DATA, STUDENT, FIXED_DATE);
    expect(result).toContain('Votre enfant a fourni un travail sérieux durant ce stage.');
  });

  it('9. Contient les axes prioritaires', () => {
    const result = generateParentEafStageReport(FULL_SOURCE_DATA, STUDENT, FIXED_DATE);
    expect(result).toContain('commentaire de texte');
    expect(result).toContain('dissertation');
  });

  it('10. Contient le niveau actuel estimé', () => {
    const result = generateParentEafStageReport(FULL_SOURCE_DATA, STUDENT, FIXED_DATE);
    expect(result).toContain('fragile mais en progression');
  });

  it('11. Contient la recommandation de suivi', () => {
    const result = generateParentEafStageReport(FULL_SOURCE_DATA, STUDENT, FIXED_DATE);
    expect(result).toContain('accompagnement régulier est recommandé');
  });

  it('12. Ne contient pas de texte marketing ("meilleur", "garantissons")', () => {
    const result = generateParentEafStageReport(FULL_SOURCE_DATA, STUDENT, FIXED_DATE);
    const lowered = result.toLowerCase();

    expect(lowered).not.toContain('garantissons');
    expect(lowered).not.toContain('excellent résultat');
    expect(lowered).not.toContain('nous promettons');
  });

  it('13. Le résultat est déterministe (même entrée → même sortie)', () => {
    const r1 = generateParentEafStageReport(FULL_SOURCE_DATA, STUDENT, FIXED_DATE);
    const r2 = generateParentEafStageReport(FULL_SOURCE_DATA, STUDENT, FIXED_DATE);

    expect(r1).toBe(r2);
  });

  it('14. Mentionne la mention Nexus Réussite en bas', () => {
    const result = generateParentEafStageReport(FULL_SOURCE_DATA, STUDENT, FIXED_DATE);
    expect(result).toContain('Nexus Réussite');
  });
});
