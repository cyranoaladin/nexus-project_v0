import { render, screen } from '@testing-library/react';

import StagesPage from '@/app/stages/page';

jest.mock('@/components/layout/CorporateNavbar', () => ({
  CorporateNavbar: () => <div data-testid="navbar">Navbar</div>,
}));

jest.mock('@/components/layout/CorporateFooter', () => ({
  CorporateFooter: () => <div data-testid="footer">Footer</div>,
}));

describe('Stages Printemps 2026 page', () => {
  it('renders the spring 2026 hero and flagship offers on /stages', () => {
    render(<StagesPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getAllByText(/stages printemps 2026/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 1, name: /la dernière ligne droite/i })).toBeInTheDocument();
    expect(screen.getByText(/vers la mention/i)).toBeInTheDocument();
    expect(screen.getByText(/pack « doublé anticipé »/i)).toBeInTheDocument();
    expect(screen.getByText(/pack « full stack nsi »/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /découvrir les académies/i })).toHaveAttribute('href', '#academies');
    expect(screen.getAllByRole('link', { name: /réserver ma place/i }).length).toBeGreaterThan(0);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('highlights urgency, ROI and choice with cleaner conversion copy', () => {
    render(<StagesPage />);

    expect(
      screen.getByText(/stages intensifs pensés pour transformer les vacances de printemps/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /choisir le bon stage doit prendre moins d'une minute/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/comparer les formules, voir les places, réserver sans friction/i)).toBeInTheDocument();
    expect(
      screen.getByText(/moins cher, moins d'élèves, plus de structure. c'est là que le retour sur investissement change/i)
    ).toBeInTheDocument();
  });

  it('does not use emoji glyphs as product and section icons anymore', () => {
    const { container } = render(<StagesPage />);
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/[🎯📖📐💻🖥🎤🌿⚡🚨✍🎓🏆⚔🎭]/u);
  });

  it('does not expose February-only copy on the active /stages page', () => {
    render(<StagesPage />);

    expect(screen.queryByText(/stage de février/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/boost décisif/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pallier 1/i)).not.toBeInTheDocument();
  });
});
