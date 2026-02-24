/**
 * Bilan Renderer — Complete Test Suite
 *
 * Tests: renderEleveBilan, renderParentsBilan, renderNexusBilan, renderAllBilans
 *
 * Source: lib/diagnostics/bilan-renderer.ts
 */

import {
  renderEleveBilan,
  renderParentsBilan,
  renderNexusBilan,
  renderAllBilans,
  type RenderContext,
  type LLMEnrichment,
} from '@/lib/diagnostics/bilan-renderer';
import type { ScoringV2Result } from '@/lib/diagnostics/types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function buildScoringResult(overrides: Partial<ScoringV2Result> = {}): ScoringV2Result {
  return {
    masteryIndex: 65,
    coverageIndex: 70,
    examReadinessIndex: 55,
    readinessScore: 62,
    riskIndex: 38,
    recommendation: 'Pallier2_conditional',
    recommendationMessage: 'Stage Pallier 2 recommandé sous conditions',
    justification: 'Score intermédiaire avec des lacunes ciblées en analyse.',
    upgradeConditions: ['Améliorer les automatismes', 'Travailler la rédaction'],
    domainScores: [
      {
        domain: 'analysis',
        score: 80,
        evaluatedCount: 8,
        totalCount: 10,
        notStudiedCount: 1,
        unknownCount: 1,
        gaps: [],
        dominantErrors: [],
        priority: 'low' as const,
      },
      {
        domain: 'algebra',
        score: 45,
        evaluatedCount: 6,
        totalCount: 8,
        notStudiedCount: 1,
        unknownCount: 1,
        gaps: ['Suites géométriques', 'Récurrence'],
        dominantErrors: ['Erreur de signe'],
        priority: 'high' as const,
      },
      {
        domain: 'probabilities',
        score: 30,
        evaluatedCount: 4,
        totalCount: 6,
        notStudiedCount: 2,
        unknownCount: 0,
        gaps: ['Loi binomiale'],
        dominantErrors: ['Confusion P(A∩B) et P(A)×P(B)'],
        priority: 'critical' as const,
      },
    ],
    alerts: [
      { type: 'danger' as const, code: 'LOW_MASTERY', message: 'Maîtrise insuffisante en probabilités' },
      { type: 'warning' as const, code: 'HIGH_STRESS', message: 'Signaux de stress détectés' },
      { type: 'info' as const, code: 'GOOD_ANALYSIS', message: 'Bon niveau en analyse' },
    ],
    dataQuality: {
      activeDomains: 3,
      evaluatedCompetencies: 18,
      notStudiedCompetencies: 4,
      unknownCompetencies: 2,
      lowConfidence: false,
      quality: 'partial' as const,
      coherenceIssues: 0,
      miniTestFilled: true,
      criticalFieldsMissing: 0,
    },
    trustScore: 72,
    trustLevel: 'orange' as const,
    topPriorities: [
      { skillLabel: 'Loi binomiale', domain: 'probabilities', reason: 'Non maîtrisé', impact: 'Épreuve', exerciseType: 'Exercices type bac' },
    ],
    quickWins: [
      { skillLabel: 'Dérivation', domain: 'analysis', reason: 'Proche du seuil', impact: 'Gain rapide' },
    ],
    highRisk: [
      { skillLabel: 'Récurrence', domain: 'algebra', reason: 'Bloquant pour suites', impact: 'Critique' },
    ],
    inconsistencies: [
      { code: 'DECL_VS_PROOF', message: 'Déclaratif élevé mais preuve faible', fields: ['mathAverage', 'masteryIndex'], severity: 'warning' as const },
    ],
    coverageProgramme: {
      seenChapterRatio: 0.7,
      evaluatedSkillRatio: 0.8,
      totalChapters: 10,
      seenChapters: 7,
      inProgressChapters: 1,
    },
    ...overrides,
  };
}

function buildRenderContext(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    firstName: 'Mehdi',
    lastName: 'Ben Ali',
    discipline: 'maths',
    level: 'terminale',
    establishment: 'Lycée Pilote',
    mathAverage: '12/20',
    classRanking: '15/35',
    learningStyle: 'Visuel',
    problemReflex: 'Relire l\'énoncé',
    maxConcentration: '30 min',
    weeklyWork: '3h',
    targetMention: 'Bien',
    postBac: 'Prépa MPSI',
    miniTestScore: 4,
    miniTestTime: 8,
    miniTestCompleted: true,
    mainRisk: 'Stress en examen',
    verbatims: {
      'Difficulté principale': 'Les probabilités me bloquent',
      'Objectif': 'Avoir 14 au bac',
    },
    weakPrerequisites: [
      { skillLabel: 'Fractions', domain: 'algebra', mastery: 2 },
    ],
    ...overrides,
  };
}

// ─── renderEleveBilan ────────────────────────────────────────────────────────

describe('renderEleveBilan', () => {
  it('should use tutoiement ("tu") in eleve bilan, never vouvoiement', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();

    // Act
    const bilan = renderEleveBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('ton');
    expect(bilan).toContain('Tes');
    expect(bilan).not.toMatch(/\bVotre\b/);
    expect(bilan).not.toMatch(/\bvous\b/i);
  });

  it('should include micro-plan with 5min/15min/30min sections', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();

    // Act
    const bilan = renderEleveBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('5 min');
    expect(bilan).toContain('15 min');
    expect(bilan).toContain('30 min');
    expect(bilan).toContain('micro-plan');
  });

  it('should include prerequis section when weak domains identified', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext({
      weakPrerequisites: [
        { skillLabel: 'Fractions', domain: 'algebra', mastery: 1 },
        { skillLabel: 'Calcul littéral', domain: 'algebra', mastery: 2 },
      ],
    });

    // Act
    const bilan = renderEleveBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Bases à consolider');
    expect(bilan).toContain('Fractions');
    expect(bilan).toContain('Calcul littéral');
  });

  it('should display numeric scores for eleve audience', () => {
    // Arrange
    const scoring = buildScoringResult({ readinessScore: 62, masteryIndex: 65 });
    const ctx = buildRenderContext();

    // Act
    const bilan = renderEleveBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('62/100');
    expect(bilan).toContain('65/100');
  });

  it('should adapt content for NSI discipline', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext({ discipline: 'nsi' });

    // Act
    const bilan = renderEleveBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('NSI');
    expect(bilan).toContain('fiche mémo');
    expect(bilan).toContain('SQL');
  });

  it('should adapt content for Maths discipline', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext({ discipline: 'maths' });

    // Act
    const bilan = renderEleveBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Mathématiques');
    expect(bilan).toContain('automatismes');
    expect(bilan).toContain('calculatrice');
  });

  it('should adapt content for Premiere level', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext({ level: 'premiere' });

    // Act
    const bilan = renderEleveBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Première');
  });

  it('should adapt content for Terminale level', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext({ level: 'terminale' });

    // Act
    const bilan = renderEleveBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Terminale');
  });

  it('should include TrustScore warning when trustLevel is red', () => {
    // Arrange
    const scoring = buildScoringResult({ trustLevel: 'red' });
    const ctx = buildRenderContext();

    // Act
    const bilan = renderEleveBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('⚠️');
    expect(bilan).toContain('incomplètes');
  });

  it('should not include TrustScore warning when trustLevel is green', () => {
    // Arrange
    const scoring = buildScoringResult({ trustLevel: 'green' });
    const ctx = buildRenderContext();

    // Act
    const bilan = renderEleveBilan(scoring, ctx);

    // Assert
    expect(bilan).not.toContain('incomplètes');
  });

  it('should use LLM enrichment intro when provided', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();
    const enrichment: LLMEnrichment = {
      eleveIntro: 'Salut Mehdi ! Voici un bilan personnalisé rien que pour toi.',
    };

    // Act
    const bilan = renderEleveBilan(scoring, ctx, enrichment);

    // Assert
    expect(bilan).toContain('rien que pour toi');
  });

  it('should handle empty priorités gracefully', () => {
    // Arrange
    const scoring = buildScoringResult({ topPriorities: [], quickWins: [], highRisk: [] });
    const ctx = buildRenderContext();

    // Act
    const bilan = renderEleveBilan(scoring, ctx);

    // Assert: should not crash, should not contain priority sections
    expect(bilan).not.toContain('Tes priorités');
    expect(bilan).not.toContain('Gains rapides');
  });

  it('should produce valid Markdown (no undefined/null placeholders)', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();

    // Act
    const bilan = renderEleveBilan(scoring, ctx);

    // Assert
    expect(bilan).not.toContain('undefined');
    expect(bilan).not.toContain('null');
    expect(bilan.startsWith('#')).toBe(true);
  });
});

// ─── renderParentsBilan ──────────────────────────────────────────────────────

describe('renderParentsBilan', () => {
  it('should use vouvoiement ("vous") in parents bilan, never tutoiement', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();

    // Act
    const bilan = renderParentsBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Madame, Monsieur');
    // Should not contain student-facing tutoiement patterns
    expect(bilan).not.toContain('Bonjour Mehdi');
    expect(bilan).not.toMatch(/\bTes\b/);
  });

  it('should NOT include raw numeric scores in parents bilan', () => {
    // Arrange
    const scoring = buildScoringResult({ readinessScore: 62 });
    const ctx = buildRenderContext();

    // Act
    const bilan = renderParentsBilan(scoring, ctx);

    // Assert: should use qualitative labels, not "62/100"
    expect(bilan).not.toContain('62/100');
    expect(bilan).not.toContain('65/100');
  });

  it('should use qualitative labels (très bon/bon/intermédiaire/fragile/insuffisant)', () => {
    // Arrange
    const scoring = buildScoringResult({ readinessScore: 62 });
    const ctx = buildRenderContext();

    // Act
    const bilan = renderParentsBilan(scoring, ctx);

    // Assert
    expect(bilan).toMatch(/très bon|bon|intermédiaire|fragile|insuffisant/);
  });

  it('should focus on actionable recommendations for parents', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();

    // Act
    const bilan = renderParentsBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Comment accompagner');
    expect(bilan).toContain('routine quotidienne');
    expect(bilan).toContain('Valoriser les progrès');
  });

  it('should include stress warning when HIGH_STRESS alert present', () => {
    // Arrange
    const scoring = buildScoringResult({
      alerts: [
        { type: 'warning', code: 'HIGH_STRESS', message: 'Signaux de stress détectés' },
      ],
    });
    const ctx = buildRenderContext();

    // Act
    const bilan = renderParentsBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('stress');
    expect(bilan).toContain('bienveillant');
  });

  it('should include upgrade conditions when present', () => {
    // Arrange
    const scoring = buildScoringResult({
      upgradeConditions: ['Travailler les automatismes', 'Améliorer la rédaction'],
    });
    const ctx = buildRenderContext();

    // Act
    const bilan = renderParentsBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Conditions de progression');
    expect(bilan).toContain('Travailler les automatismes');
  });

  it('should include trust note when trustLevel is not green', () => {
    // Arrange
    const scoring = buildScoringResult({ trustLevel: 'orange' });
    const ctx = buildRenderContext();

    // Act
    const bilan = renderParentsBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('incomplètes');
  });

  it('should use LLM enrichment intro when provided', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();
    const enrichment: LLMEnrichment = {
      parentsIntro: 'Chers parents de Mehdi,',
    };

    // Act
    const bilan = renderParentsBilan(scoring, ctx, enrichment);

    // Assert
    expect(bilan).toContain('Chers parents de Mehdi');
  });

  it('should produce valid Markdown (no undefined/null placeholders)', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();

    // Act
    const bilan = renderParentsBilan(scoring, ctx);

    // Assert
    expect(bilan).not.toContain('undefined');
    expect(bilan).not.toContain('null');
  });
});

// ─── renderNexusBilan ────────────────────────────────────────────────────────

describe('renderNexusBilan', () => {
  it('should include TrustScore as numeric value in nexus bilan', () => {
    // Arrange
    const scoring = buildScoringResult({ trustScore: 72 });
    const ctx = buildRenderContext();

    // Act
    const bilan = renderNexusBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('72/100');
    expect(bilan).toContain('TrustScore');
  });

  it('should include domain coverage table in nexus bilan', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();

    // Act
    const bilan = renderNexusBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Cartographie par domaine');
    expect(bilan).toContain('| Domaine |');
    expect(bilan).toContain('Analyse');
  });

  it('should include verbatims from student answers', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext({
      verbatims: {
        'Difficulté principale': 'Les probabilités me bloquent',
        'Objectif': 'Avoir 14 au bac',
      },
    });

    // Act
    const bilan = renderNexusBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Verbatims');
    expect(bilan).toContain('Les probabilités me bloquent');
    expect(bilan).toContain('Avoir 14 au bac');
  });

  it('should include technical domain map with skill-level breakdown', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();

    // Act
    const bilan = renderNexusBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Score');
    expect(bilan).toContain('Évalués');
    expect(bilan).toContain('Gaps');
    expect(bilan).toContain('Priorité');
  });

  it('should include inconsistencies section when present', () => {
    // Arrange
    const scoring = buildScoringResult({
      inconsistencies: [
        { code: 'DECL_VS_PROOF', message: 'Déclaratif élevé mais preuve faible', fields: ['mathAverage', 'masteryIndex'], severity: 'warning' },
      ],
    });
    const ctx = buildRenderContext();

    // Act
    const bilan = renderNexusBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Incohérences détectées');
    expect(bilan).toContain('DECL_VS_PROOF');
  });

  it('should include coverage programme metrics when present', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();

    // Act
    const bilan = renderNexusBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Couverture du programme');
    expect(bilan).toContain('7/10');
  });

  it('should include LLM notes when enrichment provided', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();
    const enrichment: LLMEnrichment = {
      nexusNotes: 'Élève à suivre de près pour les automatismes.',
    };

    // Act
    const bilan = renderNexusBilan(scoring, ctx, enrichment);

    // Assert
    expect(bilan).toContain('Notes complémentaires');
    expect(bilan).toContain('automatismes');
  });

  it('should include profil cognitif section', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();

    // Act
    const bilan = renderNexusBilan(scoring, ctx);

    // Assert
    expect(bilan).toContain('Profil cognitif');
    expect(bilan).toContain('Visuel');
    expect(bilan).toContain('4/6');
  });

  it('should produce valid Markdown (no undefined/null placeholders)', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();

    // Act
    const bilan = renderNexusBilan(scoring, ctx);

    // Assert
    expect(bilan).not.toContain('undefined');
    expect(bilan).not.toContain('null');
  });
});

// ─── renderAllBilans ─────────────────────────────────────────────────────────

describe('renderAllBilans', () => {
  it('should return all 3 bilans', () => {
    // Arrange
    const scoring = buildScoringResult();
    const ctx = buildRenderContext();

    // Act
    const bilans = renderAllBilans(scoring, ctx);

    // Assert
    expect(bilans).toHaveProperty('eleve');
    expect(bilans).toHaveProperty('parents');
    expect(bilans).toHaveProperty('nexus');
    expect(bilans.eleve.length).toBeGreaterThan(0);
    expect(bilans.parents.length).toBeGreaterThan(0);
    expect(bilans.nexus.length).toBeGreaterThan(0);
  });

  it('should handle student with perfect scores', () => {
    // Arrange
    const scoring = buildScoringResult({
      readinessScore: 100,
      masteryIndex: 100,
      coverageIndex: 100,
      examReadinessIndex: 100,
      trustScore: 100,
      trustLevel: 'green',
      topPriorities: [],
      quickWins: [],
      highRisk: [],
      alerts: [],
      inconsistencies: [],
    });
    const ctx = buildRenderContext();

    // Act
    const bilans = renderAllBilans(scoring, ctx);

    // Assert: should not crash
    expect(bilans.eleve).toContain('100/100');
    expect(bilans.parents).toContain('très bon');
    expect(bilans.nexus).toContain('100/100');
  });

  it('should handle student with all-zero scores', () => {
    // Arrange
    const scoring = buildScoringResult({
      readinessScore: 0,
      masteryIndex: 0,
      coverageIndex: 0,
      examReadinessIndex: 0,
      riskIndex: 100,
      trustScore: 20,
      trustLevel: 'red',
      domainScores: [],
      topPriorities: [],
      quickWins: [],
      highRisk: [],
    });
    const ctx = buildRenderContext();

    // Act
    const bilans = renderAllBilans(scoring, ctx);

    // Assert: should not crash
    expect(bilans.eleve).toContain('0/100');
    expect(bilans.parents).toContain('insuffisant');
    expect(bilans.nexus).toContain('0/100');
  });
});
