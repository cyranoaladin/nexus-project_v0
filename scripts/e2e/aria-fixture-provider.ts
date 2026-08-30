import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import manifest from '../../data/aria/testing/rag/debbfb31c0a95e3e16ff33772f0626856e8dc01c52faab8270820b7f4374608a.json';
import { sha256AriaRagJson } from '../../lib/aria/infrastructure/rag/internal-identity';

type Environment = Readonly<Record<string, string | undefined>>;
type JsonRecord = Record<string, unknown>;

const MAX_BODY_BYTES = 256 * 1024;

export interface AriaE2EFixtureProviderHandle {
  readonly baseUrl: string;
  readonly close: () => Promise<void>;
}

interface FixtureConfiguration {
  readonly adminToken: string;
  readonly modelToken: string;
  readonly ragToken: string;
  readonly identityKey: string;
  readonly identityIssuer: string;
  readonly identityAudience: string;
  readonly issuer: string;
  readonly audience: string;
}

interface FixtureState {
  modelInvocations: number;
  ragInvocations: number;
  rejectedIdentityRequests: number;
  cancelledModelStreams: number;
  activeModelStreams: number;
  handlerErrors: number;
  lastHandlerError: string | null;
}

function configured(environment: Environment): FixtureConfiguration {
  if (environment.E2E_DISPOSABLE_STACK !== '1') {
    throw new Error('ARIA_E2E_FIXTURE_FORBIDDEN');
  }
  const configuration = {
    adminToken: environment.ARIA_E2E_FIXTURE_ADMIN_TOKEN ?? '',
    modelToken: environment.ARIA_E2E_MODEL_API_KEY ?? '',
    ragToken: environment.RAG_BFF_SERVICE_TOKEN ?? '',
    identityKey: environment.NEXUS_INTERNAL_TOKEN_SECRET ?? '',
    identityIssuer: environment.NEXUS_SSO_ISSUER ?? '',
    identityAudience: environment.NEXUS_SSO_AUDIENCE ?? '',
    issuer: environment.NEXUS_INTERNAL_TOKEN_ISSUER ?? '',
    audience: environment.NEXUS_INTERNAL_TOKEN_AUDIENCE ?? '',
  };
  if (Object.values(configuration).some((value) => Buffer.byteLength(value, 'utf8') < 3)
    || [configuration.adminToken, configuration.modelToken, configuration.ragToken,
      configuration.identityKey].some((value) => Buffer.byteLength(value, 'utf8') < 32)) {
    throw new Error('ARIA_E2E_FIXTURE_CONFIGURATION_INVALID');
  }
  return Object.freeze(configuration);
}

function sameSecret(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const left = Buffer.from(received, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function bearer(request: IncomingMessage): string | undefined {
  const value = request.headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice(7) : undefined;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const bytes = Buffer.from(JSON.stringify(body), 'utf8');
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(bytes.byteLength),
    'cache-control': 'no-store',
  });
  response.end(bytes);
}

async function readJson(request: IncomingMessage): Promise<JsonRecord> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_BODY_BYTES) throw new Error('ARIA_E2E_FIXTURE_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ARIA_E2E_FIXTURE_BODY_INVALID');
  }
  return parsed as JsonRecord;
}

function decodeJsonSegment(segment: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as JsonRecord
      : null;
  } catch {
    return null;
  }
}

function verifiedIdentity(input: {
  readonly token: string | undefined;
  readonly request: JsonRecord;
  readonly corpus: (typeof manifest.corpora)[number];
  readonly config: FixtureConfiguration;
}): boolean {
  const parts = input.token?.split('.') ?? [];
  if (parts.length !== 3) return false;
  const header = decodeJsonSegment(parts[0]);
  const envelope = decodeJsonSegment(parts[1]);
  if (!header || !envelope || header.alg !== 'HS256' || header.typ !== 'JWT') return false;
  const expectedSignature = createHmac('sha256', input.config.identityKey)
    .update(`${parts[0]}.${parts[1]}`, 'ascii')
    .digest();
  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(parts[2], 'base64url');
  } catch {
    return false;
  }
  if (receivedSignature.length !== expectedSignature.length
    || !timingSafeEqual(receivedSignature, expectedSignature)) return false;
  const identity = envelope.identity;
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) return false;
  const nested = identity as JsonRecord;
  const pedagogicalProfile = nested.pedagogical_profile;
  const studentProfile = input.request.student_profile;
  const curriculumScope = input.request.curriculum_scope;
  if (!pedagogicalProfile || typeof pedagogicalProfile !== 'object' || Array.isArray(pedagogicalProfile)
    || !studentProfile || typeof studentProfile !== 'object' || Array.isArray(studentProfile)
    || !curriculumScope || typeof curriculumScope !== 'object' || Array.isArray(curriculumScope)) return false;
  const profile = pedagogicalProfile as JsonRecord;
  const student = studentProfile as JsonRecord;
  const curriculum = curriculumScope as JsonRecord;
  const target = input.corpus.retrieval_scope.target_policy;
  const now = Math.floor(Date.now() / 1_000);
  return envelope.protocol_version === '1'
    && envelope.iss === input.config.issuer
    && envelope.aud === input.config.audience
    && nested.iss === input.config.identityIssuer
    && nested.aud === input.config.identityAudience
    && envelope.sub === nested.sub
    && envelope.jti === nested.jti
    && typeof envelope.iat === 'number'
    && typeof envelope.exp === 'number'
    && envelope.iat <= now + 5
    && envelope.exp >= now
    && envelope.exp <= envelope.iat + 30
    && typeof nested.exp === 'number'
    && envelope.exp <= (nested.exp as number)
    && nested.tenant === target.tenant
    && typeof nested.role === 'string'
    && target.roles.includes(nested.role)
    && nested.niveau === target.niveau
    && nested.school_year === student.school_year
    && profile.voie === target.voie
    && profile.statut_enseignement === target.statut_enseignement
    && typeof profile.candidat === 'string'
    && target.candidates.includes(profile.candidat)
    && typeof profile.audience === 'string'
    && target.audiences.includes(profile.audience)
    && Array.isArray(profile.matieres)
    && profile.matieres.includes(target.matiere)
    && student.niveau === target.niveau
    && student.voie === target.voie
    && Array.isArray(student.matieres)
    && student.matieres.includes(target.matiere)
    && student.statut_enseignement === target.statut_enseignement
    && curriculum.niveau === target.niveau
    && curriculum.voie === target.voie
    && curriculum.matiere === target.matiere
    && curriculum.statut_enseignement === target.statut_enseignement
    && envelope.manifest_sha256 === manifest.manifest_sha256
    && envelope.request_sha256 === sha256AriaRagJson(input.request)
    && envelope.scope_id === input.corpus.retrieval_scope.scope_id
    && envelope.scope_digest === sha256AriaRagJson(input.corpus.retrieval_scope)
    && Array.isArray(envelope.allowed_collections)
    && envelope.allowed_collections.length === 1
    && envelope.allowed_collections[0] === input.corpus.physical_collection;
}

function indexDocument(): JsonRecord {
  const payload = {
    protocol_version: '1',
    producer_repository: manifest.producer_repository,
    producer_commit: manifest.producer_commit,
    generated_at: manifest.generated_at,
    resource_registry_sha256: manifest.resource_registry_sha256,
    active_manifest_sha256: manifest.manifest_sha256,
    supported_manifests: [{
      manifest_version: manifest.manifest_version,
      manifest_sha256: manifest.manifest_sha256,
      retire_at: null,
    }],
  };
  return { ...payload, index_sha256: sha256AriaRagJson(payload) };
}

function retrievalError(response: ServerResponse, code: string, retryable: boolean): void {
  sendJson(response, 503, {
    code,
    request_id: 'aria-e2e-rag-request',
    retryable,
  });
}

async function handleRagSearch(
  request: IncomingMessage,
  response: ServerResponse,
  config: FixtureConfiguration,
  state: FixtureState,
): Promise<void> {
  if (!sameSecret(bearer(request), config.ragToken)) {
    sendJson(response, 401, { code: 'RUNTIME_UNAVAILABLE', request_id: 'aria-e2e-auth', retryable: false });
    return;
  }
  const body = await readJson(request);
  const corpus = manifest.corpora.find((candidate) =>
    candidate.corpus_id === body.corpus_id
    && candidate.corpus_version_id === body.corpus_version_id);
  if (!corpus || body.manifest_sha256 !== manifest.manifest_sha256
    || !verifiedIdentity({
      token: request.headers['x-nexus-identity'] as string | undefined,
      request: body,
      corpus,
      config,
    })) {
    state.rejectedIdentityRequests += 1;
    sendJson(response, 403, { code: 'INVALID_MANIFEST', request_id: 'aria-e2e-identity', retryable: false });
    return;
  }
  state.ragInvocations += 1;
  const need = body.need as JsonRecord;
  const query = typeof need?.query === 'string' ? need.query : '';
  if (query.includes('[RAG_UNAVAILABLE]')) {
    retrievalError(response, 'RUNTIME_UNAVAILABLE', true);
    return;
  }
  if (query.includes('[RAG_TIMEOUT]')) {
    const timer = setTimeout(() => retrievalError(response, 'TIMEOUT', true), 60_000);
    timer.unref();
    request.once('close', () => clearTimeout(timer));
    return;
  }
  const resource = corpus.resources[0];
  const chunk = resource.chunks[0];
  const isMaths = corpus.corpus_id === 'aria-maths-terminale';
  sendJson(response, 200, {
    results: query.includes('[NO_RESULTS]') ? [] : [{
      chunk_id: chunk.chunk_id,
      doc_id: resource.resource_version_id,
      score: 0.99,
      title: isMaths ? 'Programme officiel de mathématiques ARIA E2E' : 'Programme officiel de NSI ARIA E2E',
      excerpt: isMaths
        ? 'Lorsque la dérivée est positive sur un intervalle, la fonction y est croissante.'
        : 'Une pile suit le principe dernier entré, premier sorti.',
      citation: {
        source_label: 'Ministère de l’Éducation nationale',
        source_uri: 'https://www.education.gouv.fr/programmes-scolaires',
        rights: 'officiel_public',
        page: null,
      },
      metadata: {},
      resource_id: resource.resource_id,
      resource_version_id: resource.resource_version_id,
      content_sha256: resource.content_sha256,
      locator: chunk.locator,
      corpus_id: corpus.corpus_id,
      corpus_version_id: corpus.corpus_version_id,
      manifest_sha256: manifest.manifest_sha256,
    }],
    filters_applied: {},
    warnings: [],
  });
}

function modelPrompt(body: JsonRecord): string {
  if (!Array.isArray(body.messages)) return '';
  return body.messages.map((message) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return '';
    const content = (message as JsonRecord).content;
    return typeof content === 'string' ? content : '';
  }).join('\n');
}

function modelChunk(content: string, finishReason: string | null = null): string {
  return `data: ${JSON.stringify({
    id: 'aria-e2e-completion',
    object: 'chat.completion.chunk',
    created: 1788091200,
    model: 'aria-e2e',
    choices: [{ index: 0, delta: content ? { content } : {}, finish_reason: finishReason }],
  })}\n\n`;
}

function trackModelStream(response: ServerResponse, state: FixtureState): void {
  let settled = false;
  state.activeModelStreams += 1;
  const settle = (cancelled: boolean) => {
    if (settled) return;
    settled = true;
    state.activeModelStreams -= 1;
    if (cancelled) state.cancelledModelStreams += 1;
  };
  response.once('finish', () => settle(false));
  response.once('close', () => settle(!response.writableEnded));
}

function controlledDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  });
}

async function handleModel(
  request: IncomingMessage,
  response: ServerResponse,
  config: FixtureConfiguration,
  state: FixtureState,
): Promise<void> {
  if (!sameSecret(bearer(request), config.modelToken)) {
    sendJson(response, 401, { error: { code: 'unauthorized' } });
    return;
  }
  const body = await readJson(request);
  if (body.stream !== true || !Array.isArray(body.messages)) {
    sendJson(response, 400, { error: { code: 'invalid_request' } });
    return;
  }
  state.modelInvocations += 1;
  const prompt = modelPrompt(body);
  if (prompt.includes('[MODEL_UNAVAILABLE]')) {
    sendJson(response, 503, { error: { code: 'provider_unavailable' } });
    return;
  }
  if (prompt.includes('[MODEL_TIMEOUT]')) {
    const timer = setTimeout(() => response.end(), 60_000);
    timer.unref();
    request.once('close', () => clearTimeout(timer));
    return;
  }
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  response.flushHeaders();
  trackModelStream(response, state);
  const tokens = prompt.includes('[HOSTILE_ASSISTANT_OUTPUT]')
    ? ['<script>window.__ariaXss=1</script>', '<img src=x onerror="window.__ariaXss=1">', 'javascript:alert(1) data:text/html,unsafe']
    : prompt.includes('[STREAM_500]')
    ? Array.from({ length: 500 }, (_, index) => `${index} `)
    : prompt.includes('Discipline : Mathématiques')
      ? ['Une dérivée positive ', 'sur un intervalle signifie que ', 'la fonction y est croissante.']
      : ['Une pile ', 'fonctionne en dernier entré, ', 'premier sorti.'];
  response.write(modelChunk(tokens[0]));
  if (prompt.includes('[CANCEL]')) {
    return;
  }
  if (prompt.includes('[RETRY_AFTER_FIRST_DELTA]')) {
    await controlledDelay(300);
    if (response.destroyed || response.writableEnded) return;
  }
  for (const [index, token] of tokens.slice(1).entries()) {
    response.write(modelChunk(token));
    if (prompt.includes('[STREAM_500]') && (index + 1) % 25 === 0) {
      await controlledDelay(5);
    }
  }
  response.write(modelChunk('', 'stop'));
  response.end('data: [DONE]\n\n');
}

export async function startAriaE2EFixtureProvider(input: {
  readonly environment?: Environment;
  readonly host?: string;
  readonly port?: number;
}): Promise<AriaE2EFixtureProviderHandle> {
  const environment = input.environment ?? process.env;
  const config = configured(environment);
  const state: FixtureState = {
    modelInvocations: 0,
    ragInvocations: 0,
    rejectedIdentityRequests: 0,
    cancelledModelStreams: 0,
    activeModelStreams: 0,
    handlerErrors: 0,
    lastHandlerError: null,
  };
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://aria-e2e.invalid');
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { status: 'READY', manifestSha256: manifest.manifest_sha256 });
      } else if (request.method === 'GET' && url.pathname === '/corpora/servable/v1') {
        if (!sameSecret(bearer(request), config.ragToken)) sendJson(response, 401, { code: 'RUNTIME_UNAVAILABLE' });
        else sendJson(response, 200, indexDocument());
      } else if (request.method === 'GET'
        && url.pathname === `/corpora/servable/v1/${manifest.manifest_sha256}`) {
        if (!sameSecret(bearer(request), config.ragToken)) sendJson(response, 401, { code: 'RUNTIME_UNAVAILABLE' });
        else sendJson(response, 200, manifest);
      } else if (request.method === 'POST' && url.pathname === '/search/v2') {
        await handleRagSearch(request, response, config, state);
      } else if (request.method === 'POST' && url.pathname === '/v1/chat/completions') {
        await handleModel(request, response, config, state);
      } else if (request.method === 'GET' && url.pathname === '/__e2e/state') {
        if (!sameSecret(bearer(request), config.adminToken)) sendJson(response, 403, { code: 'FORBIDDEN' });
        else sendJson(response, 200, state);
      } else if (request.method === 'POST' && url.pathname === '/__e2e/reset') {
        if (!sameSecret(bearer(request), config.adminToken)) sendJson(response, 403, { code: 'FORBIDDEN' });
        else if (state.activeModelStreams !== 0) {
          sendJson(response, 409, { code: 'ACTIVE_MODEL_STREAMS', activeModelStreams: state.activeModelStreams });
        }
        else {
          state.modelInvocations = 0;
          state.ragInvocations = 0;
          state.rejectedIdentityRequests = 0;
          state.cancelledModelStreams = 0;
          state.handlerErrors = 0;
          state.lastHandlerError = null;
          sendJson(response, 200, state);
        }
      } else {
        sendJson(response, 404, { code: 'NOT_FOUND' });
      }
    })().catch((error: unknown) => {
      state.handlerErrors += 1;
      state.lastHandlerError = error instanceof Error
        ? error.message.slice(0, 160)
        : 'UNKNOWN_HANDLER_ERROR';
      if (!response.headersSent) sendJson(response, 400, { code: 'INVALID_REQUEST' });
      else response.destroy();
    });
  });
  const host = input.host ?? '127.0.0.1';
  const port = input.port ?? 4010;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('ARIA_E2E_FIXTURE_LISTEN_FAILED');
  return Object.freeze({
    baseUrl: `http://${host}:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => error ? reject(error) : resolve());
    }),
  });
}

if (require.main === module) {
  startAriaE2EFixtureProvider({
    host: process.env.ARIA_E2E_FIXTURE_HOST ?? '0.0.0.0',
    port: Number(process.env.ARIA_E2E_FIXTURE_PORT ?? '4010'),
  }).then(({ baseUrl }) => {
    process.stdout.write(`ARIA_E2E_FIXTURE_READY=${baseUrl}\n`);
  }).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'ARIA_E2E_FIXTURE_START_FAILED'}\n`);
    process.exitCode = 1;
  });
}
