import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

const publicMarketingFiles = [
  'app/page.tsx',
  'app/HomePageClient.tsx',
  'app/offres/page.tsx',
  'app/stages/Stages2026Page.tsx',
  'app/accompagnement-scolaire/page.tsx',
  'app/contact/page.tsx',
  'app/bilan-gratuit/page.tsx',
  'app/bilan-gratuit/BilanStrategiqueClient.tsx',
  'components/layout/CorporateFooter.tsx',
  'components/marketing/acadomia-inspired.tsx',
  'components/marketing/LandingNiche.tsx',
  'components/marketing/OfferDetailDialog.tsx',
  'components/marketing/MobileStickyBar.tsx',
  'components/premium/ForWhoSection.tsx',
  'components/premium/HeroSection.tsx',
  'content/social-proof.json',
  'content/team.json',
];

function readExistingFiles(paths: string[]) {
  return paths
    .filter((path) => existsSync(join(root, path)))
    .map((path) => ({
      path,
      text: readFileSync(join(root, path), 'utf8'),
    }));
}

describe('Acadomia-inspired public marketing guardrails', () => {
  it('does not reintroduce Masterium on the public marketing surfaces', () => {
    const offenders = readExistingFiles(publicMarketingFiles)
      .filter(({ text }) => /Masterium/i.test(text))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it('does not introduce unverifiable social-result claims on public marketing surfaces', () => {
    const forbidden = [
      /\d+\s*points/i,
      /\d{2,3}\s*%\s*(de\s*)?(réussite|satisfaits)/i,
      /\d{3,}\s*(élèves|familles|avis)/i,
    ];

    const offenders = readExistingFiles(publicMarketingFiles)
      .flatMap(({ path, text }) =>
        forbidden
          .filter((pattern) => pattern.test(text))
          .map((pattern) => `${path}: ${pattern}`)
      );

    expect(offenders).toEqual([]);
  });

  it('MobileStickyBar is md:hidden and FloatingAdvisorBubble is hidden md:inline-flex (no overlap)', () => {
    const stickyBar = readFileSync(join(root, 'components/marketing/MobileStickyBar.tsx'), 'utf8');
    const bubble = readFileSync(join(root, 'components/marketing/acadomia-inspired.tsx'), 'utf8');

    // MobileStickyBar must be mobile-only
    expect(stickyBar).toContain('md:hidden');
    expect(stickyBar).toContain('motion-reduce:animate-none');
    // FloatingAdvisorBubble must be desktop-only
    expect(bubble).toMatch(/hidden\s[^"]*md:inline-flex/);
  });

  // Section count (9) and background alternation are verified by the e2e test:
  //   e2e/pages-public-homepage.spec.ts → "9 sections principales dans <main>"
  // No regex/hardcoded-map unit test — the e2e asserts the actual rendered DOM.

  it('keeps the footer newsletter consent copy present', () => {
    const footer = readFileSync(join(root, 'components/layout/CorporateFooter.tsx'), 'utf8');
    const marketing = readFileSync(join(root, 'components/marketing/acadomia-inspired.tsx'), 'utf8');
    const publicFooterSurface = `${footer}\n${marketing}`;

    expect(publicFooterSurface).toContain('Conseils pour réussir le bac français.');
    expect(publicFooterSurface).toContain('consentement');
  });
});
