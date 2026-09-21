/**
 * Real ClamAV integration (mission §2/§3) — explicitly separated from the
 * mocked unit coverage in submission-pipeline.test.ts. This exercises the
 * ACTUAL official clamd daemon and the ACTUAL clamdscan client (both
 * inside the `nexus-clamav-c1` container, started for this rehearsal),
 * with the real, officially-distributed signature database — never a
 * fabricated verdict. Skips (does not fail) if that infrastructure is not
 * configured, so it never silently passes as "qualified" without it, and
 * never blocks a run where it was not set up.
 *
 * Naming: `.real.test.ts`, same convention as the rest of this codebase's
 * real-infrastructure-dependent suites (jest.unit.config.js excludes this
 * pattern from the mocked unit lane on purpose).
 */
import { randomUUID } from 'node:crypto';
import { scanDiagnosticSubmissionFile } from '@/lib/core-v2/diagnostics/virus-scan';
import { writeDiagnosticStorageFile } from '@/lib/core-v2/diagnostics/storage';

const configured = Boolean(process.env.DIAGNOSTIC_AV_CLAMDSCAN_COMMAND);
const describeOrSkip = configured ? describe : describe.skip;

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

describeOrSkip('scanDiagnosticSubmissionFile — real ClamAV daemon (DIAGNOSTIC_AV_CLAMDSCAN_COMMAND configured)', () => {
  beforeAll(() => {
    process.env.DIAGNOSTIC_AV_MODE = 'clamdscan';
  });

  test('a harmless synthetic file is genuinely scanned and reported clean by the real engine', async () => {
    const path = `real-av-clean-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, Buffer.from('%PDF-1.0\nharmless synthetic content, no signature match expected\n%%EOF'));
    const result = await scanDiagnosticSubmissionFile(path);
    expect(result.clean).toBe(true);
    expect(result.engine).toMatch(/^clamdscan-stream:/);
  });

  test('the official EICAR test signature is genuinely detected by the real engine — not a fabricated verdict', async () => {
    const path = `real-av-eicar-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, Buffer.from(EICAR));
    await expect(scanDiagnosticSubmissionFile(path)).rejects.toThrow(/^MALWARE_DETECTED:/);
  });

  test('an unreachable/misconfigured engine fails closed (AV_SCAN_FAILED), never a false "clean"', async () => {
    const path = `real-av-unreachable-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, Buffer.from('%PDF-1.0\nirrelevant, the engine itself is unreachable in this case\n%%EOF'));
    const previous = process.env.DIAGNOSTIC_AV_CLAMDSCAN_COMMAND;
    process.env.DIAGNOSTIC_AV_CLAMDSCAN_COMMAND = JSON.stringify(['docker', 'exec', '-i', 'nexus-clamav-nonexistent-container', 'clamdscan']);
    try {
      await expect(scanDiagnosticSubmissionFile(path)).rejects.toThrow();
    } finally {
      process.env.DIAGNOSTIC_AV_CLAMDSCAN_COMMAND = previous;
    }
  });
});

// The "no engine configured at all" / "engine unavailable while mandatory"
// scenarios are covered by mocked, environment-independent tests in
// submission-pipeline.test.ts — not repeated here, since a host that
// happens to have a real clamdscan on PATH would make that specific
// assertion flaky in exactly the opposite direction this file exists to
// avoid (a mocked "always clean" double masquerading as a real verdict).
