/**
 * Landing mission §10 — the auth rollout mode cannot be bypassed, defaulted
 * or downgraded by configuration accidents:
 *   - production startup calls the fail-closed preflight;
 *   - the env contract declares CORE_V2_AUTH_MODE required in production;
 *   - the authority module never derives "V1" from a missing Core v2 URL;
 *   - every stack/CI lane that runs the app declares the mode explicitly.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('AUTH_ROLLOUT_MODE_NO_DOWNGRADE', () => {
  test('instrumentation.ts runs the rollout preflight and exits the process on failure', () => {
    const src = read('instrumentation.ts');
    expect(src).toMatch(/auth-rollout-startup/);
    const block = src.slice(src.indexOf('assertAuthRolloutStartup'));
    expect(block).toMatch(/AUTH_ROLLOUT_PREFLIGHT_FAILED[\s\S]*process\.exit\(1\)/);
  });

  test('the env contract requires CORE_V2_AUTH_MODE in production', () => {
    expect(read('lib/env-validation.ts')).toMatch(/name: 'CORE_V2_AUTH_MODE', level: 'REQUIRED'/);
  });

  test('the rollout module has no default mode and the authority module never turns a missing URL into V1', () => {
    const rollout = read('lib/core-v2/auth/rollout.ts');
    expect(rollout).not.toMatch(/\?\?\s*'(V1_ONLY|HYBRID|V2_ONLY)'/);
    expect(rollout).toMatch(/throw new CoreV2ConfigError/);
    const authority = read('lib/core-v2/auth/authority.ts');
    expect(authority).not.toMatch(/CoreV2DatabaseUrlError\)\s*return 'V1'/);
    expect(authority).not.toMatch(/isCoreV2AuthConfigured\(\)\)\s*return 'V1'/);
    expect(authority).toMatch(/CoreV2AuthorityUnavailableError/);
  });

  test('every lane that runs the application declares the mode explicitly', () => {
    // Production contract: Core v1 is the only credential authority. Disposable
    // lanes exercise exactly that mode, never a broader one.
    expect(read('docker-compose.e2e.yml')).toMatch(/CORE_V2_AUTH_MODE: V1_ONLY/);
    expect(read('.github/workflows/ci.yml')).toMatch(/CORE_V2_AUTH_MODE: V1_ONLY/);
    expect(read('docker-compose.e2e.yml')).not.toMatch(/CORE_V2_AUTH_MODE:\s*(HYBRID|V2_ONLY)/);
    expect(read('.github/workflows/ci.yml')).not.toMatch(/CORE_V2_AUTH_MODE:\s*(HYBRID|V2_ONLY)/);
    expect(read('.env.example')).toMatch(/CORE_V2_AUTH_MODE=/);
    expect(read('jest.setup.js')).toMatch(/CORE_V2_AUTH_MODE/);
  });

  /**
   * A V1_ONLY lane never reaches the Core v2 password-reset code: declaring its
   * fail-closed TTL there would state something the lane cannot honour.
   */
  test('every CI application server declares V1_ONLY and no Core v2 password-reset TTL', () => {
    const steps = read('.github/workflows/ci.yml')
      .split(/\n {6}- name: /)
      .filter((step) => /^Start Next\.js server in background/.test(step))
      .map((step) => step.slice(0, step.indexOf('\n        run:')));
    expect(steps.length).toBeGreaterThanOrEqual(3);
    for (const env of steps) {
      expect(env).toMatch(/CORE_V2_AUTH_MODE:\s*V1_ONLY/);
      expect(env).not.toMatch(/CORE_V2_PASSWORD_RESET_TTL_MINUTES:/);
    }
    expect(read('docker-compose.e2e.yml')).not.toMatch(/CORE_V2_PASSWORD_RESET_TTL_MINUTES:/);
  });
});
