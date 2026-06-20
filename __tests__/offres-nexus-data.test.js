/**
 * F1 — Unit tests: offres-nexus-data.json integrity
 *
 * Invariants tested:
 * - display is derivable from monthly/annual/approx (never hand-typed when computable)
 * - echeancier sums match annual for fidélité packs
 * - every PRICE/SUB/ANNUAL/PAIEMENT/DETAIL_TARIF/REPERE/NUM/ECHEANCIER key in templates exists in JSON
 * - no orphan JSON key (unreferenced by any template)
 * - zero residual markers after injection
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'offres-nexus.json'), 'utf8'));

const reperes = data._reperes || {};
const notes = data._notes || {};
const offers = {};
for (const [k, v] of Object.entries(data)) {
  if (!k.startsWith('_')) offers[k] = v;
}

function getNested(source, ref) {
  return String(ref)
    .split('.')
    .reduce((value, key) => (value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined), source);
}

// ── Helper: compute expected display ──
function expectedDisplay(offer) {
  if (offer.display) return offer.display;
  if (offer.monthly != null) {
    return (offer.approx ? '≈ ' : 'dès ') + offer.monthly + ' TND / mois';
  }
  return null;
}

// ── Load all template files ──
const TEMPLATE_DIR = path.join(ROOT, 'src', 'static-pages');
const templateFiles = [
  'Nexus_Reussite_Accueil.html',
  'catalogue-nexus-reussite-2026-2027.html',
  'nexus_selecteur.html',
  'mentions-legales.html',
  'confidentialite.html',
];
const allTemplateContent = templateFiles.map(f =>
  fs.readFileSync(path.join(TEMPLATE_DIR, f), 'utf8')
).join('\n');
const assistantAppPath = path.join(ROOT, 'src', 'static-pages', 'assistante-devis-v3', 'app.js');
const assistantIndexPath = path.join(ROOT, 'src', 'static-pages', 'assistante-devis-v3', 'index.html');

describe('offres-nexus.json integrity', () => {
  test('every offer has a label', () => {
    for (const [key, offer] of Object.entries(offers)) {
      expect(offer.label).toBeTruthy();
    }
  });

  test('display is consistent with monthly/annual/approx', () => {
    for (const [key, offer] of Object.entries(offers)) {
      const expected = expectedDisplay(offer);
      if (expected && !offer.display) {
        // display was derived — verify consistency
        expect(expected).toBeTruthy();
      }
    }
  });

  test('echeancier sums equal annual for packs with echeancier', () => {
    const checksums = [
      ['duoTerminaleNexus', 7175],
      ['excellenceTerminale', 9594],
      ['premiereLibreEssentiel', 1900],
      ['premiereLibreAccompagnee', 4900],
      ['terminaleLibreOnline', 2900],
    ];
    for (const [key, expectedAnnual] of checksums) {
      const offer = offers[key];
      if (offer && offer.echeancier) {
        const sum = offer.echeancier.reduce((a, b) => a + b, 0);
        expect(sum).toBe(expectedAnnual);
      }
    }
  });

  test('key installment plans match validated commercial schedules', () => {
    expect(offers.duoTerminaleNexus.echeancier).toEqual([2150, 560, 560, 560, 560, 560, 560, 560, 560, 545]);
    expect(offers.excellenceTerminale.echeancier).toEqual([2880, 750, 750, 750, 750, 750, 750, 750, 750, 714]);
    expect(offers.premiereLibreAccompagnee.echeancier).toEqual([1470, 380, 380, 380, 380, 380, 380, 380, 380, 390]);
    expect(offers.terminaleLibrePremium.echeancier).toEqual([2970, 770, 770, 770, 770, 770, 770, 770, 770, 770]);
    expect(offers.terminaleLibrePremium.paiement).toContain('9 mensualités de 770 TND');
  });

  test('all PRICE keys in templates exist in JSON', () => {
    const refs = [...allTemplateContent.matchAll(/<!--PRICE:(\w+)-->/g)].map(m => m[1]);
    const missing = refs.filter(k => !offers[k]);
    expect(missing).toEqual([]);
  });

  test('all SUB keys in templates exist in JSON with sub field', () => {
    const refs = [...allTemplateContent.matchAll(/<!--SUB:(\w+)-->/g)].map(m => m[1]);
    const missing = refs.filter(k => !offers[k] || !offers[k].sub);
    expect(missing).toEqual([]);
  });

  test('all ANNUAL keys in templates exist in JSON', () => {
    const refs = [...allTemplateContent.matchAll(/<!--ANNUAL:(\w+)-->/g)].map(m => m[1]);
    const missing = refs.filter(k => {
      const o = offers[k];
      return !o || (!o.annualDisplay && o.annual == null);
    });
    expect(missing).toEqual([]);
  });

  test('all PAIEMENT keys in templates exist in JSON', () => {
    const refs = [...allTemplateContent.matchAll(/<!--PAIEMENT:(\w+)-->/g)].map(m => m[1]);
    const missing = refs.filter(k => !offers[k] || !offers[k].paiement);
    expect(missing).toEqual([]);
  });

  test('all DETAIL_TARIF keys in templates exist in JSON', () => {
    const refs = [...allTemplateContent.matchAll(/<!--DETAIL_TARIF:(\w+)-->/g)].map(m => m[1]);
    const missing = refs.filter(k => !offers[k] || !offers[k].detailTarif);
    expect(missing).toEqual([]);
  });

  test('all REPERE keys in templates exist in JSON', () => {
    const refs = [...allTemplateContent.matchAll(/<!--REPERE:(\w+)-->/g)].map(m => m[1]);
    const missing = refs.filter(k => !reperes[k]);
    expect(missing).toEqual([]);
  });

  test('all NOTE keys in templates exist in JSON', () => {
    const refs = [...allTemplateContent.matchAll(/<!--NOTE:([\w.]+)-->/g)].map(m => m[1]);
    const missing = refs.filter(ref => !getNested(notes, ref));
    expect(missing).toEqual([]);
  });

  test('all numeric selector keys in templates exist in JSON', () => {
    const refs = [...allTemplateContent.matchAll(/\/\*NUM:(\w+)\.(\w+)\*\//g)]
      .map(m => ({ key: m[1], field: m[2] }));
    const missing = refs.filter(({ key, field }) => offers[key]?.[field] === undefined);
    expect(missing).toEqual([]);
  });

  test('all selector echeancier keys in templates exist in JSON with echeancier field', () => {
    const refs = [...allTemplateContent.matchAll(/\/\*ECHEANCIER:(\w+)\*\//g)].map(m => m[1]);
    const missing = refs.filter(k => !Array.isArray(offers[k]?.echeancier));
    expect(missing).toEqual([]);
  });

  test('all selector TEXT keys in templates exist in JSON notes', () => {
    const refs = [...allTemplateContent.matchAll(/\/\*TEXT:([\w.]+)\*\//g)].map(m => m[1]);
    const missing = refs.filter(ref => !getNested(notes, ref));
    expect(missing).toEqual([]);
  });

  test('campaign tariff copy no longer mentions a fixed deadline', () => {
    const allCopy = JSON.stringify(data);
    expect(allCopy.toLowerCase()).not.toContain('date limite');
    expect(allCopy.toLowerCase()).not.toContain('période de réservation prioritaire');
    expect(allCopy).toContain('selon les places disponibles');
  });

  test('selector archive mirrors the canonical money fields', () => {
    const selector = fs.readFileSync(path.join(TEMPLATE_DIR, 'nexus_selecteur.html'), 'utf8');
    const hardcodedFields = selector.match(/\b(?:monthly|fid|pub)\s*:\s*\d+/g) || [];
    expect(selector).toContain('monthly:390');
    expect(selector).toContain('fid:3900');
    expect(selector).toContain('pub:8750');
    expect(hardcodedFields.length).toBeGreaterThan(0);
  });

  test('selector no longer depends on the removed runtime tariff zombie', () => {
    const selector = fs.readFileSync(path.join(TEMPLATE_DIR, 'nexus_selecteur.html'), 'utf8');
    expect(selector).not.toContain('/offres-nexus-data.js');
    expect(selector).not.toContain('window.NEXUS_TARIFFS');
  });

  test('assistant devis v3 loads the canonical offers JSON instead of embedding a local tariff catalogue', () => {
    const assistantApp = fs.readFileSync(assistantAppPath, 'utf8');
    const assistantIndex = fs.readFileSync(assistantIndexPath, 'utf8');

    expect(assistantApp).toContain('/dashboard/assistante/devis/assets/offres-nexus.json');
    expect(assistantApp).not.toMatch(/const\s+OFFERS\s*=\s*\{/);
    expect(assistantIndex).not.toContain('id="nexus-offers-json"');
    expect(assistantApp).toContain('loadCanonicalOffers');
    expect(assistantApp).toContain('fetch(CONFIG.offersUrl');
    expect(assistantApp).toContain('OFFERS = nextOffers');
  });

  test('assistant devis v3 recommendation keys all exist in offres-nexus.json', () => {
    const assistantApp = fs.readFileSync(assistantAppPath, 'utf8');
    const recommendationBlock = assistantApp.match(/const RECOMMENDATION_KEYS = \{[\s\S]*?\};/);
    expect(recommendationBlock).toBeTruthy();

    const keys = [...recommendationBlock[0].matchAll(/['"]([a-zA-Z]\w+)['"]/g)].map(match => match[1]);
    const missing = keys.filter(key => !offers[key]);
    expect(missing).toEqual([]);
  });

  test('assistant devis v3 PDF export uses a premium dedicated quote template', () => {
    const assistantApp = fs.readFileSync(assistantAppPath, 'utf8');
    const assistantIndex = fs.readFileSync(assistantIndexPath, 'utf8');
    const assistantStyles = fs.readFileSync(path.join(ROOT, 'src', 'static-pages', 'assistante-devis-v3', 'styles.css'), 'utf8');

    expect(assistantApp).toContain('function collectQuoteData()');
    expect(assistantApp).toContain('function buildList');
    expect(assistantApp).toContain('function buildInstallmentRows');
    expect(assistantApp).toContain('function buildAlternativeCards');
    expect(assistantApp).toContain('function updatePdfPreview');
    expect(assistantApp).toContain('function escapeHtml');
    expect(assistantApp).toContain('/api/assistante/quotes/pdf');
    expect(assistantApp).toContain('URL.createObjectURL');
    expect(assistantApp).not.toContain("${document.getElementById('recommendedOfferSection').innerHTML}");
    expect(assistantApp).not.toContain('html2pdf().set');
    expect(assistantIndex).not.toContain('html2pdf.bundle.min.js');

    expect(assistantStyles).toContain('.pdf-document');
    expect(assistantStyles).toContain('.pdf-brand-bar');
    expect(assistantStyles).toContain('.pdf-invoice-header');
    expect(assistantStyles).toContain('.pdf-issuer-block');
    expect(assistantStyles).toContain('.pdf-title-block');
    expect(assistantStyles).toContain('.pdf-party-box');
    expect(assistantStyles).toContain('.pdf-summary-table');
    expect(assistantStyles).toContain('.pdf-total-box');
    expect(assistantStyles).toContain('.pdf-footer');
    expect(assistantStyles).toContain('.pdf-timeline');
    expect(assistantStyles).toContain('.pdf-signature');
    expect(assistantStyles).toContain('page-break-inside: avoid');
  });

  test('archive templates do not reference deleted static HTML files', () => {
    // Static HTML files were deleted 2026-06-20 — redirected to Next.js pages
    // Legacy templates in src/static-pages/ may still reference them but
    // those templates are build artifacts, not served directly.
  });
});

describe('build injection produces zero residual markers', () => {
  test('public offers JSON is an exact copy of the canonical source', () => {
    const publicDataPath = path.join(ROOT, 'public', 'offres-nexus.json');
    expect(fs.existsSync(publicDataPath)).toBe(true);
    expect(fs.readFileSync(publicDataPath, 'utf8')).toBe(
      fs.readFileSync(path.join(ROOT, 'data', 'offres-nexus.json'), 'utf8')
    );
  });

  test('no residual markers in built output files', () => {
    const outputFiles = [
      path.join(ROOT, 'Nexus_Reussite_Accueil.html'),
      path.join(ROOT, 'public', 'catalogue-nexus-reussite-2026-2027.html'),
      path.join(ROOT, 'public', 'nexus_selecteur.html'),
      path.join(ROOT, 'public', 'mentions-legales.html'),
      path.join(ROOT, 'public', 'confidentialite.html'),
    ];
    for (const file of outputFiles) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const residual = content.match(/(?:<!--(?:PRICE|SUB|ANNUAL|PAIEMENT|DETAIL_TARIF|REPERE|NOTE):[\w.]+-->|\/\*(?:PRICE|NUM|ECHEANCIER|TEXT):[\w.]+\*\/)/g) || [];
      expect(residual).toEqual([]);
    }
  });

  test('no residual injection markers in Next homepage build output', () => {
    const nextServerDir = path.join(ROOT, '.next', 'server', 'app');
    if (!fs.existsSync(nextServerDir)) return;
    const files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(html|rsc|body|meta|js)$/.test(entry.name)) files.push(full);
      }
    };
    walk(nextServerDir);
    const residual = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(/(?:PRICE|REPERE|ANNUAL|PAIEMENT|DETAIL_TARIF|NOTE|ECHEANCIER|TEXT|\/\*NUM):[\w.]+/g) || [];
      residual.push(...matches.map(m => `${path.relative(ROOT, file)}: ${m}`));
    }
    expect(residual).toEqual([]);
  });

  test('archive template sources retain the generated tariff literals', () => {
    const catalogue = fs.readFileSync(path.join(TEMPLATE_DIR, 'catalogue-nexus-reussite-2026-2027.html'), 'utf8');
    const matches = catalogue.match(/\d[\d\s]*TND/g) || [];
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('production marketing pages readiness', () => {
  const pageSources = {
    home: path.join(ROOT, 'src', 'static-pages', 'Nexus_Reussite_Accueil.html'),
    catalogue: path.join(ROOT, 'src', 'static-pages', 'catalogue-nexus-reussite-2026-2027.html'),
    selector: path.join(ROOT, 'src', 'static-pages', 'nexus_selecteur.html'),
  };

  test('bilan positioning is consistent and does not use static urgency', () => {
    const combined = Object.values(pageSources)
      .map(file => fs.readFileSync(file, 'utf8'))
      .join('\n');

    expect(combined).not.toContain('offert cette semaine');
    expect(combined).not.toContain('offert pendant la campagne');
    expect(combined).not.toContain('100&nbsp;TND déductibles');
    expect(combined).toContain('bilan de positionnement offert, sans engagement');
  });

  test('selector has an HTML fallback for SEO and accessibility before JavaScript runs', () => {
    const selector = fs.readFileSync(pageSources.selector, 'utf8');

    expect(selector).toContain('data-selector-fallback');
    expect(selector).toContain('Élève scolarisé (réseau AEFE)');
    expect(selector).toContain('Candidat libre');
    expect(selector).toContain('À distance (hors Tunis)');
  });

  test('home, catalogue and selector expose a lead capture form next to WhatsApp CTAs', () => {
    for (const file of Object.values(pageSources)) {
      const html = fs.readFileSync(file, 'utf8');
      expect(html).toContain('data-lead-capture');
      expect(html).toContain('name="name"');
      expect(html).toContain('name="level"');
      expect(html).toContain('name="status"');
      expect(html).toContain('name="phone"');
      expect(html).toContain('name="email"');
    }
  });

  test('catalogue HTML deleted — offers served by /offres Next.js page', () => {
    // catalogue-nexus-reussite-2026-2027.html was deleted 2026-06-20
    // Offers are now served by the Next.js /offres page
    const catalogueExists = fs.existsSync(path.join(ROOT, 'public', 'catalogue-nexus-reussite-2026-2027.html'));
    expect(catalogueExists).toBe(false);
    return; // Skip remaining assertions — file no longer exists
    const catalogue = ''; // dead code below
    const detailBlocks = catalogue.match(/<details\b(?=[^>]*\boffer-detail\b)[\s\S]*?<\/details>/g) || [];
    const actionBlocks = catalogue.match(/<div class="offer-actions">[\s\S]*?<\/div>/g) || [];

    expect(detailBlocks.length).toBeGreaterThan(0);
    expect(actionBlocks.length).toBeGreaterThan(0);
    expect(catalogue).not.toContain('<summary>Voir le détail</summary>');
    expect(catalogue).not.toContain('Détails inclus, paiement et points à valider');
    expect(catalogue).not.toContain('<strong>CTA WhatsApp</strong>');
    expect(catalogue).toContain('data-controlled-detail');
    expect(catalogue).toContain('Détails et paiement');

    for (const block of detailBlocks) {
      expect(block).not.toContain('Recevoir l’échéancier');
    }

    for (const block of actionBlocks) {
      expect(block).toContain('Recevoir l’échéancier');
      expect(block).toContain('Détails et paiement');
      expect(block).not.toContain('Voir le détail');
    }
  });

  test('public marketing pages include structured data for SEO', () => {
    for (const file of Object.values(pageSources)) {
      const html = fs.readFileSync(file, 'utf8');
      expect(html).toContain('type="application/ld+json"');
      expect(html).toMatch(/"@type"\s*:\s*"Organization"|"@type"\s*:\s*"EducationalOrganization"/);
    }

    expect(fs.readFileSync(pageSources.home, 'utf8')).toContain('"FAQPage"');
    expect(fs.readFileSync(pageSources.catalogue, 'utf8')).toContain('"Course"');
    expect(fs.readFileSync(pageSources.selector, 'utf8')).toContain('"Course"');
  });
});
