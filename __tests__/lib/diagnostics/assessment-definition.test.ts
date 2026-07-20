import { assessmentDefinitionSchema } from '@/lib/diagnostics/assessment-definition';
import { adaptLegacyDefinition, adaptLegacyDefinitions } from '@/lib/diagnostics/legacy-adapter';
import { MATHS_PREMIERE_P2 } from '@/lib/diagnostics/definitions/maths-premiere-p2';
import { MATHS_TERMINALE_P2 } from '@/lib/diagnostics/definitions/maths-terminale-p2';
import { NSI_PREMIERE_P2 } from '@/lib/diagnostics/definitions/nsi-premiere-p2';
import { NSI_TERMINALE_P2 } from '@/lib/diagnostics/definitions/nsi-terminale-p2';

describe('AssessmentDefinition schema', () => {
  test('validates a minimal well-formed definition', () => {
    const minimalDef = {
      id: 'maths-test-def',
      version: 'v1.0',
      label: 'Test Maths Definition',
      status: 'DRAFT' as const,
      curriculumBinding: {
        prerequisiteCurriculumId: 'fr-maths-seconde-gt-2019',
        targetCurriculumId: 'fr-maths-premiere-speciality-2026',
        academicYear: '2026-2027',
        subject: 'MATHEMATICS' as const,
        currentLevel: 'SECONDE' as const,
        targetLevel: 'PREMIERE' as const,
        track: 'GENERAL' as const,
        subjectVariant: 'SPECIALITY' as const,
      },
      skills: {
        analyse: [
          { skillId: 'an-1', label: 'Limits', domain: 'analyse' },
        ],
      },
      scoringPolicy: {
        domainWeights: { analyse: 1.0 },
        thresholds: {
          confirmed: { readiness: 60, risk: 55 },
          conditional: { readiness: 48, risk: 70 },
        },
      },
      prompts: {
        version: 'v1.0',
        eleve: 'Prompt for student.',
        parents: 'Prompt for parents.',
        nexus: 'Prompt for Nexus.',
      },
      ragPolicy: {
        collections: ['ressources_maths'],
        maxQueries: 3,
        topK: 2,
      },
    };

    const result = assessmentDefinitionSchema.safeParse(minimalDef);
    expect(result.success).toBe(true);
  });

  test('rejects a definition where a domain has skills but no weight', () => {
    const def = {
      id: 'bad-domain-coverage',
      version: 'v1.0',
      label: 'Bad Definition',
      status: 'DRAFT' as const,
      curriculumBinding: {
        prerequisiteCurriculumId: 'fr-maths-seconde-gt-2019',
        targetCurriculumId: 'fr-maths-premiere-speciality-2026',
        academicYear: '2026-2027',
        subject: 'MATHEMATICS' as const,
        currentLevel: 'SECONDE' as const,
        targetLevel: 'PREMIERE' as const,
        track: 'GENERAL' as const,
        subjectVariant: 'SPECIALITY' as const,
      },
      skills: {
        analyse: [{ skillId: 'an-1', label: 'Limits', domain: 'analyse' }],
        algebre: [{ skillId: 'al-1', label: 'Polynomials', domain: 'algebre' }],
      },
      scoringPolicy: {
        // 'algebre' is missing from weights but present in skills
        domainWeights: { analyse: 1.0 },
        thresholds: {
          confirmed: { readiness: 60, risk: 55 },
          conditional: { readiness: 48, risk: 70 },
        },
      },
      prompts: {
        version: 'v1.0',
        eleve: 'Eleve.',
        parents: 'Parents.',
        nexus: 'Nexus.',
      },
      ragPolicy: { collections: ['maths'], maxQueries: 2, topK: 2 },
    };

    const result = assessmentDefinitionSchema.safeParse(def);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages.some((m) => m.includes('algebre'))).toBe(true);
    }
  });

  test('rejects a definition where a weighted domain has no skills', () => {
    const def = {
      id: 'orphan-weight',
      version: 'v1.0',
      label: 'Orphan Weight',
      status: 'DRAFT' as const,
      curriculumBinding: {
        prerequisiteCurriculumId: 'fr-maths-seconde-gt-2019',
        targetCurriculumId: 'fr-maths-premiere-speciality-2026',
        academicYear: '2026-2027',
        subject: 'MATHEMATICS' as const,
        currentLevel: 'SECONDE' as const,
        targetLevel: 'PREMIERE' as const,
        track: 'GENERAL' as const,
        subjectVariant: 'SPECIALITY' as const,
      },
      skills: {
        analyse: [{ skillId: 'an-1', label: 'Limits', domain: 'analyse' }],
      },
      scoringPolicy: {
        domainWeights: { analyse: 0.7, algebre: 0.3 }, // algebre weighted but no skills
        thresholds: {
          confirmed: { readiness: 60, risk: 55 },
          conditional: { readiness: 48, risk: 70 },
        },
      },
      prompts: {
        version: 'v1.0',
        eleve: 'Eleve.',
        parents: 'Parents.',
        nexus: 'Nexus.',
      },
      ragPolicy: { collections: ['maths'], maxQueries: 2, topK: 2 },
    };

    const result = assessmentDefinitionSchema.safeParse(def);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages.some((m) => m.includes('algebre'))).toBe(true);
    }
  });

  test('rejects an invalid curriculum subject', () => {
    const result = assessmentDefinitionSchema.safeParse({
      id: 'bad-subject',
      version: 'v1.0',
      label: 'Test',
      status: 'DRAFT',
      curriculumBinding: {
        prerequisiteCurriculumId: 'x',
        targetCurriculumId: 'y',
        academicYear: '2026-2027',
        subject: 'LATIN', // invalid
        currentLevel: 'SECONDE',
        targetLevel: 'PREMIERE',
        track: 'GENERAL',
        subjectVariant: 'SPECIALITY',
      },
      skills: { d: [{ skillId: 's', label: 'l', domain: 'd' }] },
      scoringPolicy: {
        domainWeights: { d: 1.0 },
        thresholds: { confirmed: { readiness: 60, risk: 55 }, conditional: { readiness: 48, risk: 70 } },
      },
      prompts: { version: 'v1', eleve: 'e', parents: 'p', nexus: 'n' },
      ragPolicy: { collections: ['c'], maxQueries: 1, topK: 1 },
    });
    expect(result.success).toBe(false);
  });
});

describe('adaptLegacyDefinition', () => {
  test('adapts Maths Première without warnings', () => {
    const result = adaptLegacyDefinition(MATHS_PREMIERE_P2);
    expect(result.warnings).toHaveLength(0);
    expect(result.definition.id).toBe('maths-premiere-p2-adapted-2026');
    expect(result.definition.status).toBe('DRAFT');
    expect(result.definition.curriculumBinding.subject).toBe('MATHEMATICS');
    expect(result.definition.curriculumBinding.targetLevel).toBe('PREMIERE');
    expect(result.definition.curriculumBinding.prerequisiteCurriculumId).toBe('fr-maths-seconde-gt-2019');
    expect(result.definition.curriculumBinding.targetCurriculumId).toBe('fr-maths-premiere-speciality-2026');
  });

  test('adapts Maths Terminale without warnings', () => {
    const result = adaptLegacyDefinition(MATHS_TERMINALE_P2);
    expect(result.warnings).toHaveLength(0);
    expect(result.definition.curriculumBinding.targetLevel).toBe('TERMINALE');
    expect(result.definition.curriculumBinding.targetCurriculumId).toBe('fr-maths-terminale-speciality-2019');
    expect(result.definition.curriculumBinding.examSession).toBe(2027);
  });

  test('adapts NSI Première without warnings', () => {
    const result = adaptLegacyDefinition(NSI_PREMIERE_P2);
    expect(result.warnings).toHaveLength(0);
    expect(result.definition.curriculumBinding.subject).toBe('NSI');
    expect(result.definition.curriculumBinding.prerequisiteCurriculumId).toBe('fr-snt-seconde-gt-2019');
  });

  test('adapts NSI Terminale without warnings', () => {
    const result = adaptLegacyDefinition(NSI_TERMINALE_P2);
    expect(result.warnings).toHaveLength(0);
    expect(result.definition.curriculumBinding.targetCurriculumId).toBe('fr-nsi-terminale-speciality-2020');
  });

  test('adapted definition preserves skills and prompts from legacy', () => {
    const result = adaptLegacyDefinition(MATHS_PREMIERE_P2);
    const def = result.definition;
    // Skills should be non-empty
    expect(Object.keys(def.skills).length).toBeGreaterThan(0);
    // Prompts should be present for all audiences
    expect(def.prompts.eleve.length).toBeGreaterThan(50);
    expect(def.prompts.parents.length).toBeGreaterThan(50);
    expect(def.prompts.nexus.length).toBeGreaterThan(50);
  });

  test('adapted definition always has DRAFT status regardless of input', () => {
    const result = adaptLegacyDefinition(MATHS_TERMINALE_P2);
    expect(result.definition.status).toBe('DRAFT');
  });

  test('returns an independent curriculum binding for every adaptation', () => {
    const first = adaptLegacyDefinition(MATHS_PREMIERE_P2);
    first.definition.curriculumBinding.targetCurriculumId = 'mutated-by-caller';

    const second = adaptLegacyDefinition(MATHS_PREMIERE_P2);
    expect(second.definition.curriculumBinding.targetCurriculumId)
      .toBe('fr-maths-premiere-speciality-2026');
  });

  test('generates a warning for an unmapped track:level combination', () => {
    const unknownDef = {
      ...MATHS_PREMIERE_P2,
      key: 'physique-premiere-p2',
      track: 'physique' as 'maths',
      level: 'premiere' as const,
    };
    const result = adaptLegacyDefinition(unknownDef);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('No curriculum binding'))).toBe(true);
  });

  test('adapted definition passes canonical schema validation for known definitions', () => {
    const defs = [MATHS_PREMIERE_P2, MATHS_TERMINALE_P2, NSI_PREMIERE_P2, NSI_TERMINALE_P2];
    for (const legacy of defs) {
      const result = adaptLegacyDefinition(legacy);
      expect(result.warnings).toHaveLength(0);
      const parseResult = assessmentDefinitionSchema.safeParse(result.definition);
      if (!parseResult.success) {
        console.error(`Validation failed for ${legacy.key}:`, parseResult.error.errors);
      }
      expect(parseResult.success).toBe(true);
    }
  });
});

describe('adaptLegacyDefinitions', () => {
  test('skips definitions with UNKNOWN curriculum IDs', () => {
    const mixedDefs = [
      MATHS_PREMIERE_P2,
      { ...MATHS_PREMIERE_P2, key: 'unknown-subject-p2', track: 'unknown' as 'maths', level: 'premiere' as const },
    ];
    const { results, skipped } = adaptLegacyDefinitions(mixedDefs);
    expect(results).toHaveLength(1);
    expect(skipped).toContain('unknown-subject-p2');
  });

  test('adapts all four known legacy definitions successfully', () => {
    const allLegacy = [MATHS_PREMIERE_P2, MATHS_TERMINALE_P2, NSI_PREMIERE_P2, NSI_TERMINALE_P2];
    const { results, skipped } = adaptLegacyDefinitions(allLegacy);
    expect(skipped).toHaveLength(0);
    expect(results).toHaveLength(4);
  });
});
