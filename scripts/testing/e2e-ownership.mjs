/**
 * Inventaire de propriete des specs E2E.
 *
 * Un test qu'aucune configuration ne collecte ne s'execute jamais : il ne
 * protege rien, tout en donnant l'apparence d'une couverture. Ce controle
 * etablit, pour chaque spec du depot, la ou les voies qui la collectent, et
 * refuse toute spec dont le statut n'est pas etabli.
 *
 * Une spec est en regle si elle est collectee par au moins une configuration,
 * OU si elle figure dans `e2e/ownership.registry.json` avec un motif — la
 * dormance devient alors une decision inscrite, et non un oubli silencieux.
 *
 * Sortie : E2E_SPEC_ORPHANS, E2E_UNINTENDED_DUPLICATE_COLLECTION.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

function readdirSyncSafe(dir) {
  try { return readdirSync(dir).filter((f) => /\.[jt]s$/.test(f)); } catch { return []; }
}
import { join } from 'node:path';

const ROOT = process.cwd();
const CONFIGS = [
  'playwright.config.ts',
  'playwright.auth.config.ts',
  'playwright.ci.config.ts',
  'playwright.aria.config.ts',
];

function trackedSpecs() {
  return execFileSync('git', ['ls-files', 'e2e/**/*.spec.ts', 'e2e/*.spec.ts'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((l) => l.trim()).filter(Boolean).sort();
}

function collectedBy(config) {
  // Plusieurs specs valident leur base AU CHARGEMENT du module : sans ces
  // variables, la collecte de toute une voie echoue et ses specs paraissent
  // dormantes. Les valeurs designent la base jetable de la pile e2e, la meme
  // que celle des tests ; aucune n'ouvre de connexion ici, on ne fait que
  // lister.
  // URL SANS identifiants : lister ne se connecte a rien, et la garde de base
  // jetable ne verifie que le protocole, l'hote et le nom de base. Y placer un
  // couple utilisateur/mot de passe reviendrait a versionner un credential —
  // ce que `check-versioned-credentials` refuse, a juste titre.
  const DISPOSABLE = process.env.E2E_DATABASE_URL
    || 'postgresql://127.0.0.1:5435/nexus_e2e?schema=public';
  const env = {
    ...process.env,
    E2E_DISPOSABLE_STACK: '1',
    E2E_DATABASE_URL: DISPOSABLE,
    TEST_DATABASE_URL: DISPOSABLE,
    DATABASE_URL: DISPOSABLE,
  };
  const files = new Set();
  for (const project of ['', 'aria-desktop', 'aria-mobile', 'aria-a11y', 'aria-smoke']) {
    if (project && !config.includes('aria')) continue;
    if (!project && config.includes('aria')) continue;
    try {
      const args = ['node_modules/@playwright/test/cli.js', 'test', `--config=${config}`, '--list', '--reporter=json'];
      if (project) args.push(`--project=${project}`);
      // `--list` peut sortir en code non nul tout en ayant produit son
      // inventaire : on exploite la sortie plutot que le code de retour, sans
      // quoi une voie entiere passe pour vide et toutes ses specs pour
      // dormantes — c'est exactement l'erreur que ce controle doit eviter.
      let out;
      try {
        out = execFileSync(process.execPath, args, {
          cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
          env: project ? { ...env, PLAYWRIGHT_PROJECT: project } : env,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        out = typeof err.stdout === 'string' ? err.stdout : '';
      }
      if (!out || out.indexOf('{') === -1) throw new Error('LISTING_VIDE');
      const parsed = JSON.parse(out.slice(out.indexOf('{')));
      // Playwright exprime `file` RELATIVEMENT au `rootDir` de la configuration
      // (`e2e/` ici, `e2e/aria/` la). On resout donc chaque chemin depuis ce
      // rootDir avant de le ramener a une reference du depot.
      const rootDir = (parsed.config && parsed.config.rootDir) || ROOT;
      const toRepo = (f) => {
        const abs = f.startsWith('/') ? f : join(rootDir, f);
        return abs.startsWith(ROOT) ? abs.slice(ROOT.length + 1) : null;
      };
      const visit = (v) => {
        if (!v || typeof v !== 'object') return;
        if (!Array.isArray(v) && typeof v.file === 'string') files.add(toRepo(v.file));
        if (!Array.isArray(v) && v.location && typeof v.location.file === 'string') files.add(toRepo(v.location.file));
        for (const nested of Array.isArray(v) ? v : Object.values(v)) visit(nested);
      };
      visit(parsed);
    } catch {
      // Une configuration qui refuse de lister est signalee par son absence de
      // collecte : elle ne peut pas rendre une spec « possedee » par erreur.
    }
  }
  return files;
}

const specs = trackedSpecs();
const matrix = new Map(specs.map((s) => [s, []]));
for (const config of CONFIGS) {
  for (const file of collectedBy(config)) {
    if (file && matrix.has(file)) matrix.get(file).push(config);
  }
}

// Aucune dispense n'est prevue : une spec est collectee par une voie, ou elle
// n'a pas lieu d'etre. Le registre transitoire qui declarait les specs
// dormantes a ete supprime avec la derniere d'entre elles — un cliquet est une
// mesure de migration, pas un etat final.
const orphans = [];
for (const [spec, configs] of matrix) {
  if (configs.length === 0) orphans.push(spec);
}

// Une spec collectee par plusieurs voies est acceptable si chacune l'execute
// pour une raison distincte ; elle ne l'est pas si c'est un ramassage fortuit.
// Plusieurs navigateurs ou viewports sous UNE meme configuration ne sont pas
// une duplication : c'est la meme voie qui joue la spec plusieurs fois. On ne
// signale que la collecte par plusieurs CONFIGURATIONS distinctes, qui elle
// est fortuite.
const duplicates = [...matrix.entries()].filter(([, c]) => new Set(c).size > 1);

// ── Preuve semantique : un fichier `.spec.ts` doit etre un test ────────────
// Une regle naive « expect > 0 » serait fausse : une assertion peut vivre dans
// un helper. On considere donc qu'une spec porte une preuve si elle assure
// elle-meme, OU si elle appelle un helper local qui assure. Restent signales
// les fichiers qui ne prouvent rien, ceux qui se declarent comme outils de mise
// au point, et ceux dont la raison d'etre est d'ecrire hors du depot.
const helperAsserts = new Set();
for (const helper of readdirSyncSafe(join(ROOT, 'e2e/helpers'))) {
  const text = readFileSync(join(ROOT, 'e2e/helpers', helper), 'utf8');
  if (/\bexpect\s*\(/.test(text)) helperAsserts.add(helper.replace(/\.[jt]s$/, ''));
}

const withoutProof = [];
const debugOrManual = [];
const writingOutsideRepo = [];
for (const spec of specs) {
  const text = readFileSync(join(ROOT, spec), 'utf8');
  const assertsDirectly = /\bexpect\s*\(/.test(text);
  const assertsViaHelper = [...helperAsserts].some((h) => text.includes(`helpers/${h}`));
  if (!assertsDirectly && !assertsViaHelper) withoutProof.push(spec);
  if (/(^|\/)[^/]*(debug|manual|generate-state)[^/]*\.spec\.ts$/i.test(spec)) debugOrManual.push(spec);
  if (/writeFileSync\(\s*['"`]\/(tmp|var)\//.test(text) || /mkdirSync\(\s*['"`]\/(tmp|var)\//.test(text)) writingOutsideRepo.push(spec);
}

const lines = [
  `E2E_SPEC_TOTAL=${specs.length}`,
  `E2E_SPEC_COLLECTED=${[...matrix.values()].filter((c) => c.length > 0).length}`,
  `E2E_SPEC_ORPHANS=${orphans.length}`,
  `E2E_UNINTENDED_DUPLICATE_COLLECTION=${duplicates.length}`,
  `SPECS_WITHOUT_VERIFIABLE_PROOF=${withoutProof.length}`,
  `DEBUG_OR_MANUAL_SPECS=${debugOrManual.length}`,
  `SPECS_WRITING_OUTSIDE_REPO=${writingOutsideRepo.length}`,
];
for (const l of lines) console.log(l);
if (orphans.length) {
  console.log('\nSpecs sans voie ET sans motif declare :');
  for (const s of orphans) console.log('  ' + s);
}
if (duplicates.length) {
  console.log('\nSpecs collectees par plusieurs configurations distinctes :');
  for (const [s, c] of duplicates) console.log('  ' + s + ' -> ' + [...new Set(c)].join(', '));
}
for (const [label, list] of [
  ['Specs sans preuve verifiable (ni assertion, ni helper qui assure)', withoutProof],
  ['Fichiers .spec.ts qui se declarent outils de mise au point', debugOrManual],
  ['Specs dont la raison d\'etre est d\'ecrire hors du depot', writingOutsideRepo],
]) {
  if (!list.length) continue;
  console.log('\n' + label + ' :');
  for (const item of list) console.log('  ' + item);
}

export { matrix, orphans, duplicates };

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const failures = orphans.length + duplicates.length + withoutProof.length
    + debugOrManual.length + writingOutsideRepo.length;
  process.exit(failures ? 1 : 0);
}
