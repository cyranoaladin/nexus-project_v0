import { render, screen } from '@testing-library/react';
import HomePage, { metadata } from '@/app/page';

jest.mock('@/components/layout/CorporateNavbar', () => ({
  CorporateNavbar: () => <div data-testid="navbar">Navbar</div>,
}));
jest.mock('@/components/layout/CorporateFooter', () => ({
  CorporateFooter: () => <div data-testid="footer">Footer</div>,
}));

describe('HomePage', () => {
  it('renders the homepage without crashing', () => {
    const { container } = render(<HomePage />);
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(container.firstChild).not.toBeNull();
  });

  it('exports homepage metadata', () => {
    expect(metadata.title).toBeDefined();
    expect(typeof metadata.title).toBe('string');
    expect(metadata.description).toBeDefined();
  });
});
