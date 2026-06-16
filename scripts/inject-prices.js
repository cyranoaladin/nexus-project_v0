#!/usr/bin/env node

/**
 * inject-prices.js — Source unique : injecte les prix depuis data/offres-nexus.json
 * dans les templates HTML, produit les fichiers servis.
 *
 * Flux :
 *   src/static-pages/*.html  +  data/offres-nexus.json
 *           ↓ injection des <!--PRICE:clé--> et <!--REPERE:clé-->
 *   public/*.html  et  Nexus_Reussite_Accueil.html (racine)
 *
 * Lancé en "prebuild" dans package.json.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'offres-nexus.json');
const TEMPLATES_DIR = path.join(ROOT, 'src', 'static-pages');

// ── Charger les données ──────────────────────────────────────
const rawData = fs.readFileSync(DATA_PATH, 'utf8');
const raw = JSON.parse(rawData);
const PUBLIC_DATA_PATH = path.join(ROOT, 'public', 'offres-nexus.json');

// Calculer le display pour chaque offre si absent
function computeDisplay(offer) {
  if (offer.display) return offer.display;
  if (offer.monthly != null) {
    const prefix = offer.approx ? '≈ ' : 'dès ';
    return prefix + offer.monthly + ' TND / mois';
  }
  return null;
}

function computeAnnual(offer) {
  if (offer.annualDisplay) return offer.annualDisplay;
  if (offer.annual != null) {
    return offer.annual.toLocaleString('fr-FR') + ' TND / an';
  }
  return null;
}

function computeSelectorEcheancier(offer) {
  if (!Array.isArray(offer.echeancier)) return null;
  const labels =
    offer.echeancier.length === 5
      ? ['Réservation', 'Versement 1', 'Versement 2', 'Versement 3', 'Versement 4']
      : offer.echeancier.length === 4
        ? ['Réservation', 'Trimestre 1', 'Trimestre 2', 'Trimestre 3']
        : offer.echeancier.length === 9
          ? ['Réservation', 'Versement 1', 'Versement 2', 'Versement 3', 'Versement 4', 'Versement 5', 'Versement 6', 'Versement 7', 'Versement 8']
          : offer.echeancier.map((_, index) => (index === 0 ? 'Réservation' : `Versement ${index}`));

  return JSON.stringify(offer.echeancier.map((amount, index) => [labels[index], amount]));
}

const offers = {};
const reperes = raw._reperes || {};
const notes = raw._notes || {};

for (const [key, val] of Object.entries(raw)) {
  if (key.startsWith('_')) continue;
  offers[key] = {
    ...val,
    display: computeDisplay(val),
    annualDisplay: computeAnnual(val),
  };
}

// ── Mapping des fichiers template → destination ──────────────
const FILE_MAP = [
  {
    src: path.join(TEMPLATES_DIR, 'Nexus_Reussite_Accueil.html'),
    dest: path.join(ROOT, 'Nexus_Reussite_Accueil.html'),
  },
  {
    src: path.join(TEMPLATES_DIR, 'catalogue-nexus-reussite-2026-2027.html'),
    dest: path.join(ROOT, 'public', 'catalogue-nexus-reussite-2026-2027.html'),
  },
  {
    src: path.join(TEMPLATES_DIR, 'nexus_selecteur.html'),
    dest: path.join(ROOT, 'public', 'nexus_selecteur.html'),
  },
  {
    src: path.join(TEMPLATES_DIR, 'mentions-legales.html'),
    dest: path.join(ROOT, 'public', 'mentions-legales.html'),
  },
  {
    src: path.join(TEMPLATES_DIR, 'confidentialite.html'),
    dest: path.join(ROOT, 'public', 'confidentialite.html'),
  },
];

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getNested(source, ref) {
  return String(ref)
    .split('.')
    .reduce((value, key) => (value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined), source);
}

function extractText(fragment) {
  return fragment
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function fallbackBenefits(title, category) {
  const source = `${title} ${category}`.toLowerCase();
  if (source.includes('plateforme')) {
    return ['Ressources structurées', 'Compte parent et bilans selon formule', 'Cadre Nexus à distance'];
  }
  if (source.includes('stage')) {
    return ['Objectif ciblé', 'Groupe réduit', 'Dates précises communiquées avec la recommandation'];
  }
  if (source.includes('brevet')) {
    return ['Bases consolidées', 'Sujets types et méthode', 'Groupe réduit'];
  }
  if (source.includes('seconde')) {
    return ['Méthode de travail', 'Consolidation scientifique', 'Orientation progressive'];
  }
  return ['Groupe réduit', 'Plateforme selon formule', 'Bilans parents et suivi'];
}

function extractBenefits(article, title, category) {
  const benefits = [];
  article.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, item) => {
    const text = extractText(item);
    if (text && !benefits.includes(text)) benefits.push(text);
    return _;
  });
  return benefits.length ? benefits.slice(0, 3) : fallbackBenefits(title, category);
}

function buildBenefitList(benefits) {
  return `<ul class="list">${benefits.map((benefit) => `<li>${benefit}</li>`).join('')}</ul>`;
}

function buildOfferDetails({ detailsId, category, sub, price, benefits, payment }) {
  return [
    `<details id="${detailsId}" class="offer-detail" data-controlled-detail>`,
    '<summary>Détails de la formule</summary>',
    '<div class="offer-detail-body">',
    `<div class="detail-cell"><strong>Pour qui ?</strong>${sub}</div>`,
    `<div class="detail-cell"><strong>Ce qui est inclus</strong>${benefits.join(' · ')}</div>`,
    `<div class="detail-cell"><strong>Format</strong>${category}. ${sub}</div>`,
    `<div class="detail-cell"><strong>Paiement</strong>${payment || price}</div>`,
    '<div class="detail-cell full"><strong>Points à valider avant inscription</strong>Niveau, statut, établissement, spécialités, groupe ouvert, créneau disponible et échéancier.</div>',
    '</div>',
    '</details>',
  ].join('');
}

function enhanceCatalogueArticle(article, category) {
  const whatsapp = 'https://wa.me/21699192829?text=';
  const titleMatch = article.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  const title = titleMatch ? extractText(titleMatch[1]) : 'cette offre';
  const safeTitle = escapeHtmlAttribute(title);
  const detailSlug = slugify(title) || 'offre';
  const detailsId = `detail-${detailSlug}`;
  const message = encodeURIComponent(
    `Bonjour, je souhaite recevoir l’échéancier Nexus pour l’offre ${title}. Voici le niveau et le besoin de mon enfant :`
  );
  const mutedMatch = article.match(/<p[^>]*class="[^"]*\bmuted\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const sub = mutedMatch ? extractText(mutedMatch[1]) : 'Parcours adapté selon le niveau et le besoin.';
  const priceMatch = article.match(/<div[^>]*class="[^"]*\bprice-main\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const price = priceMatch ? extractText(priceMatch[1]) : 'Tarif transmis avec la recommandation';
  const benefits = extractBenefits(article, title, category);
  const detailsMatch = article.match(/<details\b(?=[^>]*\boffer-detail\b)[\s\S]*?<\/details>/i);
  const payment = detailsMatch
    ? extractText(detailsMatch[0]).replace(/^(?:Voir le détail|Détails inclus, paiement et points à valider|Détails de la formule|Tarif et paiement|Tarif annuel|Paiement|Inclus|Tarif)\s*/i, '')
    : price;

  let output = article;
  if (!output.includes('class="offer-category"')) {
    output = output.replace(/(<article\b[^>]*>)/i, `$1\n            <span class="offer-category">${category}</span>`);
  }
  if (!output.includes('class="offer-for"')) {
    output = output.replace(/(<\/h3>)/i, `$1<p class="offer-for"><strong>Pour qui ?</strong> ${sub}</p>`);
  }
  if (!/<ul[^>]*class="[^"]*\blist\b/i.test(output)) {
    const benefitsHtml = buildBenefitList(benefits);
    const priceBlockPattern = /(<div><div class="price-main">[\s\S]*?<\/div><div class="price-sub">[\s\S]*?<\/div><\/div>|<div class="price-main">[\s\S]*?<\/div>)/i;
    output = priceBlockPattern.test(output)
      ? output.replace(priceBlockPattern, `$1\n            ${benefitsHtml}`)
      : output.replace(/(<\/p>)/i, `$1\n            ${benefitsHtml}`);
  }

  const detailsHtml = buildOfferDetails({
    detailsId,
    category,
    sub,
    price,
    benefits,
    payment,
  });
  output = detailsMatch
    ? output.replace(/<details\b(?=[^>]*\boffer-detail\b)[\s\S]*?<\/details>/i, detailsHtml)
    : output.replace(/<\/article>\s*$/i, `${detailsHtml}</article>`);

  if (!output.includes('class="offer-actions"')) {
    const actions = [
      '<div class="offer-actions">',
      `<a class="button" aria-label="Recevoir l’échéancier ${safeTitle} — WhatsApp Nexus Réussite" href="${whatsapp}${message}">Recevoir l’échéancier</a>`,
      `<button class="detail-link" type="button" data-target="${detailsId}" aria-controls="${detailsId}" aria-expanded="false">Détails et paiement</button>`,
      '</div>',
    ].join('');
    output = output.replace(/<\/article>\s*$/i, `${actions}</article>`);
  }
  return output;
}

function ensureCatalogueOfferStructure(html) {
  const categoryBySection = {
    'candidats-libres': 'Candidats libres',
    scolarises: 'Élèves scolarisés',
    plateforme: 'Plateforme',
    stages: 'Stages',
    brevet: 'Troisième / Brevet',
    seconde: 'Seconde / orientation',
  };

  return html.replace(/<section\b(?=[^>]*\bid="([^"]+)")[\s\S]*?<\/section>/g, (section) => {
    const idMatch = section.match(/<section\b[^>]*\bid="([^"]+)"/i);
    const sectionId = idMatch ? idMatch[1] : '';
    const category = categoryBySection[sectionId];
    if (!category) return section;
    return section.replace(/<article\b(?=[^>]*\bclass="[^"]*\boffer\b[^"]*")[\s\S]*?<\/article>/g, (article) => {
      return enhanceCatalogueArticle(article, category);
    });
  });
}

// ── Injection ────────────────────────────────────────────────
let totalMarkers = 0;
let residual = 0;
const errors = [];

for (const { src, dest } of FILE_MAP) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️  Template manquant : ${src} — skip`);
    continue;
  }

  let html = fs.readFileSync(src, 'utf8');
  const name = path.basename(src);

  // <!--PRICE:key--> → display (main price of tête)
  html = html.replace(/<!--PRICE:(\w+)-->/g, (match, key) => {
    totalMarkers++;
    const offer = offers[key];
    if (!offer || !offer.display) {
      errors.push(`${name}: clé PRICE inconnue ou sans display → ${key}`);
      residual++;
      return match;
    }
    return offer.display;
  });

  // <!--SUB:key--> → sub-price line (annual, volume, etc.)
  html = html.replace(/<!--SUB:(\w+)-->/g, (match, key) => {
    totalMarkers++;
    const offer = offers[key];
    if (!offer || !offer.sub) {
      errors.push(`${name}: clé SUB inconnue ou sans sub → ${key}`);
      residual++;
      return match;
    }
    return offer.sub;
  });

  // <!--ANNUAL:key--> → annual display
  html = html.replace(/<!--ANNUAL:(\w+)-->/g, (match, key) => {
    totalMarkers++;
    const offer = offers[key];
    if (!offer || !offer.annualDisplay) {
      errors.push(`${name}: clé ANNUAL inconnue ou sans annualDisplay → ${key}`);
      residual++;
      return match;
    }
    return offer.annualDisplay;
  });

  // <!--PAIEMENT:key--> → payment plan string
  html = html.replace(/<!--PAIEMENT:(\w+)-->/g, (match, key) => {
    totalMarkers++;
    const offer = offers[key];
    if (!offer || !offer.paiement) {
      errors.push(`${name}: clé PAIEMENT inconnue ou sans paiement → ${key}`);
      residual++;
      return match;
    }
    return offer.paiement;
  });

  // <!--DETAIL_TARIF:key--> → full tarif detail string
  html = html.replace(/<!--DETAIL_TARIF:(\w+)-->/g, (match, key) => {
    totalMarkers++;
    const offer = offers[key];
    if (!offer || !offer.detailTarif) {
      errors.push(`${name}: clé DETAIL_TARIF inconnue → ${key}`);
      residual++;
      return match;
    }
    return offer.detailTarif;
  });

  // <!--NOTE:path.to.value--> → shared copy notes from data/offres-nexus.json
  html = html.replace(/<!--NOTE:([\w.]+)-->/g, (match, ref) => {
    totalMarkers++;
    const note = getNested(notes, ref);
    if (!note) {
      errors.push(`${name}: clé NOTE inconnue → ${ref}`);
      residual++;
      return match;
    }
    return note;
  });

  // /*PRICE:key*/ → display (JS-context, inside script strings)
  html = html.replace(/\/\*PRICE:(\w+)\*\//g, (match, key) => {
    totalMarkers++;
    const offer = offers[key];
    if (!offer || !offer.display) {
      errors.push(`${name}: clé JS PRICE inconnue → ${key}`);
      residual++;
      return match;
    }
    return offer.display;
  });

  // /*NUM:key.field*/ → numeric value (JS-context)
  html = html.replace(/\/\*NUM:(\w+)\.(\w+)\*\//g, (match, key, field) => {
    totalMarkers++;
    const offer = offers[key];
    if (!offer || offer[field] === undefined || typeof offer[field] !== 'number') {
      errors.push(`${name}: clé JS NUM inconnue ou non numérique → ${key}.${field}`);
      residual++;
      return match;
    }
    return String(offer[field]);
  });

  // /*ECHEANCIER:key*/ → JS array of [label, amount]
  html = html.replace(/\/\*ECHEANCIER:(\w+)\*\//g, (match, key) => {
    totalMarkers++;
    const offer = offers[key];
    const echeancier = offer ? computeSelectorEcheancier(offer) : null;
    if (!echeancier) {
      errors.push(`${name}: clé JS ECHEANCIER inconnue ou sans echeancier → ${key}`);
      residual++;
      return match;
    }
    return echeancier;
  });

  // /*TEXT:path.to.value*/ → JS string from shared notes
  html = html.replace(/\/\*TEXT:([\w.]+)\*\//g, (match, ref) => {
    totalMarkers++;
    const note = getNested(notes, ref);
    if (!note) {
      errors.push(`${name}: clé JS TEXT inconnue → ${ref}`);
      residual++;
      return match;
    }
    return JSON.stringify(note);
  });

  // <!--REPERE:key--> → repère values
  html = html.replace(/<!--REPERE:(\w+)-->/g, (match, key) => {
    totalMarkers++;
    const val = reperes[key];
    if (!val) {
      errors.push(`${name}: clé REPERE inconnue → ${key}`);
      residual++;
      return match;
    }
    return val;
  });

  if (name === 'catalogue-nexus-reussite-2026-2027.html') {
    html = ensureCatalogueOfferStructure(html);
  }

  // Ensure destination directory exists
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html, 'utf8');
  console.log(`✅ ${name} → ${path.relative(ROOT, dest)}`);
}

fs.mkdirSync(path.dirname(PUBLIC_DATA_PATH), { recursive: true });
fs.writeFileSync(PUBLIC_DATA_PATH, rawData, 'utf8');
console.log(`✅ offres-nexus.json → ${path.relative(ROOT, PUBLIC_DATA_PATH)}`);

// ── Rapport ──────────────────────────────────────────────────
console.log(`\n📊 Injection terminée : ${totalMarkers} marqueurs traités, ${residual} résiduels`);
if (errors.length) {
  console.error('\n❌ Erreurs :');
  errors.forEach(e => console.error(`   - ${e}`));
  process.exit(1);
}
if (residual > 0) {
  process.exit(1);
}

console.log('✅ Source unique : 0 marqueur résiduel.\n');
