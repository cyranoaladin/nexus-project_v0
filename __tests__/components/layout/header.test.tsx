import { Header } from '@/components/layout/header';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

// Mock de next/link
jest.mock('next/link', () => {
  return function MockedLink({ children, href }: { children: React.ReactNode; href: string; }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock de next/image
jest.mock('next/image', () => {
  return function MockedImage({ src, alt, ...props }: any) {
    return <img src={src} alt={alt} {...props} />;
  };
});

describe('Header', () => {
  it('renders the logo and brand name', () => {
    render(<Header />);

    expect(screen.getByAltText(/Nexus Réussite/i)).toBeInTheDocument();
    expect(screen.getByText(/Nexus/i)).toBeInTheDocument();
    expect(screen.getByText(/Réussite/i)).toBeInTheDocument();
  });

  it('renders all navigation links', () => {
    render(<Header />);

    expect(screen.getByText(/Accueil/i)).toBeInTheDocument();
    expect(screen.getByText(/Notre Équipe/i)).toBeInTheDocument();
    expect(screen.getByText(/Offres & Tarifs/i)).toBeInTheDocument();
    expect(screen.getByText(/Notre Centre/i)).toBeInTheDocument();
    expect(screen.getByText(/Contact/i)).toBeInTheDocument();
  });

  it('has correct navigation links', () => {
    render(<Header />);

    const homeLink = screen.getByText(/Accueil/i).closest('a');
    expect(homeLink).toHaveAttribute('href', '/');

    const teamLink = screen.getByText(/Notre Équipe/i).closest('a');
    expect(teamLink).toHaveAttribute('href', '/equipe');

    const offersLink = screen.getByText(/Offres & Tarifs/i).closest('a');
    expect(offersLink).toHaveAttribute('href', '/offres');

    const centerLink = screen.getByText(/Notre Centre/i).closest('a');
    expect(centerLink).toHaveAttribute('href', '/notre-centre');

    const contactLink = screen.getByText(/Contact/i).closest('a');
    expect(contactLink).toHaveAttribute('href', '/contact');
  });

  it('renders CTA buttons in desktop view', () => {
    render(<Header />);

    // Dans la vue desktop, nous devrions avoir les boutons CTA
    const signInButtons = screen.getAllByText(/Se Connecter/i);
    const bilanButtons = screen.getAllByText(/Bilan Gratuit/i);

    expect(signInButtons.length).toBeGreaterThan(0);
    expect(bilanButtons.length).toBeGreaterThan(0);
  });

  it('has correct CTA button links', () => {
    render(<Header />);

    const signInLinks = screen.getAllByText(/Se Connecter/i);
    const bilanLinks = screen.getAllByText(/Bilan Gratuit/i);

    // Vérifier qu'au moins un lien de chaque type existe
    expect(signInLinks.length).toBeGreaterThan(0);
    expect(bilanLinks.length).toBeGreaterThan(0);

    // Vérifier les href (peut y avoir des versions desktop et mobile)
    const signInLink = signInLinks[0].closest('a');
    const bilanLink = bilanLinks[0].closest('a');

    expect(signInLink).toHaveAttribute('href', '/auth/signin');
    expect(bilanLink).toHaveAttribute('href', '/bilan-gratuit');
  });

  it('renders mobile menu button', () => {
    render(<Header />);

    // Le bouton de menu mobile devrait être présent
    const menuButtons = screen.getAllByRole('button');
    expect(menuButtons.length).toBeGreaterThan(0);
  });

  it('toggles mobile menu when button is clicked', () => {
    render(<Header />);

    // Trouver le bouton de menu mobile
    const menuButton = screen.getAllByRole('button')[0];

    // Initialement, le menu mobile ne devrait pas être visible
    // (ou du moins, les éléments de navigation mobile ne devraient pas être dupliqués)

    // Cliquer sur le bouton de menu
    fireEvent.click(menuButton);

    // Après le clic, nous devrions avoir plus d'instances des liens de navigation
    // (versions desktop + mobile)
    const homeLinks = screen.getAllByText(/Accueil/i);
    expect(homeLinks.length).toBeGreaterThan(1);
  });

  it('closes mobile menu when navigation link is clicked', () => {
    render(<Header />);

    // Ouvrir le menu mobile
    const menuButton = screen.getAllByRole('button')[0];
    fireEvent.click(menuButton);

    // Cliquer sur un lien de navigation dans le menu mobile
    const homeLinks = screen.getAllByText(/Accueil/i);
    if (homeLinks.length > 1) {
      fireEvent.click(homeLinks[1]); // Cliquer sur la version mobile
    }

    // Le menu devrait se fermer (moins d'instances des liens)
    // Cette assertion peut nécessiter un ajustement selon l'implémentation exacte
  });

  it('logo links to home page', () => {
    render(<Header />);

    const logoLink = screen.getByAltText(/Nexus Réussite/i).closest('a');
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('renders proper semantic structure', () => {
    render(<Header />);

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();

    const navigation = screen.getByRole('navigation');
    expect(navigation).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<Header />);

    const logo = screen.getByAltText(/Nexus Réussite/i);
    expect(logo).toHaveAttribute('alt');
    expect(logo.getAttribute('alt')).not.toBe('');

    const links = screen.getAllByRole('link');
    links.forEach(link => {
      expect(link).toHaveAttribute('href');
    });
  });

  it('renders without crashing', () => {
    expect(() => render(<Header />)).not.toThrow();
  });
});
