import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import retrievalRequestSchema from '@/data/aria/generated/rag-contracts/v1/retrieval-request.json';
import retrievalResponseSchema from '@/data/aria/generated/rag-contracts/v1/retrieval-response.json';
import retrievalErrorSchema from '@/data/aria/generated/rag-contracts/v1/retrieval-error.json';

export type AriaRagEngineClientErrorCode =
  | 'CONFIGURATION_INVALID'
  | 'REQUEST_INVALID'
  | 'PROTOCOL_INVALID'
  | 'RESPONSE_TOO_LARGE'
  | 'USER_CANCELLED'
  | 'PROVIDER_UNAVAILABLE'
  | 'NOT_CONFIGURED'
  | 'NO_RESULTS'
  | 'RUNTIME_UNAVAILABLE'
  | 'TIMEOUT'
  | 'INVALID_MANIFEST'
  | 'MANIFEST_VERSION_MISMATCH';

export class AriaRagEngineClientError extends Error {
  readonly code: AriaRagEngineClientErrorCode;
  readonly retryable: boolean;
  readonly upstreamRequestId?: string;

  constructor(
    code: AriaRagEngineClientErrorCode,
    options: { readonly retryable?: boolean; readonly upstreamRequestId?: string } = {},
  ) {
    super(code);
    this.name = 'AriaRagEngineClientError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.upstreamRequestId = options.upstreamRequestId;
  }
}

export interface AriaRagEngineClientConfig {
  readonly baseUrl: string;
  readonly serviceToken: string;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
}

type AriaRagFetch = (url: string, init?: RequestInit) => Promise<Response>;

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateRequest = ajv.compile(retrievalRequestSchema);
const validateResponse = ajv.compile(retrievalResponseSchema);
const validateError = ajv.compile(retrievalErrorSchema);

const CONFIGURATION_ERROR = 'ARIA_RAG_CLIENT_CONFIGURATION_INVALID';
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 5_000;
const DEFAULT_RESPONSE_BYTES = 262_144;
const MAX_RESPONSE_BYTES = 262_144;
const MAX_SERVICE_TOKEN_BYTES = 4_096;

function parsePositiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new Error(CONFIGURATION_ERROR);
  }
  return parsed;
}

function isValidServiceToken(value: string): boolean {
  const size = Buffer.byteLength(value, 'utf8');
  return size >= 32
    && size <= MAX_SERVICE_TOKEN_BYTES
    && Array.from(value).every((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x21 && code <= 0x7e;
    });
}

function normalizeBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(CONFIGURATION_ERROR);
  }
  if (!['http:', 'https:'].includes(url.protocol)
    || url.username || url.password || url.search || url.hash
    || url.pathname !== '/') {
    throw new Error(CONFIGURATION_ERROR);
  }
  return url.origin;
}

export function loadAriaRagEngineClientConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AriaRagEngineClientConfig {
  const rawBaseUrl = env.ARIA_RAG_ENGINE_BASE_URL?.trim() ?? '';
  const serviceToken = env.RAG_BFF_SERVICE_TOKEN?.trim() ?? '';
  if (!rawBaseUrl || !isValidServiceToken(serviceToken)) {
    throw new Error(CONFIGURATION_ERROR);
  }
  return Object.freeze({
    baseUrl: normalizeBaseUrl(rawBaseUrl),
    serviceToken,
    timeoutMs: parsePositiveInteger(
      env.ARIA_RAG_ENGINE_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    ),
    maxResponseBytes: parsePositiveInteger(
      env.ARIA_RAG_ENGINE_MAX_RESPONSE_BYTES,
      DEFAULT_RESPONSE_BYTES,
      MAX_RESPONSE_BYTES,
    ),
  });
}

function validateConfig(config: AriaRagEngineClientConfig): void {
  let normalizedBaseUrl: string;
  try {
    normalizedBaseUrl = normalizeBaseUrl(config.baseUrl);
  } catch {
    throw new AriaRagEngineClientError('CONFIGURATION_INVALID');
  }
  if (normalizedBaseUrl !== config.baseUrl
    || !isValidServiceToken(config.serviceToken)
    || !Number.isSafeInteger(config.timeoutMs) || config.timeoutMs <= 0
    || config.timeoutMs > MAX_TIMEOUT_MS
    || !Number.isSafeInteger(config.maxResponseBytes) || config.maxResponseBytes <= 0
    || config.maxResponseBytes > MAX_RESPONSE_BYTES) {
    throw new AriaRagEngineClientError('CONFIGURATION_INVALID');
  }
}

async function readBoundedResponse(response: Response, maxBytes: number): Promise<unknown> {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maxBytes) {
      throw new AriaRagEngineClientError('RESPONSE_TOO_LARGE');
    }
  }
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    throw new AriaRagEngineClientError('PROTOCOL_INVALID');
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  if (response.body) {
    const reader = response.body.getReader();
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        total += item.value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new AriaRagEngineClientError('RESPONSE_TOO_LARGE');
        }
        chunks.push(item.value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new AriaRagEngineClientError('PROTOCOL_INVALID');
  }
}

function validateManifestBoundResponse(request: unknown, response: unknown): void {
  if (!validateResponse(response)) throw new AriaRagEngineClientError('PROTOCOL_INVALID');
  const requestRecord = request as Record<string, unknown>;
  const responseRecord = response as Record<string, unknown>;
  if (!Array.isArray(responseRecord.results)
    || !Array.isArray(responseRecord.warnings)
    || typeof responseRecord.filters_applied !== 'object'
    || responseRecord.filters_applied === null) {
    throw new AriaRagEngineClientError('PROTOCOL_INVALID');
  }
  for (const item of responseRecord.results) {
    const hit = item as Record<string, unknown>;
    if (typeof hit.resource_id !== 'string'
      || typeof hit.resource_version_id !== 'string'
      || typeof hit.content_sha256 !== 'string'
      || typeof hit.locator !== 'object' || hit.locator === null
      || typeof hit.citation !== 'object' || hit.citation === null
      || hit.corpus_id !== requestRecord.corpus_id
      || hit.corpus_version_id !== requestRecord.corpus_version_id
      || hit.manifest_sha256 !== requestRecord.manifest_sha256) {
      throw new AriaRagEngineClientError('PROTOCOL_INVALID');
    }
  }
}

function mapUpstreamError(body: unknown): AriaRagEngineClientError {
  if (!validateError(body)) return new AriaRagEngineClientError('PROTOCOL_INVALID');
  const error = body as Record<string, unknown>;
  return new AriaRagEngineClientError(error.code as AriaRagEngineClientErrorCode, {
    retryable: error.retryable as boolean,
    upstreamRequestId: error.request_id as string,
  });
}

function waitForRagOperation<T>(startOperation: () => PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const complete = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      callback();
    };
    const onAbort = () => complete(() => reject(signal.reason));
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    let operation: PromiseLike<T>;
    try {
      operation = startOperation();
    } catch (error: unknown) {
      complete(() => reject(error));
      return;
    }
    Promise.resolve(operation).then(
      (value) => complete(() => resolve(value)),
      (error: unknown) => complete(() => reject(error)),
    );
  });
}

export async function searchAriaRagV2(input: {
  readonly request: unknown;
  readonly identityToken: string;
  readonly config: AriaRagEngineClientConfig;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: AriaRagFetch;
}): Promise<Record<string, unknown>> {
  validateConfig(input.config);
  if (!validateRequest(input.request) || !input.identityToken.trim()) {
    throw new AriaRagEngineClientError('REQUEST_INVALID');
  }
  if (input.signal?.aborted) throw new AriaRagEngineClientError('USER_CANCELLED');

  const controller = new AbortController();
  let abortKind: 'TIMEOUT' | 'USER_CANCELLED' | undefined;
  const abortOnce = (kind: 'TIMEOUT' | 'USER_CANCELLED') => {
    if (abortKind !== undefined) return;
    abortKind = kind;
    controller.abort(kind);
  };
  const cancelFromCaller = () => abortOnce('USER_CANCELLED');
  input.signal?.addEventListener('abort', cancelFromCaller, { once: true });
  const timeout = setTimeout(() => abortOnce('TIMEOUT'), input.config.timeoutMs);

  try {
    return await waitForRagOperation(async () => {
      const response = await (input.fetchImpl ?? fetch)(`${input.config.baseUrl}/search/v2`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${input.config.serviceToken}`,
          'content-type': 'application/json',
          'x-nexus-identity': input.identityToken,
        },
        body: JSON.stringify(input.request),
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      const body = await readBoundedResponse(response, input.config.maxResponseBytes);
      if (!response.ok) throw mapUpstreamError(body);
      validateManifestBoundResponse(input.request, body);
      return body as Record<string, unknown>;
    }, controller.signal);
  } catch (error: unknown) {
    if (error instanceof AriaRagEngineClientError) throw error;
    if (abortKind) throw new AriaRagEngineClientError(abortKind, { retryable: abortKind === 'TIMEOUT' });
    throw new AriaRagEngineClientError('PROVIDER_UNAVAILABLE', { retryable: true });
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', cancelFromCaller);
  }
}
