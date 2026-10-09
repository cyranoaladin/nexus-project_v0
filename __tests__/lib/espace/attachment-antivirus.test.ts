/** @jest-environment node */
import { saveAttachment } from '@/lib/espace/files';
import { loadWorkForActor } from '@/lib/espace/access';
import { scanPrivateFile } from '@/lib/security/private-file-antivirus';
import { writeFile, unlink } from 'node:fs/promises';
import { prisma } from '@/lib/prisma';
const mockCreate = jest.fn();
jest.mock('@/lib/prisma', () => ({ prisma: {
  espaceWorkAttachment: { count: jest.fn(async () => 0) },
  $transaction: jest.fn(async callback => callback({ espaceWorkAttachment: { create: mockCreate }, espaceWork: { updateMany: async () => ({ count: 1 }) } })),
} }));
jest.mock('@/lib/espace/access', () => ({ loadWorkForActor: jest.fn() }));
jest.mock('@/lib/security/private-file-antivirus', () => ({ scanPrivateFile: jest.fn() }));
jest.mock('node:fs/promises', () => ({ mkdir: jest.fn(async () => undefined), writeFile: jest.fn(async () => undefined), unlink: jest.fn(async () => undefined) }));
const actor = { id: 'synthetic-student', role: 'ELEVE' as const, firstName: null, lastName: null, mustChangeCredential: false };
const file = { name: 'copie.pdf', bytes: Uint8Array.from(Buffer.from('%PDF-1.4 synthetic')) };
beforeEach(() => {
  jest.clearAllMocks();
  (loadWorkForActor as jest.Mock).mockReset().mockResolvedValue({ work: { status: 'DRAFT', activity: { kind: 'UPLOAD_EXERCISE' } } });
  (scanPrivateFile as jest.Mock).mockReset().mockResolvedValue({ clean: true, engine: 'synthetic-test-double' });
  mockCreate.mockResolvedValue({ id: 'synthetic-attachment', originalName: 'copie.pdf', mimeType: 'application/pdf', sizeBytes: file.bytes.length, createdAt: new Date() });
});
test('publishes the attachment only after scanning the private exclusive file', async () => {
  (scanPrivateFile as jest.Mock).mockImplementation(async (path: string) => {
    expect(writeFile).toHaveBeenCalledWith(path, file.bytes, { mode: 0o600, flag: 'wx' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    return { clean: true, engine: 'synthetic-test-double' };
  });
  await expect(saveAttachment(actor, 'synthetic-work', file)).resolves.toMatchObject({ id: 'synthetic-attachment' });
  expect(scanPrivateFile).toHaveBeenCalledTimes(1);
});
test.each([['MALWARE_DETECTED:synthetic', 'UPLOAD_REJECTED', 400], ['AV_SCAN_TIMEOUT', 'UPLOAD_SCAN_UNAVAILABLE', 503]])('refuses %s without attachment or work mutation', async (reason, code, status) => {
  (scanPrivateFile as jest.Mock).mockRejectedValue(new Error(reason));
  await expect(saveAttachment(actor, 'synthetic-work', file)).rejects.toMatchObject({ code, status });
  expect(prisma.$transaction).not.toHaveBeenCalled();
  expect(unlink).toHaveBeenCalledWith((writeFile as jest.Mock).mock.calls[0][0]);
});
test('checks ownership before any filesystem or antivirus work', async () => {
  (loadWorkForActor as jest.Mock).mockRejectedValue(new Error('synthetic-denied'));
  await expect(saveAttachment(actor, 'foreign-work', file)).rejects.toThrow('synthetic-denied');
  expect(writeFile).not.toHaveBeenCalled();expect(scanPrivateFile).not.toHaveBeenCalled();
});
