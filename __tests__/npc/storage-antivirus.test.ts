/** @jest-environment node */
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanPrivateBytes } from '@/lib/security/private-file-antivirus';
import { saveUploadedFile } from '@/lib/npc/storage';
import { writeNpcStorageFileAtomic } from '@/lib/npc/storage-root';
jest.mock('@/lib/security/private-file-antivirus', () => ({ scanPrivateBytes: jest.fn() }));
let directory: string;
const previous = process.env.NPC_STORAGE_ROOT;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'nexus-npc-av-'));
  process.env.NPC_STORAGE_ROOT = join(directory, 'private');
  await mkdir(process.env.NPC_STORAGE_ROOT, { mode: 0o750 });
  (scanPrivateBytes as jest.Mock).mockReset();
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
  if (previous === undefined) delete process.env.NPC_STORAGE_ROOT; else process.env.NPC_STORAGE_ROOT = previous;
});
test('scans the exact clear snapshot before creating any inode', async () => {
  const bytes = Buffer.from('synthetic private upload');
  (scanPrivateBytes as jest.Mock).mockImplementation(async (clear: Buffer) => {
    expect(clear).toEqual(bytes);
    expect(await readdir(process.env.NPC_STORAGE_ROOT!)).toEqual([]);
    await expect(readFile(join(process.env.NPC_STORAGE_ROOT!, 'student/copy.pdf'))).rejects.toMatchObject({ code: 'ENOENT' });
    return { clean: true, engine: 'synthetic-test-double' };
  });
  const result = await writeNpcStorageFileAtomic('student/copy.pdf', bytes, bytes.length);
  expect(scanPrivateBytes).toHaveBeenCalledTimes(1);
  expect(await readFile(result.filePath)).toEqual(bytes);
});
test.each(['MALWARE_DETECTED', 'AV_SCAN_TIMEOUT'])('cleans the temporary inode and publishes nothing on %s', async reason => {
  (scanPrivateBytes as jest.Mock).mockRejectedValue(new Error(reason));
  await expect(writeNpcStorageFileAtomic('student/copy.pdf', Buffer.from('synthetic'), 9)).rejects.toThrow(reason);
  expect(await readdir(process.env.NPC_STORAGE_ROOT!)).toEqual([]);
});

test.each([['MALWARE_DETECTED', 'DOCUMENT_REJECTED'], ['AV_SCAN_TIMEOUT', 'DOCUMENT_SCAN_UNAVAILABLE']])('returns a safe public upload code for %s', async (reason, code) => {
  (scanPrivateBytes as jest.Mock).mockRejectedValue(new Error(reason));
  const result = await saveUploadedFile(Buffer.from('synthetic'), {
    secureId: 'synthetic-id', originalName: 'copy.pdf', sanitizedName: 'copy.pdf', mimeType: 'application/pdf',
    sizeBytes: 9, createdAt: new Date(), studentId: 'synthetic-student', submissionId: 'synthetic-submission', pageNumber: 1,
  });
  expect(result).toEqual({ success: false, error: code });
});
