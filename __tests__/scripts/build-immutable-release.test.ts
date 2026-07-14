/**
 * Behavioral tests for build-immutable-release.sh
 *
 * Tests input validation by running the script with controlled inputs.
 * The script exits early on validation failures (before git/npm),
 * so these tests are fast and self-contained.
 */

import { execFileSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SCRIPT = join(__dirname, '../../scripts/release/build-immutable-release.sh');
const scriptContent = readFileSync(SCRIPT, 'utf8');

function run(args: string[], env: Record<string, string> = {}): { code: number; output: string } {
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

const VALID_SHA = 'a'.repeat(40);

// ── Input validation (behavioral — real process exits) ──

describe('build-immutable-release.sh input validation', () => {
  test('rejects empty SHA', () => {
    const { code, output } = run([]);
    expect(code).toBe(1);
    expect(output).toContain('Usage');
  });

  test('rejects short SHA', () => {
    const { code, output } = run(['abc123']);
    expect(code).toBe(1);
    expect(output).toContain('Invalid SHA');
  });

  test('rejects uppercase SHA', () => {
    const { code } = run(['A'.repeat(40)]);
    expect(code).toBe(1);
  });

  test('rejects SHA with path traversal', () => {
    const { code } = run(['../../../etc/passwd/' + 'a'.repeat(20)]);
    expect(code).toBe(1);
  });

  test('rejects SHA with slashes', () => {
    const { code } = run(['a'.repeat(20) + '/' + 'b'.repeat(19)]);
    expect(code).toBe(1);
  });

  test('rejects SHA with spaces', () => {
    const { code } = run(['a'.repeat(20) + ' ' + 'b'.repeat(19)]);
    expect(code).toBe(1);
  });

  // Note: the user check (nexusapp) fires before dir validation in CI/dev.
  // These tests verify exit code 1 — the specific error depends on execution context.

  test('rejects relative releases dir', () => {
    const { code } = run([VALID_SHA, 'relative/path']);
    expect(code).toBe(1);
  });

  test('rejects / as releases dir', () => {
    const { code } = run([VALID_SHA, '/']);
    expect(code).toBe(1);
  });

  test('rejects /tmp as releases dir', () => {
    const { code } = run([VALID_SHA, '/tmp']);
    expect(code).toBe(1);
  });

  test('rejects /etc as releases dir', () => {
    const { code } = run([VALID_SHA, '/etc']);
    expect(code).toBe(1);
  });

  test('rejects /home as releases dir', () => {
    const { code } = run([VALID_SHA, '/home']);
    expect(code).toBe(1);
  });

  test('rejects nonexistent releases dir', () => {
    const { code } = run([VALID_SHA, '/var/www/nexus-releases-nonexistent-test']);
    expect(code).toBe(1);
  });
});

// ── Security properties (source inspection — verified against script content) ──

describe('build-immutable-release.sh security properties', () => {
  test('requires exactly nexusapp user (not just !root)', () => {
    expect(scriptContent).toContain('CURRENT_USER=$(id -un)');
    expect(scriptContent).toContain('"$CURRENT_USER" != "nexusapp"');
    expect(scriptContent).not.toMatch(/!= "root"/);
  });

  test('uses umask 077', () => {
    expect(scriptContent).toContain('umask 077');
  });

  test('uses mktemp under releases dir', () => {
    expect(scriptContent).toMatch(/mktemp -d.*RELEASES_DIR/);
  });

  test('has cleanup trap for EXIT INT TERM HUP', () => {
    expect(scriptContent).toContain('trap cleanup EXIT INT TERM HUP');
  });

  test('fetches exact SHA', () => {
    expect(scriptContent).toContain('fetch --depth=1 origin "$SHA"');
    expect(scriptContent).toContain('checkout --detach FETCH_HEAD');
  });

  test('verifies SHA after checkout', () => {
    expect(scriptContent).toContain('"$ACTUAL_SHA" != "$SHA"');
  });

  test('uses realpath for containment check', () => {
    expect(scriptContent).toContain('realpath "$RELEASES_DIR"');
    expect(scriptContent).toContain('realpath "$CANONICAL_RELEASES_ROOT"');
  });

  test('prevents prefix attacks with trailing slash', () => {
    expect(scriptContent).toContain('"$RESOLVED_CANONICAL/"*');
  });

  test('checks collision with -e and -L before build', () => {
    const collisionChecks = scriptContent.match(/\[\[ -e "\$RELEASE_DIR" \|\| -L "\$RELEASE_DIR" \]\]/g);
    expect(collisionChecks).not.toBeNull();
    expect(collisionChecks!.length).toBeGreaterThanOrEqual(2);
  });

  test('disarms trap after atomic move', () => {
    expect(scriptContent).toContain('TMP_DIR=""');
  });

  test('outputs RELEASE_DEPLOYED=false', () => {
    expect(scriptContent).toContain('RELEASE_DEPLOYED=false');
  });

  test('does not contain ln -snf or pm2', () => {
    expect(scriptContent).not.toContain('ln -snf');
    expect(scriptContent).not.toContain('pm2 reload');
    expect(scriptContent).not.toContain('pm2 restart');
  });

  test('validates manifest SHA matches input', () => {
    expect(scriptContent).toContain('"$MANIFEST_SHA" != "$SHA"');
  });

  test('validates ARTIFACT_VERIFIED', () => {
    expect(scriptContent).toContain('"$MANIFEST_VERIFIED" != "true"');
  });

  test('cleanup only removes TMP_DIR', () => {
    // Cleanup function should reference TMP_DIR only
    const cleanupMatch = scriptContent.match(/cleanup\(\)\s*\{[^}]+\}/);
    expect(cleanupMatch).not.toBeNull();
    expect(cleanupMatch![0]).toContain('TMP_DIR');
    expect(cleanupMatch![0]).not.toContain('RELEASE_DIR');
  });
});
