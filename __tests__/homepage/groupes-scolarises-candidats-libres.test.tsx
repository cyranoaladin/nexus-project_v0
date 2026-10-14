import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import { ProcessSteps } from '@/components/marketing/acadomia-inspired';
import { HeroSection } from '@/components/premium/HeroSection';
import { MethodSection } from '@/components/premium/MethodSection';

/**
 * Accueil : deux tailles de groupe distinctes, jamais une seule taille présentée comme universelle.
 * Élèves scolarisés : 5 au plus (ouverture dès 3 au lycée, 4 au Brevet).
 * Candidats libres session 2027 : 12 au plus (ouverture à 7).
 */
jest.mock('next/image', () => ({ __esModule: true, default: (props: any) => <img alt={props.alt} src={String(props.src)} /> }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, ...p }: any) => <a href={href} {...p}>{children}</a> }));

const texte = (ui: React.ReactElement) => (render(ui).container.textContent ?? '').replace(/\s/g, ' ');

describe('Accueil — groupes scolarisés (5) et candidats libres (12)', () => {
  test.each([
    ['introduction', <HeroSection key="h" />],
    ['méthode', <MethodSection key="m" />],
    ['étapes', <ProcessSteps key="p" />],
  ])('%s : les deux tailles sont nommées et attribuées', (_nom, ui) => {
    const t = texte(ui);
    // Chaque taille est rattachée à son public, dans un sens ou dans l’autre.
    expect(t).toMatch(/scolarisés[^.]{0,60}\b5\b|\b5\b[^.]{0,60}scolarisés/i);
    expect(t).toMatch(/candidats libres[^.]{0,60}\b12\b|\b12\b[^.]{0,60}candidats libres/i);
  });

  test('la méthode ne titre plus « Groupes de 5 maximum »', () => {
    expect(texte(<MethodSection />)).not.toMatch(/Groupes de 5 maximum/);
  });
});
