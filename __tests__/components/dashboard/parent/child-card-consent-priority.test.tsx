import { render, screen } from '@testing-library/react';

import { ChildCard } from '@/components/dashboard/parent/ChildCard';

/**
 * Hiérarchie de la carte enfant : le consentement conditionne l'accès aux
 * bilans, il passe AVANT l'invitation à activer le compte élève (qui ne
 * débloque rien). Jamais un enfant affiché avec des bilans muets sans
 * explication.
 */

const child = {
  id: 'student-1',
  firstName: 'Kamel',
  lastName: 'Test',
  email: 'kamel.test@nexus-student.local',
  gradeLevel: 'SECONDE',
  academicTrack: 'EDS_GENERALE',
  activationStatus: 'PENDING_ACTIVATION' as const,
  activationExpiresAt: null,
};

describe('ChildCard — priorité du consentement', () => {
  it('affiche l’appel au consentement AVANT l’invitation d’activation quand l’accord manque', () => {
    render(<ChildCard child={{ ...child, consentState: 'PENDING_PARENT_CONSENT' }} />);

    const consentNotice = screen.getByText(/attendent votre accord/i);
    const activationNotice = screen.getByText(/compte élève à activer/i);
    expect(consentNotice).toBeInTheDocument();
    expect(activationNotice).toBeInTheDocument();
    // Priorité visuelle : le bandeau consentement précède le bloc activation dans le DOM.
    expect(
      consentNotice.compareDocumentPosition(activationNotice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Le bandeau mène à la fiche enfant, où vit la carte de consentement.
    expect(consentNotice.closest('a')).toHaveAttribute('href', '/dashboard/parent/enfant/student-1');
  });

  it('affiche aussi l’appel quand aucun lien n’existe encore (MISSING)', () => {
    render(<ChildCard child={{ ...child, consentState: 'MISSING' }} />);
    expect(screen.getByText(/attendent votre accord/i)).toBeInTheDocument();
  });

  it('masque l’appel une fois le consentement VERIFIED', () => {
    render(<ChildCard child={{ ...child, consentState: 'VERIFIED' }} />);
    expect(screen.queryByText(/attendent votre accord/i)).not.toBeInTheDocument();
  });

  it('reste rétrocompatible quand l’état n’est pas fourni', () => {
    render(<ChildCard child={child} />);
    expect(screen.queryByText(/attendent votre accord/i)).not.toBeInTheDocument();
  });
});

it('propose explicitement les bilans sans indice artificiel', () => {
  render(<ChildCard child={{ ...child, consentState: 'VERIFIED' }} />);
  expect(screen.getByRole('link', { name: /Voir les bilans et le suivi/i })).toHaveAttribute('href', '/dashboard/parent/enfant/student-1');
  expect(screen.queryByText('NexusIndex')).not.toBeInTheDocument();
});
