import {
  runRagV2StagingCheck,
} from '@/scripts/aria/verify-rag-v2-staging';

const plan = Object.freeze({
  courseKey: 'eds-maths-premiere',
  pedagogicalMode: 'DISCOVERY',
  collection: 'rag_maths_premiere',
  corpusId: 'aria-maths-premiere',
  corpusVersionId: 'corpus-v1',
  manifestSha256: 'a'.repeat(64),
  resourceRegistrySha256: 'b'.repeat(64),
  academicYear: '2026-2027',
  curriculumVersion: '2026',
  retrievalScopeSha256: 'c'.repeat(64),
  retrievalScope: {
    target_policy: {
      niveau: 'premiere',
      voie: 'generale',
      matiere: 'mathematiques',
      statut_enseignement: 'specialite',
      candidates: ['scolarise'],
      audiences: ['libre'],
    },
    evidence_subject: { school_year: '2026-2027' },
  },
  resourceBindings: [],
});

function dependencies(overrides: Record<string, unknown> = {}) {
  const search = jest.fn().mockResolvedValue({ results: [{}], filters_applied: {}, warnings: [] });
  const readTaxonomy = jest.fn().mockResolvedValue({
    version: 2,
    collections: [{ collection: 'rag_maths_premiere' }],
    dimensions: {},
  });
  return {
    resolvePlan: jest.fn().mockReturnValue({ status: 'AVAILABLE', plan }),
    loadClientConfig: jest.fn().mockReturnValue({ baseUrl: 'https://rag-staging.example' }),
    loadSignerConfig: jest.fn().mockReturnValue({ signingKey: 's'.repeat(32) }),
    search,
    readTaxonomy,
    executeRetrieval: jest.fn(async (_plan, _query, _identity, options) => {
      await options.search({
        request: {},
        identityToken: 'signed-staging-identity',
        config: options.clientConfig,
      });
      return {
        status: 'SUCCESS',
        plan,
        hits: [{ id: 'chunk-1', snippet: 'Extrait', locator: { page: 1 } }],
      };
    }),
    ...overrides,
  };
}

describe('external RAG v2 staging check', () => {
  it('requires an explicit staging execution switch before network I/O', async () => {
    const deps = dependencies();
    await expect(runRagV2StagingCheck({
      environment: {},
      dependencies: deps as never,
    })).rejects.toThrow('RAG_V2_STAGING_RUN_REQUIRED');
    expect(deps.search).not.toHaveBeenCalled();
  });

  it('fails closed with default options when the process environment did not authorize staging', async () => {
    const environment = jest.replaceProperty(process, 'env', {
      ...process.env,
      RAG_STAGING_RUN: '0',
    });
    try {
      await expect(runRagV2StagingCheck()).rejects.toThrow('RAG_V2_STAGING_RUN_REQUIRED');
    } finally {
      environment.restore();
    }
  });

  it('checks taxonomy and search with the same signed identity and emits PASS markers', async () => {
    const deps = dependencies();
    const output: string[] = [];

    await expect(runRagV2StagingCheck({
      environment: { RAG_STAGING_RUN: '1' },
      dependencies: deps as never,
      write: (value) => output.push(value),
    })).resolves.toBe(0);

    expect(deps.readTaxonomy).toHaveBeenCalledWith(expect.objectContaining({
      identityToken: 'signed-staging-identity',
    }));
    expect(deps.search).toHaveBeenCalledWith(expect.objectContaining({
      identityToken: 'signed-staging-identity',
    }));
    expect(output.join('')).toContain('COCKPIT_RAG_V2_CLIENT=PASS');
    expect(output.join('')).toContain('COCKPIT_TO_RAG_STAGING=PASS');
  });

  it('refuses to report PASS when retrieval has no citable result', async () => {
    const deps = dependencies({
      executeRetrieval: jest.fn().mockResolvedValue({ status: 'NO_RESULTS', plan }),
    });
    await expect(runRagV2StagingCheck({
      environment: { RAG_STAGING_RUN: '1' },
      dependencies: deps as never,
    })).rejects.toThrow('RAG_V2_STAGING_SEARCH_FAILED');
  });

  it('refuses a course without a promoted retrieval plan before retrieval', async () => {
    const deps = dependencies({
      resolvePlan: jest.fn().mockReturnValue({
        status: 'NOT_CONFIGURED',
        reasonCode: 'COURSE_HAS_NO_DECLARED_CORPUS',
      }),
    });

    await expect(runRagV2StagingCheck({
      environment: { RAG_STAGING_RUN: '1', RAG_STAGING_COURSE_KEY: 'stmg-sgn-premiere' },
      dependencies: deps as never,
    })).rejects.toThrow('RAG_V2_STAGING_PLAN_UNAVAILABLE:COURSE_HAS_NO_DECLARED_CORPUS');
    expect(deps.executeRetrieval).not.toHaveBeenCalled();
  });

  it.each([
    ['non-object target', { ...plan.retrievalScope, target_policy: [] }],
    ['empty required dimension', {
      ...plan.retrievalScope,
      target_policy: { ...plan.retrievalScope.target_policy, niveau: '' },
    }],
    ['ambiguous candidate', {
      ...plan.retrievalScope,
      target_policy: {
        ...plan.retrievalScope.target_policy,
        candidates: ['scolarise', 'individuel'],
      },
    }],
  ])('refuses an unrepresentable probe identity: %s', async (_name, retrievalScope) => {
    const invalidPlan = { ...plan, retrievalScope };
    const deps = dependencies({
      resolvePlan: jest.fn().mockReturnValue({ status: 'AVAILABLE', plan: invalidPlan }),
    });

    await expect(runRagV2StagingCheck({
      environment: { RAG_STAGING_RUN: '1' },
      dependencies: deps as never,
    })).rejects.toThrow('RAG_V2_STAGING_IDENTITY_UNREPRESENTABLE');
    expect(deps.executeRetrieval).not.toHaveBeenCalled();
  });

  it('refuses a taxonomy that does not expose the promoted physical collection', async () => {
    const deps = dependencies({
      readTaxonomy: jest.fn().mockResolvedValue({
        version: 2,
        collections: [null, { collection: 'another_collection' }],
        dimensions: {},
      }),
    });

    await expect(runRagV2StagingCheck({
      environment: { RAG_STAGING_RUN: '1' },
      dependencies: deps as never,
    })).rejects.toThrow('RAG_V2_STAGING_TAXONOMY_MISMATCH');
    expect(deps.search).not.toHaveBeenCalled();
  });

  it('refuses a non-successful retrieval even after the taxonomy is verified', async () => {
    const deps = dependencies();
    deps.executeRetrieval.mockImplementationOnce(async (_plan, _query, _identity, options) => {
      await options.search({
        request: {},
        identityToken: 'signed-staging-identity',
        config: options.clientConfig,
      });
      return { status: 'NO_RESULTS', plan, hits: [] };
    });

    await expect(runRagV2StagingCheck({
      environment: { RAG_STAGING_RUN: '1' },
      dependencies: deps as never,
    })).rejects.toThrow('RAG_V2_STAGING_SEARCH_FAILED');
  });

  it('uses an explicitly selected course and bounded staging query', async () => {
    const deps = dependencies();

    await runRagV2StagingCheck({
      environment: {
        RAG_STAGING_RUN: '1',
        RAG_STAGING_COURSE_KEY: 'eds-nsi-premiere',
        RAG_STAGING_QUERY: 'structures de données',
      },
      dependencies: deps as never,
      write: jest.fn(),
    });

    expect(deps.resolvePlan).toHaveBeenCalledWith('eds-nsi-premiere', 'DISCOVERY', 'TUTOR');
    expect(deps.executeRetrieval).toHaveBeenCalledWith(
      plan,
      'structures de données',
      expect.objectContaining({ pseudonymousSubject: expect.stringMatching(/^psn_[0-9a-f]{32}$/) }),
      expect.any(Object),
    );
  });

  it('writes PASS markers to stdout when no output adapter is supplied', async () => {
    const output: string[] = [];
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(((value: string) => {
      output.push(value);
      return true;
    }) as typeof process.stdout.write);
    try {
      await runRagV2StagingCheck({
        environment: { RAG_STAGING_RUN: '1' },
        dependencies: dependencies() as never,
      });
    } finally {
      write.mockRestore();
    }
    expect(output.join('')).toContain('COCKPIT_TO_RAG_STAGING=PASS');
  });
});
