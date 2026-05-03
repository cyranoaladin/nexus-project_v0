import { validateGeneratedBilan } from '@/lib/bilan-generation/validateGeneratedBilan';
import type { NormalizedBilanInput, PedagogicalProfile } from '@/lib/bilan-generation/types';

const baseInput: NormalizedBilanInput = {
  bilanId: 'test-bilan-id',
  student: { id: 'stu-1', displayName: 'Test Élève', gender: 'unknown' },
  context: { bilanKind: 'MATHS_PREMIERE_STAGE_PRINTEMPS' },
  coachInputs: {},
  rawSourceData: {},
};

const baseProfile: PedagogicalProfile = {
  executiveDiagnosis: { overallLevel: 'en progression', learningDynamic: '', mainRisk: '', mainLever: '' },
  keyStrengths: [],
  priorityWeaknesses: [],
  chapterPriorities: [],
  parentGuidance: { tone: 'équilibré', urgency: 'normal' },
  dataQuality: { missingImportantFields: [], uncertaintyNotes: [] },
};

const GOOD_BILAN = `
## 1. Synthèse générale
Cet élève a montré durant ce stage une énergie et une détermination remarquables. Son engagement face aux exercices, même les plus exigeants, est un atout précieux pour progresser en mathématiques. Cette dynamique positive lui permet d'aborder les problèmes avec confiance et de ne pas se décourager face aux obstacles. Avec un travail ciblé sur la méthodologie et la précision, il a toutes les cartes en main pour consolider ses résultats et gagner en sérénité lors des évaluations. La progression observée au fil des séances témoigne d'une réelle capacité d'apprentissage et d'une volonté de progresser qui sont des fondements essentiels pour la réussite en mathématiques de spécialité.

## 2. Points d'appui
- Bonne maîtrise de la dérivation : les méthodes de base sont bien assimilées et mobilisables de manière autonome.
- Engagement constant durant les séances, ce qui facilite la progression et permet d'avancer sur des exercices complexes.
- Capacité à identifier ses erreurs lorsqu'on les lui signale, signe d'une lucidité pédagogique importante.
- Rapidité d'exécution sur les automatismes de calcul, qui constitue un avantage notable en conditions d'examen.

## 3. Axes de progrès prioritaires
Les probabilités conditionnelles restent fragiles et nécessitent un travail approfondi. Il est essentiel de réviser les formules, notamment P(A|B) et la formule de Bayes, et de s'exercer régulièrement sur des exercices type bac. La rédaction des justifications doit également être travaillée : des réponses plus complètes, avec des étapes intermédiaires clairement rédigées, permettront d'éviter des pertes de points inutiles. Enfin, la gestion du temps lors des épreuves doit être optimisée par un entraînement chronométré en conditions réelles.

## 4. Lecture de l'épreuve finale
L'épreuve finale a été réalisée avec un score de 12/20. Cette note reflète une maîtrise partielle, solide sur les parties automatismes mais fragile sur les probabilités conditionnelles. La gestion du temps a été satisfaisante, ce qui est un point encourageant. En revanche, la rédaction des justifications laisse à désirer et représente un levier de progression important. Il faut s'entraîner davantage sur les exercices de synthèse pour gagner en régularité.

## 5. Plan d'action conseillé
Pour progresser dans les prochaines semaines, nous recommandons de réviser les formules de probabilités conditionnelles chaque semaine avec des exercices ciblés, de refaire des exercices de dérivation pour ancrer les méthodes, et de structurer systématiquement les réponses avec des justifications claires. Il est également utile de chronométrer les séances d'entraînement pour habituer l'esprit à travailler sous contrainte de temps. Un travail quotidien de vingt minutes sur les automatismes permettra de consolider les bases.

## 6. Message final
Cet élève a toutes les qualités pour réussir en mathématiques de spécialité. Sa motivation et son engagement sont des moteurs puissants. Avec de la régularité, de la méthode et une attention particulière à la rédaction, les prochaines évaluations seront l'occasion de confirmer cette dynamique positive et de progresser vers des résultats à la hauteur de son potentiel.
`;

describe('validateGeneratedBilan', () => {
  it('accepts a well-formed bilan', () => {
    const result = validateGeneratedBilan(GOOD_BILAN, baseInput, baseProfile);
    expect(result.qualityStatus).not.toBe('FAIL');
    expect(result.issues).not.toContain('EMPTY');
    expect(result.issues).not.toContain('MISSING_SECTIONS');
  });

  it('rejects empty text', () => {
    const result = validateGeneratedBilan('', baseInput, baseProfile);
    expect(result.qualityStatus).toBe('FAIL');
    expect(result.issues).toContain('EMPTY');
  });

  it('rejects text that is too short', () => {
    const result = validateGeneratedBilan('## 1. Synthèse générale\nTrop court.', baseInput, baseProfile);
    expect(result.qualityStatus).toBe('FAIL');
    expect(result.issues).toContain('TOO_SHORT');
  });

  it('rejects forbidden term "ton ferme"', () => {
    const bad = GOOD_BILAN + '\nLe bilan doit adopter un ton ferme envers les parents.';
    const result = validateGeneratedBilan(bad, baseInput, baseProfile);
    expect(result.issues).toContain('FORBIDDEN_TERM');
  });

  it('rejects forbidden term "séquences"', () => {
    const bad = GOOD_BILAN + '\nLes séquences doivent être révisées.';
    const result = validateGeneratedBilan(bad, baseInput, baseProfile);
    expect(result.issues).toContain('FORBIDDEN_TERM');
  });

  it('detects raw bold titles instead of ## headings', () => {
    const bad = GOOD_BILAN + '\n**7. Conclusion finale**\nTexte supplémentaire.';
    const result = validateGeneratedBilan(bad, baseInput, baseProfile);
    expect(result.issues).toContain('RAW_MARKDOWN_BOLD_TITLES');
  });

  it('detects excessive legacy copy', () => {
    const legacySummary = 'Il est fragile en probabilités conditionnelles et doit travailler sa rédaction et ses justifications mathématiques de manière approfondie.';
    const inputWithLegacy = { ...baseInput, legacySummary };
    const bad = GOOD_BILAN + '\n' + legacySummary.repeat(5);
    const result = validateGeneratedBilan(bad, inputWithLegacy, baseProfile);
    expect(result.issues).toContain('LEGACY_COPY');
  });

  it('warns on missing sections', () => {
    const noSection4 = GOOD_BILAN.replace(/## 4\.[\s\S]+?(?=## 5\.)/, '');
    const result = validateGeneratedBilan(noSection4, baseInput, baseProfile);
    expect(result.issues).toContain('MISSING_SECTIONS');
  });

  it('does not fail a good bilan with score when score appears in text', () => {
    const inputWithScore = {
      ...baseInput,
      finalAssessment: { approximateScore: 12, completed: true },
    };
    const profileWithReading = {
      ...baseProfile,
      finalAssessmentReading: {
        score: '12/20',
        interpretation: 'Bonne performance',
        warningPoints: [],
        positiveSigns: [],
      },
    };
    // GOOD_BILAN already contains "12/20"
    const result = validateGeneratedBilan(GOOD_BILAN, inputWithScore, profileWithReading);
    expect(result.issues).not.toContain('SCORE_NOT_INTERPRETED');
    expect(result.issues).not.toContain('EMPTY');
    expect(result.issues).not.toContain('TOO_SHORT');
  });
});
