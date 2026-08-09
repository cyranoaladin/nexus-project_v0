import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';

const mockNotFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

jest.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
}));

import { auth } from '@/auth';
import SaisiePapierPage from '@/app/dashboard/assistante/bilans/saisie-papier/page';
import { prisma } from '@/lib/prisma';

const params = Promise.resolve({});

describe('Écran assistante de saisie papier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
  });

  it.each(['PARENT', 'ELEVE'])('reste invisible au rôle %s', async (role) => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role } });
    await expect(SaisiePapierPage({ searchParams: params })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });

  it('affiche le fil guidé à une assistante', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    render(await SaisiePapierPage({ searchParams: params }));

    expect(screen.getByRole('heading', { name: 'Saisir un bilan passé sur copie' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Progression de la saisie papier' })).toBeInTheDocument();
  });
});
