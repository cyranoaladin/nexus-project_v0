/** @jest-environment node */
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanPrivateFile } from '@/lib/security/private-file-antivirus';
import { saveUploadedFile } from '@/lib/npc/storage';
import { writeNpcStorageFileAtomic } from '@/lib/npc/storage-root';
jest.mock('@/lib/security/private-file-antivirus', () => ({ scanPrivateFile: jest.fn() }));
let directory: string;
const previous = process.env.NPC_STORAGE_ROOT;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'nexus-npc-av-'));
  process.env.NPC_STORAGE_ROOT = join(directory, 'private');
  await mkdir(process.env.NPC_STORAGE_ROOT, { mode: 0o750 });
  (scanPrivateFile as jest.Mock).mockReset();
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
  if (previous === undefined) delete process.env.NPC_STORAGE_ROOT; else process.env.NPC_STORAGE_ROOT = previous;
});
test('scans the exact persisted inode before publishing its final name', async () => {
  const bytes = Buffer.from('synthetic private upload');
  (scanPrivateFile as jest.Mock).mockImplementation(async (path: string) => {
    expect(await readFile(path)).toEqual(bytes);
    await expect(readFile(join(process.env.NPC_STORAGE_ROOT!, 'student/copy.pdf'))).rejects.toMatchObject({ code: 'ENOENT' });
    return { clean: true, engine: 'synthetic-test-double' };
  });
  const result = await writeNpcStorageFileAtomic('student/copy.pdf', bytes, bytes.length);
  expect(scanPrivateFile).toHaveBeenCalledTimes(1);
  expect(await readFile(result.filePath)).toEqual(bytes);
});
test.each(['MALWARE_DETECTED:synthetic', 'AV_SCAN_TIMEOUT'])('cleans the temporary inode and publishes nothing on %s', async reason => {
  (scanPrivateFile as jest.Mock).mockRejectedValue(new Error(reason));
  await expect(writeNpcStorageFileAtomic('student/copy.pdf', Buffer.from('synthetic'), 9)).rejects.toThrow(reason);
  expect(await readdir(join(process.env.NPC_STORAGE_ROOT!, 'student'))).toEqual([]);
});

test.each([['MALWARE_DETECTED:synthetic', 'DOCUMENT_REJECTED'], ['AV_SCAN_TIMEOUT', 'DOCUMENT_SCAN_UNAVAILABLE']])('returns a safe public upload code for %s', async (reason, code) => {
  (scanPrivateFile as jest.Mock).mockRejectedValue(new Error(reason));
  const result = await saveUploadedFile(Buffer.from('synthetic'), {
    secureId: 'synthetic-id', originalName: 'copy.pdf', sanitizedName: 'copy.pdf', mimeType: 'application/pdf',
    sizeBytes: 9, createdAt: new Date(), studentId: 'synthetic-student', submissionId: 'synthetic-submission', pageNumber: 1,
  });
  expect(result).toEqual({ success: false, error: code });
});
