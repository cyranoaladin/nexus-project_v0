import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';
import { ScheduleSection } from '@/components/pre-rentree-2026/ScheduleSection';
import { ProgramsSection } from '@/components/pre-rentree-2026/ProgramsSection';
import { PricingSection } from '@/components/pre-rentree-2026/PricingSection';
import { CampaignFAQ } from '@/components/pre-rentree-2026/CampaignFAQ';
import { PracticalInformation } from '@/components/pre-rentree-2026/PracticalInformation';

jest.mock('@/lib/analytics', () => ({
  toPreRentreeEntryLevel: (level: string) => level.toLowerCase(),
  track: {
    preRentreeScheduleViewed: jest.fn(),
    preRentreeProgramViewed: jest.fn(),
  },
}));

const dto = getPreRentreeLandingDTO();

function renderSchedule() {
  return render(
    <ScheduleSection
      schedule={dto.schedule}
      scheduleWeeks={dto.scheduleWeeks}
      levels={dto.levels}
      subjects={dto.subjects}
      blocks={dto.blocks}
      organization={dto.organization}
      operationalGates={dto.operationalGates}
    />,
  );
}

describe('Pré-rentrée landing sections', () => {
  it('renders the six-subject legend and accessible level tables', async () => {
    const user = userEvent.setup();
    renderSchedule();

    expect(screen.getByRole('heading', { name: 'Planning et emplois du temps' })).toBeInTheDocument();
    const legend = screen.getByRole('list', { name: 'Légende des matières' });
    expect(within(legend).getAllByRole('listitem')).toHaveLength(6);
    expect(within(legend).getByText('Mathématiques')).toBeInTheDocument();
    expect(within(legend).getByText('Français / Expression')).toBeInTheDocument();
    expect(within(legend).getByText('NSI / SNT')).toBeInTheDocument();
    expect(within(legend).getByText('Physique-Chimie')).toBeInTheDocument();
    expect(within(legend).getByText('SVT')).toBeInTheDocument();
    expect(within(legend).getByText('Philosophie')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Par classe de rentrée' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Entrée en 3e' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Entrée en Seconde' }));
    const table = screen.getByRole('table', { name: 'Planning — Entrée en Seconde' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(6);
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getByRole('columnheader', { name: 'Matière' })).toHaveAttribute('scope', 'col');
    expect(within(table).getAllByRole('rowheader')).toHaveLength(4);
    expect(within(table).getAllByText('5 séances · 10 h')).toHaveLength(4);
    expect(within(table).getAllByText(/du lundi au vendredi/i)).toHaveLength(4);

    const levelTab = screen.getByRole('tab', { name: 'Par classe de rentrée' });
    const weekTab = screen.getByRole('tab', { name: 'Emploi du temps par semaine' });
    levelTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(weekTab).toHaveFocus();
    expect(weekTab).toHaveAttribute('aria-selected', 'true');
  });

  it('renders both weekly timetables with four blocks and two rooms', async () => {
    const user = userEvent.setup();
    renderSchedule();
    await user.click(screen.getByRole('tab', { name: 'Emploi du temps par semaine' }));

    expect(screen.getByRole('tab', { name: 'Semaine 1 · 17–21 août' })).toHaveAttribute('aria-selected', 'true');
    const weekOne = screen.getByRole('table', { name: 'Emploi du temps — Semaine 1 · 17–21 août' });
    expect(within(weekOne).getAllByRole('row')).toHaveLength(5);
    expect(within(weekOne).getByRole('columnheader', { name: 'Salle 1' })).toBeInTheDocument();
    expect(within(weekOne).getByRole('columnheader', { name: 'Salle 2' })).toBeInTheDocument();
    expect(within(weekOne).queryAllByText('Libre')).toHaveLength(0);
    expect(within(weekOne).getByText('Français — préparation à l’EAF')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Semaine 2 · 24–28 août' }));
    const weekTwo = screen.getByRole('table', { name: 'Emploi du temps — Semaine 2 · 24–28 août' });
    expect(within(weekTwo).getAllByRole('row')).toHaveLength(5);
    expect(within(weekTwo).queryAllByText('Libre')).toHaveLength(0);
    expect(within(weekTwo).getByText('Initiation informatique, algorithmique et SNT')).toBeInTheDocument();
    expect(within(weekTwo).getAllByText('Physique-Chimie')).toHaveLength(3);
  });

  it('keeps teacher assignments out of the public surface until validation', () => {
    renderSchedule();
    const organization = screen.getByRole('region', { name: 'Organisation pédagogique' });
    expect(within(organization).queryAllByTestId('teacher-role')).toHaveLength(0);
    expect(within(organization).getByText(/Salle 1.*Mathématiques.*NSI.*SVT/i)).toBeInTheDocument();
    expect(within(organization).getByText(/Salle 2.*Français.*Physique-Chimie/i)).toBeInTheDocument();
    expect(organization.textContent).not.toMatch(/MATHS_NSI_SNT_TEACHER|FRENCH_TEACHER|PHYSICS_CHEMISTRY_TEACHER/);
    expect(organization.textContent).not.toMatch(/60\s*h|30\s*h/);
  });

  it('formats the public deadline and canonical venue without duplication', () => {
    render(
      <PracticalInformation
        campaign={dto.campaign}
        blocks={dto.blocks}
        capacityByOffer={dto.capacityByOffer}
        pack={dto.packs.find((pack) => pack.subjectsCount === 1)}
        depositPercentage={dto.pricingRules.depositPercentage}
        content={dto.content.practical}
        cgvPath={dto.legalRefs.cgv}
      />,
    );
    expect(screen.getByText('Nexus Réussite — Mutuelleville, Tunis')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Mutuelleville · Mutuelleville');
    expect(screen.getByText(/Décision le 10 août 2026 à 18 h 00/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/06:00 PM|PM|AM/);
  });

  it('renders complete module content one accordion at a time', async () => {
    const user = userEvent.setup();
    render(<ProgramsSection modules={dto.modules} levels={dto.levels} subjects={dto.subjects} />);

    const firstModule = dto.modules.find((candidate) => candidate.level === 'TROISIEME');
    const trigger = screen.getByRole('button', { name: new RegExp(firstModule?.title ?? '') });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(firstModule?.prerequisites ?? '')).toBeInTheDocument();
    expect(screen.getByText(firstModule?.quickAssessment ?? '')).toBeInTheDocument();
    expect(screen.getByText(firstModule?.sessions[0]?.method ?? '')).toBeInTheDocument();
    expect(screen.getByText(firstModule?.sessions[0]?.deliverable ?? '')).toBeInTheDocument();
  });

  it('opens the level-specific module targeted by the configurator hash', () => {
    render(<ProgramsSection modules={dto.modules} levels={dto.levels} subjects={dto.subjects} />);

    window.location.hash = '#programme-premiere-mathematiques';
    fireEvent(window, new HashChangeEvent('hashchange'));

    expect(screen.getByRole('tab', { name: 'Entrée en Première' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: /Mathématiques — Entrée en Première/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it.each(dto.modules)('opens %s from a canonical program hash', async (campaignModule) => {
    render(<ProgramsSection modules={dto.modules} levels={dto.levels} subjects={dto.subjects} />);
    window.location.hash = `#programme-${campaignModule.id}`;
    fireEvent(window, new HashChangeEvent('hashchange'));

    const level = dto.levels.find((candidate) => candidate.id === campaignModule.level);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: level?.label ?? campaignModule.level })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('button', { name: new RegExp(campaignModule.title) })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });
  });

  it('opens a canonical program hash on the initial page render', async () => {
    const campaignModule = dto.modules.find((candidate) => candidate.id === 'terminale-physique-chimie');
    if (!campaignModule) throw new Error('Module Terminale Physique-Chimie absent');

    window.location.hash = `#programme-${campaignModule.id}`;
    render(<ProgramsSection modules={dto.modules} levels={dto.levels} subjects={dto.subjects} />);
    fireEvent(window, new HashChangeEvent('hashchange'));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Entrée en Terminale' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('button', { name: new RegExp(campaignModule.title) })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });
  });

  it('renders four canonical packs with hourly price, deposit and balance', () => {
    const { container } = render(
      <PricingSection
        packs={dto.offerOptions}
        levels={dto.levels}
        depositPercentage={dto.pricingRules.depositPercentage}
        campaignYear={dto.campaign.startDate.slice(0, 4)}
      />,
    );
    expect(screen.getByRole('heading', { name: /Nexus Fondations · Entrée en 3e/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Nexus Premium · Première et Terminale/i })).toBeInTheDocument();
    for (const pack of dto.offerOptions) {
      expect(container.textContent?.replace(/\s/g, '')).toContain(`${pack.price}TND`);
      expect(screen.getAllByText(`${pack.pricePerHour.toLocaleString('fr-TN')} TND/h`).length).toBeGreaterThan(0);
    }
  });

  it('renders all seventeen contract FAQ items as accessible accordions', async () => {
    const user = userEvent.setup();
    render(<CampaignFAQ items={dto.content.faq} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(17);
    await user.click(buttons[0]);
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
  });
});
