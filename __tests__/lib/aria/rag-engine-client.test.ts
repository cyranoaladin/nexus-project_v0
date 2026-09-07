import fixture from '@/data/aria/generated/rag-contracts/v1/fixtures/internal-identity-envelope-v1.json';
import * as ragEngineClientModule from '@/lib/aria/infrastructure/rag/rag-engine-client';
import {
  AriaRagEngineClientError,
  loadAriaRagEngineClientConfig,
  searchAriaRagV2,
} from '@/lib/aria/infrastructure/rag/rag-engine-client';

const config = Object.freeze({
  baseUrl: 'https://rag.internal.example',
  serviceToken: 't'.repeat(32),
  apiKey: 'k'.repeat(32),
  timeoutMs: 1_000,
  maxResponseBytes: 16_384,
});

const manifestBoundResult = Object.freeze({
  chunk_id: 'chunk-1',
  doc_id: 'doc-1',
  score: 0.9,
  title: 'Programme officiel',
  excerpt: 'La dérivée mesure le taux de variation.',
  citation: {
    source_label: 'Bulletin officiel',
    source_uri: 'https://www.education.gouv.fr/example',
    rights: 'officiel_public',
    page: 2,
  },
  metadata: {},
  resource_id: '11111111-1111-4111-8111-111111111111',
  resource_version_id: '22222222-2222-4222-8222-222222222222',
  content_sha256: 'd'.repeat(64),
  locator: { page: 2 },
  corpus_id: fixture.request.corpus_id,
  corpus_version_id: fixture.request.corpus_version_id,
  manifest_sha256: fixture.request.manifest_sha256,
});

const taxonomyV2 = Object.freeze({
  version: 2,
  collections: [{
    collection: 'rag_nexus_maths_premiere_specialite',
    matiere: 'mathematiques',
    niveau: 'premiere',
    voie: 'generale',
    statut_enseignement: 'specialite',
    programme_version: '2026',
    school_year: '2026-2027',
  }],
  dimensions: {
    matiere: ['mathematiques'],
    niveau: ['premiere'],
    voie: ['generale'],
    statut_enseignement: ['specialite'],
    programme_version: ['2026'],
    school_year: ['2026-2027'],
  },
});

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('canonical ARIA RAG /search/v2 client', () => {
  it('loads bounded defaults and explicit RAG client configuration', () => {
    const required = {
      RAG_API_BASE_URL: 'https://rag.internal.example',
      RAG_BFF_SERVICE_TOKEN: 't'.repeat(32),
      RAG_ENGINE_API_KEY: 'k'.repeat(32),
    };
    expect(loadAriaRagEngineClientConfig(required)).toEqual({
      baseUrl: 'https://rag.internal.example',
      serviceToken: 't'.repeat(32),
      apiKey: 'k'.repeat(32),
      timeoutMs: 5_000,
      maxResponseBytes: 262_144,
    });
    expect(loadAriaRagEngineClientConfig({
      ...required,
      ARIA_RAG_ENGINE_TIMEOUT_MS: '4999',
      ARIA_RAG_ENGINE_MAX_RESPONSE_BYTES: '262143',
    })).toMatchObject({ timeoutMs: 4_999, maxResponseBytes: 262_143 });
    expect(loadAriaRagEngineClientConfig({
      ...required,
      ARIA_RAG_ENGINE_TIMEOUT_MS: ' ',
      ARIA_RAG_ENGINE_MAX_RESPONSE_BYTES: '',
    })).toMatchObject({ timeoutMs: 5_000, maxResponseBytes: 262_144 });
    expect(() => loadAriaRagEngineClientConfig({
      ...required,
      ARIA_RAG_ENGINE_TIMEOUT_MS: '0',
    })).toThrow('ARIA_RAG_CLIENT_CONFIGURATION_INVALID');

    const env = jest.replaceProperty(process, 'env', { ...process.env, ...required });
    try {
      expect(loadAriaRagEngineClientConfig()).toMatchObject({
        baseUrl: required.RAG_API_BASE_URL,
        timeoutMs: 5_000,
      });
    } finally {
      env.restore();
    }
  });

  it.each([
    { ...config, baseUrl: 'not a URL' },
    { ...config, baseUrl: 'https://rag.internal.example/search' },
    { ...config, serviceToken: `${'t'.repeat(31)}\n` },
    { ...config, apiKey: `${'k'.repeat(31)}\n` },
    { ...config, timeoutMs: 0 },
    { ...config, timeoutMs: 1.5 },
    { ...config, timeoutMs: 5_001 },
    { ...config, maxResponseBytes: 0 },
    { ...config, maxResponseBytes: 262_145 },
  ])('rejects invalid direct configuration before network I/O: %p', async (invalidConfig) => {
    const fetchImpl = jest.fn(async () => response({
      results: [manifestBoundResult], filters_applied: {}, warnings: [],
    }));
    const operation = searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config: invalidConfig,
      fetchImpl,
    });
    await expect(operation).rejects.toBeInstanceOf(AriaRagEngineClientError);
    await expect(operation).rejects.toMatchObject({ code: 'CONFIGURATION_INVALID' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts only to /search/v2 with private service and manifest-bound identity headers', async () => {
    const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => response({
      results: [manifestBoundResult],
      filters_applied: {},
      warnings: [],
    }));

    const result = await searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config,
      fetchImpl,
    });

    expect(result).toEqual({ results: [manifestBoundResult], filters_applied: {}, warnings: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://rag.internal.example/search/v2');
    expect(init).toMatchObject({ method: 'POST', redirect: 'error' });
    expect(new Headers(init?.headers)).toMatchObject(expect.any(Headers));
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${config.serviceToken}`);
    expect(new Headers(init?.headers).get('x-rag-api-key')).toBe(config.apiKey);
    expect(new Headers(init?.headers).get('x-nexus-identity')).toBe(fixture.jwt);
    expect(JSON.parse(String(init?.body))).toEqual(fixture.request);
  });

  it('fails before network I/O for an invalid request or client configuration', async () => {
    const fetchImpl = jest.fn();
    await expect(searchAriaRagV2({
      request: { ...fixture.request, forged: true },
      identityToken: fixture.jwt,
      config,
      fetchImpl,
    })).rejects.toMatchObject({ code: 'REQUEST_INVALID' });
    expect(fetchImpl).not.toHaveBeenCalled();

    expect(() => loadAriaRagEngineClientConfig({})).toThrow('ARIA_RAG_CLIENT_CONFIGURATION_INVALID');
    expect(() => loadAriaRagEngineClientConfig({
      RAG_API_BASE_URL: 'https://user:password@rag.example/search',
      RAG_BFF_SERVICE_TOKEN: 't'.repeat(32),
      RAG_ENGINE_API_KEY: 'k'.repeat(32),
    })).toThrow('ARIA_RAG_CLIENT_CONFIGURATION_INVALID');
  });

  it.each([
    ['RAG_API_BASE_URL'],
    ['RAG_BFF_SERVICE_TOKEN'],
    ['RAG_ENGINE_API_KEY'],
  ] as const)('refuses missing required credential/configuration %s before network I/O', (missing) => {
    const environment: Record<string, string> = {
      RAG_API_BASE_URL: 'https://rag.internal.example',
      RAG_BFF_SERVICE_TOKEN: 't'.repeat(32),
      RAG_ENGINE_API_KEY: 'k'.repeat(32),
    };
    delete environment[missing];
    expect(() => loadAriaRagEngineClientConfig(environment)).toThrow(
      'ARIA_RAG_CLIENT_CONFIGURATION_INVALID',
    );
  });

  it('refuses reuse of one credential as both BFF bearer and scoped client key', () => {
    const reused = 'r'.repeat(32);
    expect(() => loadAriaRagEngineClientConfig({
      RAG_API_BASE_URL: 'https://rag.internal.example',
      RAG_BFF_SERVICE_TOKEN: reused,
      RAG_ENGINE_API_KEY: reused,
    })).toThrow('ARIA_RAG_CLIENT_CONFIGURATION_INVALID');
  });

  it('refuses a missing signed identity before network I/O', async () => {
    const fetchImpl = jest.fn();
    await expect(searchAriaRagV2({
      request: fixture.request,
      identityToken: '',
      config,
      fetchImpl,
    })).rejects.toMatchObject({ code: 'REQUEST_INVALID' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses an insufficient rag:search scope without credential fallback or retry', async () => {
    const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit?]>(
      async () => response({ detail: 'Forbidden' }, { status: 403 }),
    );
    await expect(searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config,
      fetchImpl,
    })).rejects.toMatchObject({ code: 'PROTOCOL_INVALID' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const headers = new Headers(fetchImpl.mock.calls[0][1]?.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${config.serviceToken}`);
    expect(headers.get('x-rag-api-key')).toBe(config.apiKey);
  });

  it('reads and validates /taxonomy/v2 with the same three credentials', async () => {
    expect(typeof (ragEngineClientModule as Record<string, unknown>).readAriaRagTaxonomyV2)
      .toBe('function');
    const readAriaRagTaxonomyV2 = (ragEngineClientModule as unknown as {
      readAriaRagTaxonomyV2: (input: {
        identityToken: string;
        config: typeof config;
        fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
      }) => Promise<unknown>;
    }).readAriaRagTaxonomyV2;
    const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit?]>(
      async () => response(taxonomyV2),
    );

    await expect(readAriaRagTaxonomyV2({
      identityToken: fixture.jwt,
      config,
      fetchImpl,
    })).resolves.toEqual(taxonomyV2);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://rag.internal.example/taxonomy/v2');
    expect(init).toMatchObject({ method: 'GET', redirect: 'error' });
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${config.serviceToken}`);
    expect(headers.get('x-rag-api-key')).toBe(config.apiKey);
    expect(headers.get('x-nexus-identity')).toBe(fixture.jwt);
  });

  it('rejects missing identity and pre-aborted taxonomy requests before network I/O', async () => {
    const readAriaRagTaxonomyV2 = ragEngineClientModule.readAriaRagTaxonomyV2;
    const fetchImpl = jest.fn();
    await expect(readAriaRagTaxonomyV2({
      identityToken: '',
      config,
      fetchImpl,
    })).rejects.toMatchObject({ code: 'REQUEST_INVALID' });

    const caller = new AbortController();
    caller.abort('student-stop');
    await expect(readAriaRagTaxonomyV2({
      identityToken: fixture.jwt,
      config,
      signal: caller.signal,
      fetchImpl,
    })).rejects.toMatchObject({ code: 'USER_CANCELLED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects malformed taxonomy and preserves a typed upstream refusal', async () => {
    const readAriaRagTaxonomyV2 = ragEngineClientModule.readAriaRagTaxonomyV2;
    await expect(readAriaRagTaxonomyV2({
      identityToken: fixture.jwt,
      config,
      fetchImpl: async () => response({ version: 2, collections: [], dimensions: {}, extra: true }),
    })).rejects.toMatchObject({ code: 'PROTOCOL_INVALID' });

    await expect(readAriaRagTaxonomyV2({
      identityToken: fixture.jwt,
      config,
      fetchImpl: async () => response({
        code: 'RUNTIME_UNAVAILABLE', request_id: 'taxonomy-request-1', retryable: true,
      }, { status: 503 }),
    })).rejects.toMatchObject({
      code: 'RUNTIME_UNAVAILABLE',
      upstreamRequestId: 'taxonomy-request-1',
      retryable: true,
    });
  });

  it.each(['version', 'collections', 'dimensions'] as const)(
    'rejects a taxonomy missing the required top-level %s field',
    async (field) => {
      const incomplete = { ...taxonomyV2 } as Record<string, unknown>;
      delete incomplete[field];

      await expect(ragEngineClientModule.readAriaRagTaxonomyV2({
        identityToken: fixture.jwt,
        config,
        fetchImpl: async () => response(incomplete),
      })).rejects.toMatchObject({ code: 'PROTOCOL_INVALID' });
    },
  );

  it('maps an untyped taxonomy provider failure without exposing its details', async () => {
    await expect(ragEngineClientModule.readAriaRagTaxonomyV2({
      identityToken: fixture.jwt,
      config,
      fetchImpl: async () => { throw new Error('private taxonomy endpoint'); },
    })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      message: 'PROVIDER_UNAVAILABLE',
      retryable: true,
    });
  });

  it('distinguishes taxonomy timeout from caller cancellation', async () => {
    jest.useFakeTimers();
    const pendingFetch = (_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    });
    try {
      const timedOut = ragEngineClientModule.readAriaRagTaxonomyV2({
        identityToken: fixture.jwt,
        config: { ...config, timeoutMs: 25 },
        fetchImpl: pendingFetch,
      });
      const timeoutExpectation = expect(timedOut).rejects.toMatchObject({
        code: 'TIMEOUT', retryable: true,
      });
      await jest.advanceTimersByTimeAsync(25);
      await timeoutExpectation;

      const caller = new AbortController();
      const cancelled = ragEngineClientModule.readAriaRagTaxonomyV2({
        identityToken: fixture.jwt,
        config,
        signal: caller.signal,
        fetchImpl: pendingFetch,
      });
      const cancellationExpectation = expect(cancelled).rejects.toMatchObject({
        code: 'USER_CANCELLED', retryable: false,
      });
      caller.abort('student-stop');
      await cancellationExpectation;
    } finally {
      jest.useRealTimers();
    }
  });

  it('runtime-validates response shape and exact manifest-bound hit identity', async () => {
    for (const invalidResult of [
      { ...manifestBoundResult, unknown: true },
      { ...manifestBoundResult, resource_version_id: null },
      { ...manifestBoundResult, manifest_sha256: 'e'.repeat(64) },
    ]) {
      await expect(searchAriaRagV2({
        request: fixture.request,
        identityToken: fixture.jwt,
        config,
        fetchImpl: async () => response({ results: [invalidResult], filters_applied: {}, warnings: [] }),
      })).rejects.toMatchObject({ code: 'PROTOCOL_INVALID' });
    }
  });

  it.each([
    { ...manifestBoundResult, resource_id: null },
    { ...manifestBoundResult, content_sha256: null },
    { ...manifestBoundResult, locator: null },
    { ...manifestBoundResult, citation: null },
    {
      ...manifestBoundResult,
      citation: { ...manifestBoundResult.citation, page: null },
      locator: { page: null },
    },
    { ...manifestBoundResult, corpus_id: 'other-corpus' },
    { ...manifestBoundResult, corpus_version_id: 'other-version' },
  ])('rejects every malformed or mismatched manifest-bound client hit', async (invalidResult) => {
    await expect(searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config,
      fetchImpl: async () => response({
        results: [invalidResult], filters_applied: {}, warnings: [],
      }),
    })).rejects.toMatchObject({ code: 'PROTOCOL_INVALID' });
  });

  it('maps a strict upstream error without exposing an upstream message', async () => {
    await expect(searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config,
      fetchImpl: async () => response({
        code: 'RUNTIME_UNAVAILABLE', request_id: 'rag-request-1', retryable: true,
      }, { status: 503 }),
    })).rejects.toEqual(expect.objectContaining({
      code: 'RUNTIME_UNAVAILABLE',
      retryable: true,
      upstreamRequestId: 'rag-request-1',
      message: 'RUNTIME_UNAVAILABLE',
    }));
  });

  it.each([
    { code: 'RUNTIME_UNAVAILABLE', retryable: true },
    { code: 'UNKNOWN', request_id: 'rag-request-1', retryable: true },
    {
      code: 'RUNTIME_UNAVAILABLE', request_id: 'rag-request-1', retryable: true, extra: 'secret',
    },
  ])('rejects malformed upstream error envelope without exposing it: %p', async (body) => {
    await expect(searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config,
      fetchImpl: async () => response(body, { status: 503 }),
    })).rejects.toMatchObject({ code: 'PROTOCOL_INVALID' });
  });

  it('rejects a pre-aborted caller before provider invocation', async () => {
    const caller = new AbortController();
    const fetchImpl = jest.fn();
    caller.abort('student-stop');
    await expect(searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config,
      signal: caller.signal,
      fetchImpl,
    })).rejects.toMatchObject({ code: 'USER_CANCELLED', retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('U035 distinguishes internal RAG timeout from caller cancellation', async () => {
    jest.useFakeTimers();
    const pendingFetch = (_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    });
    try {
      const timedOut = searchAriaRagV2({
        request: fixture.request,
        identityToken: fixture.jwt,
        config: { ...config, timeoutMs: 25 },
        fetchImpl: pendingFetch,
      });
      const timedOutExpectation = expect(timedOut).rejects.toMatchObject({ code: 'TIMEOUT' });
      await jest.advanceTimersByTimeAsync(25);
      await timedOutExpectation;

      const caller = new AbortController();
      const cancelled = searchAriaRagV2({
        request: fixture.request,
        identityToken: fixture.jwt,
        config,
        signal: caller.signal,
        fetchImpl: pendingFetch,
      });
      const cancelledExpectation = expect(cancelled).rejects.toMatchObject({ code: 'USER_CANCELLED' });
      caller.abort();
      await cancelledExpectation;
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps TIMEOUT when caller cancellation arrives after the RAG deadline', async () => {
    jest.useFakeTimers();
    const caller = new AbortController();
    const removeListener = jest.spyOn(caller.signal, 'removeEventListener');
    let rejectFetch!: (reason?: unknown) => void;
    const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit?]>(
      () => new Promise<Response>((_resolve, reject) => { rejectFetch = reject; }),
    );
    try {
      const operation = searchAriaRagV2({
        request: fixture.request,
        identityToken: fixture.jwt,
        config: { ...config, timeoutMs: 25 },
        signal: caller.signal,
        fetchImpl,
      });
      const rejection = expect(operation).rejects.toMatchObject({
        code: 'TIMEOUT', retryable: true,
      });
      jest.advanceTimersByTime(25);
      caller.abort('student-stop');
      rejectFetch(new DOMException('aborted', 'AbortError'));
      await rejection;
      expect(removeListener).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps USER_CANCELLED when caller cancellation wins before the RAG deadline', async () => {
    jest.useFakeTimers();
    const caller = new AbortController();
    const removeListener = jest.spyOn(caller.signal, 'removeEventListener');
    let rejectFetch!: (reason?: unknown) => void;
    const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit?]>(
      () => new Promise<Response>((_resolve, reject) => { rejectFetch = reject; }),
    );
    try {
      const operation = searchAriaRagV2({
        request: fixture.request,
        identityToken: fixture.jwt,
        config: { ...config, timeoutMs: 25 },
        signal: caller.signal,
        fetchImpl,
      });
      const rejection = expect(operation).rejects.toMatchObject({
        code: 'USER_CANCELLED', retryable: false,
      });
      caller.abort('student-stop');
      jest.advanceTimersByTime(25);
      rejectFetch(new DOMException('aborted', 'AbortError'));
      await rejection;
      expect(removeListener).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('consumes provider rejection when fetch synchronously triggers caller cancellation', async () => {
    const caller = new AbortController();
    const detachedRejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => detachedRejections.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      await expect(searchAriaRagV2({
        request: fixture.request,
        identityToken: fixture.jwt,
        config,
        signal: caller.signal,
        fetchImpl: () => {
          caller.abort('student-stop');
          return Promise.reject(new Error('private provider failure'));
        },
      })).rejects.toMatchObject({ code: 'USER_CANCELLED', retryable: false });
      await new Promise<void>((resolve) => { setImmediate(resolve); });
      expect(detachedRejections).toEqual([]);
    } finally {
      process.removeListener('unhandledRejection', onUnhandled);
    }
  });

  it('enforces the RAG timeout even when fetch ignores AbortSignal', async () => {
    jest.useFakeTimers();
    let rejectFetch!: (reason?: unknown) => void;
    let observed: unknown;
    const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit?]>(
      () => new Promise<Response>((_resolve, reject) => { rejectFetch = reject; }),
    );
    const operation = searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config: { ...config, timeoutMs: 25 },
      fetchImpl,
    }).catch((error: unknown) => { observed = error; });
    try {
      await jest.advanceTimersByTimeAsync(25);
      expect(observed).toMatchObject({ code: 'TIMEOUT', retryable: true });
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      rejectFetch(new DOMException('test cleanup', 'AbortError'));
      await operation;
      jest.useRealTimers();
    }
  });

  it('rejects oversized and malformed JSON responses', async () => {
    await expect(searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config: { ...config, maxResponseBytes: 8 },
      fetchImpl: async () => response({ results: [] }),
    })).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });

    await expect(searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config,
      fetchImpl: async () => new Response('{', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    })).rejects.toMatchObject({ code: 'PROTOCOL_INVALID' });
  });

  it.each(['invalid', '-1', '16385'])(
    'rejects invalid or oversized Content-Length %s',
    async (contentLength) => {
      await expect(searchAriaRagV2({
        request: fixture.request,
        identityToken: fixture.jwt,
        config,
        fetchImpl: async () => new Response(JSON.stringify({
          results: [manifestBoundResult], filters_applied: {}, warnings: [],
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'content-length': contentLength,
          },
        }),
      })).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
    },
  );

  it('accepts a valid bounded Content-Length', async () => {
    const body = JSON.stringify({
      results: [manifestBoundResult], filters_applied: {}, warnings: [],
    });
    await expect(searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config,
      fetchImpl: async () => new Response(body, {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(body)),
        },
      }),
    })).resolves.toMatchObject({ results: [manifestBoundResult] });
  });

  it.each(['results', 'filters_applied', 'warnings'] as const)(
    'requires success response field %s',
    async (field) => {
      const body: Record<string, unknown> = {
        results: [manifestBoundResult], filters_applied: {}, warnings: [],
      };
      delete body[field];
      await expect(searchAriaRagV2({
        request: fixture.request,
        identityToken: fixture.jwt,
        config,
        fetchImpl: async () => response(body),
      })).rejects.toMatchObject({ code: 'PROTOCOL_INVALID' });
    },
  );

  it.each([
    'application/jsonp',
    'application/json-malicious',
    'text/json',
  ])('rejects non-JSON response media type %s', async (contentType) => {
    await expect(searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config,
      fetchImpl: async () => response({
        results: [manifestBoundResult], filters_applied: {}, warnings: [],
      }, { headers: { 'content-type': contentType } }),
    })).rejects.toMatchObject({ code: 'PROTOCOL_INVALID' });
  });

  it('accepts JSON with an explicit charset parameter', async () => {
    await expect(searchAriaRagV2({
      request: fixture.request,
      identityToken: fixture.jwt,
      config,
      fetchImpl: async () => response({
        results: [manifestBoundResult], filters_applied: {}, warnings: [],
      }, { headers: { 'content-type': 'application/json; charset=utf-8' } }),
    })).resolves.toMatchObject({ results: [manifestBoundResult] });
  });

  it('uses the canonical global fetch and maps provider failures without leaking details', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(response({
      results: [manifestBoundResult], filters_applied: {}, warnings: [],
    })).mockRejectedValueOnce(new Error('private endpoint unavailable'));
    try {
      await expect(searchAriaRagV2({
        request: fixture.request,
        identityToken: fixture.jwt,
        config,
      })).resolves.toMatchObject({ results: [manifestBoundResult] });
      await expect(searchAriaRagV2({
        request: fixture.request,
        identityToken: fixture.jwt,
        config,
      })).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', retryable: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('uses stable typed errors with no attached provider payload', () => {
    const error = new AriaRagEngineClientError('PROVIDER_UNAVAILABLE');
    expect(error.message).toBe('PROVIDER_UNAVAILABLE');
    expect(JSON.stringify(error)).not.toContain('providerPayload');
  });
});
