/**
 * Real ClamAV integration (mission §2/§3) — explicitly separated from the
 * mocked unit coverage in submission-pipeline.test.ts. This exercises the
 * ACTUAL official clamd daemon (inside the `nexus-clamav-c1` container,
 * started for this rehearsal) over its own native INSTREAM wire protocol
 * on a plain TCP socket — no `docker exec`, no Docker daemon access, no
 * external clamdscan binary — with the real, officially-distributed
 * signature database, never a fabricated verdict. This qualification lane
 * requires an explicit local daemon and isolated synthetic storage; missing
 * infrastructure fails rather than silently skipping required AV evidence.
 *
 * Naming: `.real.test.ts`, same convention as the rest of this codebase's
 * real-infrastructure-dependent suites (jest.unit.config.js excludes this
 * pattern from the mocked unit lane on purpose).
 */
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { writeNpcStorageFileAtomic } from '@/lib/npc/storage-root';
import { scanDiagnosticSubmissionFile } from '@/lib/core-v2/diagnostics/virus-scan';
import { scanPrivateFile } from '@/lib/security/private-file-antivirus';
import { writeDiagnosticStorageFile, diagnosticsStorageRoot } from '@/lib/core-v2/diagnostics/storage';

const previousMode = process.env.DIAGNOSTIC_AV_MODE;

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

describe.each(['diagnostic', 'general'] as const)('%s private file — real ClamAV daemon over INSTREAM/TCP', kind => {
  const scan = (path: string) => kind === 'diagnostic' ? scanDiagnosticSubmissionFile(path) : scanPrivateFile(resolve(diagnosticsStorageRoot(), path));
  beforeAll(() => {
    if (!process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST || !process.env.DOCUMENT_STORAGE_ROOT) throw new Error('DIAGNOSTIC_AV_REAL_TEST_CONFIGURATION_REQUIRED');
    process.env.DIAGNOSTIC_AV_MODE = 'clamdscan';
  });

  afterAll(() => {
    if (previousMode === undefined) delete process.env.DIAGNOSTIC_AV_MODE; else process.env.DIAGNOSTIC_AV_MODE = previousMode;
  });

  test('a harmless synthetic file is genuinely scanned and reported clean by the real engine', async () => {
    const path = `real-av-clean-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, Buffer.from('%PDF-1.0\nharmless synthetic content, no signature match expected\n%%EOF'));
    const result = await scan(path);
    expect(result.clean).toBe(true);
    expect(result.engine).toMatch(/^clamd-instream-tcp:/);
  });

  test('the official EICAR test signature is genuinely detected by the real engine — not a fabricated verdict', async () => {
    const path = `real-av-eicar-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, Buffer.from(EICAR));
    await expect(scan(path)).rejects.toThrow(/^MALWARE_DETECTED:/);
  });

  test('an unreachable/misconfigured engine fails closed (AV_SCAN_FAILED), never a false "clean"', async () => {
    const path = `real-av-unreachable-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, Buffer.from('%PDF-1.0\nirrelevant, the engine itself is unreachable in this case\n%%EOF'));
    const previousHost = process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST;
    const previousPort = process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT;
    process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST = '127.0.0.1';
    process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT = '39999'; // nothing listens here
    try {
      await expect(scan(path)).rejects.toThrow();
    } finally {
      process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST = previousHost;
      process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT = previousPort;
    }
  });
});

// The "no engine configured at all" / "engine unavailable while mandatory"
// scenarios are covered by mocked, environment-independent tests in
// submission-pipeline.test.ts — not repeated here, since a host that
// happens to have a real clamdscan on PATH would make that specific
// assertion flaky in exactly the opposite direction this file exists to
// avoid (a mocked "always clean" double masquerading as a real verdict).

// Exercise the actual atomic writer: scanner reads /proc/<parent-pid>/fd/<fd>
// while the final pathname is still unpublished.
describe('NPC atomic writer with real ClamAV', () => {
  let root: string;
  const priorRoot = process.env.NPC_STORAGE_ROOT;
  beforeEach(async () => {
    if (!process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST) throw new Error('DIAGNOSTIC_AV_REAL_TEST_CONFIGURATION_REQUIRED');
    process.env.DIAGNOSTIC_AV_MODE = 'clamdscan';
    root = await mkdtemp(join(tmpdir(), 'nexus-npc-real-av-'));
    process.env.NPC_STORAGE_ROOT = join(root, 'private');
    await mkdir(process.env.NPC_STORAGE_ROOT, { mode: 0o750 });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    if (priorRoot === undefined) delete process.env.NPC_STORAGE_ROOT; else process.env.NPC_STORAGE_ROOT = priorRoot;
    if (previousMode === undefined) delete process.env.DIAGNOSTIC_AV_MODE; else process.env.DIAGNOSTIC_AV_MODE = previousMode;
  });
  test('publishes harmless bytes from the scanned open inode', async () => {
    const bytes = Buffer.from('synthetic harmless document');
    const result = await writeNpcStorageFileAtomic('student/clean.pdf', bytes, bytes.length);
    expect(await readFile(result.filePath)).toEqual(bytes);
  });
  test('real EICAR verdict removes only the quarantine file and publishes nothing', async () => {
    const bytes = Buffer.from(EICAR);
    await expect(writeNpcStorageFileAtomic('student/rejected.pdf', bytes, bytes.length)).rejects.toThrow(/^MALWARE_DETECTED:/);
    expect(await readdir(join(process.env.NPC_STORAGE_ROOT!, 'student'))).toEqual([]);
  });
});
