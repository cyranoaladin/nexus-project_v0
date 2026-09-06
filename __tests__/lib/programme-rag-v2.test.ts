import { searchProgrammeResourcesV2 } from '@/lib/programme/rag-v2';

const context = Object.freeze({
  courseKey: 'eds-maths-premiere',
  subject: { studentId: 'student-1' },
  student: {
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
    academicEnrollments: [],
  },
});

const plan = Object.freeze({
  courseKey: 'eds-maths-premiere',
  academicYear: '2026-2027',
  retrievalScope: {},
});

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    buildContext: jest.fn().mockResolvedValue(context),
    resolvePlan: jest.fn().mockReturnValue({ status: 'AVAILABLE', plan }),
    resolveDisposableIdentity: jest.fn().mockReturnValue(null),
    resolveProductionIdentity: jest.fn().mockReturnValue({ pseudonymousSubject: 'psn_test' }),
    executeRetrieval: jest.fn().mockResolvedValue({
      status: 'SUCCESS',
      plan,
      hits: [{
        id: 'chunk-1',
        chunkId: 'chunk-1',
        sourceTitle: 'Programme officiel',
        sourceDocument: 'https://education.example/programme.pdf',
        provenance: 'OFFICIEL_MEN',
        snippet: 'Déterminer le signe du trinôme.',
        score: 0.91,
        locator: { page: 12 },
      }],
    }),
    ...overrides,
  };
}

describe('Cockpit programme RAG v2 adapter', () => {
  it('uses the governed ARIA v2 retrieval chain and preserves citation/source/page', async () => {
    const deps = dependencies();

    const result = await searchProgrammeResourcesV2({
      actor: { userId: 'student-user', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      query: 'Second degré',
    }, deps as never);

    expect(deps.buildContext).toHaveBeenCalledWith({
      actor: { userId: 'student-user', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    expect(deps.executeRetrieval).toHaveBeenCalledWith(
      plan,
      'Second degré',
      { pseudonymousSubject: 'psn_test' },
    );
    expect(result).toEqual({
      status: 'SUCCESS',
      source: 'rag-v2',
      hits: [{
        id: 'chunk-1',
        document: 'Déterminer le signe du trinôme.',
        score: 91,
        citation: {
          label: 'OFFICIEL_MEN',
          source: 'https://education.example/programme.pdf',
          page: 12,
        },
        metadata: {
          title: 'Programme officiel',
          source: 'https://education.example/programme.pdf',
          sourceLabel: 'OFFICIEL_MEN',
          page: 12,
        },
      }],
      context: '[Programme officiel — p. 12]\nDéterminer le signe du trinôme.',
    });
  });

  it('does not resolve a student or call RAG when the course has no promoted corpus', async () => {
    const deps = dependencies({
      resolvePlan: jest.fn().mockReturnValue({
        status: 'NOT_CONFIGURED',
        reasonCode: 'SERVABLE_CORPUS_NOT_CONFIGURED',
      }),
    });

    const result = await searchProgrammeResourcesV2({
      actor: { userId: 'student-user', role: 'ELEVE' },
      courseKey: 'stmg-maths-premiere',
      query: 'Suites',
    }, deps as never);

    expect(result).toEqual({
      status: 'UNAVAILABLE',
      source: 'none',
      hits: [],
      context: '',
      reason: 'SERVABLE_CORPUS_NOT_CONFIGURED',
    });
    expect(deps.buildContext).not.toHaveBeenCalled();
    expect(deps.executeRetrieval).not.toHaveBeenCalled();
  });

  it.each([
    ['citation.page', { citationPage: 18, locator: { section: 'II' } }, 18],
    ['locator.page_start', { locator: { page_start: 24 } }, 24],
  ])('preserves a valid page supplied through %s', async (_source, pageFields, expectedPage) => {
    const deps = dependencies({
      executeRetrieval: jest.fn().mockResolvedValue({
        status: 'SUCCESS',
        plan,
        hits: [{
          id: 'chunk-page',
          chunkId: 'chunk-page',
          sourceTitle: 'Ressource officielle',
          sourceDocument: 'https://education.example/ressource.pdf',
          provenance: 'OFFICIEL_MEN',
          snippet: 'Extrait cité.',
          score: 0.8,
          ...pageFields,
        }],
      }),
    });

    const result = await searchProgrammeResourcesV2({
      actor: { userId: 'student-user', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      query: 'Dérivation',
    }, deps as never);

    expect(result).toMatchObject({
      status: 'SUCCESS',
      hits: [{ citation: { page: expectedPage }, metadata: { page: expectedPage } }],
    });
  });

  it('fails closed before the network when no signed academic identity can be resolved', async () => {
    const deps = dependencies({
      resolveProductionIdentity: jest.fn().mockReturnValue(null),
    });

    const result = await searchProgrammeResourcesV2({
      actor: { userId: 'student-user', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      query: 'Dérivation',
    }, deps as never);

    expect(result).toEqual({
      status: 'UNAVAILABLE',
      source: 'none',
      hits: [],
      context: '',
      reason: 'ACADEMIC_CONTEXT_UNREPRESENTABLE',
    });
    expect(deps.executeRetrieval).not.toHaveBeenCalled();
  });
});
