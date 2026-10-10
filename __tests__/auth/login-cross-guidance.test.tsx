/**
 * Orientation croisée entre les DEUX formulaires de connexion.
 *
 * Constat terrain (diagnostics sarra.b du 05/10 puis fares.laajili du 10/10) : un élève de l'espace
 * (identifiant + code personnel) qui suit « Se connecter » depuis le site public tombe sur le
 * formulaire E-MAIL `/auth/signin`, qui lui affirmait même « Élève ? Connectez-vous avec l'email » —
 * il ne peut pas réussir, et le limiteur (5 essais / 15 min) finit par le bloquer.
 *
 * Contrat testé ici :
 *  - `/auth/signin` oriente visiblement les élèves de l'espace vers `/espace/connexion` ;
 *  - après un échec dont l'identifiant RESSEMBLE à un identifiant d'espace (ni e-mail ni téléphone),
 *    un rappel ciblé avec le lien apparaît dans la zone d'erreur ;
 *  - un échec avec e-mail ou téléphone n'affiche PAS ce rappel (les parents gardent le message sobre) ;
 *  - `/espace/connexion` oriente inversement parents/administration vers `/auth/signin` ;
 *  - la navigation publique propose « Espace élève » (menu desktop et menu mobile).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const signIn = jest.fn();
const getSession = jest.fn();
const usePathnameMock = jest.fn(() => '/');

jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  getSession: (...args: unknown[]) => getSession(...args),
}));
jest.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { SignInForm } from '@/app/auth/signin/SignInForm';
import { ConnexionForm } from '@/app/espace/connexion/ConnexionForm';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';

beforeEach(() => {
  signIn.mockReset().mockResolvedValue({ error: 'CredentialsSignin' });
  getSession.mockReset().mockResolvedValue(null);
});

const espaceLinks = () =>
  screen.queryAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/espace/connexion'));

describe('/auth/signin oriente les élèves de l’espace', () => {
  it('propose en permanence le lien vers /espace/connexion, avec le vocabulaire identifiant + code personnel', () => {
    render(<SignInForm />);
    const links = espaceLinks();
    expect(links.length).toBeGreaterThan(0);
    const block = links[0]!.closest('div')!;
    expect(block.textContent).toMatch(/identifiant/i);
    expect(block.textContent).toMatch(/code personnel/i);
  });

  it('ne prétend plus qu’un élève se connecte avec un e-mail', () => {
    render(<SignInForm />);
    expect(screen.queryByText(/Connectez-vous avec l'email élève/i)).toBeNull();
  });

  async function failWith(identifier: string) {
    fireEvent.change(screen.getByTestId('input-email'), { target: { value: identifier } });
    fireEvent.change(screen.getByTestId('input-password'), { target: { value: 'x'.repeat(12) } });
    fireEvent.click(screen.getByTestId('btn-signin'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    return screen.getByRole('alert');
  }

  it.each(['fares.laajili', 'ahmad.b', 'sarra.b'])(
    'échec avec l’identifiant d’espace %s : rappel ciblé et lien direct, dans la zone d’erreur',
    async (identifier) => {
      render(<SignInForm />);
      const alert = await failWith(identifier);
      expect(alert.textContent).toMatch(/espace/i);
      const link = within(alert).getByRole('link', { name: /espace élève/i });
      expect(link.getAttribute('href')).toBe('/espace/connexion');
    },
  );

  it.each(['parent@example.invalid', '+21699000000', '99 000 000'])(
    'échec avec %s (e-mail ou téléphone) : message sobre inchangé, sans rappel élève',
    async (identifier) => {
      render(<SignInForm />);
      const alert = await failWith(identifier);
      expect(alert.textContent).toMatch(/incorrect/i);
      expect(within(alert).queryByRole('link', { name: /espace/i })).toBeNull();
    },
  );
});

describe('/espace/connexion oriente inversement', () => {
  it('propose le lien vers /auth/signin pour parent et administration', () => {
    render(<ConnexionForm />);
    const link = screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/auth/signin');
    expect(link).toBeDefined();
    expect(link!.closest('p, div')!.textContent).toMatch(/parent|administration/i);
  });
});

describe('navigation publique', () => {
  it('le menu Connexion (desktop) contient une entrée « Espace élève » vers /espace/connexion', async () => {
    render(<CorporateNavbar />);
    fireEvent.click(screen.getByRole('button', { name: /^Connexion$/i }));
    await waitFor(() => {
      const item = screen
        .getAllByRole('menuitem')
        .find((a) => a.getAttribute('href') === '/espace/connexion');
      expect(item).toBeDefined();
      expect(item!.textContent).toMatch(/Espace élève/i);
      expect(item!.textContent).toMatch(/identifiant.*code|code.*identifiant/i);
    });
  });

  it('le menu mobile propose aussi « Espace élève »', async () => {
    render(<CorporateNavbar />);
    fireEvent.click(screen.getByRole('button', { name: /ouvrir le menu/i }));
    await waitFor(() => {
      const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/espace/connexion');
      expect(links.length).toBeGreaterThan(0);
      expect(links.some((a) => /Espace élève/i.test(a.textContent ?? ''))).toBe(true);
    });
  });
});
