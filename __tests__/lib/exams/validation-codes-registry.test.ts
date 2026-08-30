import fs from 'node:fs';
import path from 'node:path';

/**
 * Mission Lot 4 correctif §6 : "éviter qu'un code disparaisse sans faire
 * échouer les tests" — a code added or removed from either source file
 * must be reflected in docs/candidat-individuel/validation-codes.md, or
 * this test fails. Deliberately text-based (not an import of internal
 * constants) — it must catch a code that exists only as a string literal.
 */

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
}

function extractLiteralCodes(source: string): string[] {
  const matches = source.matchAll(/code: '([A-Z0-9_]+)'/g);
  return [...matches].map((m) => m[1]);
}

describe('validateProfilCandidat — registre des codes reste synchronisé avec la documentation', () => {
  const registryDoc = readSource('docs/candidat-individuel/validation-codes.md');

  const profileValidationCodes = new Set(
    extractLiteralCodes(readSource('lib/exams/profile-validation.ts')),
  );
  // options.ts codes are propagated dynamically (err.code) — extracted the
  // same way from their own source of truth, never hardcoded twice here.
  const optionsCodes = new Set(extractLiteralCodes(readSource('lib/exams/options.ts')));
  // Speciality validation is delegated to its canonical validator and its
  // issue codes are propagated dynamically, just like options.
  const specialityCodes = new Set(extractLiteralCodes(readSource('lib/exams/specialities.ts')));

  const allCodes = new Set([...profileValidationCodes, ...optionsCodes, ...specialityCodes]);

  test('chaque code du code source figure dans le registre documenté', () => {
    const missing = [...allCodes].filter((code) => !registryDoc.includes(`\`${code}\``));
    expect(missing).toEqual([]);
  });

  test('le registre ne référence pas un code qui a disparu du code source (hors section "hors périmètre")', () => {
    const horsPerimetreIndex = registryDoc.indexOf('## Hors périmètre');
    const activeDoc = horsPerimetreIndex === -1 ? registryDoc : registryDoc.slice(0, horsPerimetreIndex);
    const documentedCodes = [...activeDoc.matchAll(/\| `([A-Z0-9_]+)` \|/g)].map((m) => m[1]);
    const stale = documentedCodes.filter((code) => !allCodes.has(code));
    expect(stale).toEqual([]);
  });

  test('au moins 30 codes actifs recensés (garde-fou anti-régression silencieuse)', () => {
    expect(allCodes.size).toBeGreaterThanOrEqual(30);
  });
});
