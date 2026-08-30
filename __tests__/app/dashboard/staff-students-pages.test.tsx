import { render, screen } from '@testing-library/react';

import AdminStudentsPage from '@/app/dashboard/admin/students/page';
import AssistanteStudentsPage from '@/app/dashboard/assistante/students/page';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

jest.mock('@/components/dashboard/staff/StudentsManagementWorkspace', () => ({
  StudentsManagementWorkspace: ({ staffRole, intent }: { staffRole: string; intent?: string }) => (
    <div data-testid="students-workspace" data-role={staffRole} data-intent={intent} />
  ),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const mockAuth = auth as unknown as jest.Mock;
const mockRedirect = redirect as unknown as jest.Mock;

describe('staff students pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the single shared workflow for ADMIN on the admin surface', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });

    render(await AdminStudentsPage({}));

    expect(screen.getByTestId('students-workspace')).toHaveAttribute('data-role', 'ADMIN');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('keeps the assistante surface on the same shared workflow', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'assistante-1', role: 'ASSISTANTE' } });

    render(await AssistanteStudentsPage({}));

    expect(screen.getByTestId('students-workspace')).toHaveAttribute('data-role', 'ASSISTANTE');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it.each([
    ['ADMIN', AdminStudentsPage],
    ['ASSISTANTE', AssistanteStudentsPage],
  ] as const)('transmet uniquement l’intent contextuel fermé pour %s', async (role, page) => {
    mockAuth.mockResolvedValue({ user: { id: `${role.toLowerCase()}-1`, role } });

    const contextual = render(await page({ searchParams: Promise.resolve({ intent: 'candidat-individuel' }) }));
    expect(screen.getByTestId('students-workspace')).toHaveAttribute('data-intent', 'candidat-individuel');
    contextual.unmount();

    render(await page({ searchParams: Promise.resolve({ intent: 'https://evil.example' }) }));
    expect(screen.getByTestId('students-workspace')).not.toHaveAttribute('data-intent');
  });

  it.each([
    ['ASSISTANTE', AdminStudentsPage, '/dashboard/assistante'],
    ['PARENT', AdminStudentsPage, '/dashboard'],
    ['ELEVE', AdminStudentsPage, '/dashboard'],
    ['COACH', AdminStudentsPage, '/dashboard'],
    ['ADMIN', AssistanteStudentsPage, '/dashboard/admin'],
  ] as const)('refuses %s on a role-mismatched surface', async (role, page, target) => {
    mockAuth.mockResolvedValue({ user: { id: `${role.toLowerCase()}-1`, role } });

    await expect(page({})).rejects.toThrow(`NEXT_REDIRECT:${target}`);
  });

  it.each([
    [AdminStudentsPage, '/dashboard/admin/students'],
    [AssistanteStudentsPage, '/dashboard/assistante/students'],
  ] as const)('redirects anonymous access with the exact callback', async (page, callback) => {
    mockAuth.mockResolvedValue(null);

    await expect(page({})).rejects.toThrow(`NEXT_REDIRECT:/auth/signin?callbackUrl=${callback}`);
  });
});
