/**
 * Candidat libre document deposit — the antivirus must see the PLAINTEXT.
 *
 * Regression for a verified bypass: the route used to persist the upload as an
 * AES-GCM ciphertext and THEN run clamdscan on the stored file. A ciphertext
 * can never match a signature, so the scan was a no-op the moment an engine
 * was configured. These tests speak to the REAL, digest-pinned clamd daemon
 * (clamav/clamav@sha256:57deb108..., see .github/governance/container-images.json)
 * over INSTREAM/TCP — the same lane and service as virus-scan-clamav.real.test.ts
 * — and never replace the engine's verdict with a fabricated one, except in
 * the explicitly labelled "fake daemon" cases that exist to observe the wire
 * (what bytes were sent) and the failure modes a real daemon cannot be made
 * to produce on demand (garbage verdict, empty reply).
 *
 * Requires DIAGNOSTIC_AV_CLAMD_TCP_HOST/PORT; missing infrastructure FAILS
 * rather than skipping required AV evidence.
 */
jest.mock('server-only', () => ({}));

const mockStorageRoot: { current: string } = { current: '' };
jest.mock('@/lib/documents/storage-root', () => ({
  getDocumentStorageRoot: () => mockStorageRoot.current,
}));

const mockPrisma = {
  candidateDiagnosticDocument: { findUnique: jest.fn(), create: jest.fn() },
  candidateDiagnosticAuditLog: { create: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock('@/lib/prisma', () => ({ get prisma() { return mockPrisma; } }));
// lib/guards pulls in NextAuth (ESM) — irrelevant here; same duck-typing as the real isErrorResponse.
jest.mock('@/lib/guards', () => ({
  isErrorResponse: (result: unknown) => typeof result === 'object' && result !== null && typeof (result as { json?: unknown }).json === 'function' && 'status' in result,
}));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));
jest.mock('@/lib/diagnostics/candidat-libre/consent-gate.server', () => ({ requireVerifiedParentalConsent: jest.fn(async () => null) }));
jest.mock('@/lib/diagnostics/candidat-libre/access.server', () => ({
  requireDiagnosticActor: jest.fn(async () => ({ user: { id: 'user-1', role: 'ELEVE' } })),
  getDiagnosticForActor: jest.fn(async () => ({ id: 'diag-1', studentId: 'student-1', submittedAt: null, documents: [] })),
  actorRole: jest.fn(() => 'ELEVE'),
  isDocumentVisibleToViewer: jest.fn(() => true),
}));

import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:net';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { persistDiagnosticFile } from '@/lib/diagnostics/candidat-libre/storage.server';
import { decryptDocument, encryptDocument } from '@/lib/documents/encryption';
import { scanPrivateFile } from '@/lib/security/private-file-antivirus';
import { POST } from '@/app/api/diagnostics/candidat-libre/[diagnosticId]/documents/route';

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/** A PDF whose (uncompressed) content stream genuinely contains the EICAR string. */
function pdfWithStream(content: string): Buffer {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`,
    'latin1',
  );
}
const CLEAN_PDF = pdfWithStream('BT /F1 12 Tf (Bulletin scolaire, contenu inoffensif) Tj ET');
const EICAR_PDF = pdfWithStream(EICAR);

const ENV_KEYS = [
  'DIAGNOSTIC_AV_MODE', 'DIAGNOSTIC_AV_CLAMD_TCP_HOST', 'DIAGNOSTIC_AV_CLAMD_TCP_PORT',
  'NODE_ENV', 'E2E_DISPOSABLE_STACK', 'DOCUMENT_ENCRYPTION_KEY',
  'CANDIDATE_DIAGNOSTIC_ENABLED', 'CANDIDATE_DIAGNOSTIC_STUDENT_IDS',
] as const;
const env = process.env as unknown as Record<string, string | undefined>;
let savedEnv: Record<string, string | undefined> = {};
const realHost = process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST;
const realPort = process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT;

function listFilesRecursively(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursively(full)); else out.push(full);
  }
  return out;
}

/** Entries of every directory a scratch plaintext file could plausibly be created in. */
function scratchSnapshot(): string[] {
  return [tmpdir(), '/dev/shm'].flatMap((dir) => {
    try { return readdirSync(dir).map((name) => join(dir, name)); } catch { return []; }
  }).sort();
}

/**
 * Entries that appeared since `before` and look like a scan scratch artefact: the
 * implementation's own `nexus-av-` naming, or any new regular file whose bytes hold the
 * plaintext marker. (The shared tmp dir also receives unrelated entries from other
 * processes, which must not make this assertion flaky.)
 */
function newScratchArtefacts(before: string[]): string[] {
  return scratchSnapshot().filter((entry) => {
    if (before.includes(entry)) return false;
    if (/\/nexus-av-[^/]*$/.test(entry)) return true;
    try {
      const stat = statSync(entry);
      return stat.isFile() && stat.size < 1_000_000 && readFileSync(entry).includes(Buffer.from('Bulletin scolaire'));
    } catch { return false; }
  });
}

interface FakeDaemon { port: number; received: Buffer[]; during: string[][]; close: () => Promise<void> }
/** Minimal clamd stand-in speaking just enough INSTREAM to record what is sent. */
const HANG = Symbol('hang');
async function fakeDaemon(reply: string | null | typeof HANG, snapshotDuringScan?: () => string[]): Promise<FakeDaemon> {
  const received: Buffer[] = [];
  const during: string[][] = [];
  const server: Server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let payload = Buffer.alloc(0);
    let headerSeen = false;
    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      if (!headerSeen) {
        if (buffer.length < 10) return;
        expect(buffer.subarray(0, 10).toString('latin1')).toBe('zINSTREAM\0');
        buffer = buffer.subarray(10);
        headerSeen = true;
      }
      while (buffer.length >= 4) {
        const length = buffer.readUInt32BE(0);
        if (length === 0) {
          received.push(payload);
          if (snapshotDuringScan) during.push(snapshotDuringScan());
          if (reply === HANG) return; // never answers: the caller's timeout must fire
          if (reply === null) socket.end(); else socket.end(reply);
          return;
        }
        if (buffer.length < 4 + length) return;
        payload = Buffer.concat([payload, buffer.subarray(4, 4 + length)]);
        buffer = buffer.subarray(4 + length);
      }
    });
    socket.on('error', () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { port, received, during, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

function pointScannerAt(host: string, port: string | number) {
  env.DIAGNOSTIC_AV_MODE = 'clamdscan';
  env.DIAGNOSTIC_AV_CLAMD_TCP_HOST = host;
  env.DIAGNOSTIC_AV_CLAMD_TCP_PORT = String(port);
}

beforeAll(() => {
  if (!realHost || !realPort) throw new Error('DIAGNOSTIC_AV_REAL_TEST_CONFIGURATION_REQUIRED');
});

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = env[key];
  mockStorageRoot.current = mkdtempSync(join(tmpdir(), 'nexus-candidat-libre-av-'));
  env.DOCUMENT_ENCRYPTION_KEY = 'test-document-encryption-key-0123456789abcd';
  env.CANDIDATE_DIAGNOSTIC_ENABLED = 'true';
  env.CANDIDATE_DIAGNOSTIC_STUDENT_IDS = 'student-1';
  pointScannerAt(realHost as string, realPort as string);
  jest.clearAllMocks();
  mockPrisma.candidateDiagnosticDocument.findUnique.mockResolvedValue(null);
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockPrisma));
  mockPrisma.candidateDiagnosticDocument.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'doc-1', status: 'PENDING', createdAt: new Date(), ...data,
  }));
});

afterEach(() => {
  rmSync(mockStorageRoot.current, { recursive: true, force: true });
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete env[key]; else env[key] = savedEnv[key];
  }
});

function pdfFile(bytes: Buffer, name = 'bulletin.pdf'): File {
  return new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });
}

function uploadRequest(bytes: Buffer) {
  const form = new FormData();
  form.set('file', pdfFile(bytes));
  form.set('category', 'WRITTEN_COPY');
  form.set('title', 'Copie');
  form.set('clientMutationId', `mutation-${randomUUID()}`);
  return new Request('http://localhost/api/diagnostics/candidat-libre/diag-1/documents', { method: 'POST', body: form });
}
const routeParams = { params: Promise.resolve({ diagnosticId: 'diag-1' }) };

describe('premise: why scanning the stored (encrypted) file can never work', () => {
  test('the real engine flags the plaintext EICAR PDF but reports its AES-GCM ciphertext clean', async () => {
    const plaintextPath = join(mockStorageRoot.current, 'premise-plain.pdf');
    const ciphertextPath = join(mockStorageRoot.current, 'premise-cipher.enc');
    writeFileSync(plaintextPath, EICAR_PDF);
    writeFileSync(ciphertextPath, encryptDocument(EICAR_PDF, { documentId: 'premise' }));
    await expect(scanPrivateFile(plaintextPath)).rejects.toThrow(/^MALWARE_DETECTED:/);
    await expect(scanPrivateFile(ciphertextPath)).resolves.toMatchObject({ clean: true });
  });
});

describe('persistDiagnosticFile — scan happens on plaintext, before anything is written', () => {
  test('a clean PDF is accepted, stored encrypted, and round-trips to the exact plaintext', async () => {
    const stored = await persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'WRITTEN_COPY', file: pdfFile(CLEAN_PDF) });
    const onDisk = readFileSync(join(mockStorageRoot.current, stored.storageKey));
    expect(onDisk.includes(Buffer.from('Bulletin scolaire'))).toBe(false);
    expect(decryptDocument(onDisk, { documentId: stored.storageKey }).equals(CLEAN_PDF)).toBe(true);
    expect(stored.sha256).toBe(createHash('sha256').update(CLEAN_PDF).digest('hex'));
  });

  test('an EICAR-bearing PDF is rejected by the real engine and NOTHING is written', async () => {
    await expect(
      persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'WRITTEN_COPY', file: pdfFile(EICAR_PDF) }),
    ).rejects.toThrow(/^MALWARE_DETECTED/);
    expect(listFilesRecursively(mockStorageRoot.current)).toEqual([]);
  });

  test('clamd receives exactly the plaintext bytes — never the ciphertext', async () => {
    const daemon = await fakeDaemon('stream: OK\0');
    try {
      pointScannerAt('127.0.0.1', daemon.port);
      await persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'WRITTEN_COPY', file: pdfFile(CLEAN_PDF) });
      expect(daemon.received).toHaveLength(1);
      expect(daemon.received[0].equals(CLEAN_PDF)).toBe(true);
      expect(daemon.received[0].subarray(0, 6).toString('latin1')).not.toBe('NXDOC\0');
    } finally {
      await daemon.close();
    }
  });

  test('the plaintext is scanned before the encrypted file is written (nothing on disk while clamd decides)', async () => {
    const daemon = await fakeDaemon('stream: OK\0', () => listFilesRecursively(mockStorageRoot.current));
    try {
      pointScannerAt('127.0.0.1', daemon.port);
      await persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'WRITTEN_COPY', file: pdfFile(CLEAN_PDF) });
      expect(daemon.during).toEqual([[]]);
    } finally {
      await daemon.close();
    }
  });

  test('no scratch plaintext file is nameable or left behind, before, during or after the scan', async () => {
    const before = scratchSnapshot();
    const daemon = await fakeDaemon('stream: OK\0', () => newScratchArtefacts(before));
    try {
      pointScannerAt('127.0.0.1', daemon.port);
      await persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'WRITTEN_COPY', file: pdfFile(CLEAN_PDF) });
      expect(daemon.during).toEqual([[]]);
    } finally {
      await daemon.close();
    }
    const leaked = newScratchArtefacts(before);
    expect(leaked).toEqual([]);
  });

  test.each([
    ['unreachable engine', null],
    ['garbage verdict', 'stream: ERROR something unexpected\0'],
    ['empty reply', ''],
    ['connection dropped without a verdict', null],
  ])('fails closed on %s and writes nothing', async (label, reply) => {
    if (label === 'unreachable engine') {
      pointScannerAt('127.0.0.1', 1); // nothing listens on port 1
      await expect(persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'WRITTEN_COPY', file: pdfFile(CLEAN_PDF) })).rejects.toThrow(/^AV_SCAN_FAILED/);
    } else {
      const daemon = await fakeDaemon(reply);
      try {
        pointScannerAt('127.0.0.1', daemon.port);
        await expect(persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'WRITTEN_COPY', file: pdfFile(CLEAN_PDF) })).rejects.toThrow(/^AV_SCAN_FAILED/);
      } finally {
        await daemon.close();
      }
    }
    expect(listFilesRecursively(mockStorageRoot.current)).toEqual([]);
  });

  test('a daemon that never answers hits the scan timeout and fails closed, writing nothing', async () => {
    const daemon = await fakeDaemon(HANG);
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      pointScannerAt('127.0.0.1', daemon.port);
      const outcome = persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'WRITTEN_COPY', file: pdfFile(CLEAN_PDF) }).then(
        () => 'accepted',
        (error: Error) => error.message,
      );
      for (let waited = 0; daemon.received.length === 0 && waited < 500; waited += 1) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      expect(daemon.received).toHaveLength(1);
      jest.advanceTimersByTime(45_001);
      await expect(outcome).resolves.toBe('AV_SCAN_FAILED');
    } finally {
      jest.useRealTimers();
      await daemon.close();
    }
    expect(listFilesRecursively(mockStorageRoot.current)).toEqual([]);
  });

  test('an unconfigured engine in production (empty mode) fails closed and writes nothing', async () => {
    env.NODE_ENV = 'production';
    delete env.E2E_DISPOSABLE_STACK;
    env.DIAGNOSTIC_AV_MODE = '';
    await expect(persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'WRITTEN_COPY', file: pdfFile(CLEAN_PDF) })).rejects.toThrow('AV_NOT_CONFIGURED');
    expect(listFilesRecursively(mockStorageRoot.current)).toEqual([]);
  });
});

describe('POST /documents — end to end against the real engine', () => {
  test('clean PDF: 201, one encrypted file, one DB row', async () => {
    const response = await POST(uploadRequest(CLEAN_PDF), routeParams);
    expect(response.status).toBe(201);
    expect(mockPrisma.candidateDiagnosticDocument.create).toHaveBeenCalledTimes(1);
    const files = listFilesRecursively(mockStorageRoot.current);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.enc$/);
  });

  test('EICAR PDF: refused, no DB row, no file, no audit entry, verdict code is sanitised', async () => {
    const response = await POST(uploadRequest(EICAR_PDF), routeParams);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'MALWARE_DETECTED' });
    expect(mockPrisma.candidateDiagnosticDocument.create).not.toHaveBeenCalled();
    expect(mockPrisma.candidateDiagnosticAuditLog.create).not.toHaveBeenCalled();
    expect(listFilesRecursively(mockStorageRoot.current)).toEqual([]);
  });

  test('engine unreachable: 503 AV_SCAN_FAILED, no DB row, no file', async () => {
    pointScannerAt('127.0.0.1', 1);
    const response = await POST(uploadRequest(CLEAN_PDF), routeParams);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'AV_SCAN_FAILED' });
    expect(mockPrisma.candidateDiagnosticDocument.create).not.toHaveBeenCalled();
    expect(listFilesRecursively(mockStorageRoot.current)).toEqual([]);
  });

  test('production with an empty DIAGNOSTIC_AV_MODE: 503 AV_NOT_CONFIGURED before the upload is even read, logged loudly', async () => {
    env.NODE_ENV = 'production';
    delete env.E2E_DISPOSABLE_STACK;
    env.DIAGNOSTIC_AV_MODE = '';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const request = uploadRequest(CLEAN_PDF);
      const formData = jest.spyOn(request, 'formData');
      const response = await POST(request, routeParams);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'AV_NOT_CONFIGURED' });
      expect(formData).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('DIAGNOSTIC_AV_MODE'));
    } finally {
      errorSpy.mockRestore();
    }
    expect(listFilesRecursively(mockStorageRoot.current)).toEqual([]);
  });

  test('production requires an explicit INSTREAM endpoint: mode=clamdscan without host/port is refused', async () => {
    env.NODE_ENV = 'production';
    delete env.E2E_DISPOSABLE_STACK;
    env.DIAGNOSTIC_AV_MODE = 'clamdscan';
    delete env.DIAGNOSTIC_AV_CLAMD_TCP_HOST;
    delete env.DIAGNOSTIC_AV_CLAMD_TCP_PORT;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await POST(uploadRequest(CLEAN_PDF), routeParams);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'AV_NOT_CONFIGURED' });
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('database failure after a clean scan: the encrypted file is removed, no orphan remains', async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('db down'));
    const response = await POST(uploadRequest(CLEAN_PDF), routeParams);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(listFilesRecursively(mockStorageRoot.current)).toEqual([]);
    expect(statSync(mockStorageRoot.current).isDirectory()).toBe(true);
  });
});
