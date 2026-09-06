import { render, screen } from '@testing-library/react';
import Page from '@/app/dashboard/assistante/students/[studentId]/candidat/page';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCandidateProfileWorkflowStatus } from '@/lib/quotes/candidate-profile-flag';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { student: { findUnique: jest.fn() }, profilCandidat: { findFirst: jest.fn() } } }));
jest.mock('@/lib/quotes/candidate-profile-flag', () => ({ getCandidateProfileWorkflowStatus: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn(() => { throw new Error('REDIRECT'); }), notFound: jest.fn(() => { throw new Error('NOT_FOUND'); }) }));
beforeEach(() => {
 jest.clearAllMocks();
 (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff', role: 'ASSISTANTE' } });
 (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 'child-1', user: { firstName: 'Élève', lastName: 'Test' } });
 (getCandidateProfileWorkflowStatus as jest.Mock).mockResolvedValue('ACTIVE_INTERNAL');
 (prisma.profilCandidat.findFirst as jest.Mock).mockResolvedValue(null);
});
it.each(['PARENT', 'ELEVE', 'COACH'])('refuses %s before reading a student', async role => {
 (auth as jest.Mock).mockResolvedValue({ user: { id: 'nonstaff', role } });
 await expect(Page({ params: Promise.resolve({ studentId: 'child-1' }) })).rejects.toThrow('NOT_FOUND');
 expect(prisma.student.findUnique).not.toHaveBeenCalled();
});
it('does not render a write form or load profiles when the workflow is disabled', async () => {
 (getCandidateProfileWorkflowStatus as jest.Mock).mockResolvedValue('DISABLED');
 render(await Page({ params: Promise.resolve({ studentId: 'child-1' }) }));
 expect(screen.getByText(/n’est pas encore disponible/)).toBeVisible();
 expect(screen.queryByRole('button')).not.toBeInTheDocument();
 expect(prisma.profilCandidat.findFirst).not.toHaveBeenCalled();
});
it('loads only profiles attached to the requested existing student', async () => {
 render(await Page({ params: Promise.resolve({ studentId: 'child-1' }) }));
 expect(prisma.profilCandidat.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { studentId: 'child-1' } }));
 expect(screen.getByRole('button', { name: 'Enregistrer le profil' })).toBeDisabled();
});
it('refuses a nonexistent student', async () => {
 (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);
 await expect(Page({ params: Promise.resolve({ studentId: 'absent' }) })).rejects.toThrow('NOT_FOUND');
 expect(prisma.profilCandidat.findFirst).not.toHaveBeenCalled();
});
