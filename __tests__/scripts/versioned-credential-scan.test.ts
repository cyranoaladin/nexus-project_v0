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

  describe('fixtures réalistes et secrets privés (incident : un mot de passe réel recopié comme donnée de test)', () => {
    const run = (directory: string, env: Record<string, string> = {}) => {
      const result = spawnSync(process.execPath, [scanner, '--root', directory], { encoding: 'utf8', env: { ...process.env, NEXUS_PRIVATE_SECRETS_FILES: '', ...env } });
      return { status: result.status, output: `${result.stdout}${result.stderr}` };
    };
    const withDir = (fn: (dir: string) => void) => {
      const dir = mkdtempSync(join(tmpdir(), 'nexus-credential-scan-'));
      try {
        fn(dir);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    };

    it('refuse une valeur à forte entropie passée à une fonction de contrôle, sans l’afficher', () => {
      const generated = ['kX9vT2mQ8rLw3Z', 'pB7nYc4HdFa5s'].join('');
      withDir((dir) => {
        writeFileSync(join(dir, 'unsafe.test.ts'), `expect(checkTeacherPassword('${generated}', teacher).ok).toBe(true);\n`);
        const { status, output } = run(dir);
        expect(status).toBe(1);
        expect(output).toContain('CREDENTIAL_FIXTURE_REALISTIC unsafe.test.ts:1');
        expect(output).not.toContain(generated);
      });
    });

    it('accepte une fixture synthétique lisible (phrase, nom, e-mail d’exemple)', () => {
      withDir((dir) => {
        writeFileSync(
          join(dir, 'safe.test.ts'),
          [
            "expect(checkTeacherPassword('le cheval gris traverse la vallée', teacher).ok).toBe(true);",
            "expect(checkTeacherPassword('Ardoise-Lune-Fenetre-4721', teacher).ok).toBe(true);",
            "expect(checkTeacherPassword('prof.exemple@example.test', teacher).ok).toBe(false);",
          ].join('\n'),
        );
        expect(run(dir).status).toBe(0);
      });
    });

    it('compare aux secrets PRIVÉS (fichiers hors Git) : trouve la valeur recopiée n’importe où, sans jamais l’afficher', () => {
      const secret = ['Prive', 'Secret', 'Jamais', 'Versionne', '9'].join('-');
      const code = 'ABCD-2345';
      withDir((dir) => {
        const priv = join(dir, 'prive.txt');
        writeFileSync(priv, ['URL=https://exemple.test', 'IDENTIFIANT=quelquun', `MOT_DE_PASSE=${secret}`, `Nom Prenom;eleve.test;${code}`, 'NOTE_MOT_DE_PASSE=modifié par le propriétaire, non conservé'].join('\n'));
        const tree = join(dir, 'arbre');
        mkdirSync(tree);
        writeFileSync(join(tree, 'doc.md'), `ligne 1\nmot de passe : ${secret}\n`);
        writeFileSync(join(tree, 'eleve.ts'), `const c = 'ABCD2345';\n`);
        writeFileSync(join(tree, 'propre.ts'), `const ok = 'rien à voir';\n`);
        const { status, output } = run(tree, { NEXUS_PRIVATE_SECRETS_FILES: priv });
        expect(status).toBe(1);
        expect(output).toContain('PRIVATE_SECRET_MATCH doc.md:2');
        expect(output).toContain('PRIVATE_SECRET_MATCH eleve.ts:1'); // le code d’élève sans tiret est aussi cherché
        expect(output).not.toContain('propre.ts');
        expect(output).not.toContain(secret);
        expect(output).not.toContain(code);
        expect(run(tree).output).not.toContain('PRIVATE_SECRET_MATCH'); // sans variable : aucune comparaison privée
      });
    });

    it('un fichier de secrets illisible arrête le contrôle (code 2) plutôt que de le passer en silence', () => {
      withDir((dir) => {
        const { status, output } = run(dir, { NEXUS_PRIVATE_SECRETS_FILES: join(dir, 'absent.txt') });
        expect(status).toBe(2);
        expect(output).toContain('PRIVATE_SECRETS_FILE_UNREADABLE');
      });
    });
  });
});
