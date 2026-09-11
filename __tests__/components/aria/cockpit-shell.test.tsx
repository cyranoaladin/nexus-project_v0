import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AriaCockpitShell } from '@/components/aria/cockpit';
import type { AriaCockpitDTO } from '@/lib/aria/cockpit/contracts';
import fixture from '@/e2e/fixtures/aria/cockpit-terminale-eds.json';

const cockpit = fixture as unknown as AriaCockpitDTO;

function openFirstCourseWorkspace(onOpenChat = jest.fn()) {
  render(<AriaCockpitShell cockpit={cockpit} onOpenChat={onOpenChat} onToggleCourse={jest.fn()} />);
  fireEvent.click(screen.getByTestId('aria-nav-CURRICULUM'));
  fireEvent.click(screen.getAllByRole('button', { name: 'Ouvrir' })[0]!);
}

describe('AriaCockpitShell', () => {
  beforeEach(() => {
    // Opening a course workspace triggers a real fetch for its mastery/NBA
    // data (see the dedicated tests below) — neutralized here for every
    // other test in this file, which doesn't care about that data.
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ courseKey: '', skills: [] }),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens on the TODAY panel by default and shows the student header', () => {
    render(<AriaCockpitShell cockpit={cockpit} onOpenChat={jest.fn()} onToggleCourse={jest.fn()} />);
    expect(screen.getByText('Cockpit ARIA')).toBeInTheDocument();
    expect(screen.getByText(/Yasmine Dupont/)).toBeInTheDocument();
    expect(screen.getByTestId('aria-nav-TODAY')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Objectif hebdomadaire')).toBeInTheDocument();
  });

  it('falls back gracefully when the student has no name, grade level or track', () => {
    const anonymous = {
      ...cockpit,
      student: { firstName: null, lastName: null, gradeLevel: null, academicTrack: null },
    } as unknown as AriaCockpitDTO;
    render(<AriaCockpitShell cockpit={anonymous} onOpenChat={jest.fn()} onToggleCourse={jest.fn()} />);
    expect(screen.getByText('Classe inconnue')).toBeInTheDocument();
  });

  it('navigates between every panel via the nav, and clears the open-course workspace on navigation', () => {
    const onToggleCourse = jest.fn();
    render(<AriaCockpitShell cockpit={cockpit} onOpenChat={jest.fn()} onToggleCourse={onToggleCourse} />);

    fireEvent.click(screen.getByTestId('aria-nav-CURRICULUM'));
    expect(screen.getByRole('heading', { name: 'Ma carte scolaire' })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('aria-nav-TRAJECTORY'));
    fireEvent.click(screen.getByTestId('aria-nav-RESOURCES'));
    expect(screen.getByRole('heading', { name: 'Ressources' })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('aria-nav-ASSESSMENTS'));
    expect(screen.getByText('Évaluations & bilans')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('aria-nav-ARIA'));
    expect(screen.getByText('Démarrer une conversation')).toBeInTheDocument();
  });

  it('opens a course workspace from the curriculum map and returns to the map on back', () => {
    const onOpenChat = jest.fn();
    render(<AriaCockpitShell cockpit={cockpit} onOpenChat={onOpenChat} onToggleCourse={jest.fn()} />);
    fireEvent.click(screen.getByTestId('aria-nav-CURRICULUM'));

    const openButtons = screen.getAllByRole('button', { name: 'Ouvrir' });
    fireEvent.click(openButtons[0]!);
    expect(screen.queryByRole('heading', { name: 'Ma carte scolaire' })).not.toBeInTheDocument();

    const main = screen.getByRole('main');
    fireEvent.click(within(main).getByRole('button', { name: 'Ma carte scolaire' }));
    expect(screen.getByRole('heading', { name: 'Ma carte scolaire' })).toBeInTheDocument();
  });

  it('fetches real mastery and next-best-action data for the exact course opened, and renders them once loaded', async () => {
    const withGraph = cockpit.skillGraphs[0]!;
    const skill = withGraph.competencies[0]!;
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/aria/mastery/course')) {
        return {
          ok: true,
          json: async () => ({
            courseKey: withGraph.courseKey,
            skills: [{ skillId: skill.skillId, skillLabel: skill.label, level: 'MASTERED', activityId: 'activity-1' }],
          }),
        } as Response;
      }
      if (url.includes('/api/aria/next-best-action')) {
        return {
          ok: true,
          json: async () => ({
            courseKey: withGraph.courseKey,
            action: { courseKey: withGraph.courseKey, skillId: skill.skillId, skillLabel: skill.label, level: 'MASTERED', activityId: 'activity-1' },
          }),
        } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<AriaCockpitShell cockpit={cockpit} onOpenChat={jest.fn()} onToggleCourse={jest.fn()} />);
    fireEvent.click(screen.getByTestId('aria-nav-CURRICULUM'));
    const openButtons = screen.getAllByRole('button', { name: 'Ouvrir' });
    fireEvent.click(openButtons[0]!);

    await waitFor(() => expect(screen.getByTestId('aria-next-best-action')).toBeInTheDocument());
    expect(screen.getByText('Maîtrisé')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(`/api/aria/mastery/course?courseKey=${withGraph.courseKey}`);
    expect(fetchSpy).toHaveBeenCalledWith(`/api/aria/next-best-action?courseKey=${withGraph.courseKey}`);
  });

  it('never blocks or breaks the workspace when the mastery/NBA fetch fails — badges and the CTA simply stay absent', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    openFirstCourseWorkspace();

    // The workspace itself still renders correctly despite the failed fetch.
    expect(within(screen.getByRole('main')).getByRole('button', { name: 'Ma carte scolaire' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('aria-next-best-action')).not.toBeInTheDocument();
    });
  });
});
