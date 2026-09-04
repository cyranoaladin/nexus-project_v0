#!/usr/bin/env node
/**
 * Porte de qualité Nexus Planning Studio (npm run planning:gate).
 * Échoue (exit 1) si l'un des invariants suivants est violé :
 *   1. syntaxe JavaScript valide pour chaque module de l'outil ;
 *   2. data/default-data.js et data/planning.default.json identiques ;
 *   3. schemaVersion attendu et structure d'import valide ;
 *   4. planning canonique de démarrage sans erreur bloquante
 *      (conflits enseignant / salle / groupe, dépassement de capacité,
 *      références et horaires invalides) ;
 *   5. inventaire des séances conforme à la base de référence.
 * Imprime un rapport clé=valeur exploitable dans les preuves de release.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tool = path.join(repoRoot, 'tools', 'planning-studio');
const EXPECTED = { schemaVersion: 2, total: 45, active: 44, inactive: 1 };

const failures = [];
const fail = (msg) => failures.push(msg);

// 1. syntaxe
const modules = ['core.js', 'model.js', 'validation.js', 'storage.js', 'sync.js', 'ui-grid.js', 'ui-panels.js', 'app.js'];
for (const m of modules) {
  const file = path.join(tool, 'assets', m);
  try {
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: m });
  } catch (e) {
    fail(`syntaxe invalide : assets/${m} — ${e.message}`);
  }
}

// moteur (sans DOM)
const ctx = { console };
vm.createContext(ctx);
for (const m of ['core.js', 'model.js', 'validation.js']) {
  vm.runInContext(fs.readFileSync(path.join(tool, 'assets', m), 'utf8'), ctx, { filename: m });
}
const Nexus = ctx.Nexus;

// 2. JS ≡ JSON
const json = JSON.parse(fs.readFileSync(path.join(tool, 'data', 'planning.default.json'), 'utf8'));
const jsSrc = fs.readFileSync(path.join(tool, 'data', 'default-data.js'), 'utf8');
const m = /window\.NEXUS_DEFAULT_PLANNING = ([\s\S]*);\s*$/.exec(jsSrc);
if (!m) fail('default-data.js : affectation NEXUS_DEFAULT_PLANNING introuvable');
else if (JSON.stringify(JSON.parse(m[1])) !== JSON.stringify(json)) fail('default-data.js et planning.default.json divergent');

// 3. structure & schéma brut
const inspection = Nexus.inspectImport(json);
if (!inspection.ok) fail('structure invalide : ' + inspection.errors.join(' | '));
if (json.schemaVersion !== EXPECTED.schemaVersion) fail(`schemaVersion ${json.schemaVersion} ≠ ${EXPECTED.schemaVersion}`);

try {
  const schemaPath = path.join(tool, 'data', 'planning.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true });
  const validateSchema = ajv.compile(schema);
  const isValid = validateSchema(json);
  if (!isValid) {
    fail('validation JSON Schema échouée : ' + (validateSchema.errors || []).map((e) => `${e.instancePath || '/'} ${e.message}`).join(' | '));
  }
} catch (e) {
  fail('erreur validation planning.schema.json : ' + e.message);
}

// 4. validation canonique
const data = Nexus.normalize(json);
const result = Nexus.validate(data);
const count = (code) => result.issues.filter((i) => i.code === code).length;
const report = {
  PLANNING_SCHEMA_VERSION: data.schemaVersion,
  TOTAL_SESSIONS: data.sessions.length,
  ACTIVE_SESSIONS: data.sessions.filter((s) => s.active).length,
  INACTIVE_SESSIONS: data.sessions.filter((s) => !s.active).length,
  TEACHER_CONFLICTS: count('TEACHER_OVERLAP'),
  ROOM_CONFLICTS: count('ROOM_OVERLAP'),
  GROUP_CONFLICTS: count('GROUP_OVERLAP'),
  SIMULTANEOUS_OVERFLOW_WARNINGS: count('CENTER_EXCEPTIONAL'),
  SIMULTANEOUS_BLOCKERS: count('CENTER_OVERFLOW'),
  INVALID_REFERENCES: result.issues.filter((i) => /^(MISSING_|NO_SUBJECT|INVALID_LEVEL|INVALID_AUDIENCE|DUPLICATE_ID)/.test(i.code)).length,
  INVALID_DURATIONS: count('INVALID_TIME') + count('INVALID_DAY'),
  ERRORS: result.counts.error,
  WARNINGS: result.counts.warning,
  INFOS: result.counts.info,
};
if (result.counts.error > 0) fail(`planning canonique : ${result.counts.error} erreur(s) bloquante(s)`);

// 5. inventaire
if (report.TOTAL_SESSIONS !== EXPECTED.total) fail(`TOTAL_SESSIONS ${report.TOTAL_SESSIONS} ≠ ${EXPECTED.total}`);
if (report.ACTIVE_SESSIONS !== EXPECTED.active) fail(`ACTIVE_SESSIONS ${report.ACTIVE_SESSIONS} ≠ ${EXPECTED.active}`);
if (report.INACTIVE_SESSIONS !== EXPECTED.inactive) fail(`INACTIVE_SESSIONS ${report.INACTIVE_SESSIONS} ≠ ${EXPECTED.inactive}`);
const ids = data.sessions.map((s) => s.id);
if (new Set(ids).size !== ids.length) fail('identifiants de séances dupliqués');

for (const [k, v] of Object.entries(report)) console.log(`${k}=${v}`);
console.log(`PLANNING_CANONICAL_VALID=${result.counts.error === 0}`);
console.log(`PLANNING_GATE=${failures.length ? 'FAIL' : 'PASS'}`);
if (failures.length) {
  failures.forEach((f) => console.error('  ✗ ' + f));
  process.exit(1);
}
