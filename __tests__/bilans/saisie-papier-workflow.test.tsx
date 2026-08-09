import '@testing-library/jest-dom';

import { act, fireEvent, render, screen } from '@testing-library/react';

const replace = jest.fn();
const refresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

import { PaperEntryGrid } from '@/components/bilans/PaperEntryGrid';
import { PaperEntryStudentSearch } from '@/components/bilans/PaperEntryStudentSearch';
import { PaperEntryWorkflowSteps } from '@/components/bilans/PaperEntryWorkflowSteps';

describe('Fil guidé de saisie papier', () => {
  it('affiche les cinq étapes et l’étape courante', () => {
    render(<PaperEntryWorkflowSteps currentStep={3} stepHrefs={{ 1: '/foyers', 2: '/enfants' }} />);

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
    expect(screen.getByRole('link', { name: /Créer ou sélectionner le foyer/ })).toHaveAttribute('href', '/foyers');
    expect(screen.getByRole('link', { name: /Ajouter ou sélectionner l’enfant/ })).toHaveAttribute('href', '/enfants');
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
    expect(screen.getByText('Saisir les réponses').closest('li')).toHaveAttribute('aria-current', 'step');
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]);
    fireEvent.click(radios[4]);
    expect(screen.getByText('1 réponse sur 1 saisie')).toBeInTheDocument();
    expect(screen.getByText('Valider').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('link', { name: /Choisir la matière/ })).toHaveAttribute(
      'href',
      '/dashboard/assistante/bilans/saisie-papier?studentId=student-1',
    );
    expect(screen.getByRole('button', { name: 'Valider la saisie papier' })).toBeEnabled();
  });

  it('actualise la recherche après un court délai tout en gardant un envoi GET', () => {
    jest.useFakeTimers();
    render(<PaperEntryStudentSearch initialQuery="" />);

    const input = screen.getByRole('searchbox', { name: 'Rechercher un foyer ou un enfant' });
    fireEvent.change(input, { target: { value: 'Ben Salah' } });
    expect(replace).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(300); });

    expect(replace).toHaveBeenCalledWith(
      '/dashboard/assistante/bilans/saisie-papier?q=Ben+Salah',
    );
    expect(screen.getByRole('button', { name: 'Rechercher' })).toHaveAttribute('type', 'submit');
    jest.useRealTimers();
  });
});
