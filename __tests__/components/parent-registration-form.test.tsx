import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ParentRegistrationForm } from '@/components/dashboard/parent/ParentRegistrationForm';
const data = { revision: 'a'.repeat(64),
  firstName: 'Parent', lastName: 'Test', phone: '20 00 00 01', email: null, completedAt: null,
  children: [{ id: 'child-1', firstName: 'Élève', lastName: 'Test', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', school: null, schoolingStatus: 'INDIVIDUAL', consentVerified: false }],
};
describe('family registration confirmation', () => {
  it('does not preselect confirmation or pedagogical consent', () => {
    render(<ParentRegistrationForm data={data} onSubmit={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Confirmer mon dossier' })).toBeDisabled();
    for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeChecked();
    expect(screen.queryByLabelText(/mot de passe/i)).not.toBeInTheDocument();
  });
  it('permits completion without optional bilan consent', async () => {
    const submit = jest.fn().mockResolvedValue(undefined);
    render(<ParentRegistrationForm data={data} onSubmit={submit} />);
    fireEvent.click(screen.getByLabelText(/Je confirme les informations de/));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mon dossier' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ revision: data.revision, firstName: 'Parent', lastName: 'Test', children: [{ studentId: 'child-1', confirmed: true }], consentStudentIds: [] }));
  });
  it('shows a recoverable error without a success state when saving fails', async () => {
    render(<ParentRegistrationForm data={data} onSubmit={jest.fn().mockRejectedValue(new Error('Le dossier a changé. Rechargez la page.'))} />);
    fireEvent.click(screen.getByLabelText(/Je confirme les informations de/));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mon dossier' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Le dossier a changé');
    expect(screen.getByRole('button', { name: 'Confirmer mon dossier' })).toBeEnabled();
  });
});
