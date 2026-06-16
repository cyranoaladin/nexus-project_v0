import { render, screen } from '@testing-library/react';
import HomePage, { metadata } from '@/app/page';

describe('HomePage', () => {
  it('renders the static marketing homepage without crashing', () => {
    const { container } = render(<HomePage />);

    expect(container.firstChild).not.toBeNull();
    expect(container.querySelector('header#top')).toBeInTheDocument();
    expect(container.querySelector('footer')).toBeInTheDocument();
    expect(screen.getAllByAltText('Nexus Réussite').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /cadre premium pour préparer le bac français/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /forfaits courts et accompagnements ciblés/i })).toBeInTheDocument();
  });

  it('exports homepage metadata', () => {
    expect(metadata.title).toBeDefined();
    expect(typeof metadata.title).toBe('string');
    expect(metadata.description).toBeDefined();
  });
});
