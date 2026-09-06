import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CandidateProfileForm } from '@/components/dashboard/assistante/CandidateProfileForm';
import fs from 'node:fs';
import path from 'node:path';
afterEach(() => jest.restoreAllMocks());
function fill() {
 for (const [label, value] of Object.entries({ 'Niveau': 'TERMINALE', 'Session du bac': '2027', 'Modalité déclarée': 'A', 'Spécialité 1': 'MATHEMATIQUES', 'Spécialité 2': 'NSI', 'Redoublant': 'true', 'Bac déjà obtenu': 'false', 'Changement de spécialité': 'false', 'Objectif': 'true' })) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
 }
}
it('requires explicit facts and posts one student link to the canonical endpoint', async () => {
 const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ id: 'profile-1' }) } as Response);
 render(<CandidateProfileForm studentId="student-1" sessions={[2026, 2027]} />);
 expect(screen.getByRole('button', { name: 'Enregistrer le profil' })).toBeDisabled();
 fill();
 fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
 await screen.findByRole('status');
 expect(fetchMock).toHaveBeenCalledWith('/api/assistante/candidate-profiles', expect.objectContaining({ method: 'POST' }));
 expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ studentId: 'student-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', estRedoublant: true, estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionCycleComplet: true });
 expect(screen.getByRole('button', { name: 'Enregistrer le profil' })).toBeDisabled();
});
it('revises an existing canonical profile without creating a second root or relinking', async () => {
 const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ id: 'revision-2' }) } as Response);
 render(<CandidateProfileForm studentId="student-1" sessions={[2027]} initialProfile={{ id: 'profile-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', estRedoublant: true, estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionCycleComplet: true }} />);
 fireEvent.click(screen.getByRole('button', { name: 'Enregistrer une révision' }));
 await waitFor(() => expect(fetchMock).toHaveBeenCalled());
 expect(fetchMock.mock.calls[0][0]).toBe('/api/assistante/candidate-profiles/profile-1');
 expect(fetchMock.mock.calls[0][1]?.method).toBe('PATCH');
 expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).not.toHaveProperty('studentId');
});
it('does not silently retry an ambiguous creation', async () => {
 jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network'));
 render(<CandidateProfileForm studentId="student-1" sessions={[2027]} />);
 fill(); fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
 expect(await screen.findByRole('alert')).toHaveTextContent('Vérifiez le dossier');
 expect(screen.getByRole('button', { name: 'Enregistrer le profil' })).toBeDisabled();
});
it('both family entrypoints target the existing student candidate page', () => {
 for (const file of ['components/dashboard/assistante/FamilyForm.tsx', 'app/dashboard/assistante/students/[studentId]/page.tsx']) {
  const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  expect(source).not.toContain('/dashboard/assistante/candidat-individuel?');
  expect(source).toMatch(/\/dashboard\/assistante\/students\/\$\{[^}]+\}\/candidat/);
 }
});
it('clears the anticipated-only objective when the level changes to Terminale', () => {
 render(<CandidateProfileForm studentId="student-1" sessions={[2027]} />);
 fireEvent.change(screen.getByLabelText('Niveau'), { target: { value: 'PREMIERE' } });
 fireEvent.change(screen.getByLabelText('Objectif'), { target: { value: 'false' } });
 fireEvent.change(screen.getByLabelText('Niveau'), { target: { value: 'TERMINALE' } });
 expect(screen.getByLabelText('Objectif')).toHaveValue('');
 expect(screen.queryByRole('option', { name: 'Épreuves anticipées uniquement' })).not.toBeInTheDocument();
});
