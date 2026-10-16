import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

import HomePage, { revalidate } from '@/app/page';
import { getALaUneCandidatsLibres } from '@/lib/candidats-libres-2027';

/** « À la une » de l'accueil : la campagne candidats libres 2027, datée et coupée automatiquement. */

const espaces = (texte: string) => texte.replace(/\s/g, ' ');

function renderAu(iso: string) {
  jest.useFakeTimers().setSystemTime(new Date(iso));
  const utils = render(<HomePage />);
  jest.useRealTimers();
  return utils;
}

describe('Accueil — à la une candidats libres 2027', () => {
  afterEach(() => jest.useRealTimers());

  test('l’accueil se régénère au moins toutes les heures', () => {
    expect(revalidate).toBeLessThanOrEqual(3600);
  });

  test('le 14/10 : bloc visible, trois mensualités, clôture Terminale, frais offerts, lien vers la page', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    const bloc = screen.getByRole('region', { name: /candidat libre/i });
    const texte = espaces(bloc.textContent ?? '');
    expect(texte).toMatch(/À la une/);
    // Les deux entrées de chaque parcours, jamais une seule : au 14/10 celle
    // d'octobre est en avant, celle de novembre reste lisible à côté.
    expect(texte).toContain('580 TND');
    expect(texte).toContain('650 TND');
    expect(texte).toContain('850 TND');
    expect(texte).toContain('950 TND');
    expect(texte).toContain('1 290 TND');
    expect(texte).toMatch(/dès octobre/);
    expect(texte).toMatch(/dès novembre/);
    expect(texte).toMatch(/Terminale.*12\/11 à 18 h/);
    expect(texte).toMatch(/Frais de dossier offerts jusqu’au 31\/10/);
    expect(within(bloc).getByRole('link', { name: /parcours et les prix/i })).toHaveAttribute('href', '/bac-candidat-libre');
  });

  test('le 05/11 : seule la Première reste ouverte à l’offre de frais, clôture Terminale toujours annoncée', () => {
    const une = getALaUneCandidatsLibres(new Date('2026-11-05T10:00:00+01:00'))!;
    expect(une.offre).toMatch(/08\/11 en Première/);
    expect(une.offre).not.toMatch(/Terminale/);
    expect(une.echeances.map((e) => e.niveau)).toEqual(['Terminale', 'Première']);
  });

  test('frais de dossier toujours mentionnés, et dernière mensualité ajustée', () => {
    const avant = getALaUneCandidatsLibres(new Date('2026-10-14T10:00:00+01:00'))!;
    expect(avant.fraisDossier).toMatch(/250\sTND.*Bac en 1 an/);
    const apres = getALaUneCandidatsLibres(new Date('2026-11-15T10:00:00+01:00'))!;
    expect(apres.fraisDossier).toMatch(/Frais de dossier.*250\sTND/);
    const terminale = avant.parcours.find((p) => p.id === 'terminale')!;
    expect(terminale.entrees.map((e) => [e.nbMensualites, e.mensualite, e.derniere, e.enAvant]))
      .toEqual([[9, 850, 800, true], [8, 950, 950, false]]);
  });

  test('le 15/11 : la Terminale est close, seule la Première est annoncée', () => {
    const une = getALaUneCandidatsLibres(new Date('2026-11-15T10:00:00+01:00'))!;
    expect(une.echeances.map((e) => e.niveau)).toEqual(['Première']);
    expect(une.offre).toBeNull();
  });

  test('FAQ de l’accueil : données structurées FAQPage et réponse candidats libres à jour', () => {
    const { container } = renderAu('2026-10-14T10:00:00+01:00');
    const blocs = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((b) => JSON.parse(b.textContent ?? '{}'));
    const faq = blocs.find((b) => b['@type'] === 'FAQPage');
    expect(faq.mainEntity).toHaveLength(5);
    const reponse = faq.mainEntity.find((q: any) => /candidats individuels/.test(q.name)).acceptedAnswer.text;
    expect(reponse).toMatch(/session 2027/);
    expect(reponse).toMatch(/Cyclades/);
    expect(reponse).not.toMatch(/ARIA|pilotage/);
  });

  test('repères tarifaires : plus de repère ARIA (plateforme retirée du catalogue)', () => {
    renderAu('2026-10-14T10:00:00+01:00');
    const reperes = screen.getByRole('heading', { name: /des formules pour chaque besoin/i }).closest('section')!;
    expect(reperes.textContent).not.toMatch(/ARIA/);
    expect(reperes.textContent).toMatch(/Spécialité simple/);
  });

  test('après le 20/11 à 18 h : plus de bloc à la une', () => {
    expect(getALaUneCandidatsLibres(new Date('2026-11-20T18:00:00+01:00'))).toBeNull();
    renderAu('2026-11-21T10:00:00+01:00');
    expect(screen.queryByRole('region', { name: /candidat libre/i })).not.toBeInTheDocument();
  });
});
