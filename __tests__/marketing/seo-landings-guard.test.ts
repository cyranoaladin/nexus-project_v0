import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PREPARATION_LINKS } from '@/content/marketing/preparation-links';
import { seoLandings } from '@/content/marketing/seo-landings';

const root = process.cwd();
type LandingPath = keyof typeof seoLandings;

const LANDINGS: Array<{
  path: LandingPath;
  file: string;
  expectedTitle: string;
  expectedLinks: string[];
}> = [
  {
    path: '/candidat-libre-bac-francais',
    file: 'app/candidat-libre-bac-francais/page.tsx',
    expectedTitle: 'Candidat libre au bac français en Tunisie',
    expectedLinks: ['/reussir-eaf', '/grand-oral', '/preparation-bac-francais-tunis'],
  },
  {
    path: '/preparation-bac-francais-tunis',
    file: 'app/preparation-bac-francais-tunis/page.tsx',
    expectedTitle: 'Préparer le bac français à Tunis',
    expectedLinks: ['/candidat-libre-bac-francais', '/reussir-eaf', '/grand-oral'],
  },
  {
    path: '/reussir-eaf',
    file: 'app/reussir-eaf/page.tsx',
    expectedTitle: 'Réussir l’EAF : épreuves anticipées de français',
    expectedLinks: ['/candidat-libre-bac-francais', '/grand-oral', '/preparation-bac-francais-tunis'],
  },
  {
    path: '/grand-oral',
    file: 'app/grand-oral/page.tsx',
    expectedTitle: 'Préparer le Grand Oral du bac',
    expectedLinks: ['/candidat-libre-bac-francais', '/reussir-eaf', '/preparation-bac-francais-tunis'],
  },
];

function sourceFor(file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

type LandingContent = (typeof seoLandings)[keyof typeof seoLandings];

function landingText(landing: LandingContent): string {
  return [
    landing.title,
    landing.intro,
    landing.jsonLdName,
    landing.metadata.title,
    landing.metadata.description,
    ...landing.sections.flatMap((section) => [
      section.heading,
      ...(section.body ?? []),
      ...(section.bullets ?? []),
    ]),
    ...landing.relatedLinks.flatMap((link) => [link.href, link.label, link.description ?? '']),
    ...landing.faq.flatMap((item) => [item.question, item.answer]),
  ].join(' ');
}

function visibleWordCount(text: string): number {
  const cleaned = text
    .replace(/[{}[\]()<>=:;.,'"`?/\\|_*#@+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.split(' ').filter((word) => /[A-Za-zÀ-ÿ0-9]/.test(word)).length;
}

describe('SEO landings T1.1 guard', () => {
  test.each(LANDINGS)('$path has canonical metadata and one declared H1 title', ({ path, file, expectedTitle }) => {
    const source = sourceFor(file);
    const landing = seoLandings[path];

    expect(source).toContain(`seoLandings['${path}']`);
    expect(source.match(/title=\{landing\.title\}/g)?.length ?? 0).toBe(1);
    expect(landing.title).toBe(expectedTitle);
    expect(landing.metadata.alternates?.canonical).toBe(`https://nexusreussite.academy${path}`);
  });

  test.each(LANDINGS)('$path has long-form SSR content and a bilan CTA', ({ path }) => {
    const landing = seoLandings[path];

    expect(visibleWordCount(landingText(landing))).toBeGreaterThanOrEqual(600);
    expect(landing.primaryCtaHref).toBe('/bilan-gratuit');
  });

  test.each(LANDINGS)('$path links to the preparation cluster', ({ path, expectedLinks }) => {
    const landing = seoLandings[path];
    const source = landingText(landing);

    for (const link of expectedLinks) {
      expect(source).toContain(link);
    }
  });

  test('shared renderer exposes FAQPage JSON-LD and preparation related links', () => {
    const source = sourceFor('components/marketing/LandingNiche.tsx');

    expect(source).toContain('FAQPage');
    expect(source).toContain('relatedLinks');
    expect(source).toContain('sections');
  });

  test('navigation and footer expose the preparation cluster', () => {
    const navbar = sourceFor('components/layout/CorporateNavbar.tsx');
    const footer = sourceFor('components/layout/CorporateFooter.tsx');

    expect(navbar).toContain('Préparations');
    expect(footer).toContain('Préparations');
    expect(navbar).toContain('PREPARATION_LINKS.map');
    expect(footer).toContain('PREPARATION_LINKS.map');
    for (const link of PREPARATION_LINKS) {
      expect(link.href).toMatch(/^\/(preparation-bac-francais-tunis|candidat-libre-bac-francais|reussir-eaf|grand-oral)$/);
    }
  });
});
