import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

const root = join(__dirname, '..', '..');
const componentPath = join(root, 'components/marketing/PreRentreeCampaignSpotlight.tsx');

describe('PreRentreeCampaignSpotlight', () => {
  it('keeps the campaign absent until PUBLIC_READY while preserving the permanent homepage', () => {
    const { container } = render(<HomePage />);
    const hero = container.querySelector('[data-hero]');
    const router = screen.getByText('Mon enfant est en…').closest('section');

    expect(screen.queryByRole('region', { name: 'Campagne Pré-rentrée 2026' })).not.toBeInTheDocument();
    expect(hero).not.toBeNull();
    expect(router).not.toBeNull();
  });

  it('does not expose campaign copy or navigation while owner gates are open', () => {
    const { container } = render(<HomePage />);

    expect(screen.queryByRole('heading', { name: 'Stages de pré-rentrée 2026' })).not.toBeInTheDocument();
    expect(screen.queryByText('Fondations : 4 à 6 élèves · Premium : 3 à 5 élèves')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/stages/pre-rentree-2026"]')).toBeNull();
    expect(container.querySelector('a[href^="/stages/pre-rentree-2026#"]')).toBeNull();
  });

  it('contains no copied commercial data or direct source imports', () => {
    expect(existsSync(componentPath)).toBe(true);
    const source = existsSync(componentPath) ? readFileSync(componentPath, 'utf8') : '';

    expect(source).not.toMatch(/pre-rentree-2026\.json|pricing\.canonical\.json/);
    expect(source).not.toMatch(/17\s*[–-]\s*28|17 au 28|480|900|1[\s\u00a0]?350|1[\s\u00a0]?800/);
    expect(source).not.toMatch(/(?:Campagne|Stages de|Découvrir la) Pré-rentrée 2026/);
    expect(source).not.toMatch(/21699192829|\+216|99\s*19\s*28\s*29|15\s*h/);
    expect(source).not.toMatch(/data\/campaigns|data\/pricing/);
  });
});
