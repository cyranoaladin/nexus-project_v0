#!/usr/bin/env node
/**
 * check.js — Validation statique de index.html
 * Usage : node scripts/check.js
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '..', 'index.html');
const html = readFileSync(htmlPath, 'utf-8');

let errors = 0;
let warnings = 0;

function check(label, condition, severity = 'error') {
  const ok = typeof condition === 'function' ? condition() : condition;
  const icon = ok ? '✓' : (severity === 'error' ? '✗' : '⚠');
  const color = ok ? '\x1b[32m' : (severity === 'error' ? '\x1b[31m' : '\x1b[33m');
  console.log(`${color}${icon}\x1b[0m ${label}`);
  if (!ok) severity === 'error' ? errors++ : warnings++;
}

console.log('\n── Validation statique index.html ──\n');

// ── Structure HTML ──
check('doctype html présent', html.startsWith('<!doctype html>'));
check('lang="fr" présent', html.includes('lang="fr"'));
check('charset utf-8', html.includes('charset="utf-8"'));
check('viewport meta', html.includes('name="viewport"'));
check('title présent', html.includes('<title>'));

// ── Fonctionnalités critiques ──
check('Modale saisie nom (nameModal)', html.includes('id="nameModal"'));
check('Formulaire nom (nameForm)', html.includes('id="nameForm"'));
check('Input nom (nameInput)', html.includes('id="nameInput"'));
check('Chip élève (studentChip)', html.includes('id="studentChip"'));
check('Indicateur save (savedPill)', html.includes('id="savedPill"'));
check('Bannière stockage (storageBanner)', html.includes('id="storageBanner"'));
check('Bloc bilan (bilanBlock)', html.includes('id="bilanBlock"'));
check('Pre bilan (bilanPre)', html.includes('id="bilanPre"'));
check('Nom dans impression (printStudentName)', html.includes('id="printStudentName"'));

// ── Boutons d\'action ──
check('Bouton check-auto', html.includes('data-action="check-auto"'));
check('Bouton show-bilan', html.includes('data-action="show-bilan"'));
check('Bouton export-json', html.includes('data-action="export-json"'));
check('Bouton export-csv', html.includes('data-action="export-csv"'));
check('Bouton copy-bilan', html.includes('data-action="copy-bilan"'));
check('Bouton reset avec confirm', html.includes('data-action="reset"'));
check('Bouton print', html.includes('data-action="print"'));

// ── Système de sauvegarde ──
check('SCHEMA_VERSION défini', html.includes('SCHEMA_VERSION = 2'));
check('ROOT_KEY défini', html.includes("ROOT_KEY = 'nexusDnbRoot'"));
check('sessionStorage utilisé', html.includes('sessionStorage'));
check('try/catch localStorage', html.includes('try{') || html.includes('try {'));
check('QuotaExceededError géré', html.includes('QuotaExceededError'));
check('makeStudentId présent', html.includes('function makeStudentId'));
check('makeRoot présent', html.includes('function makeRoot'));
check('loadRoot présent', html.includes('function loadRoot'));
check('saveRoot présent', html.includes('function saveRoot'));
check('storageAvailable détecté', html.includes('storageAvailable'));

// ── Bilan nominatif ──
check('buildBilanText présent', html.includes('_buildBilanText'));
check('buildBilanCSV présent', html.includes('_buildBilanCSV'));
check('exportJSON présent', html.includes('function exportJSON'));
check('exportCSV présent', html.includes('function exportCSV'));
check('copyBilan présent', html.includes('function copyBilan'));
check('submitName présent', html.includes('function submitName'));
check('changeStudent présent', html.includes('function changeStudent'));

// ── Quiz & flashcards ──
check('autoQuestions (10 questions)', (html.match(/id:'a\d+'/g) || []).length >= 10);
check('4 missions définies', ['percent', 'arith', 'algebra', 'geo'].every(ns => html.includes(`${ns}:`)));
check('8 flashcards définies', (html.match(/id:'fc\d+'/g) || []).length >= 8);
check('checkQuestions présent', html.includes('function checkQuestions'));
check('renderFlashcards présent', html.includes('function renderFlashcards'));

// ── Accessibilité ──
check('aria-modal sur modale', html.includes('aria-modal="true"'));
check('aria-label navigation', html.includes('aria-label'));
check('aria-live sur toast', html.includes('aria-live'));
check('role="status" sur feedback', html.includes('role="status"'));
check('role="alert" sur erreur nom', html.includes('role="alert"'));
check('focus-visible géré', html.includes('focus-visible'));

// ── Responsive & print ──
check('Media query mobile (720px)', html.includes('@media (max-width:720px)'));
check('Media query print', html.includes('@media print'));
check('.only-print', html.includes('only-print'));
check('.no-print', html.includes('no-print'));

// ── Autonomie (pas de CDN) ──
const externalRefs = ['cdn.', 'googleapis.com', 'jsdelivr.net', 'unpkg.com', 'cloudflare.com'];
externalRefs.forEach(ref => check(`Pas de dépendance ${ref}`, !html.includes(ref)));

// ── IDs dupliqués ──
const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const idCounts = {};
idMatches.forEach(id => { idCounts[id] = (idCounts[id] || 0) + 1; });
const dupes = Object.entries(idCounts).filter(([, n]) => n > 1).map(([id]) => id);
check(`Aucun ID dupliqué (trouvé: ${dupes.join(', ') || 'aucun'})`, dupes.length === 0);

// ── Liens internes ──
const anchorLinks = [...html.matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
const missingAnchors = anchorLinks.filter(id => !html.includes(`id="${id}"`));
check(`Liens internes valides (cassés: ${missingAnchors.join(', ') || 'aucun'})`, missingAnchors.length === 0);

// ── Résumé ──
console.log('\n────────────────────────────');
if (errors === 0 && warnings === 0) {
  console.log('\x1b[32m✓ Toutes les vérifications passent.\x1b[0m');
} else {
  if (errors > 0) console.log(`\x1b[31m✗ ${errors} erreur(s) critique(s)\x1b[0m`);
  if (warnings > 0) console.log(`\x1b[33m⚠ ${warnings} avertissement(s)\x1b[0m`);
}
console.log('');
process.exit(errors > 0 ? 1 : 0);
