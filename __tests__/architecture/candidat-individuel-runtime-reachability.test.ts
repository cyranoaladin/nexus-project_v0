import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

describe('candidat individuel runtime reachability', () => {
  test('the HTML family page and public API share the consultation lifecycle service', () => {
    const page = readFileSync(join(root, 'app/devis/[token]/page.tsx'), 'utf8');
    const route = readFileSync(join(root, 'app/api/quotes/public/[token]/route.ts'), 'utf8');

    expect(page).toContain("@/lib/quotes/public-view.server");
    expect(route).toContain("@/lib/quotes/public-view.server");
    expect(page).toContain('getFamilyQuoteView(token)');
    expect(route).toContain('getFamilyQuoteView(token)');
  });

  test('confirmed test-only modules are absent from the shipped source tree', () => {
    const retired = [
      'components/diagnostics/candidat-libre/ConsentGate.tsx',
      'lib/diagnostics/candidat-libre/index.ts',
      'lib/diagnostics/candidat-libre/item-validation.server.ts',
      'lib/diagnostics/candidat-libre/student-provisioning.server.ts',
      'lib/quotes/group-availability.ts',
      'lib/quotes/prorata.ts',
    ];

    for (const relativePath of retired) {
      expect(existsSync(join(root, relativePath))).toBe(false);
    }
  });

  test('the middleware no longer special-cases the removed legacy quote assistant', () => {
    const middleware = readFileSync(join(root, 'middleware.ts'), 'utf8');
    expect(middleware).not.toContain('/dashboard/assistante/devis/app');
  });

  test('inactive quote revision branches and status helpers are absent from runtime code', () => {
    const persistence = readFileSync(join(root, 'lib/quotes/persistence.server.ts'), 'utf8');
    const status = readFileSync(join(root, 'lib/quotes/status.ts'), 'utf8');
    const publicRoute = readFileSync(join(root, 'app/api/quotes/public/[token]/route.ts'), 'utf8');
    const quoteRoute = readFileSync(join(root, 'app/api/quotes/route.ts'), 'utf8');
    const workspace = readFileSync(join(root, 'components/dashboard/assistante/DevisWorkspace.tsx'), 'utf8');

    for (const source of [persistence, publicRoute, quoteRoute, workspace]) {
      expect(source).not.toContain('previousRevisionId');
      expect(source).not.toContain('revisionNumber');
    }
    expect(status).not.toContain('isTerminalStatus');
  });

  test('direct HTTP contracts and intentionally dark diagnostic scope are documented', () => {
    const audit = readFileSync(join(root, 'docs/audits/candidat-individuel-final-closure.md'), 'utf8');
    expect(audit).toContain('/api/quotes/public/[token]');
    expect(audit).toContain('/api/diagnostics/candidat-libre/consent');
    expect(audit).toContain('fonctionnalité sombre');
  });
});
