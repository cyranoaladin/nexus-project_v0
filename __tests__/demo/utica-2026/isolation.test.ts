/**
 * Preuve statique d'isolation du démonstrateur UTICA 2026 (amendements A6/A7).
 *
 * Balaie tout le code source de lib/demo/utica-2026, app/demo/utica-2026 et
 * components/demo/utica-2026 à la recherche de dépendances interdites :
 * Prisma/DB, vrai moteur ARIA, OpenAI/RAG, appels réseau, session NextAuth,
 * stockage documentaire réel. Le P0 doit fonctionner sans aucune d'entre
 * elles (résilience salon, zéro écriture, zéro PII réelle).
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TARGET_DIRS = ['lib/demo/utica-2026', 'app/demo/utica-2026', 'components/demo/utica-2026'];

function listSourceFiles(relDir: string): string[] {
  const abs = path.join(ROOT, relDir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const full = path.join(abs, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(path.relative(ROOT, full)));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

const FORBIDDEN: { pattern: RegExp; reason: string }[] = [
  { pattern: /@\/lib\/prisma\b/, reason: 'import direct du client Prisma' },
  { pattern: /@prisma\/client/, reason: "référence au package Prisma généré" },
  { pattern: /@\/lib\/aria(?!-)/, reason: 'import du vrai moteur ARIA (lib/aria.ts / lib/aria/*)' },
  { pattern: /from\s+['"]openai['"]/, reason: 'import du SDK OpenAI' },
  { pattern: /@\/lib\/rag-client/, reason: 'import du client RAG' },
  { pattern: /\bfetch\s*\(/, reason: 'appel réseau fetch()' },
  { pattern: /getServerSession\s*\(|useSession\s*\(/, reason: 'dépendance à la session NextAuth' },
  { pattern: /from\s+['"]@\/auth['"]/, reason: 'import de la config NextAuth' },
  { pattern: /@\/lib\/documents\/storage-root/, reason: 'dépendance au stockage documentaire réel' },
  { pattern: /prisma\.\w+\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/, reason: 'écriture Prisma' },
];

describe('Isolation du démonstrateur UTICA 2026', () => {
  const files = TARGET_DIRS.flatMap(listSourceFiles);

  test('au moins les fichiers attendus existent (le scan porte sur du contenu réel)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(FORBIDDEN)('aucun fichier ne référence : $reason', ({ pattern }) => {
    const offenders: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (pattern.test(content)) offenders.push(path.relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});
