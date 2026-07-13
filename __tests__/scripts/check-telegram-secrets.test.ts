import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const scanner = join(process.cwd(), 'scripts/security/check-telegram-secrets.mjs');

function runScanner(root: string) {
  return spawnSync(process.execPath, [scanner, root], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

describe('Telegram secret scanner', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nexus-telegram-scan-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('fails without printing a detected Telegram Bot Token', () => {
    const syntheticToken = `${'12345678'}:${'A'.repeat(35)}`;
    writeFileSync(join(root, 'fixture.ts'), `export const value = '${syntheticToken}';\n`);

    const result = runScanner(root);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('fixture.ts');
    expect(output).not.toContain(syntheticToken);
  });

  it('accepts manifestly invalid placeholders', () => {
    writeFileSync(
      join(root, 'example.env'),
      'TELEGRAM_BOT_TOKEN=telegram-token-from-private-secret-store\n',
    );

    const result = runScanner(root);

    expect(result.status).toBe(0);
  });

  it('rejects public variables and legacy opt-out flags', () => {
    const publicVariable = ['NEXT', 'PUBLIC', 'TELEGRAM', 'TOKEN'].join('_');
    const legacyFlag = ['TELEGRAM', 'DISABLED'].join('_');
    writeFileSync(
      join(root, 'config.ts'),
      `const publicFlag = process.env.${publicVariable};\nconst legacy = process.env.${legacyFlag};\n`,
    );

    const result = runScanner(root);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('config.ts');
    expect(output).not.toContain(publicVariable);
  });
});
