import { source } from './aria-boundary-helpers';

describe('H008 ARIA repository architecture evidence', () => {
  it('versions the V2 runtime, lifecycle, authorization, privacy, RAG and rollout contracts', () => {
    const architecture = source('docs/architecture/ARIA_V1.md');
    for (const evidence of [
      'Frontières de modules', 'Matrice API/route', 'stateDiagram',
      'idempotence', 'concurrence', 'Retrieval', 'erreurs',
      'contexte autorisé', 'Privacy', 'Resource Registry', 'Migration', 'ARIA-C',
    ]) expect(architecture).toMatch(new RegExp(evidence, 'i'));
  });

  it('keeps representation and product capability coverage separate and non-absolute', () => {
    const matrix = source('docs/architecture/ARIA_PERSONAL_LEARNING_OS_DATA_MODEL.md');
    expect(matrix).toMatch(/ACADEMIC_MAP_REPRESENTATION_COVERAGE/);
    expect(matrix).toMatch(/ARIA_CAPABILITY_COVERAGE/);
    expect(matrix).toMatch(/CANDIDAT_LIBRE_COVERAGE=NOT_PROVEN/i);
    expect(matrix).not.toMatch(/ACADEMIC_MAP_SUPPORTED_PROFILES\s*=\s*100%/);
  });
});
