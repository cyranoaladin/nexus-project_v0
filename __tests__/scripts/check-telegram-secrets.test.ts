import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

  it('classifies bundled server code outside the browser artifact scan', () => {
    const serverDirectory = join(root, '.next', 'server', 'chunks');
    const bundledServerCall = [
      'https://api.telegram.org/',
      'bot${process.env.TELEGRAM_BOT_TOKEN}',
      '/sendMessage',
    ].join('');
    mkdirSync(serverDirectory, { recursive: true });
    writeFileSync(join(serverDirectory, 'route.js'), `const url = \`${bundledServerCall}\`;\n`);

    const result = runScanner(root);

    expect(result.status).toBe(0);
  });

  it('ignores disposable build checkouts under .artifacts', () => {
    const artifactDirectory = join(root, '.artifacts', 'clean-checkout', '.next', 'server');
    const bundledServerCall = [
      'https://api.telegram.org/',
      'bot${process.env.TELEGRAM_BOT_TOKEN}',
      '/sendMessage',
    ].join('');
    mkdirSync(artifactDirectory, { recursive: true });
    writeFileSync(join(artifactDirectory, 'route.js'), `const url = \`${bundledServerCall}\`;\n`);

    const result = runScanner(root);

    expect(result.status).toBe(0);
  });

  it('continues to reject credentials in browser chunks', () => {
    const staticDirectory = join(root, '.next', 'static', 'chunks');
    const syntheticToken = `${'12345678'}:${'A'.repeat(35)}`;
    mkdirSync(staticDirectory, { recursive: true });
    writeFileSync(join(staticDirectory, 'client.js'), `const value = '${syntheticToken}';\n`);

    const result = runScanner(root);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('.next/static/chunks/client.js');
    expect(output).not.toContain(syntheticToken);
  });
});
