/**
 * Hotfix sécurité — thread P1 review PR #174 (scripts/demo-utica-start.sh).
 *
 * Finding : le script utilisait `${VAR:-fallback}` pour DATABASE_URL,
 * REDIS_URL, EMAIL_OUTBOX_ENCRYPTION_KEY, SMTP_HOST/FROM — un lancement
 * depuis un shell ayant hérité des identifiants de production conservait
 * ces valeurs, et EMAIL_OUTBOX_WORKER_ENABLED=true aurait alors pu faire
 * drainer le véritable outbox e-mail vers de vrais destinataires.
 *
 * Ces tests exercent le VRAI script (scripts/demo-utica-start.sh) pour les
 * cas de refus — il échoue avant même de vérifier l'artefact de build,
 * donc aucun `npm run build` n'est nécessaire ici — et un harness shell
 * minimal (les fonctions exportées par scripts/demo-utica-env-guard.sh,
 * jamais `exec node`) pour prouver la résolution en environnement propre,
 * sans lancer l'artefact standalone complet.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const START_SCRIPT = path.join(REPO_ROOT, 'scripts/demo-utica-start.sh');
const GUARD_SCRIPT = path.join(REPO_ROOT, 'scripts/demo-utica-env-guard.sh');

function runStartScript(envOverrides: Record<string, string>) {
  try {
    const stdout = execFileSync('bash', [START_SCRIPT], {
      env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', ...envOverrides },
      encoding: 'utf8',
      timeout: 10_000,
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as { status: number | null; stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      code: err.status,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
    };
  }
}

function runGuardHarness(envOverrides: Record<string, string>) {
  // GUARD_SCRIPT is passed as a real execFileSync argument (bash's $1),
  // never interpolated into the -c script text, so an absolute path
  // containing shell-special characters can never change the command's
  // meaning (CodeQL js/shell-command-injection-from-environment).
  const script = `
    set -e
    source "$1"
    demo_utica_refuse_inherited_env
    demo_utica_export_local_env 127.0.0.1 3000 /tmp/demo-utica-env-guard-test-storage
    env
  `;
  try {
    const stdout = execFileSync('bash', ['-c', script, 'bash', GUARD_SCRIPT], {
      env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', ...envOverrides },
      encoding: 'utf8',
      timeout: 10_000,
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as { status: number | null; stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      code: err.status,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
    };
  }
}

describe('scripts/demo-utica-start.sh — refuse un environnement hérité dangereux', () => {
  test.each([
    ['DATABASE_URL', 'postgresql://sentinel-production-value'],
    ['SMTP_HOST', 'sentinel-production-smtp'],
    ['REDIS_URL', 'redis://sentinel-production-redis'],
    ['EMAIL_OUTBOX_ENCRYPTION_KEY', 'sentinel-production-key'],
    ['NEXTAUTH_SECRET', 'sentinel-production-secret'],
    ['RATE_LIMIT_KEY_SECRET', 'sentinel-production-ratelimit'],
    ['SMTP_USER', 'sentinel-production-user'],
    ['SMTP_PASS', 'sentinel-production-pass'],
    ['SMTP_PASSWORD', 'sentinel-production-password'],
    ['MAIL_FROM', 'sentinel@production.example'],
    ['EMAIL_FROM', 'sentinel@production.example'],
  ])(
    'refuse le lancement (avant tout accès à l\'artefact) si %s est déjà défini, sans jamais afficher sa valeur',
    (varName, sentinelValue) => {
      const result = runStartScript({ [varName]: sentinelValue });
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain(varName);
      expect(result.stderr).not.toContain(sentinelValue);
      expect(result.stderr).toContain('environnement non sûr');
    },
  );
});

describe('scripts/demo-utica-env-guard.sh — environnement propre force des endpoints strictement locaux', () => {
  test('DB/Redis/SMTP/stockage sont forcés en local, MAIL_DISABLED=true, credentials SMTP neutralisés', () => {
    const result = runGuardHarness({});
    expect(result.code).toBe(0);

    const env: Record<string, string> = {};
    for (const line of result.stdout.split('\n')) {
      const idx = line.indexOf('=');
      if (idx > 0) env[line.slice(0, idx)] = line.slice(idx + 1);
    }

    expect(env.DATABASE_URL).toBe('postgresql://127.0.0.1:5432/nexus_demo_local_disposable');
    expect(env.REDIS_URL).toBe('redis://127.0.0.1:6379');
    expect(env.MAIL_DISABLED).toBe('true');
    expect(env.SMTP_HOST).toBe('127.0.0.1');
    expect(env.SMTP_USER ?? '').toBe('');
    expect(env.SMTP_PASS ?? '').toBe('');
    expect(env.SMTP_PASSWORD ?? '').toBe('');
    expect(env.MAIL_FROM ?? '').toBe('');
    expect(env.EMAIL_FROM ?? '').toBe('');
    expect(env.NPC_STORAGE_ROOT).toBe('/tmp/demo-utica-env-guard-test-storage/npc');
    expect(env.DOCUMENT_STORAGE_ROOT).toBe('/tmp/demo-utica-env-guard-test-storage/documents');
  });
});
