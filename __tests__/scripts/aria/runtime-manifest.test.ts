import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  inspectAriaStaticManifestContract,
  runAriaRuntimeManifestCheck,
  verifyAriaRuntimeManifestEndpoint,
} from '@/scripts/aria/check-runtime-manifest';
import { ARIA_RESOURCE_REGISTRY_SHA256 } from '@/lib/aria/manifests/resource-registry';
import { getRequiredAriaCorpusIds } from '@/lib/aria/manifests/course-capabilities';
import courseCapabilities from '@/data/aria/course-capabilities.v1.json';
import { sha256AriaRagJson } from '@/lib/aria/infrastructure/rag/internal-identity';

const TOKEN = ['runtime', 'service', 'token', 'fixture'].join('-');
const KEY = 'k'.repeat(32);

function write(root: string, path: string, value: unknown): void {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, typeof value === 'string' ? value : `${JSON.stringify(value)}\n`);
}

function staticFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'aria-manifest-'));
  cpSync(
    join(process.cwd(), 'data/aria/generated/rag-contracts/v1'),
    join(root, 'data/aria/generated/rag-contracts/v1'),
    { recursive: true },
  );
  write(root, 'data/aria/rag/contracts.lock.json',
    readFileSync(join(process.cwd(), 'data/aria/rag/contracts.lock.json'), 'utf8'));
  return root;
}

function corpusFixture(corpusId: string) {
  return {
    corpus_id: corpusId,
    corpus_version_id: `${corpusId}-v1`,
    academic_year: '2026-2027',
    curriculum_version: '2026',
    physical_collection: corpusId.replace(/-/g, '_'),
    retrieval_scope: {
      artifact_version: '3',
      scope_id: corpusId.replace(/-/g, '_'),
      status: 'eligible_for_promotion',
      source_sha256: '2'.repeat(64),
      target_policy: {
        tenant: 'nexus', niveau: 'terminale', voie: 'generale', matiere: 'mathematiques',
        statut_enseignement: 'enseignement_commun', audiences: ['tous'],
        candidates: ['scolarise'], roles: ['student'],
      },
      evidence_subject: {
        collection: corpusId.replace(/-/g, '_'), tenant: 'nexus', niveau: 'terminale',
        voie: 'generale', matiere: 'mathematiques',
        statut_enseignement: 'enseignement_commun', candidat: 'scolarise',
        audiences: ['tous'], visibility: 'public', rights: ['officiel_public'],
        school_year: '2026-2027', programme_version: '2026',
      },
    },
    resources: [{
      resource_id: '202269df-9b59-5c61-aa20-1f13a7558910',
      resource_version_id: 'f69965ee-0e3a-51d9-ab4d-55f58a003beb',
      content_sha256: '3'.repeat(64),
      chunks: [{ chunk_id: 'chunk-1', locator: { page: 1 } }],
    }],
  };
}

function manifest(input: Readonly<{
  resourceRegistrySha256?: string;
  corpusIds?: readonly string[];
}> = {}) {
  const corpusIds = input.corpusIds ?? [...getRequiredAriaCorpusIds()];
  const unsigned = {
    protocol_version: '1',
    manifest_version: 'fixture-v1',
    resource_registry_version: '1',
    resource_registry_sha256: input.resourceRegistrySha256 ?? ARIA_RESOURCE_REGISTRY_SHA256,
    producer_repository: 'cyranoaladin/RAG',
    producer_commit: '1'.repeat(40),
    generated_at: '2026-08-30T12:00:00.000Z',
    corpora: corpusIds.map((corpusId) => corpusFixture(corpusId)),
  };
  const manifestSha256 = sha256AriaRagJson(unsigned);
  return { ...unsigned, manifest_sha256: manifestSha256 };
}

function indexFor(manifests: readonly ReturnType<typeof manifest>[], input: Readonly<{
  resourceRegistrySha256?: string;
  activeManifestSha256?: string;
}> = {}) {
  const unsigned = {
    protocol_version: '1',
    producer_repository: 'cyranoaladin/RAG',
    producer_commit: '1'.repeat(40),
    generated_at: '2026-08-30T12:00:00.000Z',
    resource_registry_sha256: input.resourceRegistrySha256 ?? ARIA_RESOURCE_REGISTRY_SHA256,
    active_manifest_sha256: input.activeManifestSha256 ?? manifests[0]!.manifest_sha256,
    supported_manifests: manifests.map((item) => ({
      manifest_version: item.manifest_version,
      manifest_sha256: item.manifest_sha256,
      retire_at: null,
    })),
  };
  return { ...unsigned, index_sha256: sha256AriaRagJson(unsigned) };
}

function response(value: unknown, init: ResponseInit = {}): Response {
  return new Response(typeof value === 'string' ? value : JSON.stringify(value), init);
}

describe('ARIA static and runtime RAG manifest gate', () => {
  it('accepts a digest-bound promoted static index and reports absence explicitly', () => {
    const absent = staticFixture();
    expect(inspectAriaStaticManifestContract(absent)).toMatchObject({
      status: 'NOT_CONFIGURED', reasonCode: 'SERVABLE_INDEX_NOT_PROMOTED',
    });
    const configured = staticFixture();
    write(configured, 'data/aria/rag/servable-corpus-index.lock.json', indexFor([manifest()]));
    expect(inspectAriaStaticManifestContract(configured)).toMatchObject({
      status: 'CONFIGURED', reasonCode: 'SERVABLE_INDEX_STATICALLY_VALID',
      ragMappingSourcesOfTruth: 1,
      resourceIdentitySourcesOfTruth: 1,
      ragDocumentIdentitySourcesOfTruth: 1,
    });
  });

  it('rejects invalid locks, contract identities and byte drift', () => {
    const invalidLock = staticFixture();
    write(invalidLock, 'data/aria/rag/contracts.lock.json', {});
    expect(() => inspectAriaStaticManifestContract(invalidLock))
      .toThrow('ARIA_RAG_CONTRACT_LOCK_INVALID');

    const invalidIdentity = staticFixture();
    const lockPath = join(invalidIdentity, 'data/aria/rag/contracts.lock.json');
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    lock.schemas['retrieval-request.json'] = {};
    writeFileSync(lockPath, `${JSON.stringify(lock)}\n`);
    expect(() => inspectAriaStaticManifestContract(invalidIdentity))
      .toThrow('ARIA_RAG_CONTRACT_IDENTITY_INVALID:retrieval-request.json');

    const drift = staticFixture();
    write(drift, 'data/aria/generated/rag-contracts/v1/retrieval-request.json', '{}\n');
    expect(() => inspectAriaStaticManifestContract(drift))
      .toThrow('ARIA_RAG_CONTRACT_BYTES_DRIFT:retrieval-request.json');
  });

  it('loads and validates every supported runtime manifest with bounded authenticated requests', async () => {
    const document = manifest();
    const index = indexFor([document]);
    const fetchImpl = jest.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      expect(init?.headers).toEqual({
        authorization: `Bearer ${TOKEN}`,
        'x-rag-api-key': KEY,
        accept: 'application/json',
      });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return response(path === '/corpora/servable/v1' ? index : document);
    }) as jest.MockedFunction<typeof fetch>;

    await expect(verifyAriaRuntimeManifestEndpoint({
      apiKey: KEY,
      baseUrl: 'http://127.0.0.1:4010', serviceToken: TOKEN, fetchImpl,
    })).resolves.toEqual({
      indexSha256: index.index_sha256,
      manifestCount: 1,
      activeManifestSha256: document.manifest_sha256,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['http://rag.example.test', TOKEN, 'ARIA_RAG_RUNTIME_BASE_URL_INSECURE'],
    ['ftp://127.0.0.1', TOKEN, 'ARIA_RAG_RUNTIME_BASE_URL_INSECURE'],
    ['https://user:pass@rag.example.test', TOKEN, 'ARIA_RAG_RUNTIME_CONFIGURATION_INVALID'],
    ['https://rag.example.test', 'short', 'ARIA_RAG_RUNTIME_CONFIGURATION_INVALID'],
  ])('rejects unsafe runtime configuration %s', async (baseUrl, serviceToken, expected) => {
    await expect(verifyAriaRuntimeManifestEndpoint({ baseUrl, serviceToken, apiKey: KEY }))
      .rejects.toThrow(expected);
  });

  it('rejects a single credential reused for both RAG authorization gates', async () => {
    await expect(verifyAriaRuntimeManifestEndpoint({
      baseUrl: 'https://rag.example.test',
      serviceToken: TOKEN,
      apiKey: TOKEN,
    })).rejects.toThrow('ARIA_RAG_RUNTIME_CONFIGURATION_INVALID');
  });

  it('keeps HTTP, size and JSON failures distinct', async () => {
    await expect(verifyAriaRuntimeManifestEndpoint({
      baseUrl: 'https://rag.example.test', serviceToken: TOKEN, apiKey: KEY,
      fetchImpl: jest.fn().mockResolvedValue(response('', { status: 503 })),
    })).rejects.toThrow('ARIA_RAG_RUNTIME_HTTP_503');
    await expect(verifyAriaRuntimeManifestEndpoint({
      baseUrl: 'https://rag.example.test', serviceToken: TOKEN, apiKey: KEY,
      fetchImpl: jest.fn().mockResolvedValue(response('{}', {
        headers: { 'content-length': String(2 * 1024 * 1024 + 1) },
      })),
    })).rejects.toThrow('ARIA_RAG_RUNTIME_RESPONSE_TOO_LARGE');
    await expect(verifyAriaRuntimeManifestEndpoint({
      baseUrl: 'https://rag.example.test', serviceToken: TOKEN, apiKey: KEY,
      fetchImpl: jest.fn().mockResolvedValue(response('x'.repeat(2 * 1024 * 1024 + 1))),
    })).rejects.toThrow('ARIA_RAG_RUNTIME_RESPONSE_TOO_LARGE');
    await expect(verifyAriaRuntimeManifestEndpoint({
      baseUrl: 'https://rag.example.test', serviceToken: TOKEN, apiKey: KEY,
      fetchImpl: jest.fn().mockResolvedValue(response('not-json')),
    })).rejects.toThrow('ARIA_RAG_RUNTIME_JSON_INVALID');
  });

  it('rejects index schema, digest, registry and compatibility-window drift', async () => {
    const document = manifest();
    for (const [value, expected] of [
      [{}, 'ARIA_RAG_INDEX_SCHEMA_INVALID'],
      [{ ...indexFor([document]), index_sha256: '0'.repeat(64) }, 'ARIA_RAG_INDEX_DIGEST_MISMATCH'],
      [indexFor([document], { resourceRegistrySha256: '0'.repeat(64) }),
        'ARIA_RAG_INDEX_RESOURCE_REGISTRY_MISMATCH'],
      [indexFor([document, document]), 'ARIA_RAG_INDEX_WINDOW_INVALID'],
      [indexFor([document], { activeManifestSha256: '0'.repeat(64) }),
        'ARIA_RAG_INDEX_WINDOW_INVALID'],
    ] as const) {
      await expect(verifyAriaRuntimeManifestEndpoint({
        baseUrl: 'https://rag.example.test', serviceToken: TOKEN, apiKey: KEY,
        fetchImpl: jest.fn().mockResolvedValue(response(value)),
      })).rejects.toThrow(expected);
    }
  });

  it('rejects manifest schema, digest and canonical resource-registry drift', async () => {
    const valid = manifest();
    const cases = [
      { document: {}, index: indexFor([valid]), expected: 'ARIA_RAG_MANIFEST_SCHEMA_INVALID' },
      {
        document: { ...valid, manifest_sha256: '0'.repeat(64) },
        index: indexFor([valid]), expected: 'ARIA_RAG_MANIFEST_DIGEST_MISMATCH',
      },
    ];
    const wrongRegistry = manifest({ resourceRegistrySha256: '0'.repeat(64) });
    cases.push({
      document: wrongRegistry,
      index: indexFor([wrongRegistry]),
      expected: 'ARIA_RAG_MANIFEST_RESOURCE_REGISTRY_MISMATCH',
    });
    for (const item of cases) {
      const fetchImpl = jest.fn()
        .mockResolvedValueOnce(response(item.index))
        .mockResolvedValueOnce(response(item.document));
      await expect(verifyAriaRuntimeManifestEndpoint({
        baseUrl: 'https://rag.example.test', serviceToken: TOKEN, apiKey: KEY, fetchImpl,
      })).rejects.toThrow(item.expected);
    }
  });

  it('rejects a retired active manifest and a manifest missing a required course corpus binding', async () => {
    const document = manifest();
    const retiredIndex = {
      ...indexFor([document]),
      supported_manifests: [{
        manifest_version: document.manifest_version,
        manifest_sha256: document.manifest_sha256,
        retire_at: '2020-01-01T00:00:00.000Z',
      }],
    };
    retiredIndex.index_sha256 = sha256AriaRagJson(
      Object.fromEntries(Object.entries(retiredIndex).filter(([key]) => key !== 'index_sha256')),
    );
    await expect(verifyAriaRuntimeManifestEndpoint({
      baseUrl: 'https://rag.example.test', serviceToken: TOKEN, apiKey: KEY,
      fetchImpl: jest.fn().mockResolvedValue(response(retiredIndex)),
    })).rejects.toThrow('ARIA_RAG_RUNTIME_ACTIVE_MANIFEST_RETIRED');

    const [missingCorpusId, ...remainingCorpusIds] = [...getRequiredAriaCorpusIds()];
    const incomplete = manifest({ corpusIds: remainingCorpusIds });
    const incompleteIndex = indexFor([incomplete]);
    await expect(verifyAriaRuntimeManifestEndpoint({
      baseUrl: 'https://rag.example.test', serviceToken: TOKEN, apiKey: KEY,
      fetchImpl: jest.fn()
        .mockResolvedValueOnce(response(incompleteIndex))
        .mockResolvedValueOnce(response(incomplete)),
    })).rejects.toThrow(`ARIA_RAG_RUNTIME_REQUIRED_CORPUS_MISSING:${missingCorpusId}`);
  });

  it('never requires a corpus for a course with chat capability disabled', async () => {
    const chatDisabledCourses = Object.values(courseCapabilities.courses)
      .filter((declaration) => declaration.chat === null);
    expect(chatDisabledCourses.length).toBeGreaterThan(0);

    const complete = manifest();
    const index = indexFor([complete]);
    await expect(verifyAriaRuntimeManifestEndpoint({
      baseUrl: 'https://rag.example.test', serviceToken: TOKEN, apiKey: KEY,
      fetchImpl: jest.fn()
        .mockResolvedValueOnce(response(index))
        .mockResolvedValueOnce(response(complete)),
    })).resolves.toMatchObject({ activeManifestSha256: complete.manifest_sha256 });
  });

  it('aborts a bounded runtime check on timeout', async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn((_url: URL | RequestInfo, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('fixture aborted')));
      })) as jest.MockedFunction<typeof fetch>;
    const pending = verifyAriaRuntimeManifestEndpoint({
      baseUrl: 'https://rag.example.test', serviceToken: TOKEN, apiKey: KEY, timeoutMs: 250, fetchImpl,
    });
    const expectation = expect(pending).rejects.toThrow('fixture aborted');
    await jest.advanceTimersByTimeAsync(250);
    await expectation;
    jest.useRealTimers();
  });

  it('runs static and runtime modes through one injectable CLI adapter', async () => {
    const root = staticFixture();
    const output: string[] = [];
    await expect(runAriaRuntimeManifestCheck({
      argv: ['--mode', 'static'], repositoryRoot: root,
      write: (value) => output.push(value),
    })).resolves.toBe(0);
    expect(output.join('')).toContain('ARIA_RAG_MANIFEST_STATUS=NOT_CONFIGURED');
    await expect(runAriaRuntimeManifestCheck({ argv: [], repositoryRoot: root }))
      .rejects.toThrow('ARIA_RAG_MANIFEST_CHECK_MODE_REQUIRED');

    const document = manifest();
    const index = indexFor([document]);
    const runtimeOutput: string[] = [];
    await expect(runAriaRuntimeManifestCheck({
      argv: ['--mode=runtime'],
      repositoryRoot: root,
      environment: {
        RAG_API_BASE_URL: 'https://rag.example.test',
        RAG_BFF_SERVICE_TOKEN: TOKEN,
        RAG_MANIFEST_API_KEY: KEY,
      },
      fetchImpl: jest.fn()
        .mockResolvedValueOnce(response(index))
        .mockResolvedValueOnce(response(document)),
      write: (value) => runtimeOutput.push(value),
    })).resolves.toBe(0);
    expect(runtimeOutput.join('')).toContain(`ARIA_RAG_RUNTIME_INDEX_SHA256=${index.index_sha256}`);
    expect(runtimeOutput.join('')).toContain('ARIA_RAG_RUNTIME_MANIFEST_COUNT=1');
  });
});
