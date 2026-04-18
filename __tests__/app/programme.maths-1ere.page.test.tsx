import { render, screen } from '@testing-library/react';

import MathsPremierePage from '@/app/programme/maths-1ere/page';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

jest.mock('@/app/programme/maths-1ere/components/MathJaxProvider', () => ({
  MathJaxProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/app/programme/maths-1ere/components/MathsRevisionClient', () => ({
  __esModule: true,
  default: ({ user }: { user: { id: string; name?: string } }) => (
    <div data-testid="maths-revision-client">
      {user.id}:{user.name ?? 'unknown'}
    </div>
  ),
}));

jest.mock('next/navigation', () => {
  const actual = jest.requireActual('next/navigation');
  return {
    ...actual,
    redirect: jest.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
  };
});

const mockAuth = auth as unknown as jest.Mock;
const mockRedirect = redirect as unknown as jest.Mock;
const mockPrismaStudentFindUnique = prisma.student.findUnique as unknown as jest.Mock;

describe('MathsPremierePage access control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects unauthenticated users to signin with callback', async () => {
    mockAuth.mockResolvedValue(null);

    await expect(MathsPremierePage()).rejects.toThrow(
      'NEXT_REDIRECT:/auth/signin?callbackUrl=%2Fprogramme%2Fmaths-1ere'
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      '/auth/signin?callbackUrl=%2Fprogramme%2Fmaths-1ere'
    );
  });

  it('renders for a Premiere student', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'student-1',
        role: 'ELEVE',
        firstName: 'Nour',
        name: 'Nour Example',
      },
    });
    mockPrismaStudentFindUnique.mockResolvedValue({ grade: 'Première' });

    render(await MathsPremierePage());

    expect(screen.getByTestId('maths-revision-client')).toHaveTextContent('student-1:Nour');
    expect(mockPrismaStudentFindUnique).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      select: { grade: true },
    });
  });

  it('redirects a non-Premiere student to the student dashboard', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'student-2',
        role: 'ELEVE',
        firstName: 'Sami',
      },
    });
    mockPrismaStudentFindUnique.mockResolvedValue({ grade: 'Terminale' });

    await expect(MathsPremierePage()).rejects.toThrow('NEXT_REDIRECT:/dashboard/eleve');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard/eleve');
  });

  it.each([
    ['PARENT', '/dashboard/parent'],
    ['ADMIN', '/dashboard/admin'],
    ['ASSISTANTE', '/dashboard/assistante'],
    ['COACH', '/dashboard/coach'],
  ])('renders for %s without looking up a student profile', async (role) => {
    mockAuth.mockResolvedValue({
      user: {
        id: `${role.toLowerCase()}-1`,
        role,
        firstName: 'Alex',
      },
    });

    render(await MathsPremierePage());

    expect(screen.getByTestId('maths-revision-client')).toHaveTextContent(`${role.toLowerCase()}-1:Alex`);
    expect(mockPrismaStudentFindUnique).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/dashboard\//)
    );
  });
});
