/**
 * scanDiagnosticSubmissionFile's mode resolution — pure, no real file or
 * daemon needed (the disabled/refused branches return or throw before
 * ever touching disk). Mission §3: `disabled` must never become an
 * accidental way to skip the real scan in production, but a CI job that
 * deliberately builds with NODE_ENV=production (a real production-shaped
 * artifact) and has no clamd of its own available is a legitimate,
 * explicitly-declared HTTP-boundary proof tier — never inferred from
 * NODE_ENV alone, only via the same narrow E2E_DISPOSABLE_STACK flag
 * already used elsewhere in this codebase for exactly this distinction.
 */
import { scanDiagnosticSubmissionFile } from '@/lib/core-v2/diagnostics/virus-scan';

const ENV_KEYS = ['DIAGNOSTIC_AV_MODE', 'NODE_ENV', 'E2E_DISPOSABLE_STACK'] as const;
const env = process.env as unknown as Record<string, string | undefined>;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) saved[key] = env[key];
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
});

describe('scanDiagnosticSubmissionFile — mode resolution (no real file touched on these paths)', () => {
  test('unset mode outside production: accepted as a development no-op', async () => {
    delete env.DIAGNOSTIC_AV_MODE;
    env.NODE_ENV = 'test';
    delete env.E2E_DISPOSABLE_STACK;
    await expect(scanDiagnosticSubmissionFile('irrelevant.pdf')).resolves.toEqual({ clean: true, engine: 'disabled-development' });
  });

  test('unset mode in production, no disposable-stack flag: fails closed, never a silent accept', async () => {
    delete env.DIAGNOSTIC_AV_MODE;
    env.NODE_ENV = 'production';
    delete env.E2E_DISPOSABLE_STACK;
    await expect(scanDiagnosticSubmissionFile('irrelevant.pdf')).rejects.toThrow('AV_NOT_CONFIGURED');
  });

  test('explicit DIAGNOSTIC_AV_MODE=disabled in production, no disposable-stack flag: still refused', async () => {
    env.DIAGNOSTIC_AV_MODE = 'disabled';
    env.NODE_ENV = 'production';
    delete env.E2E_DISPOSABLE_STACK;
    await expect(scanDiagnosticSubmissionFile('irrelevant.pdf')).rejects.toThrow('AV_NOT_CONFIGURED');
  });

  test('DIAGNOSTIC_AV_MODE=disabled in production WITH the explicit disposable-stack flag: accepted as an HTTP-boundary rehearsal, distinctly labeled', async () => {
    env.DIAGNOSTIC_AV_MODE = 'disabled';
    env.NODE_ENV = 'production';
    env.E2E_DISPOSABLE_STACK = '1';
    await expect(scanDiagnosticSubmissionFile('irrelevant.pdf')).resolves.toEqual({ clean: true, engine: 'disabled-e2e-disposable' });
  });

  test('unset mode in production WITH the disposable-stack flag: still refused — the carve-out requires an EXPLICIT DIAGNOSTIC_AV_MODE=disabled, it is not inferred from E2E_DISPOSABLE_STACK alone', async () => {
    delete env.DIAGNOSTIC_AV_MODE;
    env.NODE_ENV = 'production';
    env.E2E_DISPOSABLE_STACK = '1';
    await expect(scanDiagnosticSubmissionFile('irrelevant.pdf')).rejects.toThrow('AV_NOT_CONFIGURED');
  });

  test('an unrecognized DIAGNOSTIC_AV_MODE value is refused, never silently accepted', async () => {
    env.DIAGNOSTIC_AV_MODE = 'something-typo-ed';
    env.NODE_ENV = 'test';
    await expect(scanDiagnosticSubmissionFile('irrelevant.pdf')).rejects.toThrow('AV_NOT_CONFIGURED');
  });
});
