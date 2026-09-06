import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';
import { PreRentreeCampaignSpotlight } from '@/components/marketing/PreRentreeCampaignSpotlight';
import { compilePreRentreeReviewHomepageSpotlightDTO } from '@/lib/campaigns/pre-rentree-2026/getters';
import { getPreRentreeReleaseGate } from '@/lib/campaigns/pre-rentree-2026/release-gate';

const root = join(__dirname, '..', '..');
const componentPath = join(root, 'components/marketing/PreRentreeCampaignSpotlight.tsx');

// Canonical review data remains testable while public campaign access is closed.
describe('PreRentreeCampaignSpotlight', () => {
  it('keeps the institutional homepage without the expired campaign after publication closes', () => {
    expect(getPreRentreeReleaseGate().isPublicReady).toBe(false);
    const campaign = compilePreRentreeReviewHomepageSpotlightDTO();
    expect(campaign).not.toBeNull();

    const { container } = render(<HomePage />);
    const hero = container.querySelector('[data-hero]');
    const router = screen.getByText('Mon enfant est en…').closest('section');

    expect(screen.queryByRole('region', { name: campaign!.ariaLabel })).not.toBeInTheDocument();
    expect(screen.queryByTestId('pre-rentree-home-spotlight')).not.toBeInTheDocument();
    expect(container.querySelector('[data-hero] a[href="/recommandation"]')).not.toBeNull();
    expect(container.querySelector('[data-hero] a[href="/offres"]')).not.toBeNull();
    expect(hero).not.toBeNull();
    expect(router).not.toBeNull();
  });

  it('exposes the canonical campaign copy and navigation in the preserved review component', () => {
    const campaign = compilePreRentreeReviewHomepageSpotlightDTO();
    expect(campaign).not.toBeNull();

    const { container } = render(<PreRentreeCampaignSpotlight campaign={campaign!} />);

    expect(screen.getByRole('heading', { name: campaign!.title })).toBeInTheDocument();
    expect(screen.getByText(campaign!.subjectFamiliesLabel)).toBeInTheDocument();
    expect(container.querySelector(`a[href="${campaign!.campaignPath}"]`)).not.toBeNull();
    expect(container.querySelector(`a[href^="${campaign!.campaignPath}#"]`)).not.toBeNull();
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
