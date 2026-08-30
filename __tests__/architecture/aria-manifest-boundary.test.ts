import { source } from './aria-boundary-helpers';

describe('H005 ARIA manifest sources of truth', () => {
  it('derives curriculum and retrieval from one versioned RAG manifest resolver', () => {
    expect(source('lib/aria/curriculum.ts')).not.toMatch(/RAG_COLLECTION_MAPPING/);
    expect(source('lib/aria/rag.ts')).not.toMatch(/CANONICAL_PLANS/);
    expect(source('lib/aria/curriculum.ts')).toMatch(/getAriaRagCorpusCapability/);
    expect(source('lib/aria/rag.ts')).toMatch(/getAriaRagCorpusCapability/);
  });

  it('loads resources from one versioned registry instead of a TypeScript catalog', () => {
    const resources = source('lib/aria/resources.ts');
    expect(resources).not.toMatch(/STATIC_RESOURCES/);
    expect(resources).toMatch(/resource-registry\.v1\.json/);
  });
});
