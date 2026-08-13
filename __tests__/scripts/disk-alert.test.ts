/**
 * disk-alert.sh — alerte disque à seuil, e-mail via commande injectable.
 *
 * La commande mail est remplacée par un capteur qui écrit le message sur
 * disque — aucun envoi réel, aucun secret.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/ops/disk-alert.sh');

let testDir: string;
let capturePath: string;
let fakeMail: string;

function run(args: string[], env: Record<string, string> = {}) {
  return spawnSync('bash', [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, INTERNAL_NOTIFICATION_EMAIL: '', ...env },
  });
}

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'nexus-diskalert-'));
  capturePath = join(testDir, 'sent-mail.txt');
  fakeMail = join(testDir, 'fake-sendmail.sh');
  writeFileSync(fakeMail, `#!/bin/sh\ncat > "${capturePath}"\n`);
  chmodSync(fakeMail, 0o755);
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('disk-alert.sh', () => {
  it('silencieux (exit 0, pas de mail) sous le seuil', () => {
    // Seuil 99 : l'occupation réelle du runner est forcément inférieure.
    const res = run(['--threshold', '99', '--to', 'ops@example.test', '--mail-command', fakeMail]);
    expect(res.status).toBe(0);
    expect(existsSync(capturePath)).toBe(false);
  });

  it('envoie l\'alerte au-dessus du seuil, avec expéditeur et destinataire attendus', () => {
    // Seuil 1 : l'occupation réelle dépasse toujours 1 %.
    const res = run([
      '--threshold', '1',
      '--to', 'support@nexusreussite.academy',
      '--from', 'contact@nexusreussite.academy',
      '--mail-command', fakeMail,
    ]);
    expect(res.status).toBe(0);
    expect(existsSync(capturePath)).toBe(true);
    const mail = readFileSync(capturePath, 'utf8');
    expect(mail).toContain('From: Nexus Ops <contact@nexusreussite.academy>');
    expect(mail).toContain('To: support@nexusreussite.academy');
    expect(mail).toContain('[ALERTE DISQUE]');
    expect(mail).toContain('rotate-releases.sh');
  });

  it('lit le destinataire depuis INTERNAL_NOTIFICATION_EMAIL', () => {
    const res = run(
      ['--threshold', '1', '--mail-command', fakeMail],
      { INTERNAL_NOTIFICATION_EMAIL: 'env-recipient@example.test' },
    );
    expect(res.status).toBe(0);
    expect(readFileSync(capturePath, 'utf8')).toContain('To: env-recipient@example.test');
  });

  it('échoue sans destinataire', () => {
    const res = run(['--threshold', '1', '--mail-command', fakeMail]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('RECIPIENT_MISSING');
  });

  it('rejette un seuil invalide', () => {
    const res = run(['--threshold', 'abc', '--to', 'x@y.z', '--mail-command', fakeMail]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('INVALID_THRESHOLD');
  });
});
