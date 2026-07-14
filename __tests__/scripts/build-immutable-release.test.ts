/**
 * Tests for build-immutable-release.sh input validation.
 *
 * These test the script's argument validation by running it with invalid
 * inputs and verifying it exits with code 1 before any git/npm operations.
 */

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const SCRIPT = join(__dirname, '../../scripts/release/build-immutable-release.sh');
const scriptContent = readFileSync(SCRIPT, 'utf8');

function runBuilder(args: string[], env: Record<string, string> = {}): { code: number; output: string } {
  try {
    const output = execFileSync('bash', [SCRIPT, ...args], {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, ...env, HOME: '/tmp' },
    });
    return { code: 0, output };
  } catch (e: any) {
    return { code: e.status ?? 1, output: (e.stdout || '') + (e.stderr || '') };
  }
}

describe('build-immutable-release.sh input validation', () => {
  test('rejects empty SHA', () => {
    const { code, output } = runBuilder([]);
    expect(code).toBe(1);
    expect(output).toContain('Usage');
  });

  test('rejects short SHA', () => {
    const { code, output } = runBuilder(['abc123']);
    expect(code).toBe(1);
    expect(output).toContain('Invalid SHA');
  });

  test('rejects SHA with uppercase', () => {
    const { code, output } = runBuilder(['ABCDEF1234567890abcdef1234567890abcdef12']);
    expect(code).toBe(1);
    expect(output).toContain('Invalid SHA');
  });

  test('rejects SHA with path traversal', () => {
    const { code, output } = runBuilder(['../../../etc/passwd/aaaaaaaaaaaaaaaaaaa']);
    expect(code).toBe(1);
    expect(output).toContain('Invalid SHA');
  });

  test('rejects SHA with slashes', () => {
    const { code, output } = runBuilder(['aaaa/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']);
    expect(code).toBe(1);
    expect(output).toContain('Invalid SHA');
  });

  test('rejects SHA with spaces', () => {
    const { code, output } = runBuilder(['aaaa bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']);
    expect(code).toBe(1);
    expect(output).toContain('Invalid SHA');
  });

  test('rejects relative releases dir', () => {
    const sha = 'a'.repeat(40);
    const { code, output } = runBuilder([sha, 'relative/path']);
    expect(code).toBe(1);
    expect(output).toContain('absolute');
  });

  test('rejects / as releases dir', () => {
    const sha = 'a'.repeat(40);
    const { code, output } = runBuilder([sha, '/']);
    expect(code).toBe(1);
    expect(output).toContain('too broad');
  });

  test('rejects /tmp as releases dir', () => {
    const sha = 'a'.repeat(40);
    const { code, output } = runBuilder([sha, '/tmp']);
    expect(code).toBe(1);
    expect(output).toContain('too broad');
  });
});

describe('build-immutable-release.sh security properties', () => {
  test('refuses root execution', () => {
    expect(scriptContent).toContain("id -un");
    expect(scriptContent).toContain("root");
    expect(scriptContent).toContain("Refusing to build as root");
  });

  test('uses umask 077', () => {
    expect(scriptContent).toContain('umask 077');
  });

  test('uses mktemp for temp directory', () => {
    expect(scriptContent).toContain('mktemp -d');
  });

  test('has cleanup trap', () => {
    expect(scriptContent).toContain('trap cleanup EXIT INT TERM HUP');
  });

  test('fetches exact SHA (not branch head)', () => {
    expect(scriptContent).toContain('git -C');
    expect(scriptContent).toContain('fetch --depth=1 origin "$SHA"');
    expect(scriptContent).toContain('checkout --detach FETCH_HEAD');
  });

  test('verifies SHA after checkout', () => {
    expect(scriptContent).toContain('ACTUAL_SHA');
    expect(scriptContent).toContain('"$ACTUAL_SHA" != "$SHA"');
  });

  test('does not contain ln -snf or pm2 reload', () => {
    expect(scriptContent).not.toContain('ln -snf');
    expect(scriptContent).not.toContain('pm2 reload');
    expect(scriptContent).not.toContain('pm2 restart');
  });

  test('outputs RELEASE_DEPLOYED=false', () => {
    expect(scriptContent).toContain('RELEASE_DEPLOYED=false');
  });

  test('validates manifest SHA matches input', () => {
    expect(scriptContent).toContain('MANIFEST_SHA');
    expect(scriptContent).toContain('"$MANIFEST_SHA" != "$SHA"');
  });

  test('disarms trap after atomic move', () => {
    expect(scriptContent).toContain('TMP_DIR=""');
  });
});
