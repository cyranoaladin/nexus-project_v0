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
    preRentreeLevelSelected: jest.fn(),
    preRentreeSubjectSelected: jest.fn(),
  },
}));

const dto = getPreRentreeLandingDTO();

function renderSchedule() {
  return render(
    <ScheduleSection
      schedule={dto.schedule}
      scheduleWindows={dto.scheduleWindows}
      levels={dto.levels}
      subjects={dto.subjects}
      blocks={dto.blocks}
      organization={dto.organization}
      operationalGates={dto.operationalGates}
      offerOptions={dto.offerOptions}
      subjectIncompatibilities={dto.subjectIncompatibilities}
      capacityByOffer={dto.capacityByOffer}
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
    expect(within(legend).getByText('NSI')).toBeInTheDocument();
    expect(within(legend).getByText('Physique-Chimie')).toBeInTheDocument();
    expect(within(legend).getByText('SVT')).toBeInTheDocument();
    expect(within(legend).getByText('Mathématiques expertes')).toBeInTheDocument();
    expect(within(legend).queryByText('Philosophie')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Par classe de rentrée' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Entrée en 3e' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Entrée en Seconde' }));
    const table = screen.getByRole('table', { name: 'Planning — Entrée en Seconde' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(6);
    // Seconde n'a plus que Maths + Français (grille fenêtres + week-end v2) : 1 ligne d'en-tête + 2 lignes.
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('columnheader', { name: 'Matière' })).toHaveAttribute('scope', 'col');
    expect(within(table).getAllByRole('rowheader')).toHaveLength(2);
    expect(within(table).getAllByText('5 séances · 10 h')).toHaveLength(2);
    expect(within(table).getAllByText(/du lundi \d+ au vendredi \d+/i)).toHaveLength(2);

    const levelTab = screen.getByRole('tab', { name: 'Par classe de rentrée' });
    const weekTab = screen.getByRole('tab', { name: 'Emploi du temps par semaine' });
    levelTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(weekTab).toHaveFocus();
    expect(weekTab).toHaveAttribute('aria-selected', 'true');
  });

  it('server-renders the three level timetables in the initial DOM (D1 — SEO/a11y)', () => {
    // Sans aucun clic : les grilles Seconde, Première ET Terminale sont montées (forceMount),
    // donc présentes pour un crawler, un lecteur d'écran et un navigateur sans JS.
    renderSchedule();
    const captions = Array.from(document.querySelectorAll('table caption')).map((c) => c.textContent);
    expect(captions).toEqual(
      expect.arrayContaining([
        'Planning — Entrée en Seconde',
        'Planning — Entrée en Première',
        'Planning — Entrée en Terminale',
      ]),
    );
  });

  it('does not leak the Radix forceMount control prop to the DOM', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    renderSchedule();

    const messages = consoleError.mock.calls.flat().map(String).join('\n');
    consoleError.mockRestore();
    expect(messages).not.toMatch(/forceMount/i);
  });

  it('renders the three window timetables with four blocks and two rooms', async () => {
    const user = userEvent.setup();
    renderSchedule();
    await user.click(screen.getByRole('tab', { name: 'Emploi du temps par semaine' }));

    expect(screen.getByRole('tab', { name: 'Fenêtre 1 — 17 au 21 août' })).toHaveAttribute('aria-selected', 'true');
    const windowOne = screen.getByRole('table', { name: 'Emploi du temps — Fenêtre 1 — 17 au 21 août' });
    expect(within(windowOne).getAllByRole('row')).toHaveLength(5);
    expect(within(windowOne).getByRole('columnheader', { name: 'Salle 1' })).toBeInTheDocument();
    expect(within(windowOne).getByRole('columnheader', { name: 'Salle 2' })).toBeInTheDocument();
    expect(within(windowOne).queryByRole('columnheader', { name: 'Salle 3' })).not.toBeInTheDocument();
    // Fenêtre 1 (S5) est entièrement occupée sur ses 2 salles : 4 blocs x 2 salles = 8 créneaux, 0 libre.
    expect(within(windowOne).queryAllByText('Libre')).toHaveLength(0);
    // Le Français Première (préparation à l'EAF) est désormais dans la fenêtre week-end, plus en fenêtre 1.
    expect(within(windowOne).queryByText('Français — préparation à l’EAF')).not.toBeInTheDocument();
    expect(within(windowOne).getAllByText('SVT').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Fenêtre 2 — 24 au 28 août (Terminale)' }));
    const windowTwo = screen.getByRole('table', { name: 'Emploi du temps — Fenêtre 2 — 24 au 28 août (Terminale)' });
    expect(within(windowTwo).getAllByRole('row')).toHaveLength(5);
    expect(within(windowTwo).getByRole('columnheader', { name: 'Salle 3' })).toBeInTheDocument();
    // Bloc A/B n'occupent que la salle 1 (Maths expertes, Maths) ; salle 2 et salle 3 y sont libres.
    // Bloc C occupe les 3 salles (NSI, Physique-Chimie, SVT) ; bloc D occupe salle 1 et 2 (NSI, SVT), salle 3 libre.
    expect(within(windowTwo).queryAllByText('Libre')).toHaveLength(5);
    expect(within(windowTwo).getByText('Mathématiques expertes')).toBeInTheDocument();
    expect(within(windowTwo).getByText('Physique-Chimie')).toBeInTheDocument();
    expect(within(windowTwo).getAllByText('SVT').length).toBeGreaterThan(0);
  });

  it('keeps teacher assignments out of the public surface until validation', () => {
    renderSchedule();
    const organization = screen.getByRole('region', { name: 'Organisation pédagogique' });
    expect(within(organization).queryAllByTestId('teacher-role')).toHaveLength(0);
    expect(within(organization).getByText(/Salle 1.*Mathématiques.*NSI.*Mathématiques expertes/i)).toBeInTheDocument();
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

  it.each([
    ['planning', () => renderSchedule()],
    ['programmes', () => render(
      <ProgramsSection modules={dto.modules} levels={dto.levels} subjects={dto.subjects} />,
    )],
  ])('offers planning, level programmes, tariffs and flyer downloads in %s', (_section, renderSection) => {
    renderSection();
    expect(screen.getByRole('link', { name: /Planning et informations pratiques.*PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Télécharger le dossier complet — Entrée en Seconde.*PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Télécharger le dossier complet — Entrée en Première.*PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Télécharger le dossier complet — Entrée en Terminale.*PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tarifs et conditions financières.*PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /flyer 1 page.*PDF/i })).toBeInTheDocument();
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

  it('renders all eighteen contract FAQ items as accessible accordions', async () => {
    const user = userEvent.setup();
    render(<CampaignFAQ items={dto.content.faq} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(19);
    await user.click(buttons[0]);
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
  });
});
