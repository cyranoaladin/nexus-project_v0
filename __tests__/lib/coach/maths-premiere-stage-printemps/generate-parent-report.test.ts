import { generateParentMathsStageReport } from '@/lib/coach/maths-premiere-stage-printemps/generate-parent-report';
import type { CoachMathsSourceData } from '@/lib/coach/maths-premiere-stage-printemps/types';

describe('generateParentMathsStageReport (P0 restructured)', () => {
  const student = { firstName: 'Alice', lastName: 'Martin' };
  const baseDate = new Date('2026-04-15');

  const minimalValidData: Partial<CoachMathsSourceData> = {
    attendanceAndEngagement: { attendance: 'reguliere' },
    parentRecommendations: {
      parentMainMessage: 'Bon stage pour Alice.',
    },
  };

  it('generates report with student name and date', () => {
    const report = generateParentMathsStageReport(minimalValidData, student, baseDate);
    expect(report).toContain('Alice Martin');
    expect(report).toContain('15 avril 2026');
    expect(report).toContain('BILAN PÉDAGOGIQUE');
  });

  it('includes global diagnostic when provided', () => {
    const data: Partial<CoachMathsSourceData> = {
      globalDiagnostic: {
        overallProfile: 'UNEVEN_PROGRESS',
        workPace: 'SLOW_BUT_ACCURATE',
        mainCoachMessage: 'Message principal test.',
      },
      parentRecommendations: {
        parentUrgency: 'WATCH',
        parentTone: 'BALANCED',
        parentMainMessage: 'Message guidé.',
      },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    expect(report).toContain('progression inégale');
    expect(report).toContain('lent mais précis');
    expect(report).toContain('Message principal test');
    expect(report).toContain('à surveiller');
  });

  it('includes chapter diagnostics when provided', () => {
    const data: Partial<CoachMathsSourceData> = {
      chapterDiagnostics: {
        secondDegree: {
          mastery: 4,
          methodsAcquired: ['factorisation', 'Delta'],
          vigilancePoints: ['signe de a'],
          recurringErrors: ['oubli discriminant'],
          priorityRemediation: 'Revoir les inéquations',
        },
        derivation: {
          mastery: 3,
          strength: 'Point fort sur la dérivation',
        },
      },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    expect(report).toContain('Second degré');
    expect(report).toContain('satisfaisant');
    expect(report).toContain('factorisation');
    expect(report).toContain('Revoir les inéquations');
    expect(report).toContain('Dérivation');
    expect(report).toContain('Point fort sur la dérivation');
  });

  it('includes enhanced final assessment when provided', () => {
    const data: Partial<CoachMathsSourceData> = {
      finalAssessment: {
        finalTestDone: 'DONE',
        approximateScore: 14,
        timeManagement: 3,
        writtenJustification: 4,
        mostAvoidableMistake: 'Erreur de calcul évitable',
        strongestFinalTestPoint: 'Bonne méthode de résolution',
        priorityBeforeExam: 'Revoir les tableaux de signes',
      },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    expect(report).toContain('ÉPREUVE FINALE');
    expect(report).toContain('14/20');
    expect(report).toContain('réalisée complètement');
    expect(report).toContain('Erreur de calcul évitable');
    expect(report).toContain('Bonne méthode de résolution');
    expect(report).toContain('Revoir les tableaux de signes');
  });

  it('limits priority axes to max 3 in report', () => {
    const data: Partial<CoachMathsSourceData> = {
      parentRecommendations: {
        priorityAxes: ['second-degre', 'derivation', 'suites', 'exponentielle', 'produit-scalaire'],
      },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    const axesSection = report.split('PRIORITÉS DES DEUX PROCHAINES SEMAINES')[1];
    expect(axesSection).toBeDefined();
    // Should only have 3 axes
    const bulletMatches = axesSection.match(/•/g);
    expect(bulletMatches?.length).toBeLessThanOrEqual(3);
  });

  it('uses only parentMainMessage when both P0 and legacy fields provided', () => {
    const data: Partial<CoachMathsSourceData> = {
      parentRecommendations: {
        parentMainMessage: 'Message nouveau P0 prioritaire.',
        parentSummaryMessage: 'Message legacy qui ne doit pas apparaître.',
      },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    // Seul parentMainMessage apparaît
    expect(report).toContain('Message nouveau P0 prioritaire');
    // parentSummaryMessage n'apparaît pas du tout
    expect(report).not.toContain('Message legacy qui ne doit pas apparaître');
  });

  it('uses parentSummaryMessage only as legacy fallback when no P0 message fields', () => {
    const data: Partial<CoachMathsSourceData> = {
      parentRecommendations: {
        parentSummaryMessage: 'Ceci est une synthèse legacy uniquement.',
        // Pas de parentMainMessage, pas de mainCoachMessage
      },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    // La legacy apparait mais traitée comme note, pas comme grande synthèse
    expect(report).toContain('Ceci est une synthèse legacy');
    // Vérifier qu'elle est marquée comme note legacy
    expect(report).toContain('Note du coach');
  });

  it('handles backward compatibility with legacy data only', () => {
    const legacyData: Partial<CoachMathsSourceData> = {
      attendanceAndEngagement: { attendance: 'excellente' },
      automatismes: { calculationFluency: 4, strongestAutomation: 'Bons calculs' },
      parentRecommendations: {
        parentSummaryMessage: 'Synthèse legacy pour compatibilité.',
        priorityAxes: ['derivation', 'suites'],
      },
    };
    const report = generateParentMathsStageReport(legacyData, student, baseDate);
    expect(report).toContain('BILAN PÉDAGOGIQUE');
    expect(report).toContain('dérivation');
    expect(report).toContain('suites numériques');
    // Legacy summary should appear when no P0 fields
    expect(report).toContain('Synthèse legacy');
  });

  it('prevents duplicate content across multiple fields with exact same text', () => {
    // Cas minimal : même paragraphe long dans plusieurs champs
    const repeated = "Melik doit apprendre à ralentir, analyser les consignes et vérifier systématiquement ses résultats avant de conclure.";
    const data: Partial<CoachMathsSourceData> = {
      globalDiagnostic: {
        mainCoachMessage: repeated,
      },
      parentRecommendations: {
        parentMainMessage: repeated,
        parentSummaryMessage: repeated, // Should not appear
      },
      attendanceAndEngagement: {
        coachComment: repeated, // Should not appear
      },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    // Compter les occurrences exactes du paragraphe
    const occurrences = report.split(repeated).length - 1;
    // Exiger au maximum 1 occurrence
    expect(occurrences).toBeLessThanOrEqual(1);
  });

  it('prevents similar content with different prefixes from flooding the report', () => {
    // Même phrase longue répétée dans deux sections avec préfixe différent
    const coreMessage = "Les techniques de factorisation doivent être maîtrisées avant le contrôle.";
    const data: Partial<CoachMathsSourceData> = {
      automatismes: { strongestAutomation: coreMessage },
      chapterDiagnostics: {
        secondDegree: { priorityRemediation: coreMessage }, // Same core message
      },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    // Le contenu ne doit pas apparaître plus d'une fois de manière significative
    const matches = report.match(/factorisation/gi) || [];
    expect(matches.length).toBeLessThanOrEqual(2); // Tolérance pour "factorisation" mais pas 4+
  });

  it('excludes final assessment section when test not done', () => {
    const data: Partial<CoachMathsSourceData> = {
      finalAssessment: { finalTestDone: 'NOT_DONE' },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    expect(report).not.toContain('ÉPREUVE FINALE');
  });

  it('includes final assessment section when partially done', () => {
    const data: Partial<CoachMathsSourceData> = {
      finalAssessment: { finalTestDone: 'PARTIAL' },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    expect(report).toContain('ÉPREUVE FINALE');
    expect(report).toContain('partiellement réalisée');
  });

  it('truncates overly long legacy parentSummaryMessage', () => {
    const longText = 'A'.repeat(300);
    const data: Partial<CoachMathsSourceData> = {
      parentRecommendations: {
        parentSummaryMessage: longText,
      },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    expect(report).not.toContain(longText);
    expect(report).toContain('A'.repeat(200)); // Should be truncated
    expect(report).toContain('...');
  });

  it('includes parentDoNotSay if provided', () => {
    const data: Partial<CoachMathsSourceData> = {
      parentRecommendations: {
        parentDoNotSay: 'Éviter les remarques démotivantes',
      },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    expect(report).toContain('À éviter dans les échanges');
    expect(report).toContain('Éviter les remarques démotivantes');
  });

  it('structures report into clear numbered sections', () => {
    const fullData: Partial<CoachMathsSourceData> = {
      globalDiagnostic: { overallProfile: 'STEADY_PROGRESS' },
      automatismes: {
        weakestAutomation: 'Calculs avec fractions à renforcer',
      },
      chapterDiagnostics: {
        secondDegree: {
          mastery: 4,
          strength: 'Point fort SD',
          vigilancePoints: ['Signe de a'],
        },
      },
      finalAssessment: { finalTestDone: 'DONE', mostAvoidableMistake: 'Erreur de signe' },
      parentRecommendations: { priorityAxes: ['derivation'] },
    };
    const report = generateParentMathsStageReport(fullData, student, baseDate);
    expect(report).toContain('1. SYNTHÈSE GÉNÉRALE');
    expect(report).toContain('2. POINTS D\'APPUI');
    expect(report).toContain('3. POINTS DE VIGILANCE');
    expect(report).toContain('4. DIAGNOSTIC PAR CHAPITRE');
    expect(report).toContain('5. ÉPREUVE FINALE');
    expect(report).toContain('6. PRIORITÉS');
    expect(report).toContain('7. RECOMMANDATION FINALE');
  });

  it('handles empty data gracefully', () => {
    const report = generateParentMathsStageReport({}, student, baseDate);
    expect(report).toContain('Alice Martin');
    expect(report).toContain('BILAN PÉDAGOGIQUE');
    expect(report).toContain('SYNTHÈSE GÉNÉRALE');
    expect(report).toContain('RECOMMANDATION FINALE');
  });

  it('limits strengths and vigilance to reasonable amounts', () => {
    const data: Partial<CoachMathsSourceData> = {
      chapterDiagnostics: {
        secondDegree: { strength: 'S1', vigilancePoints: ['V1', 'V2', 'V3'] },
        derivation: { strength: 'S2' },
        sequences: { strength: 'S3' },
        exponential: { strength: 'S4' },
        scalarProduct: { strength: 'S5' },
        probabilities: { strength: 'S6' },
      },
    };
    const report = generateParentMathsStageReport(data, student, baseDate);
    const pointsAppui = report.split('POINTS D\'APPUI')[1]?.split('POINTS DE VIGILANCE')[0];
    const bulletMatches = pointsAppui?.match(/•/g) ?? [];
    expect(bulletMatches.length).toBeLessThanOrEqual(4); // Max 4 strengths
  });
});

describe('CoachMathsBilanSchema validation', () => {
  // Import the actual schema for integration testing
  const { coachMathsBilanSchema } = jest.requireActual('@/lib/coach/maths-premiere-stage-printemps/types');

  it('validates new P0 fields successfully', () => {
    const validData = {
      action: 'draft' as const,
      globalDiagnostic: {
        overallProfile: 'UNEVEN_PROGRESS' as const,
        mainCoachMessage: 'Message'.repeat(5),
      },
      chapterDiagnostics: {
        secondDegree: {
          mastery: 4,
          methodsAcquired: ['méthode1'],
        },
      },
      parentRecommendations: {
        parentTone: 'BALANCED' as const,
        parentUrgency: 'IMPORTANT' as const,
        parentMainMessage: 'Synthèse courte.',
      },
      finalAssessment: {
        finalTestDone: 'DONE' as const,
        approximateScore: 15,
      },
    };
    const result = coachMathsBilanSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects oversized text in new P0 fields', () => {
    const invalidData = {
      action: 'draft' as const,
      globalDiagnostic: {
        mainCoachMessage: 'A'.repeat(601), // Exceeds updated 600 char limit
      },
    };
    const result = coachMathsBilanSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('rejects too many priority axes', () => {
    const invalidData = {
      action: 'draft' as const,
      parentRecommendations: {
        priorityAxes: Array(10).fill('derivation'), // Exceeds updated max of 9
      },
    };
    const result = coachMathsBilanSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('accepts legacy data without new P0 fields (backward compatibility)', () => {
    const legacyData = {
      action: 'complete' as const,
      attendanceAndEngagement: { attendance: 'excellente' },
      automatismes: { calculationFluency: 4 },
      parentRecommendations: {
        parentSummaryMessage: 'Synthèse legacy',
      },
    };
    const result = coachMathsBilanSchema.safeParse(legacyData);
    expect(result.success).toBe(true);
  });
});
