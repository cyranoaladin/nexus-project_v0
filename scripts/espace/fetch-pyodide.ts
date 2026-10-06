/**
 * Télécharge le runtime Pyodide (v0.27.7) nécessaire hors ligne et l'enregistre dans un cache local,
 * avec les empreintes SHA-256 dans PYODIDE_SHA256.json. Aucun binaire n'est versionné dans Git.
 *
 *   npx tsx scripts/espace/fetch-pyodide.ts [--cache-dir <dir>] [--force]
 *
 * Cache par défaut : ~/.cache/nexus-pyodide/0.27.7
 * Un cache déjà complet et cohérent avec ses empreintes n'est jamais retéléchargé.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

export const PYODIDE_VERSION = '0.27.7';
export const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
/** Fichiers requis par `loadPyodide({ indexURL })` pour démarrer sans réseau (sans paquets supplémentaires). */
export const PYODIDE_FILES = ['pyodide.mjs', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'] as const;
export const PYODIDE_SHA_FILE = 'PYODIDE_SHA256.json';

export function defaultPyodideCache(): string {
  return path.join(os.homedir(), '.cache', 'nexus-pyodide', PYODIDE_VERSION);
}

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const exists = (file: string) => stat(file).then(() => true, () => false);

/** Vrai si tous les fichiers sont présents et conformes à PYODIDE_SHA256.json. */
export async function isPyodideCacheValid(dir: string): Promise<boolean> {
  try {
    const recorded = JSON.parse(await readFile(path.join(dir, PYODIDE_SHA_FILE), 'utf8')) as { files?: Record<string, string> };
    for (const name of PYODIDE_FILES) {
      const expected = recorded.files?.[name];
      if (!expected || sha256(await readFile(path.join(dir, name))) !== expected) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function fetchPyodide(dir: string = defaultPyodideCache(), opts: { force?: boolean; log?: (m: string) => void } = {}): Promise<string> {
  const log = opts.log ?? (() => undefined);
  if (!opts.force && (await isPyodideCacheValid(dir))) {
    log(`Pyodide ${PYODIDE_VERSION} : cache valide (${dir})`);
    return dir;
  }
  await mkdir(dir, { recursive: true });
  const files: Record<string, string> = {};
  for (const name of PYODIDE_FILES) {
    const target = path.join(dir, name);
    const response = await fetch(PYODIDE_CDN + name);
    if (!response.ok) throw new Error(`Téléchargement impossible : ${name} (HTTP ${response.status})`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length === 0) throw new Error(`Fichier vide reçu : ${name}`);
    // Écriture atomique : jamais de fichier partiel dans le cache.
    const tmp = `${target}.part`;
    await writeFile(tmp, data);
    await rename(tmp, target);
    files[name] = sha256(data);
    log(`+ ${name}  ${(data.length / 1024 / 1024).toFixed(2)} Mo  sha256 ${files[name]!.slice(0, 12)}…`);
  }
  await writeFile(path.join(dir, PYODIDE_SHA_FILE), `${JSON.stringify({ version: PYODIDE_VERSION, source: PYODIDE_CDN, files }, null, 2)}\n`);
  return dir;
}

/** Copie le pack validé dans `dest` (ex. `<paquet>/NSI…/pyodide/`). */
export async function copyPyodidePack(cacheDir: string, dest: string): Promise<void> {
  const { copyFile } = await import('node:fs/promises');
  if (!(await isPyodideCacheValid(cacheDir))) throw new Error(`Cache Pyodide absent ou corrompu : ${cacheDir} (lancer fetch-pyodide.ts)`);
  await mkdir(dest, { recursive: true });
  for (const name of [...PYODIDE_FILES, PYODIDE_SHA_FILE]) {
    if (!(await exists(path.join(cacheDir, name)))) throw new Error(`Fichier manquant dans le cache : ${name}`);
    await copyFile(path.join(cacheDir, name), path.join(dest, name));
  }
}

async function main() {
  const { values } = parseArgs({ options: { 'cache-dir': { type: 'string' }, force: { type: 'boolean', default: false } } });
  const dir = await fetchPyodide(values['cache-dir'] ?? defaultPyodideCache(), { force: values.force, log: (m) => process.stdout.write(`${m}\n`) });
  process.stdout.write(`OK : ${dir}\n`);
}

if (require.main === module) {
  main().catch((e) => {
    process.stderr.write(`ERREUR : ${e instanceof Error ? e.message : 'inconnue'}\n`);
    process.exitCode = 1;
  });
}
