/** @jest-environment node */
import { saveAttachment } from '@/lib/espace/files';
import { loadWorkForActor } from '@/lib/espace/access';
import { scanPrivateBytes } from '@/lib/security/private-file-antivirus';
import { writeFile, unlink } from 'node:fs/promises';
import { prisma } from '@/lib/prisma';
const mockCreate = jest.fn();
jest.mock('@/lib/prisma', () => ({ prisma: {
  espaceWorkAttachment: { count: jest.fn(async () => 0) },
  $transaction: jest.fn(async callback => callback({ espaceWorkAttachment: { create: mockCreate }, espaceWork: { updateMany: async () => ({ count: 1 }) } })),
} }));
jest.mock('@/lib/espace/access', () => ({ loadWorkForActor: jest.fn() }));
jest.mock('@/lib/security/private-file-antivirus', () => ({ scanPrivateBytes: jest.fn() }));
jest.mock('@/lib/security/private-file-write', () => ({ writePrivateFileExclusive: jest.fn((path, bytes) =>
  require('node:fs/promises').writeFile(path, bytes, { mode: 0o600, flag: 'wx' })) }));
jest.mock('node:fs/promises', () => ({ mkdir: jest.fn(async () => undefined), writeFile: jest.fn(async () => undefined), unlink: jest.fn(async () => undefined) }));
const actor = { id: 'synthetic-student', role: 'ELEVE' as const, firstName: null, lastName: null, mustChangeCredential: false };
const file = { name: 'copie.pdf', bytes: Uint8Array.from(Buffer.from('%PDF-1.4 synthetic')) };
beforeEach(() => {
  jest.clearAllMocks();
  (loadWorkForActor as jest.Mock).mockReset().mockResolvedValue({ work: { status: 'DRAFT', activity: { kind: 'UPLOAD_EXERCISE' } } });
  (scanPrivateBytes as jest.Mock).mockReset().mockResolvedValue({ clean: true, engine: 'synthetic-test-double' });
  mockCreate.mockResolvedValue({ id: 'synthetic-attachment', originalName: 'copie.pdf', mimeType: 'application/pdf', sizeBytes: file.bytes.length, createdAt: new Date() });
});
test('scans clear bytes before any filesystem or database write', async () => {
  (scanPrivateBytes as jest.Mock).mockImplementation(async (clear: Buffer) => {
    expect(clear).toEqual(Buffer.from(file.bytes));
    expect(writeFile).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    return { clean: true, engine: 'synthetic-test-double' };
  });
  await expect(saveAttachment(actor, 'synthetic-work', file)).resolves.toMatchObject({ id: 'synthetic-attachment' });
  expect(scanPrivateBytes).toHaveBeenCalledTimes(1);
});
test.each([['MALWARE_DETECTED', 'UPLOAD_REJECTED', 400], ['AV_SCAN_TIMEOUT', 'UPLOAD_SCAN_UNAVAILABLE', 503]])('refuses %s without attachment or work mutation', async (reason, code, status) => {
  (scanPrivateBytes as jest.Mock).mockRejectedValue(new Error(reason));
  await expect(saveAttachment(actor, 'synthetic-work', file)).rejects.toMatchObject({ code, status });
  expect(prisma.$transaction).not.toHaveBeenCalled();
  expect(writeFile).not.toHaveBeenCalled();
  expect(unlink).not.toHaveBeenCalled();
});
test('checks ownership before any filesystem or antivirus work', async () => {
  (loadWorkForActor as jest.Mock).mockRejectedValue(new Error('synthetic-denied'));
  await expect(saveAttachment(actor, 'foreign-work', file)).rejects.toThrow('synthetic-denied');
  expect(writeFile).not.toHaveBeenCalled();expect(scanPrivateBytes).not.toHaveBeenCalled();
});
