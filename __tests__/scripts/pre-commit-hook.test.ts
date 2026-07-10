/**
 * Tests for pre-commit-hook.sh allowlist logic.
 *
 * Sources the hook functions and exercises is_value_allowlisted
 * against real and injected content. Fixtures in .sample files.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const hookPath = join(process.cwd(), 'scripts/pre-commit-hook.sh');
const gateContent = readFileSync(join(process.cwd(), 'scripts/gate-all.sh'), 'utf8');

const fixturesDir = join(process.cwd(), '__tests__/scripts/fixtures/secret-scan');
const fixtureBenign = readFileSync(join(fixturesDir, 'gate-benign.sample'), 'utf8').trim();
const fixtureMalicious = readFileSync(join(fixturesDir, 'gate-malicious.sample'), 'utf8').trim();
const fixtureNextauth = readFileSync(join(fixturesDir, 'gate-nextauth.sample'), 'utf8').trim();
const fixtureNextauthHardcoded = readFileSync(join(fixturesDir, 'gate-nextauth-hardcoded.sample'), 'utf8').trim();
const fixturePostgresQuoted = readFileSync(join(fixturesDir, 'gate-postgres-quoted.sample'), 'utf8').trim();

function runAllowlistCheck(file: string, pattern: string, content: string): number {
  const script = `
    set -euo pipefail
    ${readAllowlistFromHook()}
    ${readFunctionFromHook()}
    CONTENT=$(cat <<'CONTENT_EOF'
${content}
CONTENT_EOF
    )
    is_value_allowlisted "${file}" "${pattern}" "$CONTENT"
  `;
  try {
    execSync(`bash -c '${script.replace(/'/g, "'\\''")}'`, { stdio: 'pipe' });
    return 0;
  } catch (err: unknown) {
    const e = err as { status?: number };
    return e.status ?? 1;
  }
}

function readAllowlistFromHook(): string {
  const hook = readFileSync(hookPath, 'utf8');
  const start = hook.indexOf('SECRET_SCAN_VALUE_ALLOWLIST=(');
  const end = hook.indexOf('\n)', start) + 2;
  return hook.slice(start, end);
}

function readFunctionFromHook(): string {
  const hook = readFileSync(hookPath, 'utf8');
  const start = hook.indexOf('is_value_allowlisted()');
  const end = hook.indexOf('\n}', start) + 2;
  return hook.slice(start, end);
}

describe('pre-commit-hook allowlist', () => {
  it('exempts benign POSTGRES password in real gate-all.sh', () => {
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      fixtureBenign.split('=')[0] + '=',
      gateContent
    );
    expect(exitCode).toBe(0);
  });

  it('blocks non-benign POSTGRES password suffix', () => {
    const injected = gateContent + '\n' + fixtureMalicious + '\n';
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      fixtureMalicious.split('=')[0] + '=',
      injected
    );
    expect(exitCode).toBe(1);
  });

  it('blocks quoted POSTGRES secret (empty extract = fail closed)', () => {
    const injected = gateContent + '\n' + fixturePostgresQuoted + '\n';
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      fixturePostgresQuoted.split('=')[0] + '=',
      injected
    );
    expect(exitCode).toBe(1);
  });

  it('exempts NEXTAUTH command substitution in real gate-all.sh', () => {
    // Precondition: the real gate-all.sh MUST contain NEXTAUTH_SECRET=
    const nextauthPattern = fixtureNextauth.split('=')[0] + '=';
    expect(gateContent).toContain(nextauthPattern);
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      nextauthPattern,
      gateContent
    );
    expect(exitCode).toBe(0);
  });

  it('blocks hardcoded NEXTAUTH literal secret', () => {
    const nextauthPattern = fixtureNextauthHardcoded.split('=')[0] + '=';
    const injected = gateContent + '\n' + fixtureNextauthHardcoded + '\n';
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      nextauthPattern,
      injected
    );
    expect(exitCode).toBe(1);
  });
});
