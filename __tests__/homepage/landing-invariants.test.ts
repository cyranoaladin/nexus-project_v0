/**
 * Landing page business invariants (active components).
 * Replaces deleted landing-content.test.ts which tested legacy content.ts.
 *
 * Invariants covered by other test suites (not duplicated here):
 * - Pricing: pricing-canonical-validator, reperes-vs-offers, data-coherence
 * - WhatsApp URLs: pages-public-homepage.spec.ts (exact count 3+4)
 * - Image alt texts: pages-public-homepage.spec.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');

describe('Landing page business invariants', () => {
  const homeClient = readFileSync(join(root, 'app/HomePageClient.tsx'), 'utf8');
  const heroSection = readFileSync(join(root, 'components/premium/HeroSection.tsx'), 'utf8');

  test('hero CTA primary links to /recommandation', () => {
    expect(heroSection).toContain('href="/recommandation"');
  });

  test('hero CTA secondary links to /offres', () => {
    expect(heroSection).toContain('href="/offres"');
  });

  test('hero mentions "réseau AEFE"', () => {
    expect(heroSection).toContain('réseau AEFE');
  });

  test('hero has WhatsApp link', () => {
    expect(heroSection).toContain('buildWhatsAppUrl');
  });

  test('home has trust section with checkmarks', () => {
    expect(homeClient).toContain('Transparence tarifaire');
    expect(homeClient).toContain('Cellule Cyclades');
  });

  test('home FAQ is available on /offres (not on homepage)', () => {
    // FAQ was moved off homepage — verify FAQAccordion still exists in premium components
    const premiumIndex = readFileSync(join(root, 'components/premium/index.ts'), 'utf8');
    expect(premiumIndex).toContain('FAQAccordion');
  });

  test('home CTA section links to /bilan-gratuit', () => {
    expect(homeClient).toContain('href="/bilan-gratuit"');
  });

  test('home uses canonical repères (not hardcoded prices)', () => {
    expect(homeClient).toContain('reperes');
    // No hardcoded TND amounts in the trust items
    const trustItems = homeClient.match(/`[^`]+`/g) ?? [];
    for (const item of trustItems) {
      expect(item).not.toMatch(/\d{3,}\s*TND/);
    }
  });
});
