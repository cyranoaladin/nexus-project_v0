/**
 * Real ClamAV integration (mission §2/§3) — explicitly separated from the
 * mocked unit coverage in submission-pipeline.test.ts. This exercises the
 * ACTUAL official clamd daemon over its own native INSTREAM wire protocol on
 * a plain TCP socket — no `docker exec`, no external clamdscan binary — and
 * never a fabricated verdict. Missing infrastructure FAILS the suite; it is
 * never skipped.
 *
 * Engine lifecycle (see `startEngine`):
 *  - CI: the workflow's `clamav` service container is used when
 *    DIAGNOSTIC_AV_CLAMD_TCP_HOST/PORT are exported (same pinned digest, see
 *    .github/governance/container-images.json).
 *  - Local: otherwise this file starts the SAME image, pinned by digest, on a
 *    loopback ephemeral port, waits for the image's own Docker HEALTHCHECK
 *    plus a protocol-level PING/VERSION, and removes it afterwards.
 *
 * Pinning: the image is addressed by digest, never by tag. Its signature
 * database is the one baked into that digest (freshclam is disabled locally),
 * so image + signatures are one immutable, reproducible unit
 * (ClamAV 1.4.6, daily signature set 28136).
 *
 * Fault injection (timeout / cut socket / invalid reply) uses a throw-away
 * loopback TCP server that speaks (or breaks) the clamd wire format. A real
 * daemon cannot be made to misbehave on demand; the server never produces a
 * "clean" verdict that a test then relies on — every such case must REFUSE.
 *
 * Naming: `.real.test.ts`, same convention as the rest of this codebase's
 * real-infrastructure-dependent suites (jest.unit.config.js excludes this
 * pattern from the mocked unit lane on purpose).
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { connect, createServer, type Server, type Socket } from 'node:net';
import { resolve, join } from 'node:path';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { writeNpcStorageFileAtomic } from '@/lib/npc/storage-root';
import { scanDiagnosticSubmissionFile } from '@/lib/core-v2/diagnostics/virus-scan';
import { scanPrivateFile } from '@/lib/security/private-file-antivirus';
import { writeDiagnosticStorageFile, diagnosticsStorageRoot } from '@/lib/core-v2/diagnostics/storage';
import { saveAttachment } from '@/lib/espace/files';
import { prisma } from '@/lib/prisma';
import { POST as adminDocumentsPost } from '@/app/api/admin/documents/route';
import { POST as coachDocumentsPost } from '@/app/api/coach/students/[studentId]/documents/route';

// ── Collaborators that are NOT the antivirus authority (auth, DB, CSRF, rate
// limit) are stubbed; the scanner, the filesystem and the route/service code
// under test are all real. ───────────────────────────────────────────────────
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    espaceWorkAttachment: { count: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
    student: { findFirst: jest.fn() },
    userDocument: { create: jest.fn() },
  },
}));
jest.mock('@/lib/espace/access', () => ({ loadWorkForActor: jest.fn() }));
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  requireRole: jest.fn(),
  isErrorResponse: (value: unknown) => value instanceof Response,
}));
// ESM-only package; only its unique-id generation is needed here.
jest.mock('@paralleldrive/cuid2', () => ({ createId: () => `doc${randomUUID().replace(/-/g, '')}` }));
jest.mock('@/lib/csrf',() => ({ checkCsrf: () => null }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: async () => null }));
jest.mock('@/lib/rbac/coach-student-access', () => ({ assertCoachCanAccessStudent: async () => undefined }));

// ── Pinned engine ───────────────────────────────────────────────────────────
/** Same digest as `ci-clamav-native-instream` in .github/governance/container-images.json. */
const CLAMAV_IMAGE_DIGEST = 'sha256:57deb108fc4c72778aa83eafbca7bb7153e28c3f57c005afd38d31f16da86f23';
const CLAMAV_IMAGE = `clamav/clamav@${CLAMAV_IMAGE_DIGEST}`;
const ENGINE_VERSION_PREFIX = 'ClamAV 1.4.6/';
/** Daily signature set baked into the pinned digest (freshclam disabled locally => exact). */
const PINNED_SIGNATURE_VERSION = 28136;
/** Upper bound for pulling the image if absent, starting clamd and loading ~3.6M signatures. */
const ENGINE_START_BUDGET_MS = 180_000;
/** Contract of lib/security/private-file-antivirus.ts: the scan is bounded at 45 s end to end. */
const SCAN_TIMEOUT_MS = 45_000;

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const EICAR_BYTES = Buffer.from(EICAR);

/**
 * ClamAV only recognises the EICAR hash signature on a file that IS the EICAR
 * string. Upload paths gate on type first, so the realistic malicious upload
 * is a PDF whose stream carries it — which the real engine unpacks and flags.
 */
const EICAR_PDF = Buffer.concat([
  Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${EICAR_BYTES.length} >>\nstream\n`),
  EICAR_BYTES,
  Buffer.from('\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'),
]);
const CLEAN_PDF = Buffer.from('%PDF-1.4\nharmless synthetic content, no signature match expected\n%%EOF\n');

interface Engine {
  host: string;
  port: number;
  version: string;
  container?: string;
}

let engine: Engine;
let startedContainer: string | undefined;
let createdStorageRoot: string | undefined;
const envBackup: Record<string, string | undefined> = {};
const ENV_KEYS = ['DIAGNOSTIC_AV_MODE', 'DIAGNOSTIC_AV_CLAMD_TCP_HOST', 'DIAGNOSTIC_AV_CLAMD_TCP_PORT', 'DOCUMENT_STORAGE_ROOT'] as const;

function docker(...args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** One clamd command on a fresh connection: `zCOMMAND\0` -> NUL-terminated reply. */
function clamdCommand(host: string, port: number, command: string): Promise<string> {
  return new Promise((resolveReply, reject) => {
    const socket = connect(port, host);
    let reply = '';
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('clamd command timeout')); }, 5_000);
    socket.on('connect', () => socket.write(`z${command}\0`));
    socket.on('data', chunk => { reply += chunk.toString('utf8'); });
    socket.on('error', error => { clearTimeout(timer); reject(error); });
    socket.on('close', () => { clearTimeout(timer); resolveReply(reply.replace(/\0+$/, '')); });
  });
}

async function waitUntilHealthy(host: string, port: number, container: string | undefined): Promise<string> {
  const deadline = Date.now() + ENGINE_START_BUDGET_MS;
  let lastProblem = 'not started';
  while (Date.now() < deadline) {
    try {
      if (container) {
        const state = docker('inspect', container, '--format', '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}');
        if (!state.startsWith('running')) throw new Error(`container state: ${state}`);
        if (!state.endsWith('healthy') || state.endsWith('unhealthy')) throw new Error(`docker healthcheck: ${state}`);
      }
      // Protocol-level healthcheck, independent of Docker: the daemon must answer PING and VERSION.
      if ((await clamdCommand(host, port, 'PING')) !== 'PONG') throw new Error('clamd PING did not return PONG');
      const version = await clamdCommand(host, port, 'VERSION');
      if (!version.startsWith('ClamAV ')) throw new Error(`unexpected VERSION reply: ${version.slice(0, 80)}`);
      return version;
    } catch (error) {
      lastProblem = error instanceof Error ? error.message : String(error);
      await new Promise(done => setTimeout(done, 1_000));
    }
  }
  throw new Error(`DIAGNOSTIC_AV_REAL_TEST_ENGINE_UNHEALTHY: ${lastProblem}`);
}

async function startEngine(): Promise<Engine> {
  const configuredHost = process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST;
  if (configuredHost) {
    const port = Number(process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT);
    if (!Number.isInteger(port) || port <= 0 || port > 65_535) throw new Error('DIAGNOSTIC_AV_REAL_TEST_CONFIGURATION_REQUIRED: invalid DIAGNOSTIC_AV_CLAMD_TCP_PORT');
    return { host: configuredHost, port, version: await waitUntilHealthy(configuredHost, port, undefined) };
  }

  try { docker('version', '--format', '{{.Server.Version}}'); }
  catch { throw new Error('DIAGNOSTIC_AV_REAL_TEST_CONFIGURATION_REQUIRED: no DIAGNOSTIC_AV_CLAMD_TCP_HOST and no usable Docker daemon'); }
  try { docker('image', 'inspect', CLAMAV_IMAGE); }
  catch { docker('pull', CLAMAV_IMAGE); }

  const container = `nexus-av-real-${process.pid}-${randomUUID().slice(0, 8)}`;
  docker(
    'run', '-d', '--name', container, '--label', 'nexus.test=virus-scan-clamav-real',
    // Signatures = the ones baked into the pinned digest: no network, no drift.
    '-e', 'CLAMAV_NO_FRESHCLAMD=true',
    '-p', '127.0.0.1::3310',
    CLAMAV_IMAGE,
  );
  startedContainer = container;
  const mapping = docker('port', container, '3310/tcp').split('\n')[0] ?? '';
  const port = Number(mapping.slice(mapping.lastIndexOf(':') + 1));
  if (!Number.isInteger(port)) throw new Error(`DIAGNOSTIC_AV_REAL_TEST_ENGINE_UNHEALTHY: cannot resolve published port from "${mapping}"`);
  const version = await waitUntilHealthy('127.0.0.1', port, container);
  return { host: '127.0.0.1', port, version, container };
}

beforeAll(async () => {
  for (const key of ENV_KEYS) envBackup[key] = process.env[key];
  if (!process.env.DOCUMENT_STORAGE_ROOT) {
    createdStorageRoot = await mkdtemp(join(tmpdir(), 'nexus-av-real-storage-'));
    process.env.DOCUMENT_STORAGE_ROOT = createdStorageRoot;
  }
  engine = await startEngine();
  process.env.DIAGNOSTIC_AV_MODE = 'clamdscan';
  process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST = engine.host;
  process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT = String(engine.port);
}, ENGINE_START_BUDGET_MS + 30_000);

afterAll(async () => {
  for (const key of ENV_KEYS) {
    if (envBackup[key] === undefined) delete process.env[key]; else process.env[key] = envBackup[key];
  }
  if (startedContainer) {
    try { docker('rm', '-f', '-v', startedContainer); } catch { /* already gone */ }
  }
  if (createdStorageRoot) await rm(createdStorageRoot, { recursive: true, force: true });
});

// ── Fault-injecting loopback "clamd" ────────────────────────────────────────
type Fault = 'silent' | 'cut-mid-stream' | 'cut-after-stream' | 'garbage' | 'not-ok' | 'error' | 'size-limit';

interface FakeClamd {
  port: number;
  /** Resolves once the scanner under test has connected. */
  connected: Promise<void>;
  /** Resolves once the scanner has closed its end (no dangling socket). */
  clientClosed: Promise<void>;
  close: () => Promise<void>;
}

async function startFakeClamd(fault: Fault): Promise<FakeClamd> {
  let markConnected: () => void = () => undefined;
  let markClosed: () => void = () => undefined;
  const connected = new Promise<void>(done => { markConnected = done; });
  const clientClosed = new Promise<void>(done => { markClosed = done; });
  const sockets = new Set<Socket>();
  const server: Server = createServer(socket => {
    sockets.add(socket);
    markConnected();
    socket.on('close', () => { sockets.delete(socket); markClosed(); });
    socket.on('error', () => undefined);
    let received = Buffer.alloc(0);
    let answered = false;
    socket.on('data', chunk => {
      received = Buffer.concat([received, chunk]);
      if (fault === 'silent') return; // accepts, reads, never answers
      if (fault === 'cut-mid-stream') { socket.destroy(); return; }
      // Wait for the INSTREAM terminator (zero-length chunk) before answering.
      if (answered || received.length < 4 || !received.subarray(received.length - 4).equals(Buffer.alloc(4))) return;
      answered = true;
      if (fault === 'cut-after-stream') { socket.destroy(); return; }
      const reply = {
        garbage: 'this is not clamd\0',
        'not-ok': 'stream: NOT OK\0',
        error: 'stream: Some failure ERROR\0',
        'size-limit': 'INSTREAM size limit exceeded. ERROR\0',
      }[fault];
      socket.end(reply);
    });
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fake clamd failed to bind');
  return {
    port: address.port,
    connected,
    clientClosed,
    close: () => new Promise<void>(done => {
      for (const socket of sockets) socket.destroy();
      server.close(() => done());
    }),
  };
}

/** Points the scanner at `port` for the duration of `fn`. */
async function againstEngineAt<T>(port: number, fn: () => Promise<T>): Promise<T> {
  const previous = process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT;
  process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT = String(port);
  try { return await fn(); }
  finally { if (previous === undefined) delete process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT; else process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT = previous; }
}

/** Runs `run` against an engine that accepts the stream and never answers, then expires the scan deadline. */
async function runUntilScanDeadline(run: () => Promise<unknown>, observe?: () => Promise<string[]>): Promise<{ outcome: unknown; fake: FakeClamd; filesDuring?: string[] }> {
  const fake = await startFakeClamd('silent');
  // Only the timer the scanner arms is virtualised; sockets, fs and promises stay real.
  jest.useFakeTimers({ doNotFake: ['Date', 'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval'] });
  try {
    let settled = false;
    const outcomePromise = againstEngineAt(fake.port, run).then(
      value => { settled = true; return { resolved: value }; },
      error => { settled = true; return { rejected: error }; },
    );
    await fake.connected;
    const filesDuring = await observe?.();
    jest.advanceTimersByTime(SCAN_TIMEOUT_MS - 1);
    await new Promise(done => setImmediate(done));
    expect(settled).toBe(false); // still waiting: the bound is not shorter than the contract
    jest.advanceTimersByTime(1);
    return { outcome: await outcomePromise, fake, filesDuring };
  } finally {
    jest.useRealTimers();
    await fake.close();
  }
}

// ── 1. Engine identity and health ───────────────────────────────────────────
describe('pinned ClamAV engine', () => {
  test('answers PING/VERSION and runs the pinned engine and signature set', async () => {
    expect(await clamdCommand(engine.host, engine.port, 'PING')).toBe('PONG');
    expect(engine.version.startsWith(ENGINE_VERSION_PREFIX)).toBe(true);
    const signatureVersion = Number(engine.version.split('/')[1]);
    if (engine.container) {
      // Local lifecycle: image by digest, baked signatures, nothing newer.
      expect(signatureVersion).toBe(PINNED_SIGNATURE_VERSION);
      expect(docker('inspect', engine.container, '--format', '{{.Config.Image}}')).toBe(CLAMAV_IMAGE);
      expect(docker('image', 'inspect', CLAMAV_IMAGE, '--format', '{{json .RepoDigests}}')).toContain(CLAMAV_IMAGE_DIGEST);
      expect(docker('inspect', engine.container, '--format', '{{.State.Health.Status}}')).toBe('healthy');
    } else {
      // CI service container: same digest, signatures refreshed at start-up, never older than the pin.
      expect(signatureVersion).toBeGreaterThanOrEqual(PINNED_SIGNATURE_VERSION);
    }
  });
});

// ── 2. Core scanning authority: clean accepted, EICAR refused ───────────────
describe.each(['diagnostic', 'general'] as const)('%s private file — real ClamAV daemon over INSTREAM/TCP', kind => {
  const scan = (path: string) => kind === 'diagnostic' ? scanDiagnosticSubmissionFile(path) : scanPrivateFile(resolve(diagnosticsStorageRoot(), path));

  test('a harmless synthetic file is genuinely scanned and reported clean by the real engine', async () => {
    const path = `real-av-clean-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, Buffer.from('%PDF-1.0\nharmless synthetic content, no signature match expected\n%%EOF'));
    const result = await scan(path);
    expect(result.clean).toBe(true);
    expect(result.engine).toBe('clamd-instream-tcp');
  });

  test('the official EICAR test signature is genuinely detected by the real engine — not a fabricated verdict', async () => {
    const path = `real-av-eicar-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, Buffer.from(EICAR));
    await expect(scan(path)).rejects.toThrow(/^MALWARE_DETECTED$/);
  });

  test('an unreachable/misconfigured engine fails closed (AV_SCAN_FAILED), never a false "clean"', async () => {
    const path = `real-av-unreachable-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, Buffer.from('%PDF-1.0\nirrelevant, the engine itself is unreachable in this case\n%%EOF'));
    const previousHost = process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST;
    const previousPort = process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT;
    process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST = '127.0.0.1';
    process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT = '39999'; // nothing listens here
    try {
      const failure = await scan(path).then(() => null, (error: Error) => error);
      expect(failure).not.toBeNull(); // rejected, never resolved
      expect(failure?.message).not.toMatch(/^MALWARE_DETECTED/);
      expect(failure?.message).toBe('AV_SCAN_FAILED');
    } finally {
      process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST = previousHost;
      process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT = previousPort;
    }
  });

  // ── 3. Timeout, cut socket and invalid replies each refuse ────────────────
  test('a scan that never completes is refused with AV_SCAN_TIMEOUT at the 45 s bound and the socket is released', async () => {
    const path = `real-av-timeout-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, Buffer.from(CLEAN_PDF));
    const { outcome, fake } = await runUntilScanDeadline(() => scan(path));
    expect(outcome).toMatchObject({ rejected: expect.objectContaining({ message: 'AV_SCAN_TIMEOUT' }) });
    await fake.clientClosed; // the scanner destroyed its socket rather than leaving it dangling
  });

  test.each<[Fault, RegExp]>([
    ['cut-mid-stream', /^AV_SCAN_FAILED$/],
    ['cut-after-stream', /^AV_SCAN_FAILED$/],
    ['garbage', /^AV_SCAN_FAILED$/],
    ['not-ok', /^AV_SCAN_FAILED$/],
    ['error', /^AV_SCAN_FAILED$/],
    ['size-limit', /^AV_SCAN_FAILED$/],
  ])('a %s engine fault is refused, never reported clean', async (fault, expected) => {
    const path = `real-av-fault-${fault}-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, CLEAN_PDF);
    const fake = await startFakeClamd(fault);
    try {
      const outcome = await againstEngineAt(fake.port, () => scan(path)).then(value => ({ resolved: value }), (error: Error) => ({ rejected: error }));
      expect(outcome).not.toHaveProperty('resolved');
      const failure = (outcome as { rejected: Error }).rejected;
      expect(failure.message).not.toMatch(/^MALWARE_DETECTED/);
      expect(failure.message).toMatch(expected);
    } finally {
      await fake.close();
    }
  });
});

// The "no engine configured at all" / "engine unavailable while mandatory"
// scenarios are covered by mocked, environment-independent tests in
// submission-pipeline.test.ts — not repeated here, since a host that
// happens to have a real clamdscan on PATH would make that specific
// assertion flaky in exactly the opposite direction this file exists to
// avoid (a mocked "always clean" double masquerading as a real verdict).

// ── 4. NPC upload path ──────────────────────────────────────────────────────
// Exercise the actual atomic writer: the in-memory clear snapshot is scanned
// before any staging file exists; inode verification protects publication.
describe('NPC atomic writer with real ClamAV', () => {
  let root: string;
  const priorRoot = process.env.NPC_STORAGE_ROOT;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'nexus-npc-real-av-'));
    process.env.NPC_STORAGE_ROOT = join(root, 'private');
    await mkdir(process.env.NPC_STORAGE_ROOT, { mode: 0o750 });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    if (priorRoot === undefined) delete process.env.NPC_STORAGE_ROOT; else process.env.NPC_STORAGE_ROOT = priorRoot;
  });
  const published = async () => {
    try { return await readdir(join(process.env.NPC_STORAGE_ROOT!, 'student')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  };

  test('publishes harmless bytes from the scanned open inode', async () => {
    const bytes = Buffer.from('synthetic harmless document');
    const result = await writeNpcStorageFileAtomic('student/clean.pdf', bytes, bytes.length);
    expect(await readFile(result.filePath)).toEqual(bytes);
  });
  test('real EICAR verdict removes only the quarantine file and publishes nothing', async () => {
    const bytes = Buffer.from(EICAR);
    await expect(writeNpcStorageFileAtomic('student/rejected.pdf', bytes, bytes.length)).rejects.toThrow(/^MALWARE_DETECTED$/);
    expect(await published()).toEqual([]);
  });
  test('an EICAR payload inside a PDF is refused and nothing is published', async () => {
    await expect(writeNpcStorageFileAtomic('student/pdf.pdf', EICAR_PDF, EICAR_PDF.length)).rejects.toThrow(/^MALWARE_DETECTED$/);
    expect(await published()).toEqual([]);
  });
  test('an unreachable engine publishes nothing', async () => {
    await againstEngineAt(39999, async () => {
      await expect(writeNpcStorageFileAtomic('student/down.pdf', CLEAN_PDF, CLEAN_PDF.length)).rejects.toThrow(/^AV_SCAN_FAILED$/);
    });
    expect(await published()).toEqual([]);
  });
  test('a scan that never completes publishes nothing', async () => {
    const { outcome, filesDuring } = await runUntilScanDeadline(() => writeNpcStorageFileAtomic('student/slow.pdf', CLEAN_PDF, CLEAN_PDF.length), () => listFilesRecursively(root));
    expect(filesDuring).toEqual([]);
    expect(outcome).toMatchObject({ rejected: expect.objectContaining({ message: 'AV_SCAN_TIMEOUT' }) });
    expect(await published()).toEqual([]);
  });
  test.each<Fault>(['cut-mid-stream', 'cut-after-stream', 'not-ok', 'garbage'])('a %s engine fault publishes nothing', async fault => {
    const fake = await startFakeClamd(fault);
    try {
      await againstEngineAt(fake.port, async () => {
        const failure = await writeNpcStorageFileAtomic('student/fault.pdf', CLEAN_PDF, CLEAN_PDF.length).then(() => null, (error: Error) => error);
        expect(failure).not.toBeNull(); // rejected, never resolved
        expect(failure?.message).not.toMatch(/^MALWARE_DETECTED/);
      });
    } finally {
      await fake.close();
    }
    expect(await published()).toEqual([]);
  });
});

// ── 5. Documents (admin + coach) and Espace upload paths ────────────────────
// Real scanner, real filesystem, real route/service code. After any refusal the
// storage tree holds no file at all and no database write was attempted.
async function listFilesRecursively(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? listFilesRecursively(join(directory, entry.name)) : Promise.resolve([join(directory, entry.name)])));
  return nested.flat();
}

describe('Documents, Espace and NPC share one scanning authority — end to end with the real engine', () => {
  let storageRoot: string;
  beforeEach(async () => {
    jest.clearAllMocks();
    storageRoot = await mkdtemp(join(tmpdir(), 'nexus-av-real-uploads-'));
    process.env.DOCUMENT_STORAGE_ROOT = storageRoot;
  });
  afterEach(async () => {
    await rm(storageRoot, { recursive: true, force: true });
    if (envBackup.DOCUMENT_STORAGE_ROOT === undefined && createdStorageRoot) process.env.DOCUMENT_STORAGE_ROOT = createdStorageRoot;
    else if (envBackup.DOCUMENT_STORAGE_ROOT !== undefined) process.env.DOCUMENT_STORAGE_ROOT = envBackup.DOCUMENT_STORAGE_ROOT;
  });

  const uploadFile = (bytes: Buffer, name: string, type: string) => ({
    name, type, size: bytes.length,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }) as unknown as File;
  const formRequest = (fields: Record<string, unknown>) => ({
    method: 'POST',
    headers: new Headers({ 'content-type': 'multipart/form-data; boundary=synthetic' }),
    formData: async () => ({ get: (key: string) => fields[key] ?? null }),
  }) as never;

  // Each scenario describes how the scanner is brought to refuse.
  const refusals: Array<{ name: string; setup: () => Promise<{ port: number; run: <T>(fn: () => Promise<T>) => Promise<T>; stop: () => Promise<void> }>; bytes: Buffer; malware: boolean }> = [
    { name: 'EICAR (real signature hit)', bytes: EICAR_PDF, malware: true, setup: async () => ({ port: engine.port, run: fn => fn(), stop: async () => undefined }) },
    { name: 'engine unreachable', bytes: CLEAN_PDF, malware: false, setup: async () => ({ port: 39999, run: fn => againstEngineAt(39999, fn), stop: async () => undefined }) },
    ...(['cut-mid-stream', 'cut-after-stream', 'not-ok', 'garbage'] as const).map(fault => ({
      name: `${fault} engine fault`, bytes: CLEAN_PDF, malware: false,
      setup: async () => { const fake = await startFakeClamd(fault); return { port: fake.port, run: <T,>(fn: () => Promise<T>) => againstEngineAt(fake.port, fn), stop: fake.close }; },
    })),
  ];

  describe('Documents — POST /api/admin/documents', () => {
    const asAdmin = () => {
      const guards = jest.requireMock('@/lib/guards');
      guards.requireAnyRole.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
      (prisma.userDocument.create as jest.Mock).mockImplementation(async ({ data }) => ({ ...data, createdAt: new Date() }));
    };
    const post = (bytes: Buffer) => adminDocumentsPost(formRequest({ file: uploadFile(bytes, 'bulletin.pdf', 'application/pdf'), userId: 'user-1' }));

    test('a clean PDF is stored and its record created', async () => {
      asAdmin();
      const response = await post(CLEAN_PDF);
      expect(response.status).toBe(201);
      expect(prisma.userDocument.create).toHaveBeenCalledTimes(1);
      expect(await listFilesRecursively(storageRoot)).toHaveLength(1);
    });

    test.each(refusals)('$name: refused, no file left, no record', async ({ setup, bytes, malware }) => {
      asAdmin();
      const scenario = await setup();
      try {
        const response = await scenario.run(() => post(bytes));
        expect(response.status).toBe(malware ? 422 : 503);
        expect(await response.json()).toEqual({ error: malware ? 'DOCUMENT_REJECTED' : 'DOCUMENT_SCAN_UNAVAILABLE' });
      } finally { await scenario.stop(); }
      expect(prisma.userDocument.create).not.toHaveBeenCalled();
      expect(await listFilesRecursively(storageRoot)).toEqual([]);
    });

    test('a scan that never completes: refused (503), no file left, no record', async () => {
      asAdmin();
      const { outcome, filesDuring } = await runUntilScanDeadline(async () => {
        const response = await post(CLEAN_PDF);
        return { status: response.status, body: await response.json() };
      }, () => listFilesRecursively(storageRoot));
      expect(filesDuring).toEqual([]);
      expect(outcome).toEqual({ resolved: { status: 503, body: { error: 'DOCUMENT_SCAN_UNAVAILABLE' } } });
      expect(prisma.userDocument.create).not.toHaveBeenCalled();
      expect(await listFilesRecursively(storageRoot)).toEqual([]);
    });
  });

  describe('Documents — POST /api/coach/students/[studentId]/documents', () => {
    const asCoach = () => {
      const guards = jest.requireMock('@/lib/guards');
      guards.requireRole.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH', authority: 'V1' } });
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'student-1', userId: 'student-user-1' });
      (prisma.userDocument.create as jest.Mock).mockImplementation(async ({ data }) => ({ ...data, id: 'doc-1', createdAt: new Date(), updatedAt: new Date() }));
    };
    const post = (bytes: Buffer) => coachDocumentsPost(
      formRequest({ file: uploadFile(bytes, 'fiche.pdf', 'application/pdf'), title: 'Fiche', documentType: 'COURS' }),
      { params: Promise.resolve({ studentId: 'student-1' }) },
    );

    test('no clear file exists while the scanner is still awaiting its verdict', async () => {
      asCoach();
      const { outcome, filesDuring } = await runUntilScanDeadline(() => post(CLEAN_PDF), () => listFilesRecursively(storageRoot));
      expect(filesDuring).toEqual([]);
      expect(outcome).toMatchObject({ resolved: expect.objectContaining({ status: 503 }) });
      expect(prisma.userDocument.create).not.toHaveBeenCalled();
    });

    test('a clean PDF is stored and its record created', async () => {
      asCoach();
      const response = await post(CLEAN_PDF);
      expect(response.status).toBe(201);
      expect(prisma.userDocument.create).toHaveBeenCalledTimes(1);
      expect(await listFilesRecursively(storageRoot)).toHaveLength(1);
    });

    test.each(refusals)('$name: refused, no file left, no record', async ({ setup, bytes, malware }) => {
      asCoach();
      const scenario = await setup();
      try {
        const response = await scenario.run(() => post(bytes));
        expect(response.status).toBe(malware ? 422 : 503);
        expect(await response.json()).toEqual({ error: malware ? 'DOCUMENT_REJECTED' : 'DOCUMENT_SCAN_UNAVAILABLE' });
      } finally { await scenario.stop(); }
      expect(prisma.userDocument.create).not.toHaveBeenCalled();
      expect(await listFilesRecursively(storageRoot)).toEqual([]);
    });
  });

  describe('Espace — saveAttachment', () => {
    const actor = { id: 'student-1', role: 'ELEVE' as const, firstName: null, lastName: null, mustChangeCredential: false };
    const arrange = () => {
      (jest.requireMock('@/lib/espace/access').loadWorkForActor as jest.Mock).mockResolvedValue({ work: { status: 'DRAFT', activity: { kind: 'UPLOAD_EXERCISE' } } });
      (prisma.espaceWorkAttachment.count as jest.Mock).mockResolvedValue(0);
      (prisma.$transaction as jest.Mock).mockImplementation(async callback => callback({
        espaceWorkAttachment: { create: async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: 'att-1', createdAt: new Date() }) },
        espaceWork: { updateMany: async () => ({ count: 1 }) },
      }));
    };
    const save = (bytes: Buffer) => saveAttachment(actor, 'work-1', { name: 'copie.pdf', bytes: Uint8Array.from(bytes) });

    test('a clean PDF is stored and its record created', async () => {
      arrange();
      await expect(save(CLEAN_PDF)).resolves.toMatchObject({ id: 'att-1', mimeType: 'application/pdf' });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(await listFilesRecursively(storageRoot)).toHaveLength(1);
    });

    test.each(refusals)('$name: refused, no file left, no record', async ({ setup, bytes, malware }) => {
      arrange();
      const scenario = await setup();
      try {
        await scenario.run(async () => {
          await expect(save(bytes)).rejects.toMatchObject(malware ? { code: 'UPLOAD_REJECTED', status: 400 } : { code: 'UPLOAD_SCAN_UNAVAILABLE', status: 503 });
        });
      } finally { await scenario.stop(); }
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(await listFilesRecursively(storageRoot)).toEqual([]);
    });

    test('a scan that never completes: refused (503), no file left, no record', async () => {
      arrange();
      const { outcome, filesDuring } = await runUntilScanDeadline(() => save(CLEAN_PDF), () => listFilesRecursively(storageRoot));
      expect(filesDuring).toEqual([]);
      expect(outcome).toMatchObject({ rejected: expect.objectContaining({ code: 'UPLOAD_SCAN_UNAVAILABLE', status: 503 }) });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(await listFilesRecursively(storageRoot)).toEqual([]);
    });
  });
});
