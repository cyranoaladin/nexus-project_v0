import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(process.cwd(), 'app/dashboard/admin/page.tsx'), 'utf8');

/**
 * PR #309: the "Statistiques Utilisateurs" card reads only the legacy Core v1
 * client (app/api/admin/dashboard/route.ts: prisma.user.count()) and never
 * counts Core v2 accounts. This guards the fix so the scope can't silently
 * regress back to an unlabeled, misleading 0.
 */
describe('admin dashboard — user-stats widget scope', () => {
  it('labels the card as Core v1-scoped', () => {
    expect(source).toMatch(/Statistiques Utilisateurs \(Core v1 historique\)/);
  });

  it('explains the Core v2 exclusion without claiming Core v2 has no UI', () => {
    expect(source).toMatch(/Ne compte pas les comptes Core v2/);
    // The operational Core v2 households UI does exist (ASSISTANTE-facing);
    // the caption must not claim otherwise.
    expect(source).not.toMatch(/Core v2[^.]*n['’]est pas encore livré/i);
  });

  it('never claims the households space is closed to ADMIN — #311 opened it', () => {
    // A prior version of this caption said "il n'est pas ouvert à l'ADMIN
    // aujourd'hui", true only until PR #311's middleware/auth.config.ts fix.
    // Freezing that sentence in a test would have been exactly the mistake
    // the go-live mission warned against — the test must track the current
    // capability/route grant, not an old limitation.
    expect(source).not.toMatch(/pas ouvert[^.]*ADMIN/i);
    expect(source).not.toMatch(/ADMIN[^.]*pas ouvert/i);
  });

  it('never hardcodes a synthetic retention percentage', () => {
    expect(source).not.toMatch(/Taux de rétention[^\n]*\d/);
    expect(source).toMatch(/Taux de rétention[^\n]*non disponible/);
  });
});
