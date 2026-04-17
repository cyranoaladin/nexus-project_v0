jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$12$temp-pass'),
}));

import { auth } from '@/auth';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route';
import { sendMail } from '@/lib/email/mailer';

const mockAuth = auth as jest.Mock;
const mockSendMail = sendMail as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
  process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';
});

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/stages/printemps-2026/reservations/res-1/confirm', {
    method: 'POST',
  });
}

function session(role: string) {
  return {
    user: {
      id: 'user-1',
      email: 'staff@nexus.test',
      role,
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

const params = Promise.resolve({ stageSlug: 'printemps-2026', reservationId: 'res-1' });

const baseReservation = {
  id: 'res-1',
  email: 'eleve@example.com',
  parentName: 'Parent Example',
  studentName: 'Eleve Example',
  richStatus: 'PENDING',
  stage: { title: 'Printemps 2026' },
};

describe('POST /api/stages/[slug]/reservations/[id]/confirm', () => {
  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST(makeRequest(), { params });

    expect(res.status).toBe(401);
  });

  it('retourne 403 si rôle insuffisant (ELEVE, PARENT, COACH)', async () => {
    mockAuth.mockResolvedValue(session('ELEVE'));

    const res = await POST(makeRequest(), { params });

    expect(res.status).toBe(403);
  });

  it('retourne 404 si réservation introuvable', async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));
    prisma.stageReservation.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(), { params });

    expect(res.status).toBe(404);
  });

  it('retourne 409 si réservation déjà CONFIRMED', async () => {
    mockAuth.mockResolvedValue(session('ADMIN'));
    prisma.stageReservation.findUnique.mockResolvedValue({
      ...baseReservation,
      richStatus: 'CONFIRMED',
    });

    const res = await POST(makeRequest(), { params });

    expect(res.status).toBe(409);
  });

  it('confirme la réservation et met à jour le statut', async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));
    prisma.stageReservation.findUnique.mockResolvedValue(baseReservation);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-existing',
      email: 'eleve@example.com',
    });
    prisma.stageReservation.update.mockResolvedValue({});

    const res = await POST(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.stageReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-1' },
        data: expect.objectContaining({
          richStatus: 'CONFIRMED',
          status: 'CONFIRMED',
          activationToken: expect.any(String),
          activationTokenExpiresAt: expect.any(Date),
        }),
      })
    );
  });

  it('crée un User ELEVE si email inexistant', async () => {
    mockAuth.mockResolvedValue(session('ADMIN'));
    prisma.stageReservation.findUnique.mockResolvedValue(baseReservation);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-created',
      email: 'eleve@example.com',
    });
    prisma.stageReservation.update.mockResolvedValue({});

    await POST(makeRequest(), { params });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'eleve@example.com',
          role: 'ELEVE',
        }),
      })
    );
  });

  it('ne crée pas de doublon User si email déjà existant', async () => {
    mockAuth.mockResolvedValue(session('ADMIN'));
    prisma.stageReservation.findUnique.mockResolvedValue(baseReservation);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-existing',
      email: 'eleve@example.com',
    });
    prisma.stageReservation.update.mockResolvedValue({});

    await POST(makeRequest(), { params });

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('génère un activationToken + expiry 72h', async () => {
    mockAuth.mockResolvedValue(session('ADMIN'));
    prisma.stageReservation.findUnique.mockResolvedValue(baseReservation);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-existing',
      email: 'eleve@example.com',
    });
    prisma.stageReservation.update.mockResolvedValue({});

    await POST(makeRequest(), { params });

    const updateCall = prisma.stageReservation.update.mock.calls[0][0];
    expect(updateCall.data.activationToken).toEqual(expect.any(String));
    expect(updateCall.data.activationTokenExpiresAt).toBeInstanceOf(Date);
    expect(updateCall.data.activationTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("envoie l'email de confirmation avec lien d'activation", async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));
    prisma.stageReservation.findUnique.mockResolvedValue(baseReservation);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-existing',
      email: 'eleve@example.com',
    });
    prisma.stageReservation.update.mockResolvedValue({});

    await POST(makeRequest(), { params });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'eleve@example.com',
        subject: expect.stringContaining('Printemps 2026'),
        html: expect.stringContaining('/auth/activate?token='),
      })
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('source=stage'),
      })
    );
  });
});
