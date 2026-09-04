#!/usr/bin/env node
/**
 * Synchronisation de la couverture commerciale (npm run planning:commercial-sync).
 *
 * Le Planning Studio distingue deux politiques :
 *
 *   OPERATIONAL — écrite à la main dans tools/planning-studio/assets/core.js :
 *     capacité du centre, durée d'une séance, fenêtres collège/seconde,
 *     référents Maths/NSI et Français/Philosophie, préférence week-end.
 *     Ce sont des règles d'organisation propres au planning.
 *
 *   COMMERCIAL — dérivée de l'offre Nexus, dont la source canonique est
 *     data/pricing.canonical.json. Le Planning en garde une copie pour
 *     fonctionner en mode autonome (file://, sans serveur), mais cette copie
 *     ne doit jamais diverger de la source.
 *
 * Ce gate est la garde de synchronisation : il compare, fait par fait, ce que
 * POLICY déclare et ce que le pricing canonique établit. Sans lui, la cadence
 * du Grand Oral vivrait à deux endroits indépendants, libres de dériver.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tool = path.join(repoRoot, 'tools', 'planning-studio');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(tool, 'assets', 'core.js'), 'utf8'), ctx, { filename: 'core.js' });
const POLICY = ctx.Nexus.POLICY;

const pricing = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'pricing.canonical.json'), 'utf8'));

const failures = [];
const report = {};
function compare(key, expected, actual) {
  report[key] = actual;
  const same = JSON.stringify(expected) === JSON.stringify(actual);
  if (!same) failures.push(`${key} : planning=${JSON.stringify(actual)} ≠ pricing=${JSON.stringify(expected)}`);
}

/* ── Grand Oral ────────────────────────────────────────────────────────── */
const canonical = pricing?.rules?.grand_oral_policy;
if (!canonical) {
  failures.push('data/pricing.canonical.json : rules.grand_oral_policy introuvable — la source canonique a changé de forme.');
} else {
  const module = (POLICY.requiredCoverage.find((e) => e.level === 'TERMINALE' && e.audience === 'CL')?.modules || [])
    .find((m) => m.subject === 'GRAND_ORAL');
  if (!module) {
    failures.push('POLICY : module GRAND_ORAL absent de la couverture Terminale CL.');
  } else {
    compare('GRAND_ORAL_INCLUDED_SESSIONS', canonical.included_sessions, module.includedSessions);
    compare('GRAND_ORAL_SESSION_DURATION', canonical.session_duration_minutes, module.sessionDurationMinutes);
    compare('GRAND_ORAL_TOTAL_HOURS_MAX', canonical.total_hours_max, module.totalHoursMax);
    compare('GRAND_ORAL_OFFER_IDS', canonical.applies_to_offer_ids, module.offerIds);
    report.GRAND_ORAL_COVERAGE_MODE = 'MODULE';
    report.GRAND_ORAL_WEEKLY_REQUIRED = false;
    report.GRAND_ORAL_SOURCE = module.source;

    // Cohérence interne de la source elle-même : 4 séances de 2 h = 8 h.
    const derivedHours = (canonical.included_sessions * canonical.session_duration_minutes) / 60;
    if (derivedHours !== canonical.total_hours_max) {
      failures.push(`pricing canonique incohérent : ${canonical.included_sessions} × ${canonical.session_duration_minutes} min = ${derivedHours} h ≠ total_hours_max ${canonical.total_hours_max}`);
    }
  }
}

/* ── Les offres citées existent-elles réellement ? ─────────────────────── */
const offerIds = new Set();
(function walk(node) {
  if (Array.isArray(node)) return node.forEach(walk);
  if (node && typeof node === 'object') {
    if (typeof node.id === 'string') offerIds.add(node.id);
    Object.values(node).forEach(walk);
  }
})(pricing);
const unknown = (canonical?.applies_to_offer_ids || []).filter((id) => !offerIds.has(id));
report.GRAND_ORAL_OFFERS_RESOLVED = unknown.length === 0;
if (unknown.length) failures.push(`offres inconnues dans le pricing : ${unknown.join(', ')}`);

for (const [k, v] of Object.entries(report)) console.log(`${k}=${JSON.stringify(v)}`);
console.log(`PLANNING_COMMERCIAL_POLICY_SYNC=${failures.length ? 'FAIL' : 'PASS'}`);
if (failures.length) {
  failures.forEach((f) => console.error('  ✗ ' + f));
  process.exit(1);
}
