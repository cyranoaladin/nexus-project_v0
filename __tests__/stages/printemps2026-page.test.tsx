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
    expect(
      screen.getByRole('heading', { level: 1, name: /préparez les échéances de mai et juin/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/duo première — français \+ maths/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /voir les formules disponibles/i })
    ).toHaveAttribute('href', '#offres');
    expect(screen.getAllByRole('link', { name: /réserver ma place/i }).length).toBeGreaterThan(0);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('highlights urgency, ROI and choice with cleaner conversion copy', () => {
    render(<StagesPage />);

    expect(
      screen.getByText(/des groupes de 6 élèves maximum/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /choisissez la formule la plus adaptée/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/un stage nexus coûte moins qu'un équivalent en cours individuels/i)
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
