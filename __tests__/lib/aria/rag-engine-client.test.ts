import fixture from '@/data/aria/generated/rag-contracts/v1/fixtures/internal-identity-envelope-v1.json';
import {
  AriaRagEngineClientError,
  loadAriaRagEngineClientConfig,
  searchAriaRagV2,
} from '@/lib/aria/infrastructure/rag/rag-engine-client';

const config = Object.freeze({
  baseUrl: 'https://rag.internal.example',
  serviceToken: 't'.repeat(32),
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
      ARIA_RAG_ENGINE_BASE_URL: 'https://rag.internal.example',
      RAG_BFF_SERVICE_TOKEN: 't'.repeat(32),
    };
    expect(loadAriaRagEngineClientConfig(required)).toEqual({
      baseUrl: 'https://rag.internal.example',
      serviceToken: 't'.repeat(32),
      timeoutMs: 5_000,
      maxResponseBytes: 262_144,
    });
    expect(loadAriaRagEngineClientConfig({
      ...required,
      ARIA_RAG_ENGINE_TIMEOUT_MS: '4999',
      ARIA_RAG_ENGINE_MAX_RESPONSE_BYTES: '262143',
    })).toMatchObject({ timeoutMs: 4_999, maxResponseBytes: 262_143 });
  });

  it.each([
    { ...config, baseUrl: 'not a URL' },
    { ...config, baseUrl: 'https://rag.internal.example/search' },
    { ...config, serviceToken: `${'t'.repeat(31)}\n` },
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
      ARIA_RAG_ENGINE_BASE_URL: 'https://user:password@rag.example/search',
      RAG_BFF_SERVICE_TOKEN: 't'.repeat(32),
    })).toThrow('ARIA_RAG_CLIENT_CONFIGURATION_INVALID');
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

  it('uses stable typed errors with no attached provider payload', () => {
    const error = new AriaRagEngineClientError('PROVIDER_UNAVAILABLE');
    expect(error.message).toBe('PROVIDER_UNAVAILABLE');
    expect(JSON.stringify(error)).not.toContain('providerPayload');
  });
});
