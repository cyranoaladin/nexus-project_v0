#!/usr/bin/env node
/**
 * Portes de données Nexus Planning Studio.
 *
 *   node scripts/planning/data-gate.mjs orphans      (npm run planning:orphans)
 *   node scripts/planning/data-gate.mjs duplicates   (npm run planning:duplicates)
 *
 * Contrôle par défaut le planning livré (tools/planning-studio/data). Un
 * chemin de fichier JSON peut être passé en second argument pour auditer un
 * autre planning — notamment un export du document canonique de production :
 *
 *   node scripts/planning/data-gate.mjs orphans /tmp/planning-live.json
 *
 * Imprime un rapport clé=valeur et sort en 1 si un invariant est violé.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tool = path.join(repoRoot, 'tools', 'planning-studio');

const mode = process.argv[2];
if (mode !== 'orphans' && mode !== 'duplicates') {
  console.error('usage : data-gate.mjs <orphans|duplicates> [planning.json]');
  process.exit(64);
}

const ctx = { console };
vm.createContext(ctx);
for (const m of ['core.js', 'model.js', 'validation.js']) {
  vm.runInContext(fs.readFileSync(path.join(tool, 'assets', m), 'utf8'), ctx, { filename: m });
}
const Nexus = ctx.Nexus;

const sourcePath = process.argv[3] || path.join(tool, 'data', 'planning.default.json');
const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const data = Nexus.normalize(raw);
const issues = Nexus.validate(data).issues;

const failures = [];
const report = {};
const emit = (key, value, blocking = true) => {
  report[key] = value;
  if (blocking && value !== 0) failures.push(`${key}=${value}`);
};

const countCode = (code) => issues.filter((i) => i.code === code).length;
const idsOfCode = (code) => issues.filter((i) => i.code === code).flatMap((i) => i.sessionIds);

if (mode === 'orphans') {
  const registries = {
    teacherId: new Set(data.teachers.map((t) => t.id)),
    roomId: new Set(data.rooms.map((r) => r.id)),
    subjectId: new Set(data.subjects.map((s) => s.id)),
    groupId: new Set(data.groups.map((g) => g.id)),
  };
  // Une référence est orpheline si elle est absente OU pointe vers une entité
  // supprimée. Contrôlé directement sur les données, pas seulement via les
  // diagnostics, pour que la porte reste vraie même si un code change de nom.
  const orphans = { teacherId: [], roomId: [], subjectId: [], groupId: [] };
  for (const session of data.sessions) {
    for (const field of Object.keys(registries)) {
      const value = session[field];
      if (!value || !registries[field].has(value)) orphans[field].push(session.id);
    }
  }
  emit('ORPHAN_SESSION_TEACHERS', orphans.teacherId.length);
  emit('ORPHAN_SESSION_ROOMS', orphans.roomId.length);
  emit('ORPHAN_SESSION_SUBJECTS', orphans.subjectId.length);
  emit('ORPHAN_SESSION_GROUPS', orphans.groupId.length);
  for (const [field, ids] of Object.entries(orphans)) {
    if (ids.length) console.error(`  ✗ ${field} orphelin : ${ids.join(', ')}`);
  }

  // Configuration jamais référencée : information, sauf prestation obligatoire.
  emit('UNUSED_TEACHERS', countCode('TEACHER_UNUSED'), false);
  emit('UNUSED_ROOMS', countCode('UNUSED_ROOM'), false);
  emit('UNUSED_SUBJECTS', countCode('UNUSED_SUBJECT'), false);
  emit('UNUSED_GROUPS', countCode('UNUSED_GROUP'), false);
  emit('REQUIRED_COVERAGE_MISSING', countCode('REQUIRED_COVERAGE_MISSING'));
} else {
  emit('DUPLICATE_SESSION_IDS', countCode('DUPLICATE_ID'));
  emit('DUPLICATE_SESSIONS_EXACT', countCode('DUPLICATE_SESSION_EXACT'));
  emit('DUPLICATE_SESSIONS_SEMANTIC', countCode('DUPLICATE_SESSION_SEMANTIC'));
  emit('DUPLICATE_TEACHER_IDS', countCode('DUPLICATE_TEACHER_ID'));
  emit('DUPLICATE_TEACHER_CODES', countCode('DUPLICATE_TEACHER_CODE'));
  emit('DUPLICATE_ROOM_IDS', countCode('DUPLICATE_ROOM_ID'));
  emit('DUPLICATE_ROOM_IDENTITIES', countCode('DUPLICATE_ROOM_NAME'));
  emit('DUPLICATE_SUBJECT_IDS', countCode('DUPLICATE_SUBJECT_ID'));
  emit('DUPLICATE_GROUP_IDS', countCode('DUPLICATE_GROUP_ID'));
  for (const code of ['DUPLICATE_SESSION_EXACT', 'DUPLICATE_SESSION_SEMANTIC']) {
    const ids = idsOfCode(code);
    if (ids.length) console.error(`  ✗ ${code} : ${[...new Set(ids)].join(', ')}`);
  }
}

report.SOURCE = path.relative(repoRoot, sourcePath) || sourcePath;
report.SESSIONS = data.sessions.length;
for (const [k, v] of Object.entries(report)) console.log(`${k}=${v}`);
console.log(`PLANNING_${mode.toUpperCase()}_GATE=${failures.length ? 'FAIL' : 'PASS'}`);
if (failures.length) {
  failures.forEach((f) => console.error('  ✗ ' + f));
  process.exit(1);
}
