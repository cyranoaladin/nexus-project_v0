import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';

import { PaperEntryGrid } from '@/components/bilans/PaperEntryGrid';
import { PaperEntryWorkflowSteps } from '@/components/bilans/PaperEntryWorkflowSteps';

describe('Fil guidé de saisie papier', () => {
  it('affiche les cinq étapes et l’étape courante', () => {
    render(<PaperEntryWorkflowSteps currentStep={3} />);

    expect(screen.getByRole('list', { name: 'Progression de la saisie papier' })).toBeInTheDocument();
    for (const label of [
      'Créer ou sélectionner le foyer',
      'Ajouter ou sélectionner l’enfant',
      'Choisir la matière',
      'Saisir les réponses',
      'Valider',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Choisir la matière').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('rend l’état de saisie visible et nomme explicitement la validation', () => {
    render(
      <PaperEntryGrid
        studentId="student-1"
        studentName="Élève Test"
        packSlug="entree-seconde-maths-v1"
        packTitle="Entrée en Seconde · Mathématiques"
        items={[{
          id: 'q1',
          position: 1,
          prompt: 'Question test',
          options: [{ id: 'A', label: 'Réponse A' }],
        }]}
      />,
    );

    expect(screen.getByText('0 réponse sur 1 saisie')).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]);
    fireEvent.click(radios[4]);
    expect(screen.getByText('1 réponse sur 1 saisie')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valider la saisie papier' })).toBeEnabled();
  });
});
