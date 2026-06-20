/**
 * offres-nexus.json integrity — validates the legacy JSON used by the
 * assistante devis tool. The canonical source of truth is
 * data/pricing.canonical.json; offres-nexus.json is a derived format
 * for the internal devis tool only.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'offres-nexus.json'), 'utf8'));

const offers = {};
for (const [k, v] of Object.entries(data)) {
  if (!k.startsWith('_')) offers[k] = v;
}

describe('offres-nexus.json integrity', () => {
  test('every offer has a label', () => {
    for (const [key, offer] of Object.entries(offers)) {
      expect(offer.label).toBeTruthy();
    }
  });

  test('every offer has an annual or monthly value', () => {
    for (const [key, offer] of Object.entries(offers)) {
      const hasValue = offer.annual != null || offer.monthly != null || offer.display != null;
      expect(hasValue).toBe(true);
    }
  });
});

describe('pipeline artifacts cleaned', () => {
  test('no static HTML files exist in public/', () => {
    for (const file of ['catalogue-nexus-reussite-2026-2027.html', 'nexus_selecteur.html', 'mentions-legales.html', 'confidentialite.html']) {
      expect(fs.existsSync(path.join(ROOT, 'public', file))).toBe(false);
    }
  });

  test('no public/offres-nexus.json copy', () => {
    expect(fs.existsSync(path.join(ROOT, 'public', 'offres-nexus.json'))).toBe(false);
  });

  test('no dead template files in src/static-pages/', () => {
    for (const file of ['Nexus_Reussite_Accueil.html', 'catalogue-nexus-reussite-2026-2027.html', 'nexus_selecteur.html', 'mentions-legales.html', 'confidentialite.html', 'nexus_assistante_devis_v2.html']) {
      expect(fs.existsSync(path.join(ROOT, 'src', 'static-pages', file))).toBe(false);
    }
  });

  test('assistante-devis-v3 tool is preserved', () => {
    expect(fs.existsSync(path.join(ROOT, 'src', 'static-pages', 'assistante-devis-v3', 'app.js'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src', 'static-pages', 'assistante-devis-v3', 'index.html'))).toBe(true);
  });

  test('no dead build scripts', () => {
    for (const script of ['inject-prices.js', 'build-assistant-devis.js', 'sync-assistant-json.js']) {
      expect(fs.existsSync(path.join(ROOT, 'scripts', script))).toBe(false);
    }
  });
});
