import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getPreRentreeCampaign,
  getPreRentreeSchedule,
  getPreRentreeModules,
} from '@/lib/campaigns/pre-rentree-2026/getters';
import { ScheduleSection } from '@/components/pre-rentree-2026/ScheduleSection';
import { ProgramsSection } from '@/components/pre-rentree-2026/ProgramsSection';
import { CampaignFAQ } from '@/components/pre-rentree-2026/CampaignFAQ';
import { PRE_RENTREE_DOCUMENTS } from '@/lib/campaigns/pre-rentree-2026/documents';
import { compilePreRentreeReviewSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';

jest.mock('@/lib/analytics', () => ({
  toPreRentreeEntryLevel: (level: string) => level.toLowerCase(),
  track: {
    preRentreeScheduleViewed: jest.fn(),
    preRentreeProgramViewed: jest.fn(),
    preRentreeLevelSelected: jest.fn(),
    preRentreeSubjectSelected: jest.fn(),
  },
}));

const campaign = getPreRentreeCampaign();
const surfaceDto = compilePreRentreeReviewSurfaceDTO();
const dto = {
  levels: campaign.levels,
  subjects: campaign.subjects,
  blocks: campaign.blocks,
  scheduleWindows: campaign.schedule,
  capacityByLevel: surfaceDto.planning.capacityByLevel,
  operationalGates: campaign.operationalGates,
  content: campaign.content,
  schedule: getPreRentreeSchedule(),
  offerOptions: surfaceDto.planning.offerOptions,
  modules: getPreRentreeModules(),
};

function renderSchedule() {
  return render(
    <ScheduleSection
      schedule={dto.schedule}
      scheduleWindows={dto.scheduleWindows}
      levels={dto.levels}
      subjects={dto.subjects}
      blocks={dto.blocks}
      organization={{ rooms: [] }}
      roomsPubliclyConfirmed={dto.operationalGates.roomAssignmentsValidated}
      offerOptions={dto.offerOptions}
      capacityByLevel={dto.capacityByLevel}
    />,
  );
}

describe('Pré-rentrée landing sections', () => {
  it('renders the six-subject legend and accessible level tables', async () => {
    const user = userEvent.setup();
    renderSchedule();

    expect(screen.getByRole('heading', { name: 'Trouvez le planning adapté' })).toBeInTheDocument();
    const legend = screen.getByRole('list', { name: 'Légende des matières' });
    expect(within(legend).getAllByRole('listitem')).toHaveLength(7);
    expect(within(legend).getByText('Mathématiques')).toBeInTheDocument();
    expect(within(legend).getByText('Français / Expression')).toBeInTheDocument();
    expect(within(legend).getByText('NSI')).toBeInTheDocument();
    expect(within(legend).getByText('Physique-Chimie')).toBeInTheDocument();
    expect(within(legend).getByText('SVT')).toBeInTheDocument();
    expect(within(legend).getByText('Mathématiques expertes')).toBeInTheDocument();
    // Philosophie (mission 4e/Philosophie, 2026-07-27) apparaît désormais dans
    // la légende, avec un jeton ambre distinct — jamais violet (réservé ARIA).
    expect(within(legend).getByText('Philosophie')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Par classe de rentrée' })).toHaveAttribute('aria-selected', 'true');
    // Entrée en 4e est désormais le premier niveau (mission 4e/Philosophie),
    // donc le premier onglet actif par défaut.
    expect(screen.getByRole('tab', { name: 'Entrée en 4e' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Entrée en Seconde' }));
    const table = screen.getByRole('table', { name: 'Planning — Entrée en Seconde' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3);
    // Seconde n'a plus que Maths + Français (grille fenêtres + week-end v2) : 1 ligne d'en-tête + 2 lignes.
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('columnheader', { name: 'Matière' })).toHaveAttribute('scope', 'col');
    expect(within(table).getAllByRole('rowheader')).toHaveLength(2);
    expect(within(table).getAllByText('5 séances · 10 h par élève')).toHaveLength(2);
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

  it.each([
    ['Entrée en Première', 'SVT'],
    ['Entrée en Terminale', 'NSI'],
    ['Entrée en Terminale', 'SVT'],
  ])(
    'affiche %s %s comme une matière unique de 5 séances et 10 h malgré ses deux cohortes',
    async (levelLabel, subjectLabel) => {
      const user = userEvent.setup();
      renderSchedule();
      await user.click(screen.getByRole('tab', { name: levelLabel }));
      const table = screen.getByRole('table', { name: `Planning — ${levelLabel}` });
      const row = within(table).getAllByRole('row').find((candidate) => (
        within(candidate).queryByRole('rowheader')?.textContent?.includes(subjectLabel)
      ));

      expect(row).toBeDefined();
      expect(row).toHaveTextContent('5 séances · 10 h par élève');
      expect(row).toHaveTextContent(/Deux créneaux possibles/i);
      expect(row).not.toHaveTextContent('10 séances · 20 h');
    },
  );

  it('does not leak the Radix forceMount control prop to the DOM', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    renderSchedule();

    const messages = consoleError.mock.calls.flat().map(String).join('\n');
    consoleError.mockRestore();
    expect(messages).not.toMatch(/forceMount/i);
  });

  it('renders the three window timetables without exposing unvalidated room numbers', async () => {
    const user = userEvent.setup();
    renderSchedule();
    await user.click(screen.getByRole('tab', { name: 'Emploi du temps par semaine' }));

    expect(screen.getByRole('tab', { name: 'Fenêtre 1 — 17 au 21 août' })).toHaveAttribute('aria-selected', 'true');
    const windowOne = screen.getByRole('table', { name: 'Emploi du temps — Fenêtre 1 — 17 au 21 août' });
    expect(within(windowOne).getAllByRole('row')).toHaveLength(5);
    expect(within(windowOne).getByRole('columnheader', { name: 'Groupes proposés' })).toBeInTheDocument();
    expect(windowOne.textContent).not.toMatch(/Salle\s+\d/i);
    // Le Français Première (préparation à l'EAF) est désormais dans la fenêtre week-end, plus en fenêtre 1.
    expect(within(windowOne).queryByText('Français — préparation à l’EAF')).not.toBeInTheDocument();
    expect(within(windowOne).getAllByText('SVT').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Fenêtre 2 — 24 au 28 août (Terminale)' }));
    const windowTwo = screen.getByRole('table', { name: 'Emploi du temps — Fenêtre 2 — 24 au 28 août (Terminale)' });
    expect(within(windowTwo).getAllByRole('row')).toHaveLength(5);
    expect(windowTwo.textContent).not.toMatch(/Salle\s+\d/i);
    expect(within(windowTwo).getByText('Mathématiques expertes')).toBeInTheDocument();
    expect(within(windowTwo).getByText('Physique-Chimie')).toBeInTheDocument();
    expect(within(windowTwo).getAllByText('SVT').length).toBeGreaterThan(0);
  });

  it('keeps teacher assignments, unvalidated room numbers and internal room organization out of the public surface', () => {
    const { container } = renderSchedule();
    expect(screen.queryByRole('region', { name: 'Organisation pédagogique' })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/deux salles permanentes|salle temporaire|bloc C.*Terminale|capacité minimale|promesse de laboratoire/i);
    expect(container.querySelectorAll('[data-testid="teacher-role"]')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/Salle\s+\d/i);
    expect(container.textContent).not.toMatch(/MATHS_NSI_SNT_TEACHER|FRENCH_TEACHER|PHYSICS_CHEMISTRY_TEACHER/);
    expect(container.textContent).not.toMatch(/60\s*h|30\s*h/);
  });

  it('renders complete module content one accordion at a time', async () => {
    const user = userEvent.setup();
    render(<ProgramsSection modules={dto.modules} levels={dto.levels} documents={PRE_RENTREE_DOCUMENTS} />);

    const firstModule = dto.modules.find((candidate) => candidate.level === 'TROISIEME');
    // Entrée en 4e est désormais le premier niveau (mission 4e/Philosophie) —
    // sélectionner explicitement l'onglet 3e avant de chercher son contenu.
    await user.click(screen.getByRole('tab', { name: 'Entrée en 3e' }));
    const trigger = screen.getByRole('button', { name: new RegExp(firstModule?.title ?? '') });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(firstModule?.prerequisites ?? '')).toBeInTheDocument();
    expect(screen.getByText(firstModule?.quickAssessment ?? '')).toBeInTheDocument();
    expect(screen.getByText(firstModule?.sessions[0]?.method ?? '')).toBeInTheDocument();
    expect(screen.getByText(firstModule?.sessions[0]?.deliverable ?? '')).toBeInTheDocument();
  });

  it('offers exactly seven planning, level programme, tariff and flyer downloads in programmes', () => {
    render(<ProgramsSection modules={dto.modules} levels={dto.levels} documents={PRE_RENTREE_DOCUMENTS} />);
    expect(screen.getAllByRole('link', { name: /PDF/i })).toHaveLength(8);
    expect(screen.getByRole('link', { name: /Planning et informations pratiques.*PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Télécharger le dossier complet — Entrée en 3e.*PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Télécharger le dossier complet — Entrée en Seconde.*PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Télécharger le dossier complet — Entrée en Première.*PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Télécharger le dossier complet — Entrée en Terminale.*PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tarifs et conditions financières.*PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /flyer 1 page.*PDF/i })).toBeInTheDocument();
  });

  it('does not duplicate document links inside the planning section', () => {
    renderSchedule();
    expect(screen.queryByRole('link', { name: /PDF/i })).not.toBeInTheDocument();
  });

  it('opens the level-specific module targeted by the configurator hash', () => {
    render(<ProgramsSection modules={dto.modules} levels={dto.levels} documents={PRE_RENTREE_DOCUMENTS} />);

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
    render(<ProgramsSection modules={dto.modules} levels={dto.levels} documents={PRE_RENTREE_DOCUMENTS} />);
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
    render(<ProgramsSection modules={dto.modules} levels={dto.levels} documents={PRE_RENTREE_DOCUMENTS} />);
    fireEvent(window, new HashChangeEvent('hashchange'));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Entrée en Terminale' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('button', { name: new RegExp(campaignModule.title) })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });
  });

  it('renders exactly the published FAQ items as accessible accordions (never the reserved entries)', async () => {
    const user = userEvent.setup();
    const publicFaq = compilePreRentreeReviewSurfaceDTO().faq;
    render(<CampaignFAQ items={publicFaq} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(publicFaq.length);
    expect(campaign.content.faq.filter((entry) => entry.published)).toHaveLength(publicFaq.length);
    await user.click(buttons[0]);
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
  });
});
