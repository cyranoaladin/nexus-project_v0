import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
jest.mock('@/lib/core-v2/diagnostics/virus-scan', () => ({
  ...jest.requireActual('@/lib/core-v2/diagnostics/virus-scan'), scanDiagnosticSubmissionBytes: jest.fn(),
}));
jest.mock('@/lib/core-v2/services/diagnostics', () => {
  const actual = jest.requireActual('@/lib/core-v2/services/diagnostics');
  return { ...actual, createOwnDiagnosticSubmission: jest.fn(actual.createOwnDiagnosticSubmission) };
});
import { depositOwnDiagnosticSubmission } from '@/lib/core-v2/diagnostics/submission-pipeline';
import { scanDiagnosticSubmissionBytes } from '@/lib/core-v2/diagnostics/virus-scan';
import { diagnosticsStorageRoot, readDiagnosticSubmissionBytes } from '@/lib/core-v2/diagnostics/storage';
import { decryptDocument, isEncryptedDocument } from '@/lib/documents/encryption';
import { attributeDiagnostic, createOwnDiagnosticSubmission } from '@/lib/core-v2/services/diagnostics';
import { createHousehold, createStudent } from '@/lib/core-v2/services';
import { setupServiceHarness } from '../helpers/service-harness';
const h = setupServiceHarness();
const scan = scanDiagnosticSubmissionBytes as jest.MockedFunction<typeof scanDiagnosticSubmissionBytes>;
const originalRoot = process.env.DOCUMENT_STORAGE_ROOT;
let storageRoot: string;
let assignmentId: string;
let userId: string;
const bytes = Buffer.from('%PDF-1.4\nPrivate synthetic academic answers\n%%EOF\n');
beforeEach(async () => {
  storageRoot = await mkdtemp(join(tmpdir(), 'nexus-encrypted-submission-test-'));
  process.env.DOCUMENT_STORAGE_ROOT = storageRoot;
  process.env.DOCUMENT_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  scan.mockReset(); scan.mockResolvedValue({ clean: true, engine: 'test-collaborator' });
  (createOwnDiagnosticSubmission as jest.Mock).mockReset().mockImplementation(
    jest.requireActual('@/lib/core-v2/services/diagnostics').createOwnDiagnosticSubmission);
  const { household } = await createHousehold(h.client, h.ctx(), { parent: {
    firstName: 'Synthetic', lastName: 'Parent', email: 'encrypted-parent@example.test' } });
  const { student, user } = await createStudent(h.client, h.ctx(), { householdId: household.id,
    student: { firstName: 'Synthetic', lastName: 'Student' } }); userId = user.id;
  process.env.DIAGNOSTIC_DEMO_MODE = '1'; process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = student.id;
  const instrument = await h.client.diagnosticInstrumentRef.create({ data: {
    instrumentKey: 'ENCRYPTION-TEST', version: '1', title: 'Synthetic diagnostic', subject: 'Test',
    level: 'Toutes', targetSession: 'DEMO', form: 'FORM_TEST', durationMinutes: 30, modalities: 'Test',
    catalogStatus: 'DEMO_FIXTURE', manifestChecksum: 'a'.repeat(64), manifestVersion: 'test/1', subjectSha256: 'b'.repeat(64),
  } });
  assignmentId = (await attributeDiagnostic(h.client, h.ctx(), { studentId: student.id, instrumentRefId: instrument.id })).id;
});
afterEach(async () => {
  await rm(storageRoot, { recursive: true, force: true });
  if (originalRoot === undefined) delete process.env.DOCUMENT_STORAGE_ROOT; else process.env.DOCUMENT_STORAGE_ROOT = originalRoot;
});
const deposit = (buffer = bytes) => depositOwnDiagnosticSubmission(h.client, h.ctx({ userId, role: 'ELEVE' }), {
  assignmentId, originalFilename: 'answers.pdf', mimeType: 'application/pdf', bytes: buffer,
});
test.each(['MALWARE_DETECTED', 'AV_SCAN_TIMEOUT', 'AV_SCAN_FAILED', 'AV_NOT_CONFIGURED'])('%s leaves no file, row, audit or changed assignment', async code => {
  scan.mockRejectedValueOnce(new Error(code + ':secret-content-must-never-leak'));
  const before = await h.client.auditEvent.findMany({ orderBy: { id: 'asc' } });
  await expect(deposit()).rejects.toMatchObject({ code: 'INVALID_STATE' });
  expect(scan).toHaveBeenCalledWith(bytes);
  expect(await readdir(storageRoot)).toEqual([]);
  expect(await h.client.diagnosticSubmission.count()).toBe(0);
  expect(await h.client.auditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  expect((await h.client.diagnosticAssignment.findUniqueOrThrow({ where: { id: assignmentId } })).status).toBe('ASSIGNED');
});
test('ClamAV receives the exact clear snapshot before any persistence; only authenticated ciphertext reaches disk', async () => {
  scan.mockImplementationOnce(async clear => {
    expect(clear).toEqual(bytes);
    expect(isEncryptedDocument(clear)).toBe(false);
    expect(await readdir(storageRoot)).toEqual([]);
    expect(await h.client.diagnosticSubmission.count()).toBe(0);
    return { clean: true, engine: 'test-collaborator' };
  });
  const result = await deposit();
  const path = join(diagnosticsStorageRoot(), result.submission.storageKey);
  const encrypted = await readFile(path);
  expect(isEncryptedDocument(encrypted)).toBe(true);
  expect(encrypted.includes(bytes)).toBe(false);
  expect((await stat(path)).mode & 0o777).toBe(0o600);
  expect(await readDiagnosticSubmissionBytes(result.submission.storageKey)).toEqual(bytes);
  expect(result.submission).toMatchObject({ sizeBytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') });
  expect(() => decryptDocument(encrypted, { documentId: 'another-assignment' })).toThrow();
  encrypted[encrypted.length - 1] ^= 1; await writeFile(path, encrypted);
  await expect(readDiagnosticSubmissionBytes(result.submission.storageKey)).rejects.toThrow();
});
test('missing encryption key refuses without creating any persisted copy', async () => {
  delete process.env.DOCUMENT_ENCRYPTION_KEY;
  await expect(deposit()).rejects.toThrow('DOCUMENT_ENCRYPTION_KEY_INVALID');
  expect(await readdir(storageRoot)).toEqual([]);
  expect(await h.client.diagnosticSubmission.count()).toBe(0);
});
test('a mutation of the caller buffer during the scan cannot change the stored document', async () => {
  const mutable = Buffer.from(bytes);
  scan.mockImplementationOnce(async clear => {
    mutable.fill(0);
    expect(clear).toEqual(bytes);
    return { clean: true, engine: 'test-collaborator' };
  });
  const result = await deposit(mutable);
  expect(await readDiagnosticSubmissionBytes(result.submission.storageKey)).toEqual(bytes);
});
test('a committed submission survives a lost database acknowledgment', async () => {
  const actual = jest.requireActual('@/lib/core-v2/services/diagnostics').createOwnDiagnosticSubmission;
  (createOwnDiagnosticSubmission as jest.Mock).mockImplementationOnce(async (...args) => {
    await actual(...args);
    throw new Error('simulated lost commit acknowledgment');
  });
  const result = await deposit();
  expect(await h.client.diagnosticSubmission.count()).toBe(1);
  expect(await readDiagnosticSubmissionBytes(result.submission.storageKey)).toEqual(bytes);
});
test('an uncommitted database refusal removes its own encrypted file', async () => {
  (createOwnDiagnosticSubmission as jest.Mock).mockRejectedValueOnce(new Error('simulated uncommitted database refusal'));
  await expect(deposit()).rejects.toThrow('simulated uncommitted database refusal');
  expect(await h.client.diagnosticSubmission.count()).toBe(0);
  expect(await readdir(join(diagnosticsStorageRoot(), assignmentId))).toEqual([]);
});
