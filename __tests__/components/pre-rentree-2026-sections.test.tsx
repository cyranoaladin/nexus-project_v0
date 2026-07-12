import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';
import { ScheduleSection } from '@/components/pre-rentree-2026/ScheduleSection';
import { ProgramsSection } from '@/components/pre-rentree-2026/ProgramsSection';
import { PricingSection } from '@/components/pre-rentree-2026/PricingSection';
import { CampaignFAQ } from '@/components/pre-rentree-2026/CampaignFAQ';

jest.mock('@/lib/analytics', () => ({
  track: {
    preRentreeScheduleViewed: jest.fn(),
    preRentreeProgramViewed: jest.fn(),
  },
}));

const dto = getPreRentreeLandingDTO();

describe('Pré-rentrée landing sections', () => {
  it('offers accessible schedule views by level and by week', async () => {
    const user = userEvent.setup();
    render(
      <ScheduleSection
        schedule={dto.schedule}
        levels={dto.levels}
        subjects={dto.subjects}
        blocks={dto.blocks}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Par niveau' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Seconde' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Par semaine' }));
    expect(screen.getByText('Semaine 1')).toBeInTheDocument();
    expect(screen.getByText('Semaine 2')).toBeInTheDocument();
    expect(screen.getAllByText(/Bloc A/).length).toBeGreaterThan(0);
  });

  it('renders complete module content one accordion at a time', async () => {
    const user = userEvent.setup();
    render(<ProgramsSection modules={dto.modules} levels={dto.levels} subjects={dto.subjects} />);

    const firstModule = dto.modules.find((candidate) => candidate.level === 'SECONDE');
    const trigger = screen.getByRole('button', { name: new RegExp(firstModule?.title ?? '') });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(firstModule?.prerequisites ?? '')).toBeInTheDocument();
    expect(screen.getByText(firstModule?.quickAssessment ?? '')).toBeInTheDocument();
    expect(screen.getByText(firstModule?.sessions[0]?.method ?? '')).toBeInTheDocument();
    expect(screen.getByText(firstModule?.sessions[0]?.deliverable ?? '')).toBeInTheDocument();
  });

  it('renders four canonical packs with hourly price, deposit and balance', () => {
    const { container } = render(<PricingSection packs={dto.packs} depositPercentage={dto.pricingRules.depositPercentage} />);
    expect(screen.getAllByText(/Tarif par élève/i)).toHaveLength(4);
    for (const pack of dto.packs) {
      expect(container.textContent?.replace(/\s/g, '')).toContain(`${pack.price}TND`);
      expect(screen.getAllByText(`${pack.pricePerHour.toLocaleString('fr-TN')} TND/h`).length).toBeGreaterThan(0);
    }
  });

  it('renders all sixteen contract FAQ items as accessible accordions', async () => {
    const user = userEvent.setup();
    render(<CampaignFAQ items={dto.content.faq} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(16);
    await user.click(buttons[0]);
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
  });
});
