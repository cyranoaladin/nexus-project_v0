/**
 * @jest-environment node
 *
 * Preflight catalogue ↔ base du script de bascule : lecture seule, fail closed, jamais de mutation automatique.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts/espace/switch-release.sh');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'nexus-preflight-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const exportCatalog = () =>
  JSON.parse(spawnSync('npx', ['tsx', 'scripts/espace/export-catalog.ts'], { cwd: ROOT, encoding: 'utf8' }).stdout) as Record<string, string | number>[];

interface Row extends Record<string, string | number> {}
let seq = 0;
function audit(catalog: Row[], db: Row[] | null) {
  seq += 1;
  const c = path.join(tmp, `catalog-${seq}.json`);
  const d = path.join(tmp, `db-${seq}.json`);
  writeFileSync(c, JSON.stringify(catalog));
  writeFileSync(d, JSON.stringify(db));
  const r = spawnSync('bash', [SCRIPT, '--audit-only', '--catalog', c, '--db-json', d], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const real = exportCatalog();
const copy = () => real.map((a) => ({ ...a }));

describe('catalogue réel du code', () => {
  it('contient les 5 activités et le parcours Récursivité', () => {
    expect(real.map((a) => a.slug)).toContain('nsi-recursivite');
    expect(real).toHaveLength(5);
  });
});

describe('preflight : scénarios', () => {
  it('catalogue = base → PASS, code 0', () => {
    const r = audit(real, copy());
    expect(r.code).toBe(0);
    expect(r.out).toContain('CATALOGUE_DB_SYNC=PASS (5 activités)');
    expect(r.out).not.toContain('DEPLOYMENT_BLOCKED');
  });

  it('activité absente de la base → FAIL, DEPLOYMENT_BLOCKED, consigne sync-activities explicite', () => {
    const r = audit(real, copy().filter((a) => a.slug !== 'nsi-recursivite'));
    expect(r.code).toBe(17);
    expect(r.out).toContain('MISSING_IN_DB nsi-recursivite');
    expect(r.out).toContain('DEPLOYMENT_BLOCKED');
    expect(r.out).toContain('provision.ts sync-activities --execute');
  });

  it('base vide ou nulle (json_agg sur table vide) → FAIL', () => {
    expect(audit(real, null).code).toBe(17);
    expect(audit(real, []).code).toBe(17);
  });

  it('slug dupliqué dans le catalogue du code → FAIL', () => {
    const r = audit([...real, { ...real[0]! }], copy());
    expect(r.code).toBe(17);
    expect(r.out).toContain(`DUPLICATE_SLUG ${real[0]!.slug}`);
  });

  it.each([
    ['subject', 'MATHEMATIQUES'],
    ['kind', 'RESOURCE_PACK'],
    ['moduleSlug', 'autre'],
    ['title', 'Autre titre'],
    ['stepsTotal', 3],
    ['contentVersion', '0.9'],
  ])('%s incohérent → FAIL, un écart nommé', (field, value) => {
    const db = copy();
    db.find((a) => a.slug === 'nsi-recursivite')![field] = value;
    const r = audit(real, db);
    expect(r.code).toBe(17);
    expect(r.out).toContain(`MISMATCH nsi-recursivite.${field}`);
    expect(r.out).toContain('DEPLOYMENT_BLOCKED');
  });

  it('ligne en base absente du code → simple avertissement, pas de blocage', () => {
    const r = audit(real, [...copy(), { slug: 'retire', subject: 'NSI', moduleSlug: 'x', title: 'Retiré', kind: 'PYTHON_TP', stepsTotal: 1, contentVersion: '1' }]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('AVERTISSEMENT EXTRA_IN_DB retire');
  });
});

describe('préflight : propriétés du script', () => {
  const script = readFileSync(SCRIPT, 'utf8');

  it('est exécuté AVANT la bascule du pointeur et avant le garde de pré-vol', () => {
    const preflight = script.indexOf('catalog_preflight "$NEW" || exit 17');
    expect(preflight).toBeGreaterThan(0);
    expect(preflight).toBeLessThan(script.indexOf('guard || { echo "GARDE_PREVOL_KO"'));
    expect(preflight).toBeLessThan(script.indexOf('ln -sfn "$NEW" "$CANON.new"'));
  });

  it('est fail closed : fichier de catalogue absent ou base illisible → DEPLOYMENT_BLOCKED', () => {
    expect(script).toContain('DEPLOYMENT_BLOCKED : $cat absent');
    expect(script).toContain('lecture de espace_activities impossible (fail closed)');
  });

  it('ne mute jamais la base : aucune instruction SQL d’écriture, sync-activities seulement recommandé', () => {
    const sqlWrites = script.match(/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/g) ?? [];
    expect(sqlWrites).toEqual([]);
    for (const line of script.split('\n').filter((l) => l.includes('sync-activities'))) expect(line.trim()).toMatch(/^(#|echo)/);
  });
});
