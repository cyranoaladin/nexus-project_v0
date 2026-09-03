import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { PreRentreeCampaignSpotlight } from '@/components/marketing/PreRentreeCampaignSpotlight';
import { getPreRentreeHomepageSpotlightDTO } from '@/lib/campaigns/pre-rentree-2026/getters';
import { getPreRentreeReleaseGate } from '@/lib/campaigns/pre-rentree-2026/release-gate';

const root = join(__dirname, '..', '..');
const componentPath = join(root, 'components/marketing/PreRentreeCampaignSpotlight.tsx');

// The homepage header banner now promotes the UTICA B@ck to School 2026 fair
// (components/marketing/UticaBackToSchoolBanner.tsx). This campaign
// component still powers its own canonical landing surfaces, so it is
// exercised here in isolation rather than through the live homepage; every
// expected label is still derived from the same canonical DTO the component
// itself renders (no hardcoded copy here to drift out of sync).
describe('PreRentreeCampaignSpotlight', () => {
  it('renders the canonical campaign copy and navigation at PUBLIC_READY', () => {
    expect(getPreRentreeReleaseGate().isPublicReady).toBe(true);
    const campaign = getPreRentreeHomepageSpotlightDTO();
    expect(campaign).not.toBeNull();

    const { container } = render(<PreRentreeCampaignSpotlight campaign={campaign!} />);

    expect(screen.getByRole('region', { name: campaign!.ariaLabel })).toBeInTheDocument();
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
