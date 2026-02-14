/**
 * Unit tests for Bilan Renderer (bilan-renderer.ts)
 *
 * Tests: renderEleveBilan, renderParentsBilan, renderNexusBilan, renderAllBilans
 * Validates: structure, required sections, no raw scores in parents, data quality warnings.
 */

import {
  renderEleveBilan,
  renderParentsBilan,
  renderNexusBilan,
  renderAllBilans,
  type RenderContext,
} from '@/lib/diagnostics/bilan-renderer';
import type { ScoringV2Result } from '@/lib/diagnostics/types';

/** Build a minimal scoring result for tests */
function buildScoring(overrides: Partial<ScoringV2Result> = {}): ScoringV2Result {
  return {
    masteryIndex: 65,
    coverageIndex: 80,
    examReadinessIndex: 70,
    readinessScore: 68,
    riskIndex: 30,
    recommendation: 'Pallier2_confirmed',
    recommendationMessage: 'Profil compatible avec le Pallier 2 Excellence',
    justification: 'Mastery et ExamReadiness au-dessus des seuils.',
    upgradeConditions: [],
    domainScores: [
      { domain: 'analysis', score: 75, evaluatedCount: 3, totalCount: 4, notStudiedCount: 0, unknownCount: 0, gaps: [], dominantErrors: [], priority: 'low' },
      { domain: 'algebra', score: 50, evaluatedCount: 3, totalCount: 4, notStudiedCount: 0, unknownCount: 1, gaps: ['Suites'], dominantErrors: ['calcul'], priority: 'medium' },
      { domain: 'geometry', score: 30, evaluatedCount: 2, totalCount: 3, notStudiedCount: 1, unknownCount: 0, gaps: ['Vecteurs', 'Produit scalaire'], dominantErrors: ['signe'], priority: 'critical' },
      { domain: 'probabilities', score: 60, evaluatedCount: 2, totalCount: 3, notStudiedCount: 0, unknownCount: 1, gaps: [], dominantErrors: [], priority: 'medium' },
      { domain: 'python', score: 80, evaluatedCount: 2, totalCount: 2, notStudiedCount: 0, unknownCount: 0, gaps: [], dominantErrors: [], priority: 'low' },
    ],
    alerts: [
      { type: 'warning', code: 'HIGH_STRESS', message: 'Gestion du stress à travailler', impact: 'Risque de sous-performance' },
      { type: 'danger', code: 'WEAK_AUTOMATISMS', message: 'Automatismes très fragiles', impact: 'Partie automatismes compromise' },
    ],
    dataQuality: {
      activeDomains: 5,
      evaluatedCompetencies: 12,
      notStudiedCompetencies: 1,
      unknownCompetencies: 2,
      lowConfidence: false,
      quality: 'good',
      coherenceIssues: 0,
      miniTestFilled: true,
      criticalFieldsMissing: 0,
    },
    trustScore: 85,
    trustLevel: 'green',
    topPriorities: [
      { skillLabel: 'Vecteurs', domain: 'geometry', reason: 'Mastery 1/4 dans un domaine prioritaire', impact: 'Impact direct', exerciseType: 'Exercices de base' },
    ],
    quickWins: [
      { skillLabel: 'Suites', domain: 'algebra', reason: 'Mastery 3/4 avec friction faible', impact: 'Consolidation rapide', exerciseType: 'Exercices de consolidation' },
    ],
    highRisk: [
      { skillLabel: 'Produit scalaire', domain: 'geometry', reason: 'Mastery 0/4 — compétence non acquise', impact: 'Point bloquant', exerciseType: 'Reprise fondamentaux' },
    ],
    inconsistencies: [],
    ...overrides,
  };
}

/** Build a minimal render context */
function buildContext(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    firstName: 'Amine',
    lastName: 'Ben Ali',
    establishment: 'Lycée Pilote',
    mathAverage: '14/20',
    classRanking: '8/35',
    learningStyle: 'visuel',
    problemReflex: 'relire l\'énoncé',
    maxConcentration: '45min',
    weeklyWork: '3h',
    targetMention: 'Bien',
    postBac: 'Prépa MPSI',
    miniTestScore: 4,
    miniTestTime: 15,
    miniTestCompleted: true,
    mainRisk: 'Manque de temps',
    verbatims: {
      'À améliorer': 'La géométrie dans l\'espace',
      'Difficultés invisibles': 'Je bloque sur les démonstrations',
    },
    ...overrides,
  };
}

describe('renderEleveBilan', () => {
  it('should contain required sections', () => {
    const md = renderEleveBilan(buildScoring(), buildContext());

    expect(md).toContain('# 📊 Mon Diagnostic Maths');
    expect(md).toContain('## En résumé');
    expect(md).toContain('## ✅ Tes points forts');
    expect(md).toContain('## 🎯 Tes priorités');
    expect(md).toContain('## 💡 Gains rapides');
    expect(md).toContain('## 🧠 Ton profil');
    expect(md).toContain('## 📅 Ta routine avant le stage');
  });

  it('should use tutoiement', () => {
    const md = renderEleveBilan(buildScoring(), buildContext());

    expect(md).toContain('Bonjour Amine');
    expect(md).toContain('Tes points forts');
    expect(md).toContain('Tes priorités');
    expect(md).toContain('Ton profil');
  });

  it('should include scoring values', () => {
    const md = renderEleveBilan(buildScoring(), buildContext());

    expect(md).toContain('68/100');
    expect(md).toContain('65/100');
    expect(md).toContain('80/100');
  });

  it('should show trust warning for red trust', () => {
    const md = renderEleveBilan(buildScoring({ trustLevel: 'red', trustScore: 25 }), buildContext());

    expect(md).toContain('données sont incomplètes');
  });

  it('should not show trust warning for green trust', () => {
    const md = renderEleveBilan(buildScoring(), buildContext());

    expect(md).not.toContain('données sont incomplètes');
  });

  it('should include alerts', () => {
    const md = renderEleveBilan(buildScoring(), buildContext());

    expect(md).toContain('Gestion du stress');
    expect(md).toContain('Automatismes très fragiles');
  });

  it('should include exercise types in priorities', () => {
    const md = renderEleveBilan(buildScoring(), buildContext());

    expect(md).toContain('Exercices de base');
  });

  it('should use LLM enrichment intro when provided', () => {
    const md = renderEleveBilan(buildScoring(), buildContext(), {
      eleveIntro: 'Salut champion ! Voici ton bilan.',
    });

    expect(md).toContain('Salut champion');
    expect(md).not.toContain('Bonjour Amine');
  });
});

describe('renderParentsBilan', () => {
  it('should contain required sections', () => {
    const md = renderParentsBilan(buildScoring(), buildContext());

    expect(md).toContain('# Rapport de Positionnement');
    expect(md).toContain('## Synthèse globale');
    expect(md).toContain('## Ce qui va bien');
    expect(md).toContain('## Recommandation');
    expect(md).toContain('## Ce que le stage va apporter');
  });

  it('should use vouvoiement', () => {
    const md = renderParentsBilan(buildScoring(), buildContext());

    expect(md).toContain('Madame, Monsieur');
    expect(md).toContain('Voici le bilan diagnostic de');
  });

  it('should NOT expose raw scores', () => {
    const md = renderParentsBilan(buildScoring(), buildContext());

    // Should use qualitative labels, not raw numbers like "68/100"
    expect(md).not.toMatch(/\b68\/100\b/);
    expect(md).not.toMatch(/MasteryIndex/);
    expect(md).not.toMatch(/RiskIndex/);
  });

  it('should use qualitative labels', () => {
    const md = renderParentsBilan(buildScoring({ readinessScore: 75 }), buildContext());
    expect(md).toContain('bon');

    const md2 = renderParentsBilan(buildScoring({ readinessScore: 40 }), buildContext());
    expect(md2).toContain('fragile');
  });

  it('should show trust note for non-green trust', () => {
    const md = renderParentsBilan(buildScoring({ trustLevel: 'orange', trustScore: 55 }), buildContext());

    expect(md).toContain('données du questionnaire sont incomplètes');
  });

  it('should show danger alerts as signaux d\'alerte', () => {
    const md = renderParentsBilan(buildScoring(), buildContext());

    expect(md).toContain('## Signaux d\'alerte');
    expect(md).toContain('Automatismes très fragiles');
  });

  it('should include upgrade conditions when present', () => {
    const md = renderParentsBilan(buildScoring({
      recommendation: 'Pallier2_conditional',
      upgradeConditions: ['Atteindre 60% de ReadinessScore'],
    }), buildContext());

    expect(md).toContain('## Conditions de progression');
    expect(md).toContain('Atteindre 60%');
  });

  it('should mention stress in advice when stress alert present', () => {
    const md = renderParentsBilan(buildScoring(), buildContext());

    expect(md).toContain('stress');
  });
});

describe('renderNexusBilan', () => {
  it('should contain required technical sections', () => {
    const md = renderNexusBilan(buildScoring(), buildContext());

    expect(md).toContain('# Fiche Pédagogique');
    expect(md).toContain('## Qualité des données');
    expect(md).toContain('## Scores');
    expect(md).toContain('## Cartographie par domaine');
    expect(md).toContain('## Alertes');
    expect(md).toContain('## Profil cognitif');
    expect(md).toContain('## Justification décision');
  });

  it('should include TrustScore in data quality table', () => {
    const md = renderNexusBilan(buildScoring(), buildContext());

    expect(md).toContain('85/100');
    expect(md).toContain('green');
  });

  it('should include raw scores', () => {
    const md = renderNexusBilan(buildScoring(), buildContext());

    expect(md).toContain('ReadinessScore');
    expect(md).toContain('MasteryIndex');
    expect(md).toContain('ExamReadinessIndex');
    expect(md).toContain('68/100');
  });

  it('should include domain table with all domains', () => {
    const md = renderNexusBilan(buildScoring(), buildContext());

    expect(md).toContain('Analyse');
    expect(md).toContain('Algèbre');
    expect(md).toContain('Géométrie');
    expect(md).toContain('Probabilités');
    expect(md).toContain('Python');
  });

  it('should include priorities sections', () => {
    const md = renderNexusBilan(buildScoring(), buildContext());

    expect(md).toContain('🔴 Points bloquants');
    expect(md).toContain('🟠 Priorités pédagogiques');
    expect(md).toContain('🟢 Gains rapides');
  });

  it('should include verbatims', () => {
    const md = renderNexusBilan(buildScoring(), buildContext());

    expect(md).toContain('géométrie dans l\'espace');
    expect(md).toContain('démonstrations');
  });

  it('should include inconsistencies when present', () => {
    const md = renderNexusBilan(buildScoring({
      inconsistencies: [{
        code: 'RUSHED_TEST',
        message: 'Mini-test terminé très vite',
        fields: ['examPrep.miniTest.timeUsedMinutes'],
        severity: 'warning',
      }],
    }), buildContext());

    expect(md).toContain('## Incohérences détectées');
    expect(md).toContain('RUSHED_TEST');
  });

  it('should include LLM enrichment notes when provided', () => {
    const md = renderNexusBilan(buildScoring(), buildContext(), {
      nexusNotes: 'Élève à suivre de près pendant le stage.',
    });

    expect(md).toContain('Notes complémentaires');
    expect(md).toContain('suivre de près');
  });
});

describe('renderAllBilans', () => {
  it('should return all 3 audience bilans', () => {
    const result = renderAllBilans(buildScoring(), buildContext());

    expect(result.eleve).toBeTruthy();
    expect(result.parents).toBeTruthy();
    expect(result.nexus).toBeTruthy();
  });

  it('should produce different content for each audience', () => {
    const result = renderAllBilans(buildScoring(), buildContext());

    expect(result.eleve).not.toBe(result.parents);
    expect(result.parents).not.toBe(result.nexus);
    expect(result.eleve).not.toBe(result.nexus);
  });

  it('should produce valid markdown (headings, lists)', () => {
    const result = renderAllBilans(buildScoring(), buildContext());

    for (const md of [result.eleve, result.parents, result.nexus]) {
      expect(md).toMatch(/^# /m); // Has H1
      expect(md).toMatch(/^## /m); // Has H2
      expect(md).toMatch(/^- /m); // Has list items
    }
  });

  it('nexus should be longer than eleve and parents', () => {
    const result = renderAllBilans(buildScoring(), buildContext());

    expect(result.nexus.length).toBeGreaterThan(result.eleve.length);
  });
});
