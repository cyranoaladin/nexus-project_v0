import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import servableCorpusIndexSchema from '../../data/aria/generated/rag-contracts/v1/servable-corpus-index-v1.json';
import servableCorpusManifestSchema from '../../data/aria/generated/rag-contracts/v1/servable-corpus-manifest-v1.json';
import { ARIA_RESOURCE_REGISTRY_SHA256 } from '../../lib/aria/manifests/resource-registry';
import { sha256AriaRagJson } from '../../lib/aria/infrastructure/rag/internal-identity';

type JsonRecord = Record<string, unknown>;
const MAX_RUNTIME_MANIFEST_BYTES = 2 * 1024 * 1024;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateIndex = ajv.compile(servableCorpusIndexSchema);
const validateManifest = ajv.compile(servableCorpusManifestSchema);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withoutKey(value: JsonRecord, key: string): JsonRecord {
  return Object.fromEntries(Object.entries(value).filter(([candidate]) => candidate !== key));
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function verifyLocalRagContractLock(repositoryRoot: string): void {
  const lock = readJson(resolve(repositoryRoot, 'data/aria/rag/contracts.lock.json'));
  if (!isRecord(lock) || lock.producerRepository !== 'cyranoaladin/RAG'
    || typeof lock.producerCommit !== 'string' || !/^[0-9a-f]{40}$/.test(lock.producerCommit)
    || !isRecord(lock.schemas) || !isRecord(lock.fixtures)) {
    throw new Error('ARIA_RAG_CONTRACT_LOCK_INVALID');
  }
  for (const [filename, identity] of [
    ...Object.entries(lock.schemas).map(([name, value]) => [`${name}`, value] as const),
    ...Object.entries(lock.fixtures).map(([name, value]) => [`fixtures/${name}`, value] as const),
  ]) {
    if (!isRecord(identity) || typeof identity.sha256 !== 'string') {
      throw new Error(`ARIA_RAG_CONTRACT_IDENTITY_INVALID:${filename}`);
    }
    const bytes = readFileSync(resolve(repositoryRoot, 'data/aria/generated/rag-contracts/v1', filename));
    if (createHash('sha256').update(bytes).digest('hex') !== identity.sha256) {
      throw new Error(`ARIA_RAG_CONTRACT_BYTES_DRIFT:${filename}`);
    }
  }
}

export type AriaStaticManifestReport = Readonly<{
  status: 'NOT_CONFIGURED' | 'CONFIGURED';
  reasonCode: string;
  ragMappingSourcesOfTruth: 1;
  resourceIdentitySourcesOfTruth: 1;
  ragDocumentIdentitySourcesOfTruth: 1;
}>;

function validateIndexIdentity(index: unknown): asserts index is JsonRecord {
  if (!validateIndex(index) || !isRecord(index)) throw new Error('ARIA_RAG_INDEX_SCHEMA_INVALID');
  if (sha256AriaRagJson(withoutKey(index, 'index_sha256')) !== index.index_sha256) {
    throw new Error('ARIA_RAG_INDEX_DIGEST_MISMATCH');
  }
  if (index.resource_registry_sha256 !== ARIA_RESOURCE_REGISTRY_SHA256) {
    throw new Error('ARIA_RAG_INDEX_RESOURCE_REGISTRY_MISMATCH');
  }
  const supported = index.supported_manifests as JsonRecord[];
  const digests = supported.map((item) => item.manifest_sha256);
  if (new Set(digests).size !== digests.length || !digests.includes(index.active_manifest_sha256)) {
    throw new Error('ARIA_RAG_INDEX_WINDOW_INVALID');
  }
}

function validateManifestIdentity(manifest: unknown, expectedDigest: string): void {
  if (!validateManifest(manifest) || !isRecord(manifest)) {
    throw new Error('ARIA_RAG_MANIFEST_SCHEMA_INVALID');
  }
  if (manifest.manifest_sha256 !== expectedDigest
    || sha256AriaRagJson(withoutKey(manifest, 'manifest_sha256')) !== expectedDigest) {
    throw new Error('ARIA_RAG_MANIFEST_DIGEST_MISMATCH');
  }
  if (manifest.resource_registry_sha256 !== ARIA_RESOURCE_REGISTRY_SHA256) {
    throw new Error('ARIA_RAG_MANIFEST_RESOURCE_REGISTRY_MISMATCH');
  }
}

export function inspectAriaStaticManifestContract(repositoryRoot: string): AriaStaticManifestReport {
  verifyLocalRagContractLock(repositoryRoot);
  const indexPath = resolve(repositoryRoot, 'data/aria/rag/servable-corpus-index.lock.json');
  try {
    const index = readJson(indexPath);
    validateIndexIdentity(index);
    return Object.freeze({
      status: 'CONFIGURED' as const,
      reasonCode: 'SERVABLE_INDEX_STATICALLY_VALID',
      ragMappingSourcesOfTruth: 1 as const,
      resourceIdentitySourcesOfTruth: 1 as const,
      ragDocumentIdentitySourcesOfTruth: 1 as const,
    });
  } catch (error: unknown) {
    if (isRecord(error) && error.code === 'ENOENT') {
      return Object.freeze({
        status: 'NOT_CONFIGURED' as const,
        reasonCode: 'SERVABLE_INDEX_NOT_PROMOTED',
        ragMappingSourcesOfTruth: 1 as const,
        resourceIdentitySourcesOfTruth: 1 as const,
        ragDocumentIdentitySourcesOfTruth: 1 as const,
      });
    }
    throw error;
  }
}

async function fetchBoundedJson(
  url: URL,
  token: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`ARIA_RAG_RUNTIME_HTTP_${response.status}`);
  const contentLength = Number(response.headers.get('content-length') ?? '0');
  if (contentLength > MAX_RUNTIME_MANIFEST_BYTES) throw new Error('ARIA_RAG_RUNTIME_RESPONSE_TOO_LARGE');
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_RUNTIME_MANIFEST_BYTES) {
    throw new Error('ARIA_RAG_RUNTIME_RESPONSE_TOO_LARGE');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('ARIA_RAG_RUNTIME_JSON_INVALID');
  }
}

export async function verifyAriaRuntimeManifestEndpoint(input: Readonly<{
  baseUrl: string;
  serviceToken: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}>): Promise<Readonly<{ indexSha256: string; manifestCount: number; activeManifestSha256: string }>> {
  const baseUrl = new URL(input.baseUrl);
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname);
  if (baseUrl.protocol !== 'https:' && !(baseUrl.protocol === 'http:' && loopback)) {
    throw new Error('ARIA_RAG_RUNTIME_BASE_URL_INSECURE');
  }
  if (baseUrl.username || baseUrl.password || input.serviceToken.trim().length < 16) {
    throw new Error('ARIA_RAG_RUNTIME_CONFIGURATION_INVALID');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('ARIA_RAG_RUNTIME_TIMEOUT'), input.timeoutMs ?? 5_000);
  timer.unref?.();
  try {
    const fetchImpl = input.fetchImpl ?? fetch;
    const indexUrl = new URL('/corpora/servable/v1', baseUrl);
    const index = await fetchBoundedJson(indexUrl, input.serviceToken, fetchImpl, controller.signal);
    validateIndexIdentity(index);
    const manifests = index.supported_manifests as JsonRecord[];
    for (const supported of manifests) {
      const digest = String(supported.manifest_sha256);
      const manifest = await fetchBoundedJson(
        new URL(`/corpora/servable/v1/${digest}`, baseUrl),
        input.serviceToken,
        fetchImpl,
        controller.signal,
      );
      validateManifestIdentity(manifest, digest);
    }
    return Object.freeze({
      indexSha256: String(index.index_sha256),
      manifestCount: manifests.length,
      activeManifestSha256: String(index.active_manifest_sha256),
    });
  } finally {
    clearTimeout(timer);
  }
}

function readMode(): 'static' | 'runtime' {
  const index = process.argv.indexOf('--mode');
  const mode = index >= 0 ? process.argv[index + 1] : undefined;
  if (mode === 'static' || mode === 'runtime') return mode;
  throw new Error('ARIA_RAG_MANIFEST_CHECK_MODE_REQUIRED');
}

export function resolveAriaRuntimeManifestConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{ baseUrl: string; serviceToken: string }> {
  const baseUrl = environment.ARIA_RAG_ENGINE_BASE_URL;
  const serviceToken = environment.RAG_BFF_SERVICE_TOKEN;
  if (!baseUrl || !serviceToken) throw new Error('ARIA_RAG_RUNTIME_CONFIGURATION_REQUIRED');
  return Object.freeze({ baseUrl, serviceToken });
}

async function main(): Promise<void> {
  const mode = readMode();
  if (mode === 'static') {
    const report = inspectAriaStaticManifestContract(process.cwd());
    process.stdout.write(`ARIA_RAG_MANIFEST_STATUS=${report.status}\n`);
    process.stdout.write(`ARIA_RAG_MANIFEST_REASON=${report.reasonCode}\n`);
    process.stdout.write(`RAG_MAPPING_SOURCES_OF_TRUTH=${report.ragMappingSourcesOfTruth}\n`);
    process.stdout.write(`RESOURCE_IDENTITY_SOURCES_OF_TRUTH=${report.resourceIdentitySourcesOfTruth}\n`);
    process.stdout.write(`RAG_DOCUMENT_IDENTITY_SOURCES_OF_TRUTH=${report.ragDocumentIdentitySourcesOfTruth}\n`);
    return;
  }
  const { baseUrl, serviceToken } = resolveAriaRuntimeManifestConfiguration(process.env);
  const report = await verifyAriaRuntimeManifestEndpoint({ baseUrl, serviceToken });
  process.stdout.write(`ARIA_RAG_RUNTIME_INDEX_SHA256=${report.indexSha256}\n`);
  process.stdout.write(`ARIA_RAG_RUNTIME_MANIFEST_COUNT=${report.manifestCount}\n`);
  process.stdout.write(`ARIA_RAG_RUNTIME_ACTIVE_MANIFEST_SHA256=${report.activeManifestSha256}\n`);
}

if (require.main === module) void main();
