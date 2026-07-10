/**
 * Tests for pre-commit-hook.sh allowlist logic.
 *
 * Sources the hook functions and exercises is_value_allowlisted
 * against real and injected content.
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

/**
 * Source the hook (allowlist + function only), then call is_value_allowlisted
 * with the given file, pattern, and content. Returns exit code.
 */
function runAllowlistCheck(file: string, pattern: string, content: string): number {
  // Extract the allowlist array and function from the hook, then invoke.
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
  it('exempts the REAL gate-all.sh content (benign fixture)', () => {
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      fixtureBenign.split('=')[0] + '=',
      gateContent
    );
    expect(exitCode).toBe(0); // exempted
  });

  it('blocks non-benign suffix (malicious fixture)', () => {
    const injected = gateContent + '\n' + fixtureMalicious + '\n';
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      fixtureMalicious.split('=')[0] + '=',
      injected
    );
    expect(exitCode).toBe(1); // blocked
  });

  it('blocks unrelated pattern in gate-all.sh (nextauth fixture)', () => {
    const injected = gateContent + '\n' + fixtureNextauth + '\n';
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      fixtureNextauth.split('=')[0] + '=',
      injected
    );
    expect(exitCode).toBe(1); // blocked (no allowlist entry for this pattern)
  });
});
