/**
 * A sign-in refused by the rate limiter must stay indistinguishable FOR THE
 * CALLER from a wrong password, and must be distinguishable FOR OPERATIONS.
 *
 * Measured on the running application before this guard existed: a throttled
 * attempt, a wrong password and a rate-limit backend outage produced
 * byte-identical evidence — same redirect, same single `CredentialsSignin`
 * line. A Redis failure in production would therefore have read as "every
 * password is suddenly wrong", which is the worst possible thing to be told
 * while an outage is in progress.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const authSource = readFileSync(join(process.cwd(), 'auth.ts'), 'utf8');

describe('sign-in refused by the rate limiter', () => {
  test('the refusal is logged server-side, and says which of the two cases it is', () => {
    // The guard's result must not be discarded silently.
    expect(authSource).not.toMatch(/if\s*\(blocked\)\s*return null/);

    const branch = authSource.slice(authSource.indexOf('if (blocked)'), authSource.indexOf('return authorizeCredentials'));
    expect(branch).toMatch(/logger\.(warn|error)\s*\(/);
    expect(branch).toContain('BACKEND_UNAVAILABLE');
    expect(branch).toContain('THROTTLED');
    // 503 is the fail-closed outage; anything else is an ordinary throttle.
    expect(branch).toMatch(/blocked\.status\s*===\s*503/);
    expect(branch).toMatch(/return null/);
  });

  test('nothing about the refusal reaches the caller, and no identity is logged', () => {
    // Comments explain the reasoning and legitimately use words like
    // "password"; the assertions below are about the CODE, so strip them.
    const branch = authSource
      .slice(authSource.indexOf('if (blocked)'), authSource.indexOf('return authorizeCredentials'))
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    // The blocked NextResponse (which carries RATE_LIMIT_* details and retry
    // headers) must never be returned to the sign-in caller.
    expect(branch).not.toMatch(/return\s+blocked/);
    // No identifier, e-mail or password may appear in the log payload.
    expect(branch).not.toMatch(/identifier|credentials\.email|password/);
  });
});
