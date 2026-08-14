import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const scanner = resolve(process.cwd(), 'scripts/security/check-versioned-credentials.mjs');
const fixtures = resolve(process.cwd(), '__tests__/scripts/fixtures/versioned-credentials');

describe('versioned credential scanner', () => {
  it('rejects password, database, service and signed-link credentials without echoing values', () => {
    const directory = mkdtempSync(join(tmpdir(), 'nexus-credential-scan-'));
    const password = ['Fixture', 'Password', 'Must', 'Not', 'Leak', '42!'].join('');
    const databasePassword = ['Fixture', 'Database', 'Must', 'Not', 'Leak', '42!'].join('');
    const serviceSecret = ['Fixture', 'Service', '{Brace}', 'Must', 'Not', 'Leak', '42!'].join('');
    const signedToken = `${'c'.repeat(24)}.${'D'.repeat(43)}`;

    try {
      writeFileSync(join(directory, 'unsafe.ts'), [
        `const password = '${password}';`,
        `const database = 'postgresql://fixture-user:${databasePassword}@db.example.test/nexus';`,
        `const apiKey = '${serviceSecret}';`,
        `const signedToken = '${signedToken}';`,
      ].join('\n'));

      const result = spawnSync(process.execPath, [scanner, '--root', directory], {
        encoding: 'utf8',
      });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('PASSWORD_LITERAL');
      expect(output).toContain('SIGNED_BILAN_TOKEN');
      expect(output).toContain('CREDENTIALED_DATABASE_URL');
      expect(output).toContain('SERVICE_SECRET_LITERAL');
      expect(output).not.toContain(password);
      expect(output).not.toContain(databasePassword);
      expect(output).not.toContain(serviceSecret);
      expect(output).not.toContain(signedToken);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('accepts credentials generated at runtime', () => {
    expect(() => execFileSync(process.execPath, [
      scanner,
      '--root',
      resolve(fixtures, 'safe'),
    ], { encoding: 'utf8' })).not.toThrow();
  });

  it('scans every tracked path and invalidates exact contextual exceptions', () => {
    const repository = mkdtempSync(join(tmpdir(), 'nexus-credential-scan-git-'));
    const credential = ['Untracked', 'Runtime', 'Credential', '42!'].join('');
    const token = `${'a'.repeat(24)}.${'B'.repeat(43)}`;
    const bareToken = `cm${'c'.repeat(22)}.${'D'.repeat(43)}`;

    try {
      execFileSync('git', ['init', '-q'], { cwd: repository });
      for (const directory of ['.github/workflows', 'app', 'docs/random', 'scripts']) {
        mkdirSync(join(repository, directory), { recursive: true });
      }
      writeFileSync(join(repository, '.github/workflows/rogue.yml'), `NEXTAUTH_SECRET: ${credential}\n`);
      writeFileSync(join(repository, 'app/seed.ts'), `const password = '${credential}';\n`);
      writeFileSync(
        join(repository, 'docs/random/incident.md'),
        `postgresql://user:${credential}@db.example.test/prod\n/bilan/consultation/${token}\n${bareToken}\n`,
      );
      writeFileSync(
        join(repository, 'scripts/check-config.js'),
        [
          `SMTP_PASSWORD=${credential}`,
          `const providerToken = '${credential}';`,
          `const apiKey = '${credential}';`,
          `const token = '${credential}';`,
          `const secret = '${credential}';`,
        ].join('\n'),
      );
      execFileSync('git', ['add', '.'], { cwd: repository });

      const result = spawnSync(process.execPath, [scanner], { cwd: repository, encoding: 'utf8' });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('SERVICE_SECRET_LITERAL .github/workflows/rogue.yml:1');
      expect(output).toContain('PASSWORD_LITERAL app/seed.ts:1');
      expect(output).toContain('CREDENTIALED_DATABASE_URL docs/random/incident.md:1');
      expect(output).toContain('SIGNED_BILAN_TOKEN docs/random/incident.md:2');
      expect(output).toContain('SIGNED_BILAN_TOKEN docs/random/incident.md:3');
      expect(output).toContain('SERVICE_SECRET_LITERAL scripts/check-config.js:1');
      expect(output).toContain('SERVICE_SECRET_LITERAL scripts/check-config.js:2');
      expect(output).toContain('SERVICE_SECRET_LITERAL scripts/check-config.js:3');
      expect(output).toContain('SERVICE_SECRET_LITERAL scripts/check-config.js:4');
      expect(output).toContain('SERVICE_SECRET_LITERAL scripts/check-config.js:5');
      expect(output).not.toContain(credential);
      expect(output).not.toContain(token);
      expect(output).not.toContain(bareToken);
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it('keeps the tracked repository free of versioned credentials', () => {
    expect(() => execFileSync(process.execPath, [scanner], {
      encoding: 'utf8',
    })).not.toThrow();
  });
});
