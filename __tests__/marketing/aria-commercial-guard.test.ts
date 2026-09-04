import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PUBLIC_SURFACES = [
  'app/page.tsx',
  'app/plateforme-aria/page.tsx',
  'app/plateforme-aria/layout.tsx',
  'components/aria/AriaMarketingDemo.tsx',
  'app/HomePageClient.tsx',
  'app/offres/page.tsx',
  'app/famille/page.tsx',
  'app/stages/page.tsx',
  'app/accompagnement-scolaire/page.tsx',
  'components/layout/CorporateNavbar.tsx',
  'components/layout/CorporateFooter.tsx',
];

describe('ARIA Public Commercial Guardrails (ARIA_COMMERCIAL_READY=NO)', () => {
  const root = process.cwd();

  const getPublicContents = (): Array<{ file: string; content: string }> => {
    return PUBLIC_SURFACES.map((file) => {
      const fullPath = resolve(root, file);
      if (!existsSync(fullPath)) {
        throw new Error(`Expected public surface file not found: ${file}`);
      }
      return { file, content: readFileSync(fullPath, 'utf8') };
    });
  };

  test('PUBLIC_ARIA_INSTANT_RESPONSE_CLAIM=NO: no instant response claims in public surfaces', () => {
    const forbiddenPatterns = [
      /réponses?\s+instantanées?/i,
      /réponse\s+immédiate\s+sans\s+attendre/i,
    ];

    const violations: string[] = [];
    for (const { file, content } of getPublicContents()) {
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push(`${file} matches ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('PUBLIC_ARIA_DIRECT_AVAILABILITY_CLAIM=NO: no premature direct availability claims in public surfaces', () => {
    const forbiddenPatterns = [
      /(?:disponible|accessible|intégrée?)\s+(?:.*?\s+)?selon\s+(?:la\s+|les\s+|l['’]add-on\s+|chaque\s+)?formules?/i,
      /immédiatement\s+utilisable/i,
      /disponible\s+24\/7/i,
    ];

    const violations: string[] = [];
    for (const { file, content } of getPublicContents()) {
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push(`${file} matches ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('PUBLIC_ARIA_FREE_TRIAL_CTA=NO: no free trial or unauthenticated demo CTAs', () => {
    const forbiddenPatterns = [
      /essayez[- ]moi\s+gratuitement/i,
      /essai\s+gratuit\s+aria/i,
      /démonstration\s+gratuite/i,
    ];

    const violations: string[] = [];
    for (const { file, content } of getPublicContents()) {
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push(`${file} matches ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('PUBLIC_ARIA_DIRECT_SALE_CTA=NO: no direct sale or offer link implying immediate ARIA purchase', () => {
    const forbiddenPatterns = [
      /voir\s+les\s+offres\s+aria/i,
      /voir\s+les\s+offres\s+avec\s+aria/i,
      /acheter\s+aria/i,
      /souscrire\s+à\s+aria/i,
    ];

    const violations: string[] = [];
    for (const { file, content } of getPublicContents()) {
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push(`${file} matches ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('plateforme-aria explicitly presents aperçu pédagogique qualification banner', () => {
    const pagePath = resolve(root, 'app/plateforme-aria/page.tsx');
    const content = readFileSync(pagePath, 'utf8');

    expect(content).toMatch(/Aperçu pédagogique — service en cours de qualification technique\.\s+ARIA n(?:&apos;|')est pas actuellement ouvert à la souscription directe\./);
    expect(content).toContain('Aperçu pédagogique');
    expect(content).toContain('Déploiement progressif');
    expect(content).toContain('Échanger avec un conseiller');
  });
});
