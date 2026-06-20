#!/usr/bin/env node
/**
 * gen-offres-nexus.js — Generates data/offres-nexus.json from pricing.canonical.json.
 *
 * This is the ONLY way offres-nexus.json should be updated.
 * The devis tool reads this file; it must stay in sync with the canonical source.
 *
 * Usage: node scripts/gen-offres-nexus.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const canonical = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'pricing.canonical.json'), 'utf8')
);
const OUT = process.env.OFFRES_NEXUS_OUT || path.join(ROOT, 'data', 'offres-nexus.json');

// ── Helpers ─────────────────────────────────────────────────────────
function fmtTND(n) {
  return n.toLocaleString('fr-FR') + ' TND';
}

function camelCase(id) {
  return id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function buildEcheancier(offer) {
  if (offer.deposit == null || offer.installment_amount == null) return undefined;
  const arr = [offer.deposit];
  for (let i = 0; i < (offer.n_installments || 9) - 2; i++) {
    arr.push(offer.installment_amount);
  }
  arr.push(offer.last_installment ?? offer.installment_amount);
  return arr;
}

function buildPaiement(offer) {
  if (offer.deposit == null) return undefined;
  return `${fmtTND(offer.deposit)} reservation + ${(offer.n_installments || 9) - 1} mensualites`;
}

// ── Build output ────────────────────────────────────────────────────
const result = {};

// Annual offers (scolarises + libres + plateforme)
for (const o of canonical.offers) {
  const key = camelCase(o.id);
  const entry = { label: o.title };

  if (o.price_annual != null) {
    const monthly = o.monthly_display ?? Math.round(o.price_annual / 10);
    if (o.track === 'plateforme') {
      entry.display = `${fmtTND(o.price_annual)} / an`;
      entry.annual = o.price_annual;
      entry.monthlyAlt = monthly;
      entry.sub = `ou ${monthly} TND / mois`;
    } else {
      entry.monthly = monthly;
      entry.annual = o.price_annual;
      if (monthly !== Math.round(o.price_annual / 10)) entry.approx = true;
      const ech = buildEcheancier(o);
      if (ech) entry.echeancier = ech;
      entry.paiement = buildPaiement(o);
      entry.annualDisplay = `${fmtTND(o.price_annual)} / an`;
    }
  } else {
    // Skeleton offer (e.g. range display)
    if (o.display) entry.display = o.display;
    if (o.subjects) entry.sub = o.subjects;
  }

  result[key] = entry;
}

// Stage formats as display ranges
const stageFormats = canonical.stage_formats || [];
if (stageFormats.length > 0) {
  const prices = stageFormats.map(f => f.price_per_student).sort((a, b) => a - b);
  const minP = prices[0];
  const maxP = prices[prices.length - 1];

  // Add common stage entries
  result.vacancesUneMatiere = { label: '1 matiere — 10 a 12 h', display: `${fmtTND(stageFormats.find(f => f.format_id === 'intensif-express')?.price_per_student || minP)} a ${fmtTND(stageFormats.find(f => f.format_id === 'intensif-solo')?.price_per_student || 580)}` };
  result.vacancesDuoMatieres = { label: 'Duo matieres — 18 a 20 h', display: `${fmtTND(stageFormats.find(f => f.format_id === 'intensif-duo')?.price_per_student || 850)} a ${fmtTND(stageFormats.find(f => f.format_id === 'intensif-duo-plus')?.price_per_student || 950)}` };
  result.vacancesSprintFinal = { label: 'Sprint final — 20 a 30 h', display: `${fmtTND(stageFormats.find(f => f.format_id === 'sprint-final')?.price_per_student || 950)} a ${fmtTND(stageFormats.find(f => f.format_id === 'sprint-final-max')?.price_per_student || 1450)}` };
  result.vacancesBacBlanc = { label: 'Epreuve blanche + correction', display: fmtTND(canonical.ponctuel_offers?.find(p => p.id === 'epreuve-blanche')?.price_per_student || 150) };
}

// Urgence
if (canonical.urgence) {
  const u = canonical.urgence;
  result.urgenceMembre = { label: u.membre_heure.title, display: u.membre_heure.display, hourly: u.membre_heure.hourly };
  result.urgenceNonMembre = { label: u.non_membre_heure.title, display: u.non_membre_heure.display, hourly: u.non_membre_heure.hourly };
  result.urgencePack5Membre = { label: u.pack_5h_membre.title, display: u.pack_5h_membre.display, annual: u.pack_5h_membre.amount };
  result.urgencePack10Membre = { label: u.pack_10h_membre.title, display: u.pack_10h_membre.display, annual: u.pack_10h_membre.amount };
}

// Notes
result._notes = {
  tarifAnnuel: {
    long: `Tarif annuel ${canonical.version || '2026-2027'} selon les places disponibles. Acompte verrouillant le tarif annuel. Groupes de ${canonical.rules?.group_max || 5} eleves maximum.`,
    short: 'Tarif annuel selon les places disponibles — acompte verrouillant.',
  },
};

// Reperes
const rep = canonical.reperes_tarifaires || {};
result._reperes = {
  brevetMois: rep.brevetMois || '',
  secondeMois: rep.secondeMois || '',
  premiereSimpleMois: rep.premiereSimpleMois || '',
  premiereDuoMois: rep.premiereDuoMois || '',
  terminaleSimpleMois: rep.terminaleSimpleMois || '',
  terminaleDuoMois: rep.terminaleDuoMois || '',
  plateformeAn: rep.plateformeAn || '',
  stagesBase: rep.stagesBase || '',
  parrainage: rep.parrainage || '',
};

// Write
const json = JSON.stringify(result, null, 2) + '\n';
fs.writeFileSync(OUT, json);

const count = Object.keys(result).filter(k => !k.startsWith('_')).length;
console.log(`Generated ${OUT} (${count} offers) from pricing.canonical.json`);
