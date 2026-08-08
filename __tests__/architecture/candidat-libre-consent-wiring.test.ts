import fs from 'node:fs';
import path from 'node:path';

/**
 * Prouve que chaque chemin d'écriture du candidat libre passe le consentement
 * parental avant d'écrire quoi que ce soit.
 *
 * Le test unitaire du garde-fou ne suffit pas : le risque réel est qu'une route
 * de collecte soit ajoutée plus tard sans l'appeler. Un dossier portant sur un
 * mineur ne pardonne pas cet oubli — la collecte serait irréversible et sans
 * base légale. Ce test lit les fichiers de route et vérifie l'ordre réel des
 * appels, ce qu'aucun mock ne peut simuler.
 */

const ROUTES_ROOT = path.join(process.cwd(), 'app/api/diagnostics/candidat-libre');
const GATE = 'requireVerifiedParentalConsent';
const ALLOWLIST = 'guardCandidateDiagnosticForStudent';

/** Routes de lecture seule ou d'export staff : pas de collecte, donc non gatées. */
const READ_ONLY_ROUTES = new Set(['staff-export/route.ts']);

/**
 * La route de recueil est la seule exception au garde-fou de consentement :
 * exiger un consentement pour joindre la route qui le recueille rendrait le
 * parcours impossible. Elle reste soumise au kill switch et à l'allowlist, et
 * n'écrit que le consentement — jamais de donnée de diagnostic.
 */
const CONSENT_COLLECTION_ROUTE = 'consent/route.ts';

function listRouteFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...listRouteFiles(full));
    else if (entry.name === 'route.ts') found.push(full);
  }
  return found;
}

/** Handlers qui écrivent. GET est exclu : lire n'est pas collecter. */
const WRITE_HANDLER = /^export async function (POST|PUT|PATCH|DELETE)\b/m;

const routeFiles = listRouteFiles(ROUTES_ROOT);

describe('candidat libre — consentement parental sur tout chemin d’écriture', () => {
  it('trouve bien les routes à auditer', () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(4);
  });

  it.each(routeFiles.map((file) => [path.relative(ROUTES_ROOT, file), file]))(
    '%s',
    (relative, file) => {
      const source = fs.readFileSync(file, 'utf8');

      if (!WRITE_HANDLER.test(source)) return; // route de lecture seule
      if (READ_ONLY_ROUTES.has(relative)) return;
      if (relative === CONSENT_COLLECTION_ROUTE) return;

      expect(source).toContain(GATE);

      // Le garde-fou doit précéder toute écriture en base.
      const gateAt = source.indexOf(`await ${GATE}(`);
      const firstWrite = [
        source.indexOf('prisma.$transaction'),
        source.indexOf('.create({'),
        source.indexOf('.update({'),
        source.indexOf('.upsert({'),
      ].filter((index) => index >= 0).sort((a, b) => a - b)[0];

      expect(gateAt).toBeGreaterThanOrEqual(0);
      if (firstWrite !== undefined) {
        expect(gateAt).toBeLessThan(firstWrite);
      }
    },
  );

  it('n’enregistre plus parent-22 comme consentement parental', () => {
    const parentRoute = fs.readFileSync(
      path.join(ROUTES_ROOT, '[diagnosticId]/parent/route.ts'),
      'utf8',
    );
    // `parentSubmittedAt` reste légitime : le parent a bien soumis son
    // questionnaire. `parentConsentAt` ne doit plus être écrit ici.
    expect(parentRoute).toContain('parentSubmittedAt');
    expect(parentRoute).not.toMatch(/parentConsentAt:\s*now/);
  });

  it.each(routeFiles.map((file) => [path.relative(ROUTES_ROOT, file), file]))(
    'allowlist — %s',
    (relative, file) => {
      const source = fs.readFileSync(file, 'utf8');
      if (!WRITE_HANDLER.test(source)) return;
      if (READ_ONLY_ROUTES.has(relative)) return;

      // Sans allowlist, allumer le drapeau ouvrirait le diagnostic à tous les
      // élèves et parents de la base : le rôle dédié n'existe pas et aucune
      // éligibilité n'est vérifiée ailleurs.
      expect(source).toContain(ALLOWLIST);

      // L'allowlist doit précéder le consentement : hors périmètre, la
      // fonctionnalité doit paraître absente (404) plutôt que de révéler
      // qu'un consentement serait requis (403).
      const allowlistAt = source.indexOf(`${ALLOWLIST}(`);
      expect(allowlistAt).toBeGreaterThanOrEqual(0);
      if (relative === CONSENT_COLLECTION_ROUTE) return;
      const gateAt = source.indexOf(`await ${GATE}(`);
      expect(allowlistAt).toBeLessThan(gateAt);
    },
  );

  it('conserve le garde-fou du kill switch avant le consentement', () => {
    // L'ordre importe : la fonctionnalité doit rester invisible (404) avant
    // même de révéler qu'un consentement serait requis (403).
    for (const file of routeFiles) {
      const source = fs.readFileSync(file, 'utf8');
      if (!source.includes(GATE)) continue;
      const flagAt = source.indexOf('guardCandidateDiagnosticFeature()');
      const gateAt = source.indexOf(`await ${GATE}(`);
      expect(flagAt).toBeGreaterThanOrEqual(0);
      expect(flagAt).toBeLessThan(gateAt);
    }
  });

  it('la route de recueil reste protégée par le kill switch et l’allowlist', () => {
    const source = fs.readFileSync(path.join(ROUTES_ROOT, CONSENT_COLLECTION_ROUTE), 'utf8');
    expect(source).toContain('guardCandidateDiagnosticFeature()');
    expect(source).toContain(ALLOWLIST);
    // Elle ne doit écrire aucune donnée de diagnostic : seulement le consentement.
    expect(source).not.toMatch(/candidateDiagnosticModule\.(create|update)/);
    expect(source).not.toMatch(/candidateDiagnosticDocument\.(create|update)/);
  });
});
