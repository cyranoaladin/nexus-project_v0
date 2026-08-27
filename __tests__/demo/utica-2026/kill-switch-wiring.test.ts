/**
 * Régression : sans `export const dynamic = 'force-dynamic'`, Next.js
 * prérend /demo/utica-2026/** en statique AU BUILD et fige la valeur de
 * UTICA_DEMO_ENABLED lue à ce moment-là — le kill switch deviendrait inerte
 * après coup (repéré lors du build P0 : les 4 routes sortaient en "○
 * Static" alors que la variable d'env était absente pendant `npm run
 * build`). Ce test verrouille le correctif.
 */
import fs from 'fs';
import path from 'path';

describe('Kill switch — rendu dynamique forcé', () => {
  test("le layout /demo/utica-2026 force le rendu dynamique (le flag est relu à chaque requête)", () => {
    const layoutPath = path.join(process.cwd(), 'app/demo/utica-2026/layout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf-8');
    expect(content).toMatch(/export const dynamic = ['"]force-dynamic['"]/);
  });
});
