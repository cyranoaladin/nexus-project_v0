import { adaptMathsPremiereStagePrintemps } from '@/lib/bilan-generation/adapters/mathsPremiereStagePrintemps';

const fullSourceData = {
  meta: { version: '1.0.0' },
  globalDiagnostic: {
    overallProfile: 'STEADY_PROGRESS',
    workPace: 'FAST_BUT_CARELESS',
    mainCoachMessage: 'Bon potentiel, doit travailler la rigueur.',
  },
  automatismes: {
    calculationFluency: 4,
    identities: 3,
    strongestAutomation: 'Dérivées usuelles bien maîtrisées',
    weakestAutomation: 'Identités remarquables parfois oubliées',
  },
  finalAssessment: {
    finalTestDone: 'DONE',
    approximateScore: 13,
    timeManagement: 4,
    writtenJustification: 2,
    mostAvoidableMistake: 'Oubli du signe dans la dérivée',
    strongestFinalTestPoint: 'Rapidité d\'exécution',
    priorityBeforeExam: 'Retravailler la rédaction',
  },
  parentRecommendations: {
    parentTone: 'BALANCED',
    parentUrgency: 'NORMAL',
    parentMainMessage: 'L\'élève est sur la bonne voie.',
    parentDoNotSay: 'Ne pas parler des notes de contrôle du lycée',
    priorityAxes: ['derivation', 'probabilites-conditionnelles'],
    parentSummaryMessage: 'Synthèse legacy à ne pas recopier.',
  },
  chapterDiagnostics: {
    secondDegree: { mastery: 4, methodsAcquired: ['Discriminant', 'Factorisation'], vigilancePoints: ['Signe du discriminant'], strength: 'Formules bien maîtrisées' },
    probabilities: { mastery: 2, recurringErrors: ['P(A|B) mal appliquée'], priorityRemediation: 'Exercices Bayes' },
  },
};

describe('adaptMathsPremiereStagePrintemps', () => {
  const input = adaptMathsPremiereStagePrintemps('bilan-1', 'stu-1', 'Jean Dupont', fullSourceData);

  it('sets bilanKind to MATHS_PREMIERE_STAGE_PRINTEMPS', () => {
    expect(input.context.bilanKind).toBe('MATHS_PREMIERE_STAGE_PRINTEMPS');
  });

  it('sets duration to 14h', () => {
    expect(input.context.durationHours).toBe(14);
  });

  it('extracts mainMessage from globalDiagnostic', () => {
    expect(input.coachInputs.mainMessage).toBe('Bon potentiel, doit travailler la rigueur.');
  });

  it('extracts doNotSay', () => {
    expect(input.coachInputs.doNotSay).toContain('lycée');
  });

  it('maps tone correctly', () => {
    expect(input.coachInputs.tone).toBe('équilibré et constructif');
  });

  it('maps chapters with mastery and methods', () => {
    const secondDegree = input.chapters?.find(c => c.key === 'secondDegree');
    expect(secondDegree).toBeDefined();
    expect(secondDegree?.mastery).toBe(4);
    expect(secondDegree?.acquiredMethods).toContain('Discriminant');
  });

  it('maps finalAssessment score', () => {
    expect(input.finalAssessment?.approximateScore).toBe(13);
    expect(input.finalAssessment?.completed).toBe(true);
  });

  it('ignores empty string fields', () => {
    const sparseData = {
      globalDiagnostic: { mainCoachMessage: '' },
      automatismes: { strongestAutomation: '   ' },
    };
    const sparseInput = adaptMathsPremiereStagePrintemps('b2', 's2', 'Test', sparseData);
    expect(sparseInput.coachInputs.mainMessage).toBeUndefined();
  });

  it('does NOT include rawSourceData in chapters or coachInputs', () => {
    expect(JSON.stringify(input.chapters)).not.toContain('rawSourceData');
    expect(JSON.stringify(input.coachInputs)).not.toContain('parentSummaryMessage');
  });

  it('sets legacySummary from parentSummaryMessage (reference only)', () => {
    expect(input.legacySummary).toBeDefined();
  });

  it('maps priorityAxes as string array', () => {
    expect(input.priorityAxes).toBeInstanceOf(Array);
    expect(input.priorityAxes?.length).toBeGreaterThan(0);
  });
});
