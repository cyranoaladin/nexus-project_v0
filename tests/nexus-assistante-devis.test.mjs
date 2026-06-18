/**
 * Tests — Assistant Conseil & Devis Nexus v2
 * node --test tests/nexus-assistante-devis.test.mjs
 *
 * Tous les tests doivent être VERTS avant déploiement.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

const HTML_PATH = path.join(ROOT, 'src/static-pages/nexus_assistante_devis_v2.html');
const JSON_PATH = path.join(ROOT, 'data/offres-nexus.json');

const html     = fs.readFileSync(HTML_PATH, 'utf8');
const jsonSrc  = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Extract the embedded JSON from the HTML */
function extractEmbeddedJSON() {
  const m = html.match(/<script type="application\/json" id="nexus-offers-json"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(m, 'Bloc JSON embarqué introuvable dans le HTML');
  return JSON.parse(m[1]);
}

/** Extract META object source text from HTML script */
function extractMetaSrc() {
  const m = html.match(/const META=\{([\s\S]*?)\};/);
  return m ? m[0] : '';
}

/** Extract all numeric TND literals from JS logic (outside JSON block) */
function extractHardcodedAmounts() {
  // Remove the JSON embed block, then scan JS for bare TND-looking numbers
  const htmlNoJson = html.replace(/<script type="application\/json"[\s\S]*?<\/script>/, '');
  // Find numeric literals that look like prices (3+ digits, context = not a CSS value)
  const matches = htmlNoJson.match(/(?<![#\-])\b([2-9]\d{2,4})\b(?!\s*(?:px|%|em|rem|ms|s|deg))/g) || [];
  // Filter to likely price values (200-30000 TND range)
  return matches
    .map(Number)
    .filter(n => n >= 200 && n <= 30000)
    .filter(n => {
      // Exclude known non-price numbers like CSS z-index, year 2027, etc.
      const EXCLUDED = [2026, 2027, 1024, 1000, 1500, 1200]; // allow layout values
      return !EXCLUDED.includes(n);
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. SOURCE UNIQUE
// ═══════════════════════════════════════════════════════════════════════════
describe('1. Source unique — JSON embarqué == offres-nexus.json', () => {

  test('1.1 Le bloc JSON embarqué est présent dans le HTML', () => {
    assert.match(html, /<script type="application\/json" id="nexus-offers-json"/);
  });

  test('1.2 Le JSON embarqué est identique à data/offres-nexus.json', () => {
    const embedded = extractEmbeddedJSON();
    assert.deepStrictEqual(embedded, jsonSrc,
      'Le JSON embarqué diffère de offres-nexus.json — relancer le build script');
  });

  test('1.3 Checksum cohérent avec le JSON réel', () => {
    const m = html.match(/data-checksum="([a-f0-9]+)"/);
    assert.ok(m, 'Attribut data-checksum absent');
    const expected = createHash('sha256').update(JSON.stringify(jsonSrc)).digest('hex').slice(0, 16);
    assert.strictEqual(m[1], expected, 'Checksum ne correspond pas au JSON actuel');
  });

  test('1.4 Aucun objet OFFERS codé en dur (les prix viennent du JSON)', () => {
    // The JS should not declare a const/var OFFERS = { ... } with inline prices
    // It should use OFFERS_JSON from the embed and build OFFERS dynamically
    assert.match(html, /OFFERS_JSON=JSON\.parse\(document\.getElementById\('nexus-offers-json'\)/,
      'OFFERS_JSON doit être lu depuis l\'élément JSON embarqué');
    assert.doesNotMatch(html, /const OFFERS\s*=\s*\{\s*terminale/,
      'OFFERS ne doit pas être défini avec des données en dur');
  });

  test('1.5 La source META ne contient aucun montant TND', () => {
    const metaSrc = extractMetaSrc();
    assert.ok(metaSrc.length > 0, 'Bloc META introuvable');
    // META should only have h: (hours), not annual: or monthly: with values
    assert.doesNotMatch(metaSrc, /annual\s*:\s*[0-9]+/,
      'META ne doit pas contenir de clé annual: — les prix sont dans le JSON');
    assert.doesNotMatch(metaSrc, /monthly\s*:\s*[0-9]+/,
      'META ne doit pas contenir de clé monthly: — les prix sont dans le JSON');
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 2. EFFECTIF — GRILLE PAR OFFRE
// ═══════════════════════════════════════════════════════════════════════════
describe('2. Effectif — grille par offre (Terminale 5 · Première/Seconde 6 · Brevet 8)', () => {

  test('2.1 Chaque offre principale annuelle a effectifMax défini', () => {
    const annualKeys = ['terminaleSpecialiteSimple','duoTerminaleNexus','excellenceTerminale',
      'premiereDoubleSecurite','secondeMathsMethode','brevetComplet'];
    annualKeys.forEach(k => {
      assert.match(html, new RegExp(k+':.*?effectifMax:\\d','s'),
        `effectifMax manquant pour ${k}`);
    });
  });

  test('2.2 Le panneau économie mentionne les seuils 5/4/<4', () => {
    assert.match(html, /5.*Viabilité optimale|Viabilité optimale.*5/s);
    assert.match(html, /4.*Acceptable|Acceptable.*4/s);
    assert.match(html, /Valider direction/i);
  });

  test('2.3 Table coût/élève correcte (120 / effectif)', () => {
    // 120/5=24, 120/4=30, 120/3=40, 120/2=60, 120/1=120
    assert.match(html, /24 TND/);
    assert.match(html, /30 TND/);
    assert.match(html, /40 TND/);
    assert.match(html, /60 TND/);
    assert.match(html, /120 TND/);
  });

  test('2.4 Constante COUT_ENSEIGNANT = 120', () => {
    assert.match(html, /COUT_ENSEIGNANT\s*=\s*120/);
  });

  test('2.5 Panneau économie a la classe noprint (jamais imprimé)', () => {
    assert.match(html, /econ-panel[^"]*noprint|noprint[^"]*econ-panel/);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 3. ÉCONOMIE DU GROUPE
// ═══════════════════════════════════════════════════════════════════════════
describe('3. Économie — marge = prix × effectif − 120 × heures', () => {

  test('3.1 Formule de marge présente dans le JS', () => {
    assert.match(html, /revenue.*eff.*coutTotal|coutTotal.*revenue/s,
      'La formule marge brute groupe doit être présente');
  });

  test('3.2 Calcul marge cohérent — Duo Terminale (test manuel)', () => {
    // Duo: annual=7175, h=175, effectif=5
    // revenue = 7175*5 = 35875
    // coutTotal = 120*175 = 21000
    // marge = 35875-21000 = 14875
    const annual  = jsonSrc.duoTerminaleNexus.annual;
    const h       = 175; // documented hours from META
    const eff     = 5;
    const revenue = annual * eff;
    const cout    = 120 * h;
    const marge   = revenue - cout;
    assert.strictEqual(annual, 7175);
    assert.strictEqual(revenue, 35875);
    assert.strictEqual(cout, 21000);
    assert.strictEqual(marge, 14875);
  });

  test('3.3 Panneau économie non rendu dans #devis (pas imprimé)', () => {
    // The economics panel (HTML element) must be before #devis and carry noprint
    const econPos  = html.indexOf('id="econPanel"');
    const devisPos = html.indexOf('id="devis"');
    assert.ok(econPos > 0, 'Élément #econPanel introuvable');
    assert.ok(econPos < devisPos, 'Le panneau éco doit être avant le bloc #devis');
    // Check that the <details> opening tag contains noprint
    const econTag  = html.slice(Math.max(0, econPos - 200), econPos + 50);
    assert.match(econTag, /noprint/);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 4. RÉFÉRENTIEL EXAMENS 2026/2027
// ═══════════════════════════════════════════════════════════════════════════
describe('4. Référentiel examens 2026/2027', () => {

  test('4.1 EAM présent et labellisé (Épreuve Anticipée de Maths)', () => {
    assert.match(html, /EAM|épreuve anticipée de maths/i);
  });

  test('4.2 Spécialité abandonnée mentionnée', () => {
    assert.match(html, /spécialité abandonnée|spé abandonnée/i);
  });

  test('4.3 Ponctuelles tronc commun mentionnées (40 %)', () => {
    assert.match(html, /40\s*%.*tronc commun|ponctuelles.*40|tronc commun.*40/is);
  });

  test('4.4 Modalité A/B candidat libre présente', () => {
    assert.match(html, /modalité A/i);
    assert.match(html, /modalité B/i);
    assert.match(html, /étalée/i);
    assert.match(html, /groupée/i);
  });

  test('4.5 Carte d\'examen générée pour candidat libre', () => {
    assert.match(html, /carte d'examen|carte d\u2019examen/i);
    assert.match(html, /Cyclades/i);
    assert.match(html, /Institut français de Tunisie|IFT/i);
  });

  test('4.6 Coeff correctes Terminale dans la fiche examen (16/16/8/10)', () => {
    assert.match(html, /<td>16<\/td>/);
    assert.match(html, /<td>8<\/td>/);
    assert.match(html, /<td>10<\/td>/);
  });

  test('4.7 EAF (coef 5+5) présente dans la fiche Première', () => {
    assert.match(html, /Français écrit.*coef.*5|coef.*5.*Français/is);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 5. RÈGLE D'OR — CANDIDAT LIBRE TERMINALE
// ═══════════════════════════════════════════════════════════════════════════
describe('5. Règle d\'or — libre + terminale ∉ Spécialité Simple', () => {

  test('5.1 La logique recommend() exclut terminaleSpecialiteSimple pour les libres', () => {
    // Look for the libre terminale recommendation logic
    // It should offer Online, Mixte, or Premium — never Simple
    const recommandBlock = html.match(/else\s*\{[^}]*\/\/ terminale([\s\S]{0,800})\}/);
    // Check that the libre branch doesn't lead to terminaleSpecialiteSimple
    const libreBlock = html.match(/if\(libre\)\{([\s\S]{0,500}?)\}else if\(p\.horsTunis\)/);
    if (libreBlock) {
      assert.doesNotMatch(libreBlock[1], /terminaleSpecialiteSimple/,
        'Un libre en terminale ne doit jamais recevoir Spécialité Simple');
    }
    // Also verify the 3 valid keys are present in the libre terminale path
    assert.match(html, /terminaleLibrePremium/);
    assert.match(html, /terminaleLibreMixte/);
    assert.match(html, /terminaleLibreOnline/);
  });

  test('5.2 terminaleSpecialiteSimple uniquement dans le contexte scolarisé', () => {
    // terminaleSpecialiteSimple should only appear as recommendation for non-libre profiles
    const idx = html.indexOf("pri=\"pri\",\"alt\"");
    // The simple path in recommend(): check it's not inside a libre block
    // Find the assignment of terminaleSpecialiteSimple as pri
    const assignments = [...html.matchAll(/pri\s*=\s*["']terminaleSpecialiteSimple["']/g)];
    assignments.forEach(match => {
      // Get context around the assignment
      const ctx = html.slice(Math.max(0, match.index - 300), match.index);
      assert.doesNotMatch(ctx, /if\s*\(libre\)/,
        'terminaleSpecialiteSimple ne doit pas être assigné dans un bloc libre');
    });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 6. PANIER — TOTAL ET RÉDUCTIONS
// ═══════════════════════════════════════════════════════════════════════════
describe('6. Panier — total = offre + compléments − réductions', () => {

  test('6.1 Fonction calcBasket présente', () => {
    assert.match(html, /function calcBasket\(\)/);
  });

  test('6.2 Math.max(0,...) présente pour borner le total', () => {
    assert.match(html, /Math\.max\s*\(\s*0/);
  });

  test('6.3 Les réductions ne sont pas cumulables sans décision direction', () => {
    // Par défaut : meilleure réduction unique (reducPct logic)
    assert.match(html, /NON CUMULABLES par d.+faut/,
      'Commentaire r\u00e8gle non-cumulable attendu dans calcBasket');
    assert.match(html, /cumulDir/,
      'Flag cumulDir requis pour le chemin direction-only');
    // Comptant seul seulement si pas d'autre réduction
    assert.match(html, /&&!redAncien&&!redFratrie/,
      'Comptant ne doit s\'appliquer seul que si aucune autre r\u00e9duction');
  });

  test('6.3b Cumul seulement via case \'cumul-dir\' explicite', () => {
    assert.match(html, /id="cumul-dir"/,
      'Case \u00ab Cumul valid\u00e9 direction \u00bb requise dans le HTML');
    assert.match(html, /\u00c0 valider par la direction/,
      'Mention \u00ab \u00c0 valider par la direction \u00bb attendue quand cumul actif');
  });

  test('6.3c Parrainage = note, non d\u00e9duit du total', () => {
    // parrainage must NOT be added to reduc variable directly
    assert.doesNotMatch(html, /reduc\s*\+=\s*montantParrainage/,
      'Le montant parrainage ne doit pas \u00eatre ajout\u00e9 \u00e0 reduc \')');
    // It should appear as a note
    assert.match(html, /non d.+duite du total/i,
      'Parrainage doit \u00eatre pr\u00e9sent\u00e9 comme note non d\u00e9duite');
  });

  test('6.4 Échéancier consolidé = somme des tranches', () => {
    // Verify buildEchancier is present and uses ratio-based calculation
    assert.match(html, /function buildEchancier/);
    assert.match(html, /ratio.*totalAdjusted.*orig/s);
  });

  test('6.4b Aucune ligne 0 TND dans le panier (filtre e.a>0)', () => {
    assert.match(html, /\.filter\(e=>e\.a>0\)/,
      'Les lignes à 0 TND doivent être filtrées dans calcBasket');
  });

  test('6.4c Offres mensuelles : affichage X TND × 10 (pas 0 TND)', () => {
    assert.match(html, /fmt\(mainO\.monthly\).*TND.*×.*10/s,
      'Offres mensuelles doivent afficher X TND × 10 dans le panier');
  });

  test('6.5 Section basketWrap présente dans le DOM', () => {
    assert.match(html, /id="basketWrap"/);
    assert.match(html, /id="basketItems"/);
    assert.match(html, /id="basketTotals"/);
  });

  test('6.6 Tous les services du catalogue sélectionnables dans le panier', () => {
    // Key service types should be in BASKET_COMP_KEYS or BASKET_MAIN_KEYS
    assert.match(html, /plateformeAutonomie/);
    assert.match(html, /vacancesGrandOral/);
    assert.match(html, /vacancesBacBlanc/);
    assert.match(html, /vacancesSprintFinal/);
    assert.match(html, /urgenceMembreHeure/);
    assert.match(html, /urgencePackCinq/);
    assert.match(html, /pontParcoursup/);
    assert.match(html, /celluleCandidatLibre/);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 7. DEVIS PROFESSIONNEL
// ═══════════════════════════════════════════════════════════════════════════
describe('7. Devis professionnel', () => {

  test('7.1 Format n° NX-YYYYMMDD-HHMM-XXXX présent', () => {
    assert.match(html, /NX-\$\{.*getFullYear.*padStart|NX-.*YYYY/s);
  });

  test('7.1b Conditions devis utilisent effectifMax dynamique (effMax)', () => {
    assert.match(html, /effMax\.toLowerCase\(\)/,
      'Les conditions du devis doivent utiliser effMax dynamique, pas une valeur fix\u00e9e');
    assert.match(html, /effectifMax/,
      'effectifMax doit \u00eatre d\u00e9fini dans META');
  });

  test('7.1c makeDevis : aucune ligne 0 TND (filtre e.a>0)', () => {
    assert.match(html, /\.filter\(e=>e\.a>0\).*forEach/s,
      'makeDevis doit filtrer les lignes \u00e0 0 TND');
  });

  test('7.1d makeDevis : offres au mois affichent X TND \u00d7 10', () => {
    assert.match(html, /fmt\(o\.monthly\).*TND.*\u00d7.*10/s);
  });

  test('7.1e makeDevis : offres \u00e0 fourchette affichent range sans tableau', () => {
    assert.match(html, /o\.range&&!hasRealEch/);
  });

  test('7.2 crypto.getRandomValues utilisé (pas Math.random)', () => {
    assert.match(html, /crypto\.getRandomValues/);
    assert.doesNotMatch(html, /Math\.random/);
  });

  test('7.3 Aucune mention "réussite garantie"', () => {
    assert.doesNotMatch(html, /réussite garantie/i);
    assert.doesNotMatch(html, /résultat garanti/i);
    assert.doesNotMatch(html, /succès garanti/i);
  });

  test('7.4 Mention "proposition non contractuelle" présente dans le devis', () => {
    assert.match(html, /non contractuelle/i);
  });

  test('7.5 Section signatures présente', () => {
    assert.match(html, /bon pour accord/i);
  });

  test('7.6 Tarif public (anti-désistement) affiché si disponible', () => {
    assert.match(html, /publicAnnual|tarif public/i);
  });

  test('7.7 @media print : seul le devis s\'imprime', () => {
    assert.match(html, /@media print/);
    assert.match(html, /noprint/);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 8. SÉCURITÉ ET GDPR
// ═══════════════════════════════════════════════════════════════════════════
describe('8. Sécurité — local-only, pas de fuite données famille', () => {

  test('8.1 Aucun fetch() dans le code', () => {
    assert.doesNotMatch(html, /\bfetch\s*\(/);
  });

  test('8.2 Aucun XMLHttpRequest', () => {
    assert.doesNotMatch(html, /XMLHttpRequest/);
  });

  test('8.3 Aucun appel axios ou $.ajax', () => {
    assert.doesNotMatch(html, /axios\./);
    assert.doesNotMatch(html, /\$\.ajax/);
  });

  test('8.4 Bannière "Usage interne" présente', () => {
    assert.match(html, /Usage interne|usage interne/);
  });

  test('8.5 Mention "aucune donnée famille envoyée"', () => {
    assert.match(html, /données? famille.*envoy|aucune donnée.*serveur/i);
  });

  test('8.6 meta robots noindex,nofollow présent', () => {
    assert.match(html, /noindex.*nofollow|nofollow.*noindex/i);
  });

  test('8.7 Aucun script src externe portant des données (fonts OK)', () => {
    const externalScripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)];
    externalScripts.forEach(([, src]) => {
      // Google Fonts JS (if any) and trusted CDNs are OK; data-carrying URLs are not
      assert.doesNotMatch(src, /eleve|parent|famille|student|phone|email/i,
        'Un script externe semble transmettre des données : ' + src);
    });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 9. EXPORTS
// ═══════════════════════════════════════════════════════════════════════════
describe('9. Exports — WhatsApp · résumé interne · JSON', () => {

  test('9.1 Bouton copier message WhatsApp présent', () => {
    assert.match(html, /id="copyWa"/);
    assert.match(html, /WhatsApp/);
  });

  test('9.2 Bouton résumé interne présent', () => {
    assert.match(html, /id="copyResumeBtn"/);
  });

  test('9.3 Bouton export JSON présent', () => {
    assert.match(html, /id="exportJsonBtn"/);
  });

  test('9.4 Bouton imprimer/PDF présent', () => {
    assert.match(html, /id="printBtn"/);
    assert.match(html, /window\.print\(\)/);
  });

  test('9.5 Fonction buildInternalResume présente', () => {
    assert.match(html, /function buildInternalResume\(\)/);
  });

  test('9.6 Fonction exportQuoteJSON présente', () => {
    assert.match(html, /function exportQuoteJSON\(\)/);
  });

  test('9.7 Export JSON utilise Blob + URL.createObjectURL (pas de serveur)', () => {
    assert.match(html, /new Blob\(.*application\/json/s);
    assert.match(html, /URL\.createObjectURL/);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 10. VALEUR CANDIDATS LIBRES — 7 PILIERS
// ═══════════════════════════════════════════════════════════════════════════
describe('10. Valeur candidats libres — 7 piliers', () => {

  test('10.1 Carte d\'examen personnalisée', () => {
    assert.match(html, /carte d.examen personnalis/i);
  });

  test('10.2 Accompagnement administratif Cyclades + IFT', () => {
    assert.match(html, /Cyclades/);
    assert.match(html, /Institut français de Tunisie|IFT/);
  });

  test('10.3 Bacs blancs en conditions réelles', () => {
    assert.match(html, /bacs? blancs.*conditions? réelles|conditions? réelles.*bacs? blancs/i);
  });

  test('10.4 Plateforme mentionnée dans les offres libres', () => {
    assert.match(html, /Plateforme.*compte parent|plateforme.*complet/i);
  });

  test('10.5 Grand Oral préparé pour les libres Terminale', () => {
    assert.match(html, /Grand Oral/);
  });

  test('10.6 Pont Parcoursup disponible comme service', () => {
    assert.match(html, /pontParcoursup|Pont Parcoursup/);
    assert.ok(jsonSrc.pontParcoursup, 'pontParcoursup manquant dans offres-nexus.json');
  });

  test('10.7 Préparation ponctuelles (40 %) angle mort signalé', () => {
    assert.match(html, /40\s*%/);
    assert.match(html, /ponctuelles?/i);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 11. JSON SOURCE — COHÉRENCE DES DONNÉES
// ═══════════════════════════════════════════════════════════════════════════
describe('11. Cohérence offres-nexus.json', () => {

  test('11.1 Duo Terminale : écheancier somme = annual', () => {
    const duo = jsonSrc.duoTerminaleNexus;
    assert.ok(duo, 'duoTerminaleNexus absent');
    const sum = duo.echeancier.reduce((s, a) => s + a, 0);
    assert.strictEqual(sum, duo.annual, `Duo écheancier ${sum} ≠ annual ${duo.annual}`);
  });

  test('11.2 Excellence Terminale : écheancier somme = annual', () => {
    const ex = jsonSrc.excellenceTerminale;
    assert.ok(ex, 'excellenceTerminale absent');
    const sum = ex.echeancier.reduce((s, a) => s + a, 0);
    assert.strictEqual(sum, ex.annual, `Excellence écheancier ${sum} ≠ annual ${ex.annual}`);
  });

  test('11.3 Terminale Libre Mixte : annual = 7900', () => {
    assert.strictEqual(jsonSrc.terminaleLibreMixte.annual, 7900);
  });

  test('11.4 Terminale Libre Premium : annual = 9900', () => {
    assert.strictEqual(jsonSrc.terminaleLibrePremium.annual, 9900);
  });

  test('11.5 Nouvelles entrées urgence présentes', () => {
    assert.ok(jsonSrc.urgenceMembreHeure, 'urgenceMembreHeure manquant');
    assert.strictEqual(jsonSrc.urgenceMembreHeure.annual, 80);
    assert.ok(jsonSrc.urgenceNonMembreHeure, 'urgenceNonMembreHeure manquant');
    assert.strictEqual(jsonSrc.urgenceNonMembreHeure.annual, 120);
    assert.ok(jsonSrc.urgencePackCinq, 'urgencePackCinq manquant');
    assert.strictEqual(jsonSrc.urgencePackCinq.annual, 350);
    assert.ok(jsonSrc.urgencePackDix, 'urgencePackDix manquant');
    assert.strictEqual(jsonSrc.urgencePackDix.annual, 650);
  });

  test('11.6 Pont Parcoursup + Cellule Candidat Libre présents', () => {
    assert.ok(jsonSrc.pontParcoursup);
    assert.strictEqual(jsonSrc.pontParcoursup.annual, 900);
    assert.ok(jsonSrc.celluleCandidatLibre);
    assert.strictEqual(jsonSrc.celluleCandidatLibre.annual, 500);
  });

  test('11.7 Aucune clé privée (_) dans les offres utilisées', () => {
    const publicKeys = Object.keys(jsonSrc).filter(k => !k.startsWith('_'));
    publicKeys.forEach(k => {
      const offer = jsonSrc[k];
      assert.ok(offer.label, `Offre "${k}" sans label`);
    });
  });

  test('11.8 Clés BASKET_COMP_KEYS toutes présentes dans OFFERS/JSON', () => {
    const m = html.match(/const BASKET_COMP_KEYS=\[([^\]]+)\]/);
    assert.ok(m, 'BASKET_COMP_KEYS introuvable');
    const keys = m[1].match(/'([^']+)'/g).map(k => k.replace(/'/g,''));
    keys.forEach(k => {
      assert.ok(jsonSrc[k], `Clé BASKET_COMP_KEYS "${k}" absente de offres-nexus.json`);
    });
  });

  test('11.9 Points à valider direction documentés (arbitrages tarifaires)', () => {
    // These are deliberate warnings in the build output, not code errors.
    // Here we just verify the values exist for manual review.
    const simpleMonthly = jsonSrc.terminaleSpecialiteSimple.monthly; // 390/mois × h?
    const duoAnnual     = jsonSrc.duoTerminaleNexus.annual; // 7175
    const exAnnual      = jsonSrc.excellenceTerminale.annual; // 9594
    assert.ok(simpleMonthly > 0, 'terminaleSpecialiteSimple.monthly absent');
    assert.ok(duoAnnual > 0, 'duoTerminaleNexus.annual absent');
    assert.ok(exAnnual > 0, 'excellenceTerminale.annual absent');
    // Log the arbitrage points (informational, not a failure)
    console.log(`  ℹ️  Arbitrage 0.1 — Spé Simple: ${simpleMonthly} TND/mois`);
    console.log(`  ℹ️  Arbitrage 0.2 — Duo: ${duoAnnual} · Excellence: ${exAnnual}`);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 12. CLÉS DE COMPLÉMENTS — AUCUNE CLÉ INVALIDE
// ═══════════════════════════════════════════════════════════════════════════
describe('12. Clés de compléments — aucune clé invalide silencieuse', () => {

  test('12.1 stagePrerentreeTle absent des comp.push (clé invalide corrigée)', () => {
    assert.doesNotMatch(html, /comp\.push\([^)]*stagePrerentreeTle/,
      '"stagePrerentreeTle" est une clé invalide — doit être stagePrerentreeTerminale');
  });

  test('12.2 urgenceMembre absent des comp.push (clé invalide corrigée)', () => {
    // Only bare "urgenceMembre" (not urgenceMembreHeure) should be gone
    assert.doesNotMatch(html, /comp\.push\([^)]*['"]urgenceMembre['"]/,
      '"urgenceMembre" est une clé invalide — doit être urgenceMembreHeure');
  });

  test('12.3 stagePrerentreeTerminale présente dans recommend()', () => {
    assert.match(html, /stagePrerentreeTerminale/,
      'stagePrerentreeTerminale doit remplacer stagePrerentreeTle');
  });

  test('12.4 urgenceMembreHeure présente dans recommend()', () => {
    assert.match(html, /urgenceMembreHeure/);
  });

  test('12.5 console.warn présent pour clés invalides filtrées (uniq helper)', () => {
    assert.match(html, /console\.warn.*Cl\u00e9 de compl\u00e9ment invalide/,
      'Le helper uniq() doit logger un avertissement pour les clés absentes de OFFERS');
  });

  test('12.6 Toutes les clés comp.push existent dans BASKET_COMP_KEYS ou BASKET_MAIN_KEYS', () => {
    // Extract all keys from comp.push("key") or comp.push("k1","k2") patterns
    const pushMatches = [...html.matchAll(/comp\.push\(([^)]+)\)/g)];
    const compPushed = new Set();
    pushMatches.forEach(([,args]) => {
      [...args.matchAll(/"([^"]+)"/g)].forEach(([,k]) => compPushed.add(k));
    });
    const mComp = html.match(/const BASKET_COMP_KEYS=\[([^\]]+)\]/);
    const mMain = html.match(/const BASKET_MAIN_KEYS=\[([^\]]+)\]/);
    const validKeys = new Set();
    if(mComp) mComp[1].match(/'([^']+)'/g).forEach(k=>validKeys.add(k.replace(/'/g,'')));
    if(mMain) mMain[1].match(/'([^']+)'/g).forEach(k=>validKeys.add(k.replace(/'/g,'')));
    const invalid = [...compPushed].filter(k => !validKeys.has(k));
    assert.deepStrictEqual(invalid, [],
      `Clés comp.push invalides (absentes de BASKET_*_KEYS) : ${invalid.join(', ')}`);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 13. RÈGLES RÉDUCTIONS — GUARDS MÉTIER
// ═══════════════════════════════════════════════════════════════════════════
describe('13. Règles réductions — guards métier', () => {

  test('13.1 REDUC_EXCLU défini dans calcBasket (stages/urgences/plateformeAutonomie)', () => {
    assert.match(html, /REDUC_EXCLU\s*=\s*\[/,
      'Tableau REDUC_EXCLU requis dans calcBasket()');
    assert.match(html, /urgenceMembreHeure.*REDUC_EXCLU|REDUC_EXCLU.*urgenceMembreHeure/s);
    assert.match(html, /plateformeAutonomie.*REDUC_EXCLU|REDUC_EXCLU.*plateformeAutonomie/s);
  });

  test('13.2 Comptant uniquement sur formules annuelles (mainIsAnnual)', () => {
    assert.match(html, /mainIsAnnual/,
      'Flag mainIsAnnual requis pour limiter le comptant aux formules annuelles');
    assert.match(html, /redComptant&&mainIsAnnual/,
      'Comptant doit être conditionné à mainIsAnnual');
  });

  test('13.3 Réduction > 10% plafonnée sans autorisation direction', () => {
    assert.match(html, /reducPct>10&&!cumulDir/,
      'Réduction > 10% doit être plafonnée en l\'absence de cumulDir');
  });

  test('13.4 Total jamais négatif (Math.max(0,...))', () => {
    assert.match(html, /Math\.max\s*\(\s*0/,
      'Math.max(0,...) requis pour garantir un total non négatif');
  });

  test('13.5 Message info affiché si réduction sur offre exclue', () => {
    assert.match(html, /R\u00e9ductions non applicables aux stages.urgences/,
      'Message informatif requis quand réduction cochée sur offre non éligible');
  });

  test('13.6 Cumul direction déclenche avertissement visible dans le devis', () => {
    assert.match(html, /\u00c0 valider par la direction avant remise du devis/);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 14. STATUT COMMERCIAL DEVIS + ALERTES EDS
// ═══════════════════════════════════════════════════════════════════════════
describe('14. Statut commercial devis + alertes EDS/options', () => {

  test('14.1 Champ groupeStatut présent dans le formulaire', () => {
    assert.match(html, /id="groupeStatut"/);
  });

  test('14.2 Champ enseignantStatut présent', () => {
    assert.match(html, /id="enseignantStatut"/);
  });

  test('14.3 Champ creneauInfo présent', () => {
    assert.match(html, /id="creneauInfo"/);
  });

  test('14.4 makeDevis calcule isConditional et affiche badge statut', () => {
    assert.match(html, /isConditional/);
    assert.match(html, /statutBadge/);
    assert.match(html, /Conditionnel/);
  });

  test('14.5 Bloc Groupe & organisation dans le devis imprimé', () => {
    assert.match(html, /Groupe.*organisation|Groupe &amp; organisation/i);
    assert.match(html, /groupeLabel/);
    assert.match(html, /ensLabel/);
  });

  test('14.6 Section Documents à fournir pour candidat libre', () => {
    assert.match(html, /Documents.*fournir.*candidat libre|Documents \u00e0 fournir/i);
    assert.match(html, /Cyclades/);
    assert.match(html, /Institut fran\u00e7ais de Tunisie|IFT/);
  });

  test('14.7 Alerte EDS Terminale < 2 présente dans recommend()', () => {
    assert.match(html, /Terminale.*renseigner.*2 EDS|2 EDS.*Terminale/i);
  });

  test('14.8 Alerte Maths expertes sans Maths EDS présente', () => {
    assert.match(html, /Maths expertes requiert Maths comme EDS/i);
  });

  test('14.9 Alerte candidat libre modalité A/B non arrêtée', () => {
    assert.match(html, /modalit\u00e9 A\/B non arr\u00eat\u00e9e/i);
  });

  test('14.10 Alerte double cursus surcharge horaire', () => {
    assert.match(html, /Double cursus.*charge horaire|charge horaire.*double cursus/i);
  });

  test('14.11 Note réglementaire dans carte candidat libre', () => {
    assert.match(html, /Rep\u00e8res r\u00e9glementaires.*\u00e0 v\u00e9rifier/i);
  });

  test('14.12 print CSS exclut #basketWrap du PDF', () => {
    assert.match(html, /#basketWrap.*display:none|display:none.*#basketWrap/);
  });

  test('14.13 page-break-inside:avoid + break-inside:avoid sur blocs devis', () => {
    assert.match(html, /page-break-inside:\s*avoid/);
    assert.match(html, /break-inside:\s*avoid/);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 15. CALENDRIER PÉDAGOGIQUE — 3 CAS DISTINCTS
// ═══════════════════════════════════════════════════════════════════════════
describe('15. calendarText — 3 cas distincts (scolarisé / libre / double)', () => {

  test('15.1 status libre → texte centré sur échéances examen', () => {
    assert.match(html, /status===.libre.*ché.*ances d.examen|ché.*ances d.examen.*status===.libre/s);
    assert.match(html, /pas de calendrier scolaire impos/i);
  });

  test('15.2 status double → texte double contrainte', () => {
    assert.match(html, /status===.double.*double contrainte|double contrainte.*status===.double/s);
  });

  test('15.3 status scolarisé → texte AEFE rythme nord', () => {
    assert.match(html, /AEFE.*rythme nord/i);
    assert.match(html, /Toussaint/);
  });

  test('15.4 calendarText ne contient pas de dates IFT figées', () => {
    assert.doesNotMatch(html, /10 oct.*17 nov|20 oct.*17 nov/,
      'Les dates IFT approximatives doivent être supprimées de calendarText');
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 16. RÉDUCTIONS — CUMUL DIRECTION + GRILLE
// ═══════════════════════════════════════════════════════════════════════════
describe('16. Réductions — cumul direction correct + grille META', () => {

  test('16.1 Cumul direction : ancien + fratrie s\'additionnent (if, pas else if)', () => {
    // The bug was "else if(redFratrie)" — must now be "if(redFratrie)"
    assert.match(html, /if\(redFratrie\)\{cumul\+=Math\.round\(mainPrice\*0\.10\)/,
      'Fratrie doit être if (pas else if) pour cumuler avec ancien élève');
  });

  test('16.2 Cumul direction : labels construits par tableau + join', () => {
    assert.match(html, /labels\.push\('Fratrie/);
    assert.match(html, /labels\.push\('Ancien/);
    assert.match(html, /labels\.join\(' \+ '\)/);
  });

  test('16.3 eligibleReduction:false sur toutes les urgences', () => {
    assert.match(html, /urgenceMembreHeure:.*eligibleReduction:false/s);
    assert.match(html, /urgencePackCinq:.*eligibleReduction:false/s);
  });

  test('16.4 eligibleReduction:false sur plateformeAutonomie', () => {
    assert.match(html, /plateformeAutonomie:.*eligibleReduction:false/s);
  });

  test('16.5 eligibleReduction:false sur tous les stages', () => {
    assert.match(html, /stagePrerentreeMathsTerminale:.*eligibleReduction:false/s);
    assert.match(html, /vacancesUneMatiere:.*eligibleReduction:false/s);
  });

  test('16.6 eligibleReduction:true sur formules annuelles principales', () => {
    assert.match(html, /duoTerminaleNexus:.*eligibleReduction:true/s);
    assert.match(html, /premiereDoubleSecurite:.*eligibleReduction:true/s);
    assert.match(html, /brevetComplet:.*eligibleReduction:true/s);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// 17. SCORE DE RISQUE + STATUT COMMERCIAL + DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════
describe('17. Score de risque · statut liste d\'attente · documents', () => {

  test('17.1 riskScore calculé dans recommend()', () => {
    assert.match(html, /riskScore\s*\+?=\s*\d/);
    assert.match(html, /riskLevel/);
    assert.match(html, /riskMsg/);
  });

  test('17.2 riskScore retourné dans objet recommend()', () => {
    assert.match(html, /return\s*\{.*riskScore.*riskLevel.*riskMsg/s);
  });

  test('17.3 sRisk affiché dans le récapitulatif', () => {
    assert.match(html, /id="sRisk"/);
    assert.match(html, /sRisk.*innerHTML|innerHTML.*sRisk/s);
  });

  test('17.4 riskLevel : 3 valeurs possibles (élevé / moyen / faible)', () => {
    assert.match(html, />=8.*élevé|élevé.*>=8/s);
    assert.match(html, />=4.*moyen|moyen.*>=4/s);
    assert.match(html, /"faible"/);
  });

  test('17.5 Groupe complet → isListeAttente = true', () => {
    assert.match(html, /isListeAttente\s*=\s*gs===.complet/);
  });

  test('17.6 Groupe complet → badge rouge Liste d\'attente', () => {
    assert.match(html, /Liste d.attente.*groupe complet/i);
    assert.match(html, /isListeAttente.*FBEAEA|FBEAEA.*isListeAttente/s);
  });

  test('17.7 Enseignant à confirmer → devis conditionnel', () => {
    assert.match(html, /enseignant.*confirmer.*Conditionnel|Conditionnel.*enseignant.*confirmer/i);
  });

  test('17.8 Documents pour scolarisé Terminale/Première dans devis', () => {
    assert.match(html, /Dernier bulletin scolaire/);
    assert.match(html, /Emploi du temps actuel/);
    assert.match(html, /Dates de bacs blancs/);
  });

  test('17.9 Documents pour Troisième dans devis', () => {
    assert.match(html, /Résultat.*brevet blanc|brevet blanc.*disponible/i);
    assert.match(html, /Orientation envisag/i);
  });

  test('17.10 Documents pour Seconde dans devis', () => {
    assert.match(html, /Spécialités envisagées/);
    assert.match(html, /Projet de Première/);
  });

  test('17.11 Note IFT prudente sans dates figées (10 oct absent)', () => {
    assert.doesNotMatch(html, /10 oct.*17 nov|20 oct.*17 nov/,
      'Les dates approximatives IFT/Cyclades ne doivent plus figurer dans le code');
  });

  test('17.12 Prudence fiche examens présente', () => {
    assert.match(html, /Rep\u00e8re p\u00e9dagogique.*textes officiels.*font foi/i);
  });

  test('17.13 typeOffre défini dans META pour toutes les offres principales', () => {
    const keys = ['terminaleSpecialiteSimple','duoTerminaleNexus','premiereDoubleSecurite',
      'secondeMathsMethode','brevetComplet','urgenceMembreHeure','plateformeAutonomie'];
    keys.forEach(k => {
      assert.match(html, new RegExp(k+':.*?typeOffre:.(?:annuel|stage|urgence|plateforme|coaching)','s'),
        `typeOffre manquant pour ${k}`);
    });
  });

});
