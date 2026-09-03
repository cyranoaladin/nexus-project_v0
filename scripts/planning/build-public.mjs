#!/usr/bin/env node
/**
 * Génère public/planning (artefact servi sur /planning) depuis la source
 * canonique tools/planning-studio. Déterministe : mêmes entrées → mêmes
 * sorties octet pour octet (aucune date, aucun identifiant aléatoire).
 *
 *   npm run planning:build   — régénère l'artefact
 *   npm run planning:check   — régénère puis échoue si public/planning diverge
 *
 * Transformations appliquées à index.html :
 *   - chemins relatifs assets/ et data/ → chemins absolus /planning/… ;
 *   - insertion de /planning/config.js (mode intégré Nexus : API partagée).
 * Le fichier index.html source reste utilisable en double-clic (mode autonome).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = path.join(repoRoot, 'tools', 'planning-studio');
const target = path.join(repoRoot, 'public', 'planning');
const PREFIX = '/planning/';

const ASSETS = ['core.js', 'model.js', 'validation.js', 'storage.js', 'sync.js', 'ui-grid.js', 'ui-panels.js', 'app.js', 'styles.css'];
const DATA = ['default-data.js', 'planning.default.json', 'planning.schema.json'];

function copy(rel) {
  const from = path.join(source, rel);
  const to = path.join(target, rel);
  if (!fs.existsSync(from)) throw new Error(`Source manquante : ${rel}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
ASSETS.forEach((f) => copy(path.join('assets', f)));
DATA.forEach((f) => copy(path.join('data', f)));

let html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
html = html.replace(/(href|src)="(assets|data)\//g, (m, attr, dir) => `${attr}="${PREFIX}${dir}/`);
const marker = `<script src="${PREFIX}data/default-data.js"></script>`;
if (!html.includes(marker)) throw new Error('index.html : script default-data.js introuvable');
html = html.replace(marker, `<script src="${PREFIX}config.js"></script>\n  ${marker}`);
fs.writeFileSync(path.join(target, 'index.html'), html);

const config = [
  '/* Généré par scripts/planning/build-public.mjs — mode intégré Nexus. */',
  'window.NEXUS_PLANNING_CONFIG = {',
  "  mode: 'integrated',",
  "  apiBase: '/api/planning-studio',",
  "  basePath: '/planning/',",
  "  signinPath: '/auth/signin?callbackUrl=%2Fplanning'",
  '};',
  '',
].join('\n');
fs.writeFileSync(path.join(target, 'config.js'), config);

const written = [...ASSETS.map((f) => `assets/${f}`), ...DATA.map((f) => `data/${f}`), 'index.html', 'config.js'];
console.log(`public/planning généré depuis tools/planning-studio (${written.length} fichiers).`);
