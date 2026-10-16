/**
 * Bannière d'accueil vers les manuels.
 *
 * Les deux chiffres qu'elle affiche sont des promesses commerciales : ils sont
 * recalculés ici depuis le catalogue canonique. Si le catalogue change et que
 * la bannière ne suit pas, ce test échoue — plutôt que de laisser l'accueil
 * annoncer un prix d'entrée ou un nombre de volumes qui n'existent plus.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { ManuelsBanner } from '@/components/marketing/ManuelsBanner';
import { getManuelsBaremeClient, getManuelVolumesClient } from '@/lib/manuels/catalogue-client';
import { priceForPages } from '@/lib/manuels/pricing';

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>;
  };
});

const VOLUMES = getManuelVolumesClient();
const BAREME = getManuelsBaremeClient();

describe('bannière manuels — l’accueil mène à la boutique', () => {
  it('l’appel à l’action pointe la page dédiée', () => {
    render(<ManuelsBanner />);
    const lien = screen.getByRole('link', { name: /voir les manuels/i });
    expect(lien).toHaveAttribute('href', '/manuels');
    // cible tactile : au moins 44 px de haut
    expect(lien.className).toMatch(/min-h-11/);
  });

  it('la bannière est une région nommée, repérable au lecteur d’écran', () => {
    render(<ManuelsBanner />);
    expect(screen.getByRole('region', { name: /manuels/i })).toBeInTheDocument();
  });

  it('le nombre de volumes annoncé est celui du catalogue', () => {
    render(<ManuelsBanner />);
    expect(screen.getByText(String(VOLUMES.length))).toBeInTheDocument();
    expect(screen.getByText(`${VOLUMES.length} volumes au catalogue`)).toBeInTheDocument();
  });

  it('le prix d’entrée annoncé est le plus bas prix réellement facturé', () => {
    const payants = VOLUMES.map((v) => priceForPages(v.pages, BAREME)).filter((p) => p > 0);
    const mini = Math.min(...payants);
    render(<ManuelsBanner />);
    expect(screen.getByText(`Dès ${mini} DT`)).toBeInTheDocument();
  });

  it('en tête de page, elle porte le dégagement de la barre de navigation fixe', () => {
    const { container } = render(<ManuelsBanner />);
    // la bannière d'en-tête le portait : le perdre ferait passer le héros sous la barre
    expect(container.querySelector('section')!.className).toMatch(/pt-\[5\.75rem\]/);
  });

  it('posée sous une autre bannière, elle ne reprend pas ce dégagement', () => {
    const { container } = render(<ManuelsBanner asHeader={false} />);
    expect(container.querySelector('section')!.className).not.toMatch(/pt-\[5\.75rem\]/);
  });
});
