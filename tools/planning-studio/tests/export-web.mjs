// Exporte une copie du planificateur destinée à être servie sous un préfixe
// d'URL absolu (ex. /planning/) par un site web : les chemins relatifs de
// index.html (assets/…, data/…) sont réécrits en chemins absolus.
// Usage : node tests/export-web.mjs --prefix /planning/ --out <dossier>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
let prefix = opt('--prefix', '/planning/');
if (!prefix.endsWith('/')) prefix += '/';
const out = path.resolve(opt('--out', path.join(root, 'dist-web')));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const copyDir = (src, dest) => {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory()) copyDir(path.join(src, entry.name), path.join(dest, entry.name));
    else fs.copyFileSync(path.join(src, entry.name), path.join(dest, entry.name));
  }
};
copyDir(path.join(root, 'assets'), path.join(out, 'assets'));
fs.mkdirSync(path.join(out, 'data'), { recursive: true });
for (const f of ['default-data.js', 'planning.default.json', 'planning.schema.json']) {
  fs.copyFileSync(path.join(root, 'data', f), path.join(out, 'data', f));
}
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/(href|src)="(assets|data)\//g, (m, attr, dir) => `${attr}="${prefix}${dir}/`);
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('Export web écrit dans ' + out + ' (préfixe ' + prefix + ')');
