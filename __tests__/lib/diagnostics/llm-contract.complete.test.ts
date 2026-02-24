/**
 * LLM Output Contract — Complete Test Suite
 *
 * Tests: structuredAnalysisSchema, validateMarkdownOutput, buildQualityFlags
 *
 * Source: lib/diagnostics/llm-contract.ts
 */

import {
  structuredAnalysisSchema,
  validateMarkdownOutput,
  buildQualityFlags,
} from '@/lib/diagnostics/llm-contract';

// ─── structuredAnalysisSchema ────────────────────────────────────────────────

describe('structuredAnalysisSchema', () => {
  const validData = {
    forces: [{ domain: 'Analyse', label: 'Dérivation', detail: 'Bonne maîtrise', evidence: 'Q1 correct' }],
    faiblesses: [{ domain: 'Algèbre', label: 'Suites', detail: 'Confusions', evidence: 'Q5 incorrect' }],
    plan: [{ week: 1, objective: 'Revoir suites', actions: ['Exercices chapitre 3'], indicator: 'Score > 60%' }],
    ressources: [{ type: 'exercice' as const, label: 'Exercices suites' }],
    qualityFlags: [{ code: 'RAG_LOW', message: 'Peu de contexte' }],
    citations: [{ index: 1, source: 'Programme officiel', excerpt: 'Les suites...' }],
  };

  it('should accept valid structured analysis', () => {
    expect(structuredAnalysisSchema.safeParse(validData).success).toBe(true);
  });

  it('should reject empty forces array', () => {
    expect(structuredAnalysisSchema.safeParse({ ...validData, forces: [] }).success).toBe(false);
  });

  it('should reject empty faiblesses array', () => {
    expect(structuredAnalysisSchema.safeParse({ ...validData, faiblesses: [] }).success).toBe(false);
  });

  it('should reject empty plan array', () => {
    expect(structuredAnalysisSchema.safeParse({ ...validData, plan: [] }).success).toBe(false);
  });

  it('should accept empty ressources array', () => {
    expect(structuredAnalysisSchema.safeParse({ ...validData, ressources: [] }).success).toBe(true);
  });

  it('should accept empty citations array', () => {
    expect(structuredAnalysisSchema.safeParse({ ...validData, citations: [] }).success).toBe(true);
  });

  it('should reject plan week < 1', () => {
    const data = { ...validData, plan: [{ week: 0, objective: 'Test', actions: ['a'], indicator: 'b' }] };
    expect(structuredAnalysisSchema.safeParse(data).success).toBe(false);
  });

  it('should reject plan week > 4', () => {
    const data = { ...validData, plan: [{ week: 5, objective: 'Test', actions: ['a'], indicator: 'b' }] };
    expect(structuredAnalysisSchema.safeParse(data).success).toBe(false);
  });

  it('should reject plan with empty actions', () => {
    const data = { ...validData, plan: [{ week: 1, objective: 'Test', actions: [], indicator: 'b' }] };
    expect(structuredAnalysisSchema.safeParse(data).success).toBe(false);
  });

  it('should reject invalid ressource type', () => {
    const data = { ...validData, ressources: [{ type: 'invalid', label: 'Test' }] };
    expect(structuredAnalysisSchema.safeParse(data).success).toBe(false);
  });

  it('should accept all valid ressource types', () => {
    const types = ['exercice', 'methode', 'fiche', 'sujet0', 'programme'] as const;
    types.forEach((type) => {
      const data = { ...validData, ressources: [{ type, label: 'Test' }] };
      expect(structuredAnalysisSchema.safeParse(data).success).toBe(true);
    });
  });

  it('should accept forces without evidence (optional)', () => {
    const data = { ...validData, forces: [{ domain: 'Analyse', label: 'Test', detail: 'Good' }] };
    expect(structuredAnalysisSchema.safeParse(data).success).toBe(true);
  });

  it('should accept citations without chunkId (optional)', () => {
    const data = { ...validData, citations: [{ index: 1, source: 'Test', excerpt: 'Text' }] };
    expect(structuredAnalysisSchema.safeParse(data).success).toBe(true);
  });
});

// ─── validateMarkdownOutput ──────────────────────────────────────────────────

describe('validateMarkdownOutput', () => {
  describe('eleve audience', () => {
    it('should validate markdown with all required sections', () => {
      const md = `# Bilan
## Tes priorités
Voici ton plan d'action et ta méthode de travail.
${'x'.repeat(100)}`;
      const result = validateMarkdownOutput(md, 'eleve');
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should flag missing "priorité" section', () => {
      const md = `# Bilan\nVoici ton plan et ta méthode.\n${'x'.repeat(100)}`;
      const result = validateMarkdownOutput(md, 'eleve');
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes('priorité'))).toBe(true);
    });

    it('should flag markdown too short', () => {
      const result = validateMarkdownOutput('Short', 'eleve');
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes('trop court'))).toBe(true);
    });

    it('should flag empty markdown', () => {
      const result = validateMarkdownOutput('', 'eleve');
      expect(result.valid).toBe(false);
    });
  });

  describe('parents audience', () => {
    it('should validate markdown with all required sections', () => {
      const md = `# Synthèse du bilan
Analyse du risque et du progrès de votre enfant.
${'x'.repeat(100)}`;
      const result = validateMarkdownOutput(md, 'parents');
      expect(result.valid).toBe(true);
    });

    it('should flag missing "synthèse" section', () => {
      const md = `# Bilan\nAnalyse du risque et progrès.\n${'x'.repeat(100)}`;
      const result = validateMarkdownOutput(md, 'parents');
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes('synthèse'))).toBe(true);
    });
  });

  describe('nexus audience', () => {
    it('should validate markdown with all required sections', () => {
      const md = `# Rapport technique
Score global, domaine par domaine, alerte détectée.
${'x'.repeat(100)}`;
      const result = validateMarkdownOutput(md, 'nexus');
      expect(result.valid).toBe(true);
    });

    it('should flag missing "alerte" section', () => {
      const md = `# Rapport\nScore et domaine détaillés.\n${'x'.repeat(100)}`;
      const result = validateMarkdownOutput(md, 'nexus');
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes('alerte'))).toBe(true);
    });
  });
});

// ─── buildQualityFlags ───────────────────────────────────────────────────────

describe('buildQualityFlags', () => {
  it('should return empty array for perfect context', () => {
    const flags = buildQualityFlags({
      ragAvailable: true,
      ragHitCount: 5,
      llmSuccessCount: 3,
      dataQuality: 'complete',
      coverageIndex: 80,
    });
    expect(flags).toHaveLength(0);
  });

  it('should flag RAG_EMPTY when RAG not available', () => {
    const flags = buildQualityFlags({
      ragAvailable: false,
      ragHitCount: 0,
      llmSuccessCount: 3,
      dataQuality: 'complete',
      coverageIndex: 80,
    });
    expect(flags.some((f) => f.code === 'RAG_EMPTY')).toBe(true);
  });

  it('should flag RAG_LOW when few RAG hits', () => {
    const flags = buildQualityFlags({
      ragAvailable: true,
      ragHitCount: 1,
      llmSuccessCount: 3,
      dataQuality: 'complete',
      coverageIndex: 80,
    });
    expect(flags.some((f) => f.code === 'RAG_LOW')).toBe(true);
  });

  it('should flag LLM_PARTIAL when not all sections generated', () => {
    const flags = buildQualityFlags({
      ragAvailable: true,
      ragHitCount: 5,
      llmSuccessCount: 1,
      dataQuality: 'complete',
      coverageIndex: 80,
    });
    expect(flags.some((f) => f.code === 'LLM_PARTIAL')).toBe(true);
    expect(flags.find((f) => f.code === 'LLM_PARTIAL')!.message).toContain('2');
  });

  it('should flag LOW_DATA for insufficient data quality', () => {
    const flags = buildQualityFlags({
      ragAvailable: true,
      ragHitCount: 5,
      llmSuccessCount: 3,
      dataQuality: 'insufficient',
      coverageIndex: 80,
    });
    expect(flags.some((f) => f.code === 'LOW_DATA')).toBe(true);
  });

  it('should flag PARTIAL_DATA for partial data quality', () => {
    const flags = buildQualityFlags({
      ragAvailable: true,
      ragHitCount: 5,
      llmSuccessCount: 3,
      dataQuality: 'partial',
      coverageIndex: 80,
    });
    expect(flags.some((f) => f.code === 'PARTIAL_DATA')).toBe(true);
  });

  it('should flag LOW_COVERAGE when coverage < 50%', () => {
    const flags = buildQualityFlags({
      ragAvailable: true,
      ragHitCount: 5,
      llmSuccessCount: 3,
      dataQuality: 'complete',
      coverageIndex: 30,
    });
    expect(flags.some((f) => f.code === 'LOW_COVERAGE')).toBe(true);
    expect(flags.find((f) => f.code === 'LOW_COVERAGE')!.message).toContain('30%');
  });

  it('should accumulate multiple flags', () => {
    const flags = buildQualityFlags({
      ragAvailable: false,
      ragHitCount: 0,
      llmSuccessCount: 1,
      dataQuality: 'insufficient',
      coverageIndex: 20,
    });
    expect(flags.length).toBeGreaterThanOrEqual(3);
    const codes = flags.map((f) => f.code);
    expect(codes).toContain('RAG_EMPTY');
    expect(codes).toContain('LLM_PARTIAL');
    expect(codes).toContain('LOW_DATA');
    expect(codes).toContain('LOW_COVERAGE');
  });

  it('should not flag RAG_LOW when RAG is unavailable (RAG_EMPTY takes priority)', () => {
    const flags = buildQualityFlags({
      ragAvailable: false,
      ragHitCount: 0,
      llmSuccessCount: 3,
      dataQuality: 'complete',
      coverageIndex: 80,
    });
    expect(flags.some((f) => f.code === 'RAG_EMPTY')).toBe(true);
    expect(flags.some((f) => f.code === 'RAG_LOW')).toBe(false);
  });

  it('should not flag LLM_PARTIAL when all 3 sections succeed', () => {
    const flags = buildQualityFlags({
      ragAvailable: true,
      ragHitCount: 5,
      llmSuccessCount: 3,
      dataQuality: 'complete',
      coverageIndex: 80,
    });
    expect(flags.some((f) => f.code === 'LLM_PARTIAL')).toBe(false);
  });
});
