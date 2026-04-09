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
    expect(screen.getByText(/stages printemps 2026/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /la dernière ligne droite/i })).toBeInTheDocument();
    expect(screen.getByText(/vers la mention/i)).toBeInTheDocument();
    expect(screen.getByText(/pack « doublé anticipé »/i)).toBeInTheDocument();
    expect(screen.getByText(/pack « full stack nsi »/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /découvrir les académies/i })).toHaveAttribute('href', '#academies');
    expect(screen.getAllByRole('link', { name: /réserver ma place/i }).length).toBeGreaterThan(0);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('does not expose February-only copy on the active /stages page', () => {
    render(<StagesPage />);

    expect(screen.queryByText(/stage de février/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/boost décisif/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pallier 1/i)).not.toBeInTheDocument();
  });
});
