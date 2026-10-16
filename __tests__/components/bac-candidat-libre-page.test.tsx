import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

import BacCandidatLibrePage, { metadata, revalidate } from '@/app/bac-candidat-libre/page';
import { fmtPrice as fmtBrut } from '@/components/premium/format';
import { getCandidatsLibres2027 } from '@/lib/candidats-libres-2027';
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

  /**
   * Les DEUX entrées sont rendues sur chaque carte, chacune avec son mois
   * d'inscription. Afficher la seule entrée d'octobre trompe une famille de
   * novembre ; afficher la seule entrée de novembre montre à une famille
   * d'octobre un mensuel plus élevé que le sien.
   *
   * Le brief du 13/10 qui fixait la Première à huit mensualités porte sur la
   * créative vidéo diffusée du 01/11 au 20/11, pas sur cette page.
   */
  test('les trois parcours : prix annuel et les DEUX échéanciers étiquetés par leur mois', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    const premiere = screen.getByRole('article', { name: /Première/ });
    expect(premiere).toHaveTextContent(fmtPrice(5200));
    expect(premiere).toHaveTextContent(/9 mensualités, d’octobre à juin.*8 × 580 puis 560 TND.*pour une inscription en octobre/);
    expect(premiere).toHaveTextContent(/8 mensualités, de novembre à juin.*8 × 650 TND.*pour une inscription en novembre/);
    const terminale = screen.getByRole('article', { name: /Terminale/ });
    expect(terminale).toHaveTextContent(fmtPrice(7600));
    expect(terminale).toHaveTextContent(/9 mensualités, d’octobre à juin.*8 × 850 puis 800 TND.*pour une inscription en octobre/);
    expect(terminale).toHaveTextContent(/8 mensualités, de novembre à juin.*8 × 950 TND.*pour une inscription en novembre/);
    const b1a = screen.getByRole('article', { name: /Bac en 1 an/ });
    expect(b1a).toHaveTextContent(fmtPrice(11600));
    expect(b1a).toHaveTextContent(/9 mensualités, d’octobre à juin.*8 × 1 290 puis 1 280 TND.*pour une inscription en octobre/);
    expect(b1a).toHaveTextContent(/8 mensualités, de novembre à juin.*8 × 1 450 TND.*pour une inscription en novembre/);
    expect(b1a).toHaveTextContent(/éligibilité/i);
  });

  test('l’entrée mise en avant est celle de la date du jour', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    expect(screen.getByRole('article', { name: /Première/ }))
      .toHaveTextContent(`${fmtPrice(580)} TND / mois`);
    renderAu('2026-11-05T10:00:00+01:00');
    expect(screen.getAllByRole('article', { name: /Première/ }).at(-1))
      .toHaveTextContent(`${fmtPrice(650)} TND / mois`);
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
    expect(screen.getByRole('article', { name: /Terminale/ })).toHaveTextContent(/8 × 850 puis 800 TND/);
  });

  /**
   * Les prix des produits courts sont adoptés par la direction mais leur
   * régime fiscal n'est pas attesté par le comptable : le dossier bloque
   * « toute offre commerciale ferme » sur ce point. Rien n'en sort tant que le
   * drapeau n'est pas levé.
   */
  describe('produits courts — non publiés tant que le régime fiscal n’est pas attesté', () => {
    const produits = getCandidatsLibres2027().produits_courts.produits;
    afterEach(() => { delete process.env.PRODUITS_COURTS_PUBLIES; });

    test('sans drapeau : ni la section, ni les libellés, ni la question de FAQ', () => {
      renderAu('2026-10-14T10:00:00+01:00');
      expect(screen.queryByRole('heading', { name: /produits courts/i })).not.toBeInTheDocument();
      for (const produit of produits) {
        expect(document.body.textContent).not.toContain(produit.libelle);
      }
      expect(document.body.textContent).not.toMatch(/suivre un stage seul/i);
    });

    test('drapeau levé : la section et les prix reviennent sans autre changement', () => {
      process.env.PRODUITS_COURTS_PUBLIES = 'true';
      renderAu('2026-10-14T10:00:00+01:00');
      expect(screen.getByRole('heading', { name: /produits courts/i })).toBeInTheDocument();
      expect(document.body.textContent).toContain(produits[0].libelle);
    });
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
    // Le contrat vend « 189 h de cours, 219,5 h encadrées ». C'est le second
    // chiffre qui est le total de ce que la famille reçoit, et c'est la donnée
    // structurée qu'une machine cite : déclarer 189 h annoncerait moins que le
    // contrat. Le texte lisible garde 189 h, là où il est nommé « heures de cours ».
    expect(cours.hasCourseInstance.map((i: any) => i.courseWorkload))
      .toEqual(['PT219H30M', 'PT329H', 'PT568H']);
    const data = getCandidatsLibres2027();
    for (const [i, instance] of cours.hasCourseInstance.entries()) {
      expect(instance.courseWorkload).not.toBe(`PT${data.parcours[i].heures_cours}H`);
    }
    expect(cours.offers.map((o: any) => o.price)).toEqual([5200, 7600, 11600]);
    expect(cours.offers.every((o: any) => o.priceCurrency === 'TND')).toBe(true);
    expect(cours.provider.address.streetAddress).toBe(LEGAL.addresses.pedagogique.street);
    const faq = blocs.find((b) => b['@type'] === 'FAQPage');
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(6);
    expect(blocs.find((b) => b['@type'] === 'BreadcrumbList')).toBeDefined();
  });

  test('le 10/11, la FAQ n’annonce plus de période d’offre sur les frais de dossier', () => {
    renderAu('2026-11-10T10:00:00+01:00');
    expect(document.body.textContent).not.toMatch(/offerts pendant certaines périodes/i);
    // Les frais restent annoncés : ils sont dus, pas effacés.
    expect(document.body.textContent).toMatch(/frais de dossier/i);
  });

  test('aucune promesse de résultat', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    expect(document.body.textContent).not.toMatch(/garanti|100 ?%|taux de réussite/i);
  });
});
