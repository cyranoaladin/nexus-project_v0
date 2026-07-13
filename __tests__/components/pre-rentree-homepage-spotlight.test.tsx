import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import HomePage from '@/app/page';

const root = join(__dirname, '..', '..');
const componentPath = join(root, 'components/marketing/PreRentreeCampaignSpotlight.tsx');

describe('PreRentreeCampaignSpotlight', () => {
  it('is rendered before the permanent hero and level router', () => {
    const { container } = render(<HomePage />);
    const spotlight = screen.getByRole('region', { name: 'Campagne Pré-rentrée 2026' });
    const hero = container.querySelector('[data-hero]');
    const router = screen.getByText('Mon enfant est en…').closest('section');

    expect(spotlight).toBeInTheDocument();
    expect(hero).not.toBeNull();
    expect(router).not.toBeNull();
    expect(spotlight.compareDocumentPosition(hero as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(spotlight.compareDocumentPosition(router as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the exact campaign hierarchy and canonical actions', () => {
    render(<HomePage />);
    const spotlight = screen.getByRole('region', { name: 'Campagne Pré-rentrée 2026' });
    const campaign = within(spotlight);

    expect(campaign.getByRole('heading', { level: 2, name: 'Stages de pré-rentrée 2026' })).toBeVisible();
    expect(campaign.getByText('Pré-inscriptions ouvertes')).toBeVisible();
    expect(campaign.getByText('Entrée en Seconde, Première ou Terminale')).toBeVisible();
    expect(campaign.getByText('Mathématiques · Physique-Chimie · Français · NSI/SNT')).toBeVisible();
    expect(campaign.getByText('3 à 5 élèves')).toBeVisible();
    expect(campaign.getByText('10 h par matière')).toBeVisible();
    expect(campaign.getByText('Mutuelleville')).toBeVisible();
    expect(campaign.getByText('du 17 au 28 août')).toBeVisible();
    expect(campaign.getByText('Du 17 au 28 août 2026.')).toHaveClass('sr-only');
    expect(campaign.getByRole('link', { name: 'Découvrir la Pré-rentrée 2026' })).toHaveAttribute('href', '/stages/pre-rentree-2026');
    expect(campaign.getByRole('link', { name: 'Voir le planning' })).toHaveAttribute('href', '/stages/pre-rentree-2026#planning');
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
