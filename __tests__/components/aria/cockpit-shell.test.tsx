import { fireEvent, render, screen, within } from '@testing-library/react';
import { AriaCockpitShell } from '@/components/aria/cockpit';
import type { AriaCockpitDTO } from '@/lib/aria/cockpit/contracts';
import fixture from '@/e2e/fixtures/aria/cockpit-terminale-eds.json';

const cockpit = fixture as unknown as AriaCockpitDTO;

describe('AriaCockpitShell', () => {
  it('opens on the TODAY panel by default and shows the student header', () => {
    render(<AriaCockpitShell cockpit={cockpit} onOpenChat={jest.fn()} onToggleCourse={jest.fn()} />);
    expect(screen.getByText('Cockpit ARIA')).toBeInTheDocument();
    expect(screen.getByText(/Yasmine Dupont/)).toBeInTheDocument();
    expect(screen.getByTestId('aria-nav-TODAY')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Objectif hebdomadaire')).toBeInTheDocument();
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
});
