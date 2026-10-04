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
import { scanDiagnosticSubmissionFile } from '@/lib/core-v2/diagnostics/virus-scan';
import { writeDiagnosticStorageFile } from '@/lib/core-v2/diagnostics/storage';

const previousMode = process.env.DIAGNOSTIC_AV_MODE;

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

describe('scanDiagnosticSubmissionFile — real ClamAV daemon over INSTREAM/TCP (DIAGNOSTIC_AV_CLAMD_TCP_HOST configured)', () => {
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
    const result = await scanDiagnosticSubmissionFile(path);
    expect(result.clean).toBe(true);
    expect(result.engine).toMatch(/^clamd-instream-tcp:/);
  });

  test('the official EICAR test signature is genuinely detected by the real engine — not a fabricated verdict', async () => {
    const path = `real-av-eicar-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, Buffer.from(EICAR));
    await expect(scanDiagnosticSubmissionFile(path)).rejects.toThrow(/^MALWARE_DETECTED:/);
  });

  test('an unreachable/misconfigured engine fails closed (AV_SCAN_FAILED), never a false "clean"', async () => {
    const path = `real-av-unreachable-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, Buffer.from('%PDF-1.0\nirrelevant, the engine itself is unreachable in this case\n%%EOF'));
    const previousHost = process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST;
    const previousPort = process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT;
    process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST = '127.0.0.1';
    process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT = '39999'; // nothing listens here
    try {
      await expect(scanDiagnosticSubmissionFile(path)).rejects.toThrow();
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
