/**
 * Installe les PDF privés d'un module dans le stockage privé, en vérifiant
 * chaque empreinte contre le manifeste d'origine. Dry-run par défaut.
 *
 *   npx tsx scripts/espace/install-resources.ts --from /chemin/resources --module suites|fonctions-limites|poo-structures|recursivite [--execute]
 *
 * Destination : <DOCUMENT_STORAGE_ROOT>/espace/resources/<module>/ (jamais public).
 * Un fichier existant d'empreinte identique est laissé tel quel ; d'empreinte
 * différente il n'est PAS écrasé (erreur) : une décision humaine est requise.
 */
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { getDocumentStorageRoot } from '@/lib/documents/storage-root';
import { getActivityDef, MATHS_LIMITES_ACTIVITY_SLUG, MATHS_SUITES_ACTIVITY_SLUG, NSI_ENTRAINEMENT_ACTIVITY_SLUG, POO2_ACTIVITY_SLUG, RECURSIVITE_ACTIVITY_SLUG } from '@/lib/espace/catalog';

/** `manifest` : fichier d'empreintes attendu dans --from (Suites : manifeste d'origine ; corrigés : celui de build-corriges.ts). */
const MODULES: Record<string, { slug: string; manifest: string }> = {
  suites: { slug: MATHS_SUITES_ACTIVITY_SLUG, manifest: 'MATHS_RESOURCES_MANIFEST.json' },
  'fonctions-limites': { slug: MATHS_LIMITES_ACTIVITY_SLUG, manifest: 'MANIFEST.json' },
  'poo-structures': { slug: POO2_ACTIVITY_SLUG, manifest: 'MANIFEST.json' },
  recursivite: { slug: RECURSIVITE_ACTIVITY_SLUG, manifest: 'MANIFEST.json' },
  'entrainement-evaluation': { slug: NSI_ENTRAINEMENT_ACTIVITY_SLUG, manifest: 'MANIFEST.json' },
};
// Ancien nom du brouillon : conservé comme alias de `poo-structures`.
MODULES.structures = MODULES['poo-structures']!;

function fail(message: string): never {
  process.stderr.write(`ERREUR : ${message}\n`);
  process.exit(1);
}

const sha = async (file: string) => createHash('sha256').update(await readFile(file)).digest('hex');

async function main() {
  const { values } = parseArgs({ options: { from: { type: 'string' }, module: { type: 'string' }, execute: { type: 'boolean', default: false } } });
  if (!values.from || !values.module) fail('--from et --module sont obligatoires');
  const mod = MODULES[values.module];
  const def = mod ? getActivityDef(mod.slug) : undefined;
  if (!def) fail(`Module inconnu : ${values.module}`);

  const manifest = JSON.parse(await readFile(path.join(values.from, mod!.manifest), 'utf8')) as {
    student_resource?: { internal_name: string; sha256: string; bytes: number };
    teacher_resources: { internal_name: string; sha256: string; bytes: number }[];
  };
  const listed = [...(manifest.student_resource ? [manifest.student_resource] : []), ...manifest.teacher_resources];
  const expected = new Map(listed.map((r) => [r.internal_name, r]));
  const dest = path.join(getDocumentStorageRoot(), 'espace', 'resources', def.moduleSlug);

  for (const resource of def.resources) {
    const meta = expected.get(resource.file);
    if (!meta) fail(`${resource.file} absent du manifeste`);
    const source = path.join(values.from, resource.file);
    const actual = await sha(source);
    if (actual !== meta.sha256) fail(`${resource.file} : empreinte différente du manifeste (fichier altéré ?)`);

    const target = path.join(dest, resource.file);
    const present = await stat(target).then(() => true, () => false);
    if (present) {
      if ((await sha(target)) === actual) { process.stdout.write(`= ${resource.file}  déjà installé, identique (${resource.audience})\n`); continue; }
      fail(`${resource.file} existe avec un contenu différent : pas d'écrasement`);
    }
    process.stdout.write(`+ ${resource.file}  → ${target}  (${resource.audience}, sha256 ${actual.slice(0, 12)}…)\n`);
    if (values.execute) {
      await mkdir(dest, { recursive: true, mode: 0o750 });
      await copyFile(source, target);
      await chmod(target, 0o640);
      if ((await sha(target)) !== actual) fail(`${resource.file} : copie corrompue`);
    }
  }
  process.stdout.write(values.execute ? 'OK. Empreintes vérifiées après copie.\n' : 'DRY-RUN : aucune écriture. Ajoutez --execute.\n');
}

main().catch((e) => {
  process.stderr.write(`ERREUR : ${e instanceof Error ? e.message : 'inconnue'}\n`);
  process.exitCode = 1;
});
