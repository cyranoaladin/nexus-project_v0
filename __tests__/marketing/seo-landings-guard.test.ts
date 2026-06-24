import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { PREPARATION_LINKS } from '@/content/marketing/preparation-links';
import { seoLandings } from '@/content/marketing/seo-landings';
import CandidatLibreBacFrancaisPage from '@/app/candidat-libre-bac-francais/page';
import GrandOralPage from '@/app/grand-oral/page';
import PreparationBacFrancaisTunisPage from '@/app/preparation-bac-francais-tunis/page';
import ReussirEafPage from '@/app/reussir-eaf/page';
import { getAllOffers, getAnnualOffer, getPack, getPacks, getPonctuelOffer } from '@/lib/pricing';

const usePathnameMock = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

const root = process.cwd();
type LandingPath = keyof typeof seoLandings;

const LANDINGS: Array<{
  path: LandingPath;
  file: string;
  expectedTitle: string;
  expectedLinks: string[];
  Page: () => JSX.Element;
}> = [
  {
    path: '/candidat-libre-bac-francais',
    file: 'app/candidat-libre-bac-francais/page.tsx',
    expectedTitle: 'Candidat libre au bac français en Tunisie',
    expectedLinks: ['/reussir-eaf', '/grand-oral', '/preparation-bac-francais-tunis'],
    Page: CandidatLibreBacFrancaisPage,
  },
  {
    path: '/preparation-bac-francais-tunis',
    file: 'app/preparation-bac-francais-tunis/page.tsx',
    expectedTitle: 'Préparer le bac français à Tunis',
    expectedLinks: ['/candidat-libre-bac-francais', '/reussir-eaf', '/grand-oral'],
    Page: PreparationBacFrancaisTunisPage,
  },
  {
    path: '/reussir-eaf',
    file: 'app/reussir-eaf/page.tsx',
    expectedTitle: 'Réussir l’EAF : épreuves anticipées de français',
    expectedLinks: ['/candidat-libre-bac-francais', '/grand-oral', '/preparation-bac-francais-tunis'],
    Page: ReussirEafPage,
  },
  {
    path: '/grand-oral',
    file: 'app/grand-oral/page.tsx',
    expectedTitle: 'Préparer le Grand Oral du bac',
    expectedLinks: ['/candidat-libre-bac-francais', '/reussir-eaf', '/preparation-bac-francais-tunis'],
    Page: GrandOralPage,
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

function hrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a[href]')).map((link) => link.getAttribute('href') ?? '');
}

function resolvesOfferRef(ref: LandingContent['offerRefs'][number]): boolean {
  if (ref.type === 'annual') return Boolean(getAnnualOffer(ref.id));
  if (ref.type === 'ponctuel') return Boolean(getPonctuelOffer(ref.id));
  return Boolean(getPack(ref.id));
}

describe('SEO landings T1.1 guard', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/');
  });

  test.each(LANDINGS)('$path has canonical metadata and one declared H1 title', ({ path, file, expectedTitle }) => {
    const source = sourceFor(file);
    const landing = seoLandings[path];

    expect(source).toContain(`seoLandings['${path}']`);
    expect(source.match(/title=\{landing\.title\}/g)?.length ?? 0).toBe(1);
    expect(landing.title).toBe(expectedTitle);
    expect(landing.metadata.alternates?.canonical).toBe(path);
    expect(landing.metadata.openGraph?.url).toBe(path);
  });

  test('root layout defines metadataBase for relative canonical resolution', () => {
    const source = sourceFor('app/layout.tsx');

    expect(source).toContain('metadataBase');
    expect(source).toContain('process.env.NEXTAUTH_URL');
  });

  test('marketing content and SEO guard do not duplicate the public domain literal', () => {
    const forbiddenDomain = ['nexusreussite', 'academy'].join('.');
    const checkedFiles = [
      'content/marketing/preparation-links.ts',
      'content/marketing/seo-landings.ts',
      '__tests__/marketing/seo-landings-guard.test.ts',
    ];

    for (const file of checkedFiles) {
      expect(sourceFor(file)).not.toContain(forbiddenDomain);
    }
  });

  test('marketing content reuses the legal address source instead of hardcoding Mutuelleville', () => {
    const source = sourceFor('content/marketing/seo-landings.ts');

    expect(source).toContain('LEGAL.addresses.pedagogique');
    expect(source).not.toContain('Mutuelleville');
  });

  test('LandingNiche is the single source for landing renderer types', () => {
    const files = [
      'components/marketing/LandingNiche.tsx',
      'content/marketing/seo-landings.ts',
    ];
    const combined = files.map((file) => sourceFor(file)).join('\n');
    const contentSource = sourceFor('content/marketing/seo-landings.ts');
    const rendererSource = sourceFor('components/marketing/LandingNiche.tsx');

    for (const typeName of ['OfferRef', 'NicheSection', 'RelatedLink']) {
      const declarations = combined.match(new RegExp(`type ${typeName}\\b`, 'g')) ?? [];
      expect(declarations).toHaveLength(1);
      expect(rendererSource).toContain(`export type ${typeName}`);
      expect(contentSource).toContain(typeName);
    }

    expect(contentSource).toContain("from '@/components/marketing/LandingNiche'");
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

  test.each(LANDINGS)('$path offerRefs resolve against the canonical pricing catalog', ({ path }) => {
    const landing = seoLandings[path];

    for (const ref of landing.offerRefs) {
      expect({ path, ref, resolves: resolvesOfferRef(ref) }).toMatchObject({ resolves: true });
    }
  });

  test('landing service claims map to canonical included entries or pack services', () => {
    const annualIncluded = getAllOffers().flatMap((offer) => offer.included);
    const packServices = getPacks().flatMap((pack) =>
      pack.components
        .filter((component) => component.type === 'service')
        .map((component) => component.label ?? ''),
    );
    const candidatLibreText = landingText(seoLandings['/candidat-libre-bac-francais']);
    const hubText = landingText(seoLandings['/preparation-bac-francais-tunis']);

    expect(candidatLibreText).toContain('Cyclades');
    expect(candidatLibreText).toContain('épreuves blanches selon la formule');
    expect(hubText).toContain('ARIA complète le travail humain');
    expect(packServices).toContain('Cellule Cyclades');
    expect(annualIncluded.some((item) => item.includes('Plateforme ARIA'))).toBe(true);
    expect(annualIncluded.some((item) => item.includes('Bacs blancs'))).toBe(true);
  });

  test.each(LANDINGS)('$path renders sections, related links, offer cards and FAQ from page props', ({ Page, path }) => {
    const landing = seoLandings[path];
    const { container } = render(React.createElement(Page));

    expect(screen.getByRole('heading', { level: 1, name: landing.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: landing.sections[0].heading })).toBeInTheDocument();
    expect(hrefs(container)).toContain(landing.relatedLinks[0].href);
    expect(screen.getByRole('heading', { name: landing.faq[0].question })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /parcours recommandés/i })).toBeInTheDocument();
  });

  test('shared renderer exposes FAQPage JSON-LD and preparation related links', () => {
    const source = sourceFor('components/marketing/LandingNiche.tsx');

    expect(source).toContain('FAQPage');
    expect(source).toContain('relatedLinks');
    expect(source).toContain('sections');
  });

  test('navigation exposes the preparation cluster in rendered links', () => {
    const { container } = render(React.createElement(CorporateNavbar));

    expect(screen.getAllByText('Préparations').length).toBeGreaterThan(0);
    for (const link of PREPARATION_LINKS) {
      expect(hrefs(container)).toContain(link.href);
    }
  });

  test('footer exposes the preparation cluster in rendered links', () => {
    const { container } = render(React.createElement(CorporateFooter));

    expect(screen.getByRole('heading', { name: 'Préparations' })).toBeInTheDocument();
    for (const link of PREPARATION_LINKS) {
      expect(hrefs(container)).toContain(link.href);
    }
  });
});
