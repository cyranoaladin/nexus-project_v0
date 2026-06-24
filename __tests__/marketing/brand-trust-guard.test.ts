import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

const activeTrustSurfaces = [
  'app/famille/page.tsx',
  'app/dashboard/parent/page.tsx',
  'app/dashboard/parent/paiement/page.tsx',
  'app/stages/_components/WhyNexus.tsx',
  'app/offres/page.tsx',
  'app/HomePageClient.tsx',
  'data/pricing.canonical.json',
  'components/layout/CorporateFooter.tsx',
  'components/sections/pillars-section.tsx',
  'components/premium/MethodSection.tsx',
  'components/marketing/OfferDetailDialog.tsx',
  'components/ui/faq-section.tsx',
];

const deadFabricationArtifacts = [
  'components/ui/testimonials-section.tsx',
  'components/sections/testimonials-section.tsx',
  'components/sections/testimonials-section-gsap.tsx',
  'components/ui/offers-comparison.tsx',
  'components/ui/guarantee-seal.tsx',
  'public/images/sceau_garantie_reussite.png',
];

function sourceFor(file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

describe('Lot 1 T1.2 brand trust guardrails', () => {
  test.each(activeTrustSurfaces)('%s does not expose result guarantees or aggressive claims', (file) => {
    const source = sourceFor(file);
    const forbidden = [
      /Nous garantissons/i,
      /Garantie Bac/i,
      /Garantie Mention/i,
      /Garantie Parcoursup/i,
      /garanti dès/i,
      /garantir les meilleurs résultats/i,
      /garantir un suivi personnalisé/i,
      /Attention individualisée garantie/i,
      /Bac Obtenu ou Remboursé/i,
      /garantie de réussite/i,
      /Mention garantie/i,
      /nos garanties et notre accompagnement/i,
      /Satisfaction Garantie/i,
      /Remboursement intégral si vous n(?:&apos;|'|’)êtes pas satisfait/i,
      /rareté est réelle/i,
      /garantir votre place/i,
      /Meilleur rendement pédagogique/i,
      /La différence est mesurable/i,
      /nous nous engageons sur leurs résultats/i,
      /nous ne recrutons que l(?:'|’)élite/i,
      /L(?:&apos;|'|’)excellence pédagogique augmentée par l(?:&apos;|'|’)Intelligence Artificielle/i,
    ];

    for (const pattern of forbidden) {
      expect(source).not.toMatch(pattern);
    }
  });

  test('famille page does not contain fabricated testimonials, ratings or unverifiable stats', () => {
    const source = sourceFor('app/famille/page.tsx');
    const forbidden = [
      /\btestimonials\b/i,
      /\bStar\b/,
      /Mme Ben Ali|M\. Cherif|Mme Guesmi/i,
      /92\s*%/,
      /\+150/,
      /Taux de réussite/i,
      /Années d(?:&apos;|'|’)expertise cumulée/i,
    ];

    for (const pattern of forbidden) {
      expect(source).not.toMatch(pattern);
    }
  });

  test('dead testimonial and guarantee components are removed instead of left as reintroduction traps', () => {
    for (const file of deadFabricationArtifacts) {
      expect(existsSync(join(root, file))).toBe(false);
    }
  });
});
