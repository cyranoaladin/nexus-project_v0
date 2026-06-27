#!/usr/bin/env node
/**
 * extract-schema.mjs
 *
 * Extraction DETERMINISTE du schéma Prisma.
 * Parse prisma/schema.prisma et émet pour CHAQUE modèle et enum
 * la liste COMPLETE de ses champs/valeurs — verbatim, sans sélection.
 *
 * Sortie : Markdown tabulé, stdout.
 * Usage  : node docs/architecture/restructuration/scripts/extract-schema.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, '../../../../prisma/schema.prisma');
const schema = readFileSync(schemaPath, 'utf-8');

const lines = schema.split('\n');

// --- Parse enums ---
const enums = [];
// --- Parse models ---
const models = [];

let current = null; // { type: 'enum'|'model', name, items: [] }
let braceDepth = 0;

for (const rawLine of lines) {
  const line = rawLine.trimEnd();
  const trimmed = line.trim();

  // Start of enum
  const enumMatch = trimmed.match(/^enum\s+(\w+)\s*\{/);
  if (enumMatch) {
    current = { type: 'enum', name: enumMatch[1], items: [] };
    braceDepth = 1;
    continue;
  }

  // Start of model
  const modelMatch = trimmed.match(/^model\s+(\w+)\s*\{/);
  if (modelMatch) {
    current = { type: 'model', name: modelMatch[1], items: [] };
    braceDepth = 1;
    continue;
  }

  if (!current) continue;

  // Track braces
  for (const ch of trimmed) {
    if (ch === '{') braceDepth++;
    if (ch === '}') braceDepth--;
  }

  if (braceDepth <= 0) {
    // End of block
    if (current.type === 'enum') enums.push(current);
    else models.push(current);
    current = null;
    braceDepth = 0;
    continue;
  }

  // Skip empty lines and comments inside blocks
  if (!trimmed || trimmed.startsWith('//')) continue;

  // Skip @@-level attributes (model-level)
  if (trimmed.startsWith('@@')) {
    current.items.push({ kind: 'attribute', raw: trimmed });
    continue;
  }

  if (current.type === 'enum') {
    // Enum value — may have inline comment
    const valMatch = trimmed.match(/^(\w+)\s*(\/\/.*)?$/);
    if (valMatch) {
      current.items.push({ kind: 'value', name: valMatch[1], comment: valMatch[2] || '' });
    }
  } else {
    // Model field
    // Fields look like: name Type? @attr1 @attr2 // comment
    // Relations look like: name Model[] or name Model? @relation(...)
    current.items.push({ kind: 'field', raw: trimmed });
  }
}

// --- Output ---

const out = [];

out.push('# Schéma Prisma — extraction déterministe');
out.push('');
out.push(`> Généré par \`extract-schema.mjs\` depuis \`prisma/schema.prisma\``);
out.push(`> Date : ${new Date().toISOString().slice(0, 10)}`);
out.push('');

// Enums
out.push(`## Enums (${enums.length})`);
out.push('');

for (const e of enums) {
  out.push(`### enum ${e.name}`);
  out.push('');
  out.push('| Valeur | Commentaire |');
  out.push('|--------|-------------|');
  for (const item of e.items) {
    if (item.kind === 'value') {
      const comment = item.comment ? item.comment.replace(/^\/\/\s*/, '') : '';
      out.push(`| \`${item.name}\` | ${comment} |`);
    }
  }
  out.push('');
}

// Models
out.push(`## Modèles (${models.length})`);
out.push('');

for (const m of models) {
  out.push(`### model ${m.name}`);
  out.push('');

  const fields = m.items.filter(i => i.kind === 'field');
  const attrs = m.items.filter(i => i.kind === 'attribute');

  out.push('| Champ | Déclaration complète |');
  out.push('|-------|---------------------|');
  for (const f of fields) {
    // Escape pipes in the raw string
    const escaped = f.raw.replace(/\|/g, '\\|');
    // Extract field name (first word)
    const nameMatch = f.raw.match(/^(\w+)\s/);
    const name = nameMatch ? nameMatch[1] : f.raw;
    out.push(`| \`${name}\` | \`${escaped}\` |`);
  }

  if (attrs.length > 0) {
    out.push('');
    out.push('**Attributs modèle :**');
    for (const a of attrs) {
      out.push(`- \`${a.raw}\``);
    }
  }

  out.push('');
}

console.log(out.join('\n'));
