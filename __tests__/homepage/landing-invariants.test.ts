/**
 * Landing page business invariants (active components).
 * Replaces deleted landing-content.test.ts which tested legacy content.ts.
 *
 * Invariants covered by other test suites (not duplicated here):
 * - Pricing: pricing-canonical-validator, reperes-vs-offers, data-coherence
 * - WhatsApp URLs: pages-public-homepage.spec.ts (exact count 3+4)
 * - Image alt texts: pages-public-homepage.spec.ts
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');

describe('Landing page business invariants', () => {
  const homeClient = readFileSync(join(root, 'app/HomePageClient.tsx'), 'utf8');
  const diagnosticCtas = readFileSync(join(root, 'components/marketing/PreRentreeDiagnosticCtas.tsx'), 'utf8');
  const heroSection = readFileSync(join(root, 'components/premium/HeroSection.tsx'), 'utf8');
  const spotlightPath = join(root, 'components/marketing/PreRentreeCampaignSpotlight.tsx');

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

  test('home renders FAQ with 5 items', () => {
    expect(homeClient).toContain('FAQAccordion');
    // 5 FAQ items with question key
    const faqMatches = homeClient.match(/question:/g);
    expect(faqMatches?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  test('home CTA section distinguishes online assessment and adviser callback', () => {
    expect(homeClient).toContain('<PreRentreeDiagnosticCtas');
    expect(diagnosticCtas).toContain('/bilan-gratuit?parcours=diagnostic#demande-bilan');
    expect(diagnosticCtas).toContain('/bilan-gratuit?parcours=conseiller#rappel-conseiller');
  });

  test('home uses canonical repères (not hardcoded prices)', () => {
    expect(homeClient).toContain('reperes');
    // No hardcoded TND amounts in the trust items
    const trustItems = homeClient.match(/`[^`]+`/g) ?? [];
    for (const item of trustItems) {
      expect(item).not.toMatch(/\d{3,}\s*TND/);
    }
  });

  test('homepage delegates the priority campaign to its dedicated component', () => {
    expect(homeClient).toContain('PreRentreeCampaignSpotlight');
    expect(existsSync(spotlightPath)).toBe(true);
    expect(homeClient.indexOf('<PreRentreeCampaignSpotlight')).toBeLessThan(homeClient.indexOf('<HeroSection'));
    expect(homeClient.indexOf('<PreRentreeCampaignSpotlight')).toBeLessThan(homeClient.indexOf('<LevelRouter'));
  });

  // Regression guard for the homepage FAQ (candidat-individuel offer retirement):
  // these three answers used to name retired offers and present acompte/
  // effectif rules as universal, which stopped matching the canonical
  // catalog once the candidat-individuel offers shipped.
  test('homepage FAQ does not name any retired candidat-libre offer', () => {
    const retiredLabels = [
      'Première Libre Essentiel',
      'Première Libre Accompagnée',
      'Terminale Libre Online',
      'Terminale Libre Mixte',
      'Terminale Libre Premium',
      'Essentiel, Mixte, Premium',
      'Pass Candidat Libre',
    ];
    for (const label of retiredLabels) {
      expect(homeClient).not.toContain(label);
    }
  });

  test('homepage FAQ group answer varies by offer instead of stating a universal headcount cap', () => {
    expect(homeClient).toContain('Comment sont constitués les groupes');
    expect(homeClient).toContain('varient selon le niveau et le parcours');
    // No literal "groupes de N ... maximum" phrasing presented as a fixed rule.
    expect(homeClient).not.toMatch(/groupes? de \d+\s*(élèves)?\s*maximum/i);
  });

  test('homepage FAQ payment answer states modalities depend on the offer, not a universal 30% acompte', () => {
    expect(homeClient).toContain('Les modalités de règlement dépendent de l’offre');
    expect(homeClient).toContain('candidats individuels sont proposés sans acompte');
    expect(homeClient).not.toContain(
      'Un acompte de 30 % est versé à la réservation, puis le solde est réparti en mensualités.',
    );
  });

  test('homepage FAQ uses "candidat individuel" terminology and keeps the Cyclades non-substitution disclaimer', () => {
    expect(homeClient).toContain('Proposez-vous un accompagnement pour les candidats individuels');
    expect(homeClient).toContain('appui aux démarches Cyclades');
    expect(homeClient).toContain('sans se substituer à l’inscription officielle');
  });
});
