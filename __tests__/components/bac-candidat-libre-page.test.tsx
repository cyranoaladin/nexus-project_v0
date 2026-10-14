import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

import BacCandidatLibrePage, { metadata, revalidate } from '@/app/bac-candidat-libre/page';
import { fmtPrice as fmtBrut } from '@/components/premium/format';
import { LEGAL } from '@/lib/legal';

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

jest.mock('@/components/layout/CorporateNavbar', () => ({ CorporateNavbar: () => <nav aria-label="navigation" /> }));
jest.mock('@/components/layout/CorporateFooter', () => ({ CorporateFooter: () => <footer /> }));

/** toHaveTextContent normalise les espaces : on compare avec des espaces simples. */
const fmtPrice = (n: number) => fmtBrut(n).replace(/\s/g, ' ');

function renderAu(iso: string) {
  jest.useFakeTimers().setSystemTime(new Date(iso));
  const utils = render(<BacCandidatLibrePage />);
  jest.useRealTimers();
  return utils;
}

function jsonLd(container: HTMLElement): any[] {
  return Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((s) => JSON.parse(s.textContent ?? '{}'));
}

describe('/bac-candidat-libre', () => {
  afterEach(() => jest.useRealTimers());

  test('métadonnées : titre, description et URL canonique', () => {
    expect(String(metadata.title)).toMatch(/candidat libre/i);
    expect(String(metadata.title)).toMatch(/Tunis/);
    expect(String(metadata.description)).toMatch(/2027/);
    expect(metadata.alternates?.canonical).toBe('/bac-candidat-libre');
  });

  test('la page se régénère au moins toutes les heures (coupure des offres datées)', () => {
    expect(revalidate).toBeLessThanOrEqual(3600);
  });

  test('un seul H1, qui parle du bac français en candidat libre', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent(/bac français/i);
  });

  test('les trois parcours avec leur prix annuel et leur mensualité affichée', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    const premiere = screen.getByRole('article', { name: /Première/ });
    expect(premiere).toHaveTextContent(fmtPrice(650));
    expect(premiere).toHaveTextContent(/8 mensualités/);
    expect(premiere).toHaveTextContent(fmtPrice(5200));
    const terminale = screen.getByRole('article', { name: /Terminale/ });
    expect(terminale).toHaveTextContent(fmtPrice(850));
    expect(terminale).toHaveTextContent(/9 mensualités/);
    expect(terminale).toHaveTextContent(fmtPrice(7600));
    const b1a = screen.getByRole('article', { name: /Bac en 1 an/ });
    expect(b1a).toHaveTextContent(fmtPrice(1290));
    expect(b1a).toHaveTextContent(fmtPrice(11600));
    expect(b1a).toHaveTextContent(/éligibilité/i);
  });

  test('groupes de 12 au plus, et ce qui n’est pas préparé', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    expect(document.body).toHaveTextContent(/12 places au maximum/);
    expect(document.body).toHaveTextContent(/EPS/);
    expect(document.body).toHaveTextContent(/Institut français/);
  });

  test('le 14/10 : frais de dossier offerts et Semaine Diagnostic visibles', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    expect(screen.getByText(/frais de dossier/i, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Semaine Diagnostic/ })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(fmtPrice(290));
  });

  test('le 05/11 : plus d’offre Terminale ni de Semaine Diagnostic, offre Première toujours là', () => {
    renderAu('2026-11-05T10:00:00+01:00');
    expect(screen.queryByRole('heading', { name: /Semaine Diagnostic/ })).not.toBeInTheDocument();
    const offre = screen.getByText(/frais de dossier/i, { selector: 'strong' }).closest('p')!;
    expect(offre).toHaveTextContent(/Première/);
    expect(offre).not.toHaveTextContent(/Terminale/);
  });

  test('le 10/11 : plus aucune offre datée', () => {
    renderAu('2026-11-10T10:00:00+01:00');
    expect(screen.queryByText(/frais de dossier/i, { selector: 'strong' })).not.toBeInTheDocument();
  });

  test('frais de dossier affichés sur chaque carte, offerts ou dus ; pas de « tout compris »', () => {
    renderAu('2026-11-10T10:00:00+01:00');
    for (const niveau of [/Première/, /Terminale/, /Bac en 1 an/]) {
      expect(screen.getByRole('article', { name: niveau })).toHaveTextContent(/frais de dossier.*250 TND/i);
    }
    expect(document.body.textContent).not.toMatch(/tout compris/i);
    const faq = screen.getByRole('heading', { name: /Combien coûte/ }).nextElementSibling!;
    expect(faq.textContent).toMatch(/frais de dossier/i);
  });

  test('la dernière mensualité ajustée est indiquée (Terminale : 8 × 850 puis 800)', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    expect(screen.getByRole('article', { name: /Terminale/ })).toHaveTextContent(/dernière.*800 TND/);
  });

  test('adresse du centre et contact WhatsApp', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    expect(document.body).toHaveTextContent(LEGAL.addresses.pedagogique.full);
    const whatsapp = screen.getAllByRole('link', { name: /WhatsApp/i });
    expect(whatsapp.length).toBeGreaterThan(0);
    whatsapp.forEach((lien) => expect(lien.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\d+\?text=/));
  });

  test('inscription Cyclades : Nexus accompagne sans s’y substituer', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    const cyclades = screen.getByRole('region', { name: /Cyclades/ });
    expect(within(cyclades).getByText(/jamais à votre place/)).toBeInTheDocument();
  });

  test('données structurées : Course avec trois offres en TND, FAQPage, fil d’Ariane', () => {
    const { container } = renderAu('2026-10-14T10:00:00+01:00');
    const blocs = jsonLd(container);
    const cours = blocs.find((b) => b['@type'] === 'Course');
    expect(cours.offers).toHaveLength(3);
    expect(cours.offers.map((o: any) => o.price)).toEqual([5200, 7600, 11600]);
    expect(cours.offers.every((o: any) => o.priceCurrency === 'TND')).toBe(true);
    expect(cours.provider.address.streetAddress).toBe(LEGAL.addresses.pedagogique.street);
    const faq = blocs.find((b) => b['@type'] === 'FAQPage');
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(6);
    expect(blocs.find((b) => b['@type'] === 'BreadcrumbList')).toBeDefined();
  });

  test('aucune promesse de résultat', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    expect(document.body.textContent).not.toMatch(/garanti|100 ?%|taux de réussite/i);
  });
});
