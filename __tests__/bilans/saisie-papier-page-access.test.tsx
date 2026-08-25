import '@testing-library/jest-dom';

import { render, screen, within } from '@testing-library/react';

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
const MCO_FLAG = 'NEXUS_BILAN_PACK_ENTREE_TERMINALE_MATHS_COMPLEMENTAIRES_V1_ENABLED';

describe('Écran assistante de saisie papier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);
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
    const progress = screen.getByRole('list', { name: 'Progression de la saisie papier' });
    expect(within(progress).getByText('Créer ou sélectionner le foyer').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('rend l’étape 2 atteignable après une recherche', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    render(await SaisiePapierPage({ searchParams: Promise.resolve({ q: 'Ben Salah' }) }));

    const progress = screen.getByRole('list', { name: 'Progression de la saisie papier' });
    expect(within(progress).getByText('Ajouter ou sélectionner l’enfant').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('link', { name: '← Revenir au choix du foyer' })).toHaveAttribute(
      'href',
      '/dashboard/assistante/bilans/saisie-papier',
    );
  });

  it('tokenise prénom et nom pour retrouver une identité complète', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    render(await SaisiePapierPage({ searchParams: Promise.resolve({ q: 'Élise Ben Salah' }) }));

    const query = (prisma.student.findMany as jest.Mock).mock.calls[0][0].where;
    expect(query.AND).toHaveLength(4);
    for (const token of ['Élise', 'Ben', 'Salah']) {
      expect(JSON.stringify(query)).toContain(`\"contains\":\"${token}\"`);
    }
  });

  it('recherche aussi un foyer par téléphone parent', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    render(await SaisiePapierPage({ searchParams: Promise.resolve({ q: '99192829' }) }));

    const query = (prisma.student.findMany as jest.Mock).mock.calls[0][0].where;
    expect(query.AND[1].OR).toEqual(expect.arrayContaining([
      { parent: { user: { phone: { contains: '99192829' } } } },
      { parent: { user: { phoneNormalized: { contains: '99192829' } } } },
    ]));
  });

  it('retire des résultats un foyer synthétique même si la base le renvoie', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    (prisma.student.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'student-real', gradeLevel: 'SECONDE',
        user: { firstName: 'Élise', lastName: 'Ben Salah', email: 'elise@nexus-student.local' },
        parent: { user: { email: 'famille@gmail.com' } },
      },
      {
        id: 'student-test', gradeLevel: 'SECONDE',
        user: { firstName: 'Smoke', lastName: 'Test', email: 'student-smoke@nexus-student.local' },
        parent: { user: { email: 'famille@gmail.com' } },
      },
    ]);

    render(await SaisiePapierPage({ searchParams: Promise.resolve({ q: 'famille' }) }));

    expect(screen.getByText('Élise Ben Salah')).toBeInTheDocument();
    expect(screen.queryByText('Smoke Test')).not.toBeInTheDocument();
    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.any(Array) }),
    }));
  });

  it('refuse aussi une sélection directe synthétique malgré un résultat DB inattendu', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({
      id: 'student-test', gradeLevel: 'SECONDE',
      user: { firstName: 'DO NOT USE', lastName: 'Test', email: 'student@nexus-student.local' },
      parent: { user: { email: 'parent-technique@nexusreussite.academy' } },
    });

    render(await SaisiePapierPage({ searchParams: Promise.resolve({ studentId: 'student-test' }) }));

    expect(screen.queryByText('DO NOT USE Test')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Créer ou sélectionner le foyer' })).toBeInTheDocument();
  });

  it('propose « Absente de la copie » pour chacune des 18 questions MCO', async () => {
    const previousFlag = process.env[MCO_FLAG];
    process.env[MCO_FLAG] = 'true';
    try {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-mco', role: 'ASSISTANTE' } });
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 'student-mco',
        gradeLevel: 'TERMINALE',
        user: {
          firstName: 'Élève',
          lastName: 'MCO',
          email: 'eleve-mco@nexus-student.local',
        },
        parent: { user: { email: 'famille-mco@nexus-famille.local' } },
      });

      render(await SaisiePapierPage({
        searchParams: Promise.resolve({
          studentId: 'student-mco',
          packSlug: 'entree-terminale-maths-complementaires-v1',
        }),
      }));

      expect(screen.getByText('Terminale · Mathématiques complémentaires')).toBeInTheDocument();
      expect(screen.getAllByRole('radio', { name: 'Absente de la copie' })).toHaveLength(18);
    } finally {
      if (previousFlag === undefined) delete process.env[MCO_FLAG];
      else process.env[MCO_FLAG] = previousFlag;
    }
  });
});
