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

/**
 * Injects a controlled `df -P` replacement so tests never depend on the
 * real disk occupation of whatever machine runs them (dependency injection
 * via --df-command, mirroring the existing --mail-command test seam).
 * Field layout matches real `df -P`: Filesystem / 1024-blocks / Used /
 * Available / Capacity / Mounted-on — the script only reads fields 4 and 5.
 */
function fakeDf(usagePct: number): string {
  const dfPath = join(testDir, 'fake-df.sh');
  const availKb = 1_000_000 - usagePct * 10_000;
  const usedKb = 1_000_000 - availKb;
  writeFileSync(
    dfPath,
    [
      '#!/bin/sh',
      'cat <<DF',
      'Filesystem 1024-blocks Used Available Capacity Mounted on',
      `fake 1000000 ${usedKb} ${availKb} ${usagePct}% /`,
      'DF',
      '',
    ].join('\n'),
  );
  chmodSync(dfPath, 0o755);
  return dfPath;
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
  it('silencieux (exit 0, pas de mail) — espace suffisant, sous le seuil', () => {
    const res = run([
      '--threshold', '85',
      '--to', 'ops@example.test',
      '--mail-command', fakeMail,
      '--df-command', fakeDf(50),
    ]);
    expect(res.status).toBe(0);
    expect(existsSync(capturePath)).toBe(false);
  });

  it('envoie l\'alerte — espace insuffisant, au-dessus du seuil, expéditeur/destinataire attendus', () => {
    const res = run([
      '--threshold', '85',
      '--to', 'support@nexusreussite.academy',
      '--from', 'contact@nexusreussite.academy',
      '--mail-command', fakeMail,
      '--df-command', fakeDf(97),
    ]);
    expect(res.status).toBe(0);
    expect(existsSync(capturePath)).toBe(true);
    const mail = readFileSync(capturePath, 'utf8');
    expect(mail).toContain('From: Nexus Ops <contact@nexusreussite.academy>');
    expect(mail).toContain('To: support@nexusreussite.academy');
    expect(mail).toContain('[ALERTE DISQUE]');
    expect(mail).toContain('97%');
    expect(mail).toContain('rotate-releases.sh');
  });

  it('envoie l\'alerte au seuil exact (usage == threshold, pas strictement inférieur)', () => {
    const res = run([
      '--threshold', '85',
      '--to', 'ops@example.test',
      '--mail-command', fakeMail,
      '--df-command', fakeDf(85),
    ]);
    expect(res.status).toBe(0);
    expect(existsSync(capturePath)).toBe(true);
    expect(readFileSync(capturePath, 'utf8')).toContain('85%');
  });

  it('reste silencieux juste sous le seuil (threshold - 1)', () => {
    const res = run([
      '--threshold', '85',
      '--to', 'ops@example.test',
      '--mail-command', fakeMail,
      '--df-command', fakeDf(84),
    ]);
    expect(res.status).toBe(0);
    expect(existsSync(capturePath)).toBe(false);
  });

  it('lit le destinataire depuis INTERNAL_NOTIFICATION_EMAIL', () => {
    const res = run(
      ['--threshold', '85', '--mail-command', fakeMail, '--df-command', fakeDf(97)],
      { INTERNAL_NOTIFICATION_EMAIL: 'env-recipient@example.test' },
    );
    expect(res.status).toBe(0);
    expect(readFileSync(capturePath, 'utf8')).toContain('To: env-recipient@example.test');
  });

  it('échoue sans destinataire', () => {
    const res = run(['--threshold', '85', '--mail-command', fakeMail, '--df-command', fakeDf(97)]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('RECIPIENT_MISSING');
  });

  it('rejette un seuil invalide (non numérique)', () => {
    const res = run(['--threshold', 'abc', '--to', 'x@y.z', '--mail-command', fakeMail, '--df-command', fakeDf(97)]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('INVALID_THRESHOLD');
  });

  it('rejette un seuil hors bornes (0 et 100)', () => {
    const tooLow = run(['--threshold', '0', '--to', 'x@y.z', '--mail-command', fakeMail, '--df-command', fakeDf(97)]);
    expect(tooLow.status).not.toBe(0);
    expect(tooLow.stderr).toContain('INVALID_THRESHOLD');

    const tooHigh = run(['--threshold', '100', '--to', 'x@y.z', '--mail-command', fakeMail, '--df-command', fakeDf(97)]);
    expect(tooHigh.status).not.toBe(0);
    expect(tooHigh.stderr).toContain('INVALID_THRESHOLD');
  });
});
