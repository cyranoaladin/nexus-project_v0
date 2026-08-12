import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { resolveFrom } from '@/lib/email/mailer';

/**
 * Adresse Nexus unique : contact@nexusreussite.academy — pour l'expédition,
 * les notifications et tout contact public. Les identités techniques
 * internes (compte parent système, comptes de seed/QA, exemples de
 * documentation) sont hors champ : elles ne reçoivent ni n'expédient de
 * courrier réel. Balayage sur les fichiers suivis par Git uniquement.
 */

const ROOT = path.resolve(__dirname, '../..');

const ALLOWED_NEXUS_ADDRESSES = new Set([
  'contact@nexusreussite.academy',
  // Identité technique du parent système (jamais une adresse de courrier).
  'parent-technique@nexusreussite.academy',
]);

const NON_MAIL_PATH_PREFIXES = [
  '__tests__/', 'e2e/', 'scripts/seed-', 'scripts/create-audit-profiles', 'prisma/seed', 'docs/', '.claude/',
];

function trackedSourceFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '--cached', '-z', '--', '*.ts', '*.tsx'], {
    cwd: ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024,
  });
  return output.split('\0').filter((entry) => entry.length > 0)
    .filter((entry) => !NON_MAIL_PATH_PREFIXES.some((prefix) => entry.startsWith(prefix)));
}

describe('Adresse de contact unique', () => {
  it('l’expéditeur par défaut est contact@nexusreussite.academy', () => {
    const saved = { MAIL_FROM: process.env.MAIL_FROM, EMAIL_FROM: process.env.EMAIL_FROM, SMTP_FROM: process.env.SMTP_FROM };
    delete process.env.MAIL_FROM; delete process.env.EMAIL_FROM; delete process.env.SMTP_FROM;
    try {
      expect(resolveFrom()).toContain('contact@nexusreussite.academy');
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('aucune autre adresse @nexusreussite.academy dans le code applicatif', () => {
    const offenders: string[] = [];
    for (const file of trackedSourceFiles()) {
      const absolute = path.join(ROOT, file);
      if (!fs.existsSync(absolute)) continue;
      const content = fs.readFileSync(absolute, 'utf-8');
      const matches = content.match(/[a-zA-Z0-9._%+-]+@nexus-?reussite\.[a-z.]+/g) ?? [];
      for (const address of matches) {
        const normalized = address.toLowerCase();
        if (!ALLOWED_NEXUS_ADDRESSES.has(normalized)) offenders.push(`${file}: ${normalized}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
