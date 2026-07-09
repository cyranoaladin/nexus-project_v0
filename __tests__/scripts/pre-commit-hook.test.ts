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

/**
 * Source the hook (allowlist + function only), then call is_value_allowlisted
 * with the given file, pattern, and content. Returns exit code.
 */
function runAllowlistCheck(file: string, pattern: string, content: string): number {
  // Extract the allowlist array and function from the hook, then invoke.
  const script = `
    set -euo pipefail
    # Source only the allowlist section (lines defining the array and function)
    SECRET_SCAN_VALUE_ALLOWLIST=(
      "scripts/gate-all.sh|POSTGRES_PASSWORD=|^postgres$"
    )
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

function readFunctionFromHook(): string {
  const hook = readFileSync(hookPath, 'utf8');
  const start = hook.indexOf('is_value_allowlisted()');
  const end = hook.indexOf('\n}', start) + 2;
  return hook.slice(start, end);
}

describe('pre-commit-hook allowlist', () => {
  it('exempts the REAL gate-all.sh content (POSTGRES_PASSWORD=postgres)', () => {
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      'POSTGRES_PASSWORD=',
      gateContent
    );
    expect(exitCode).toBe(0); // exempted
  });

  it('blocks POSTGRES_PASSWORD=postgres123 (non-benign suffix)', () => {
    const injected = gateContent + '\nPOSTGRES_PASSWORD=postgres123\n';
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      'POSTGRES_PASSWORD=',
      injected
    );
    expect(exitCode).toBe(1); // blocked
  });

  it('blocks NEXTAUTH_SECRET=x in gate-all.sh (allowlist covers only its pattern)', () => {
    const injected = gateContent + '\nNEXTAUTH_SECRET=supersecret\n';
    // NEXTAUTH_SECRET= is a different pattern — not in the allowlist for gate-all.sh
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      'NEXTAUTH_SECRET=',
      injected
    );
    expect(exitCode).toBe(1); // blocked (no allowlist entry for this pattern)
  });
});
