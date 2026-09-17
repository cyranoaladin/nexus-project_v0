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
    expect(read('docker-compose.e2e.yml')).toMatch(/CORE_V2_AUTH_MODE: HYBRID/);
    expect(read('.github/workflows/ci.yml')).toMatch(/CORE_V2_AUTH_MODE: HYBRID/);
    expect(read('.env.example')).toMatch(/CORE_V2_AUTH_MODE=/);
    expect(read('jest.setup.js')).toMatch(/CORE_V2_AUTH_MODE/);
  });
});
