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
const fixtureNextauthSubstMalicious = readFileSync(join(fixturesDir, 'gate-nextauth-subst-malicious.sample'), 'utf8').trim();

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

function runSafeExamplePathCheck(file: string): number {
  const hook = readFileSync(hookPath, 'utf8');
  const start = hook.indexOf('is_safe_env_example_path()');
  const end = hook.indexOf('\n}', start) + 2;
  const source = start >= 0 && end > start ? hook.slice(start, end) : '';
  try {
    execSync(`bash -c '${source.replace(/'/g, "'\\''")}\nis_safe_env_example_path "${file}"'`, {
      stdio: 'pipe',
    });
    return 0;
  } catch (err: unknown) {
    const error = err as { status?: number };
    return error.status ?? 1;
  }
}

describe('pre-commit-hook allowlist', () => {
  it('allows only explicit environment example filenames through the path gate', () => {
    expect(runSafeExamplePathCheck('.env.example')).toBe(0);
    expect(runSafeExamplePathCheck('.env.production.example')).toBe(0);
    expect(runSafeExamplePathCheck('config/.env.preview.example')).toBe(0);
    expect(runSafeExamplePathCheck('.env')).toBe(1);
    expect(runSafeExamplePathCheck('.env.production')).toBe(1);
  });

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

  it('blocks NEXTAUTH_SECRET inside non-node substitution (P2 Codex)', () => {
    // $(printf %s super-secret) is a substitution, but NOT the legitimate
    // $(node -p ...) pattern — the secret is INSIDE the substitution.
    const nextauthPattern = fixtureNextauthSubstMalicious.split('=')[0] + '=';
    const injected = gateContent + '\n' + fixtureNextauthSubstMalicious + '\n';
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      nextauthPattern,
      injected
    );
    expect(exitCode).toBe(1);
  });

  // ── File-scoped substitution tests (regression proof) ──

  it('blocks $(node -e ...) in a NON-allowlisted file (RED proof)', () => {
    // A $(node ...) substitution in a file that is NOT in the allowlist
    // must be blocked — there is NO global $(node exemption.
    const content = 'NEXTAUTH_SECRET=$(node -e "real-secret")';
    const exitCode = runAllowlistCheck(
      'scripts/other.sh',
      'NEXTAUTH_SECRET=',
      content
    );
    expect(exitCode).toBe(1);
  });

  it('blocks SMTP_PASSWORD=$(node ...) in gate-all.sh (pattern not allowlisted)', () => {
    // gate-all.sh allowlists NEXTAUTH_SECRET= and POSTGRES_PASSWORD=,
    // but NOT SMTP_PASSWORD= — a $(node) substitution for an un-allowlisted
    // pattern must be blocked even in an allowlisted file.
    const content = 'SMTP_PASSWORD=$(node -e "something")';
    const exitCode = runAllowlistCheck(
      'scripts/gate-all.sh',
      'SMTP_PASSWORD=',
      content
    );
    expect(exitCode).toBe(1);
  });
});
