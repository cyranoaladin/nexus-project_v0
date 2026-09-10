import { fireEvent, render, screen } from '@testing-library/react';
import { AriaSetupWizard } from '@/components/aria/cockpit';
import type { AriaCockpitDTO } from '@/lib/aria/cockpit/contracts';
import fixture from '@/e2e/fixtures/aria/cockpit-terminale-eds.json';

const baseCockpit = fixture as unknown as AriaCockpitDTO;

function goToStep(n: number) {
  for (let i = 0; i < n; i += 1) {
    fireEvent.click(screen.getByTestId('aria-wizard-next'));
  }
}

describe('AriaSetupWizard', () => {
  it('shows the read-only academic profile on step 1, including an incomplete-profile warning', () => {
    const incomplete = {
      ...baseCockpit,
      curriculum: {
        ...baseCockpit.curriculum,
        academicProfile: {
          ...baseCockpit.curriculum.academicProfile,
          incomplete: true,
          missingFields: ['academicTrack'],
        },
      },
    } as unknown as AriaCockpitDTO;
    render(<AriaSetupWizard cockpit={incomplete} saving={false} error={null} onSubmit={jest.fn()} />);
    expect(screen.getByText('Profil scolaire incomplet')).toBeInTheDocument();
    expect(screen.getByText(/academicTrack/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retour/ })).toBeDisabled();
  });

  it('shows "Non renseigné" for a null profile field', () => {
    const missing = {
      ...baseCockpit,
      curriculum: {
        ...baseCockpit.curriculum,
        academicProfile: { ...baseCockpit.curriculum.academicProfile, school: null, specialties: [] },
      },
    } as unknown as AriaCockpitDTO;
    render(<AriaSetupWizard cockpit={missing} saving={false} error={null} onSubmit={jest.fn()} />);
    expect(screen.getAllByText('Non renseigné').length).toBeGreaterThan(0);
  });

  it('walks all five steps, toggles a course and a goal, changes the rhythm, then submits', () => {
    const onSubmit = jest.fn();
    render(<AriaSetupWizard cockpit={baseCockpit} saving={false} error={null} onSubmit={onSubmit} />);

    // Step 1 → 2 (full curriculum, read-only)
    goToStep(1);
    expect(screen.getByText(/Voici toutes les matières/)).toBeInTheDocument();

    // Step 2 → 3 (selectable courses)
    goToStep(1);
    const courseButtons = screen.getAllByTestId(/^aria-wizard-course-/);
    expect(courseButtons.length).toBeGreaterThan(0);
    const firstEnabled = courseButtons.find((button) => !button.hasAttribute('disabled'));
    if (firstEnabled) {
      fireEvent.click(firstEnabled); // toggles off (the fixture pins it by default)
      fireEvent.click(firstEnabled); // toggles back on — exercises the add branch too
    }

    // Step 3 → 4 (rhythm)
    goToStep(1);
    fireEvent.click(screen.getByRole('button', { name: '300 min' }));
    const input = screen.getByLabelText(/Combien de temps/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '210' } });
    expect(input.value).toBe('210');

    // Step 4 → 5 (goals) — the fixture starts with PREPARER_BAC and
    // CONSOLIDER_LACUNES already selected; add a third, not-yet-selected goal.
    goToStep(1);
    fireEvent.click(screen.getByTestId('aria-wizard-goal-ENTRAINEMENT_REGULIER'));
    expect(screen.getByTestId('aria-wizard-goal-ENTRAINEMENT_REGULIER')).toHaveTextContent(
      "M'entraîner régulièrement",
    );
    // CONSOLIDER_LACUNES is pre-selected by the fixture — toggling it off
    // exercises the goal-removal branch too.
    fireEvent.click(screen.getByTestId('aria-wizard-goal-CONSOLIDER_LACUNES'));

    fireEvent.click(screen.getByTestId('aria-wizard-submit'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        weeklyGoalMinutes: 210,
        learningGoals: ['PREPARER_BAC', 'ENTRAINEMENT_REGULIER'],
        completeOnboarding: true,
      }),
    );
  });

  it('can navigate back to a previous step', () => {
    render(<AriaSetupWizard cockpit={baseCockpit} saving={false} error={null} onSubmit={jest.fn()} />);
    goToStep(1);
    expect(screen.getByText(/Voici toutes les matières/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retour/ }));
    expect(screen.getByText('Ces informations sont gérées par l’équipe Nexus. ARIA les lit sans jamais les modifier.')).toBeInTheDocument();
  });

  it('shows the saving label and disables submit while saving', () => {
    render(<AriaSetupWizard cockpit={baseCockpit} saving error={null} onSubmit={jest.fn()} />);
    goToStep(4);
    expect(screen.getByTestId('aria-wizard-submit')).toBeDisabled();
    expect(screen.getByTestId('aria-wizard-submit')).toHaveTextContent('Enregistrement…');
  });

  it('shows a server error message', () => {
    render(<AriaSetupWizard cockpit={baseCockpit} saving={false} error="Enregistrement impossible" onSubmit={jest.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Enregistrement impossible');
  });
});
