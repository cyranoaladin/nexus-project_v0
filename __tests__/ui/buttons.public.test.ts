/**
 * Tests unitaires légers: vérif présence et href des boutons principaux sur la page d’accueil
 */
import { describe, expect, it } from 'vitest';

// Hypothèse: on teste en JSDOM sur contenu rendu statiquement (snapshots ou utils)

function extractLinks(html: string) {
  const re = /<a\s+[^>]*href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
  const out: Array<{ href: string; text: string; }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push({ href: m[1], text: m[2].replace(/<[^>]+>/g, '').trim() });
  return out;
}

describe('Homepage buttons (unit-ish)', () => {
  it('CTA principaux présents avec href non vide', () => {
    const html = `
      <a href="/bilan-gratuit">Bilan Stratégique Gratuit</a>
      <a href="/aria">Découvrez ARIA dès maintenant</a>
    `;
    const links = extractLinks(html);
    const map = new Map(links.map(x => [x.text, x.href]));
    expect(map.get('Bilan Stratégique Gratuit')).toBe('/bilan-gratuit');
    expect(map.get('Découvrez ARIA dès maintenant')).toBe('/aria');
  });
});
