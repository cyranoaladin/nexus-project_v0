import { source } from './aria-boundary-helpers';

describe('ARIA manifest sources of truth', () => {
  it('H005 derives curriculum and retrieval from one versioned RAG manifest resolver', () => {
    expect(source('lib/aria/curriculum.ts')).not.toMatch(/RAG_COLLECTION_MAPPING/);
    expect(source('lib/aria/rag.ts')).not.toMatch(/CANONICAL_PLANS/);
    expect(source('lib/aria/curriculum.ts')).toMatch(/getAriaRagCorpusCapability/);
    expect(source('lib/aria/rag.ts')).toMatch(/getAriaRagCorpusCapability/);
    expect(source('lib/aria/rag.ts')).toMatch(/infrastructure\/rag\/rag-engine-client/);
    expect(source('lib/aria/rag.ts')).not.toMatch(/['"](?:@\/)?lib\/rag-client['"]/);
  });

  it('loads resources from one versioned registry instead of a TypeScript catalog', () => {
    const resources = source('lib/aria/resources.ts');
    const registry = source('lib/aria/manifests/resource-registry.ts');
    expect(resources).not.toMatch(/STATIC_RESOURCES/);
    expect(resources).toMatch(/\.\/manifests\/resource-registry/);
    expect(resources).not.toMatch(/data\/aria\/resources/);
    expect(registry).toMatch(/data\/aria\/resources\.v2\.json/);
  });
});
