import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const assistantPath = path.join(ROOT, "nexus_assistante_devis_v2.html");
const cataloguePath = path.join(ROOT, "offres-nexus-data.js");
const dataPath = path.join(ROOT, "data", "offres-nexus.json");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function extractEmbeddedJson(html) {
  const match = html.match(/<script[^>]+id="nexus-offers-json"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(match, "assistant must embed the canonical offers JSON for local-only operation");
  return JSON.parse(match[1]);
}

function expectedAnnualFromOffer(offer) {
  if (typeof offer.annual === "number") return offer.annual;
  if (typeof offer.monthly === "number") return offer.monthly * 10;
  return undefined;
}

// --- Test 1: Tariff coherence across all 3 sources ---
test("assistant uses the same canonical tariff keys and controlled annual prices as the catalogue", () => {
  assert.ok(fs.existsSync(dataPath), "data/offres-nexus.json must exist");
  const source = JSON.parse(read(dataPath));
  const html = read(assistantPath);
  const embedded = extractEmbeddedJson(html);
  const catalogue = read(cataloguePath);

  const expected = {
    duoTerminaleNexus: 7175,
    excellenceTerminale: 9594,
    terminaleLibreMixte: 7900,
    terminaleLibrePremium: 9900,
    premiereDoubleSecurite: 4900,
    plateformeSuivi: 1490,
    plateformeAccompagnee: 2900,
    brevetComplet: 3900,
    plateformeAutonomie: 590,
  };

  for (const [key, annual] of Object.entries(expected)) {
    assert.equal(expectedAnnualFromOffer(source[key]), annual, `${key} canonical annual price`);
    assert.equal(expectedAnnualFromOffer(embedded[key]), annual, `${key} assistant annual price`);
    assert.match(catalogue, new RegExp(`${key}[\\s\\S]{0,260}annual["']?:\\s*${annual}`), `${key} catalogue bridge`);
  }
});

// --- Test 2: No duplicate OFFERS, secure quote numbers ---
test("assistant builds OFFERS from embedded JSON and uses secure quote number generation", () => {
  const html = read(assistantPath);
  // v2 declares `const OFFERS={}` then populates from OFFERS_JSON — that pattern is allowed
  // But there must NOT be a hardcoded object literal like `const OFFERS = { key: { annual: ... } }`
  assert.doesNotMatch(html, /const\s+OFFERS\s*=\s*\{\s*\w+\s*:/, "assistant must not keep a hardcoded OFFERS object with data");
  assert.doesNotMatch(html, /Math\.random\s*\(/, "quote number must not use Math.random()");
  assert.match(html, /crypto\.getRandomValues/, "quote number must use crypto.getRandomValues()");
  assert.match(html, /NX-/, "quote number must follow NX- prefix format");
});

// --- Test 3: Level-specific subjects and specialties ---
test("assistant declares level-specific subjects and manages specialties per level", () => {
  const html = read(assistantPath);
  // v2 uses levelMap with arrays per level
  assert.match(html, /troisieme.*brevetMaths|brevetMaths.*troisieme/s, "troisieme level has brevet offers");
  assert.match(html, /seconde.*secondeMathsMethode|secondeMathsMethode.*seconde/s, "seconde level has maths offers");
  assert.match(html, /premiere.*premiereLibreEssentiel|premiereLibreEssentiel.*premiere/s, "premiere level has libre offers");
  assert.match(html, /terminale.*terminaleLibreMixte|terminaleLibreMixte.*terminale/s, "terminale level has libre offers");
  assert.match(html, /expertes/, "Maths expertes must be referenced");
  assert.match(html, /\.checked\s*[=|]/, "subject checkboxes must be manageable");
});

// --- Test 4: Complementary offers accessible in embedded JSON ---
test("assistant covers complementary offers used during interviews", () => {
  const embedded = extractEmbeddedJson(read(assistantPath));
  // v2 uses different keys for urgency: urgenceMembreHeure, urgencePackCinq, urgencePackDix
  const required = [
    "plateformeAutonomie",
    "premiereLibreIntensif",
    "stagePrerentreeTroisieme",
    "stagePrerentreeSeconde",
    "stagePrerentreePremiere",
    "stagePrerentreeTerminale",
    "vacancesUneMatiere",
    "vacancesGrandOral",
    "stageBrevet",
    "vacancesBacBlanc",
    "vacancesSprintFinal",
    "urgenceMembreHeure",
    "urgenceNonMembreHeure",
    "urgencePackCinq",
    "urgencePackDix",
  ];
  for (const key of required) assert.ok(embedded[key], `${key} must be accessible`);
});

// --- Test 5: Recommendation logic with alerts and profile factors ---
test("recommendation logic documents internal alerts and profile factors", () => {
  const html = read(assistantPath);
  // v2 uses slightly different variable names and alert strings
  for (const token of [
    "horsTunis",
    "urgent",
    "ancien",
    "stageDeja",
    "carte d'examen",
    "Budget serré",
    "Hors Tunis",
    "Maths expertes",
    "Double Sécurité",
    "Terminale Libre Mixte",
  ]) {
    assert.match(html, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), token);
  }
});

// --- Test 6: Discount rules and guardrails ---
test("discount rules are guarded and quote totals cannot go negative", () => {
  const html = read(assistantPath);
  for (const token of [
    "Réductions",
    "non cumulable",
    "valider",
    "direction",
    "déduction",
    "Math.max(0",
  ]) {
    assert.match(html, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), token);
  }
});

// --- Test 7: Printable quote safeguards ---
test("printable quote includes required commercial and pedagogical safeguards", () => {
  const html = read(assistantPath);
  for (const token of [
    "proposition non contractuelle",
    "Validité du devis",
    "Calendrier pédagogique",
    "réservation bloque la place",
    "niveaux homogènes",
  ]) {
    assert.match(html, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), token);
  }
  assert.doesNotMatch(html, /réussite garantie/i, "assistant must not promise guaranteed success");
});

// --- Test 8: Privacy, security, and exports ---
test("exports and privacy/security guidance are present without server submission", () => {
  const html = read(assistantPath);
  for (const token of [
    "Outil interne",
    "ne pas partager aux familles",
    "données saisies restent dans le navigateur",
    "basic auth",
    "restriction IP",
    "Copier résumé interne",
    "Copier message WhatsApp",
    "Exporter JSON",
    "window.print()",
  ]) {
    assert.match(html, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), token);
  }
  assert.doesNotMatch(html, /fetch\s*\([^)]*(parent|eleve|tel|email)/i, "parent data must not be sent to a server");
});

// --- Test 9: Échéanciers match the grille tarifaire (acompte ≤ traite, correct totals) ---
test("échéanciers in JSON and HTML match the grille tarifaire source of truth", () => {
  const source = JSON.parse(read(dataPath));
  const embedded = extractEmbeddedJson(read(assistantPath));

  const grille = {
    premiereLibreEssentiel:   { annual: 1900, ech: [475, 475, 475, 475] },
    premiereLibreAccompagnee: { annual: 4900, ech: [1200, 1200, 1200, 1300] },
    terminaleLibreOnline:     { annual: 2900, ech: [700, 700, 700, 800] },
    terminaleLibreMixte:      { annual: 7900, ech: [1900, 2000, 2000, 2000] },
    terminaleLibrePremium:    { annual: 9900, ech: [2400, 2500, 2500, 2500] },
    premiereDoubleSecurite:   { annual: 4900, ech: [1200, 1200, 1200, 1300] },
    duoTerminaleNexus:        { annual: 7175, ech: [1775, 1800, 1800, 1800] },
    excellenceTerminale:      { annual: 9594, ech: [2394, 2400, 2400, 2400] },
  };

  for (const [key, ref] of Object.entries(grille)) {
    for (const [label, data] of [["JSON", source], ["HTML", embedded]]) {
      const offer = data[key];
      assert.ok(offer, `${label}/${key} must exist`);
      const ech = offer.echeancier;
      assert.ok(Array.isArray(ech), `${label}/${key} must have echeancier array`);
      assert.deepStrictEqual(ech, ref.ech, `${label}/${key} echeancier must match grille`);
      const total = ech.reduce((a, b) => a + b, 0);
      assert.equal(total, ref.annual, `${label}/${key} echeancier total must equal annual`);
      assert.ok(ech[0] <= ech[1], `${label}/${key} acompte (${ech[0]}) must be ≤ first traite (${ech[1]})`);
    }
  }
});

// --- Test 10: Urgency prices match grille tarifaire ---
test("urgency prices in JSON and HTML match the grille tarifaire", () => {
  const source = JSON.parse(read(dataPath));
  const embedded = extractEmbeddedJson(read(assistantPath));

  // JSON keys
  assert.equal(source.urgenceMembre.hourly, 150, "JSON urgenceMembre hourly");
  assert.equal(source.urgencePack5Membre.annual, 650, "JSON urgencePack5Membre");
  assert.equal(source.urgencePack10Membre.annual, 1200, "JSON urgencePack10Membre");

  // HTML keys (v2 naming)
  assert.equal(embedded.urgenceMembreHeure.hourly, 150, "HTML urgenceMembreHeure hourly");
  assert.equal(embedded.urgencePackCinq.annual, 650, "HTML urgencePackCinq");
  assert.equal(embedded.urgencePackDix.annual, 1200, "HTML urgencePackDix");
});

// --- Test 11: Public prices match grille tarifaire ---
test("public annual prices match the grille tarifaire", () => {
  const source = JSON.parse(read(dataPath));
  const embedded = extractEmbeddedJson(read(assistantPath));

  const expected = {
    terminaleLibreMixte: 8750,
    excellenceTerminale: 10500,
    premiereDoubleSecurite: 5400,
    duoTerminaleNexus: 7900,
  };

  for (const [key, pubPrice] of Object.entries(expected)) {
    for (const [label, data] of [["JSON", source], ["HTML", embedded]]) {
      assert.equal(data[key].publicAnnual, pubPrice, `${label}/${key} publicAnnual`);
    }
  }
});
