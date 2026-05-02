import { escapeLatex, renderLatexPremiumReport } from '@/lib/reports/stage/renderLatexPremiumReport';
import type { PremiumPedagogicalReportJson } from '@/lib/reports/stage/schema';

describe('renderLatexPremiumReport', () => {
  it('escapes LaTeX special characters', () => {
    expect(escapeLatex('A&B_50% #1 $x$ {ok}')).toContain('A\\&B\\_50\\% \\#1 \\$x\\$ \\{ok\\}');
  });

  it('renders deterministic premium sections without raw user special characters', () => {
    const data: PremiumPedagogicalReportJson = {
      cover: {
        title: 'Bilan EAF',
        subtitle: 'Stage & méthode',
        studentName: 'Aya_Test',
        stageLabel: 'Printemps',
        subjectLabel: 'Français',
      },
      executiveSummary: {
        profileSummary: 'Profil sérieux',
        keyStrengths: ['Plan clair'],
        keyRisks: ['Syntaxe à reprendre'],
        priorityMessageForParents: 'Encourager la régularité',
        priorityMessageForStudent: 'Relire les citations',
      },
      competenceReview: [
        {
          domain: 'Commentaire',
          level: 'EN_PROGRESSION',
          evidence: ['Repérage pertinent'],
          analysis: 'Analyse en construction',
          recommendation: 'Faire deux plans',
        },
      ],
      studentPosture: {
        confidence: 'Stable',
        autonomy: 'À renforcer',
        workingMethod: 'Fiches',
        attentionPoints: ['Gestion du temps'],
      },
      actionPlan: {
        next7Days: ['Revoir méthode'],
        next30Days: ['Deux sujets complets'],
        beforeExam: ['Annales'],
      },
      parentSection: {
        reassuringSummary: 'Progression visible',
        concreteSupportAdvice: ['Cadre régulier'],
        warningWithoutAlarmism: 'Ne pas multiplier les supports',
      },
      coachSection: {
        syntheticReading: 'Priorité à la problématique',
        nextSessionPriorities: ['Introduction', 'Transitions'],
      },
      qualityFlags: {
        missingData: [],
        uncertainties: [],
        shouldBeReviewedByCoach: false,
      },
    };

    const latex = renderLatexPremiumReport(data);
    expect(latex).toContain('Synthèse Exécutive');
    expect(latex).toContain('Prochaines étapes coach');
    expect(latex).toContain('Stage \\& méthode');
    expect(latex).toContain('Aya\\_Test');
  });
});
