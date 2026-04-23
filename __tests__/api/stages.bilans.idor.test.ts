/**
 * Stage Bilans API — IDOR/Ownership Tests (LOT 9.1)
 *
 * Tests réels d'isolation des ressources :
 * - Coach ne peut accéder qu'aux stages qui lui sont assignés
 * - Admin/Assistante peuvent accéder à tous les stages
 * - Pas de fuite de bilans entre stages
 *
 * Ces tests DOIVENT échouer avant correction des routes
 * Objectif : preuve de non-régression future
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/stages/[stageSlug]/bilans/route';

// Mock minimal - uniquement auth, pas Prisma (on veut tester les vraies requêtes)
jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

// Prisma est mocké globalement dans jest.setup.js
// Mais on configure les retours spécifiques pour chaque test
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const mockAuth = auth as jest.Mock;

// Helper pour créer des requêtes
function makeGetRequest(stageSlug: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/stages/${stageSlug}/bilans`, {
    method: 'GET',
  });
}

function makePostRequest(stageSlug: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3000/api/stages/${stageSlug}/bilans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Données de test
const STAGE_ASSIGNED = {
  id: 'stage-assigned-1',
  slug: 'printemps-2026',
  title: 'Stage Printemps 2026',
};

const STAGE_OTHER = {
  id: 'stage-other-1',
  slug: 'ete-2026',
  title: 'Stage Été 2026',
};

const COACH_PROFILE = {
  id: 'coach-profile-1',
  userId: 'coach-user-1',
  pseudonym: 'Coach Test',
};

const COACH_ASSIGNED = {
  id: 'coach-assigned-1',
  stageId: STAGE_ASSIGNED.id,
  coachId: COACH_PROFILE.id,
};

const STUDENT_IN_STAGE = {
  id: 'student-1',
  userId: 'student-user-1',
};

const VALID_BILAN_BODY = {
  studentId: STUDENT_IN_STAGE.id,
  contentEleve: 'Contenu élève test',
  contentParent: 'Contenu parent test',
  scoreGlobal: 15,
  strengths: ['Analyse'],
  areasForGrowth: ['Géométrie'],
};

describe('GET /api/stages/[stageSlug]/bilans — IDOR Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('✅ ADMIN peut accéder à nimporte quel stage (GET)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
    });

    // Prisma mocks
    (prisma.stage.findUnique as jest.Mock).mockResolvedValue(STAGE_OTHER);
    (prisma.stageBilan.findMany as jest.Mock).mockResolvedValue([]);

    const params = Promise.resolve({ stageSlug: STAGE_OTHER.slug });
    const res = await GET(makeGetRequest(STAGE_OTHER.slug), { params });

    expect(res.status).toBe(200);
    // Admin n'a pas besoin d'être assigné au stage
    expect(prisma.stageCoach.findFirst).not.toHaveBeenCalled();
  });

  it('✅ ASSISTANTE peut accéder à nimporte quel stage (GET)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', email: 'assistant@test.com' },
    });

    (prisma.stage.findUnique as jest.Mock).mockResolvedValue(STAGE_OTHER);
    (prisma.stageBilan.findMany as jest.Mock).mockResolvedValue([]);

    const params = Promise.resolve({ stageSlug: STAGE_OTHER.slug });
    const res = await GET(makeGetRequest(STAGE_OTHER.slug), { params });

    expect(res.status).toBe(200);
  });

  it('🔴 COACH ne peut PAS accéder à un stage non assigné (GET) — DOIT ÉCHOULER AVANT CORRECTION', async () => {
    mockAuth.mockResolvedValue({
      user: { id: COACH_PROFILE.userId, role: 'COACH', email: 'coach@test.com' },
    });

    // Le coach est assigné à STAGE_ASSIGNED, pas à STAGE_OTHER
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(COACH_PROFILE);
    (prisma.stageCoach.findFirst as jest.Mock).mockResolvedValue(null); // Pas assigné
    (prisma.stage.findUnique as jest.Mock).mockResolvedValue(STAGE_OTHER);

    const params = Promise.resolve({ stageSlug: STAGE_OTHER.slug });
    const res = await GET(makeGetRequest(STAGE_OTHER.slug), { params });

    // APRÈS CORRECTION: attendu 403
    // AVANT CORRECTION: la route retourne 200 (faille IDOR)
    const body = await res.json();

    // Ce test documente le comportement actuel (faille) vs attendu (sécurisé)
    if (res.status === 200) {
      console.log('🔴 FAILLE IDOR CONFIRMÉE: Coach a accès à stage non assigné');
    }

    // On s'attend à ce que la route soit corrigée pour retourner 403
    expect(res.status).toBe(403);
    expect(body.error).toContain('assigné');
  });

  it('✅ COACH peut accéder à son stage assigné (GET)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: COACH_PROFILE.userId, role: 'COACH', email: 'coach@test.com' },
    });

    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(COACH_PROFILE);
    (prisma.stageCoach.findFirst as jest.Mock).mockResolvedValue(COACH_ASSIGNED);
    (prisma.stage.findUnique as jest.Mock).mockResolvedValue(STAGE_ASSIGNED);
    (prisma.stageBilan.findMany as jest.Mock).mockResolvedValue([]);

    const params = Promise.resolve({ stageSlug: STAGE_ASSIGNED.slug });
    const res = await GET(makeGetRequest(STAGE_ASSIGNED.slug), { params });

    expect(res.status).toBe(200);
  });

  it('🔴 COACH tente accès stage inexistant — DOIT retourner 404', async () => {
    mockAuth.mockResolvedValue({
      user: { id: COACH_PROFILE.userId, role: 'COACH', email: 'coach@test.com' },
    });

    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(COACH_PROFILE);
    (prisma.stage.findUnique as jest.Mock).mockResolvedValue(null);

    const params = Promise.resolve({ stageSlug: 'stage-inexistant' });
    const res = await GET(makeGetRequest('stage-inexistant'), { params });

    expect(res.status).toBe(404);
  });

  it('🔴 ELEVE ne peut PAS accéder aux bilans stage (GET) — 403', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'eleve-1', role: 'ELEVE', email: 'eleve@test.com' },
    });

    const params = Promise.resolve({ stageSlug: STAGE_ASSIGNED.slug });
    const res = await GET(makeGetRequest(STAGE_ASSIGNED.slug), { params });

    expect(res.status).toBe(403);
  });

  it('🔴 PARENT ne peut PAS accéder aux bilans stage (GET) — 403', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', email: 'parent@test.com' },
    });

    const params = Promise.resolve({ stageSlug: STAGE_ASSIGNED.slug });
    const res = await GET(makeGetRequest(STAGE_ASSIGNED.slug), { params });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/stages/[stageSlug]/bilans — IDOR Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('🔴 COACH ne peut PAS créer bilan dans stage non assigné (POST) — DOIT ÉCHOULER', async () => {
    mockAuth.mockResolvedValue({
      user: { id: COACH_PROFILE.userId, role: 'COACH', email: 'coach@test.com' },
    });

    // Coach assigné à STAGE_ASSIGNED, tente de créer dans STAGE_OTHER
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(COACH_PROFILE);
    (prisma.stageCoach.findFirst as jest.Mock).mockResolvedValue(null); // Pas assigné à stage-other
    (prisma.stage.findUnique as jest.Mock).mockResolvedValue(STAGE_OTHER);

    const params = Promise.resolve({ stageSlug: STAGE_OTHER.slug });
    const res = await POST(makePostRequest(STAGE_OTHER.slug, VALID_BILAN_BODY), { params });

    // AVANT CORRECTION: 200 (faille IDOR)
    // APRÈS CORRECTION: 403
    if (res.status === 200) {
      console.log('🔴 FAILLE IDOR CONFIRMÉE: Coach peut créer bilan dans stage non assigné');
    }

    expect(res.status).toBe(403);
  });

  it('✅ COACH peut créer bilan dans son stage assigné (POST)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: COACH_PROFILE.userId, role: 'COACH', email: 'coach@test.com' },
    });

    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(COACH_PROFILE);
    (prisma.stageCoach.findFirst as jest.Mock).mockResolvedValue(COACH_ASSIGNED);
    (prisma.stage.findUnique as jest.Mock).mockResolvedValue(STAGE_ASSIGNED);
    // Vérification que l'élève est dans le stage
    (prisma.stageReservation.findFirst as jest.Mock).mockResolvedValue({
      id: 'reservation-1',
      stageId: STAGE_ASSIGNED.id,
      studentId: VALID_BILAN_BODY.studentId,
      richStatus: 'CONFIRMED',
    });
    (prisma.stageBilan.upsert as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      isPublished: false,
    });

    const params = Promise.resolve({ stageSlug: STAGE_ASSIGNED.slug });
    const res = await POST(makePostRequest(STAGE_ASSIGNED.slug, VALID_BILAN_BODY), { params });

    expect(res.status).toBe(200);
    expect(prisma.stageBilan.upsert).toHaveBeenCalled();
  });

  it('✅ ADMIN peut créer bilan dans nimporte quel stage (POST)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
    });

    (prisma.stage.findUnique as jest.Mock).mockResolvedValue(STAGE_OTHER);
    // ADMIN a besoin d'un coach assigné au stage pour créer le bilan
    (prisma.stageCoach.findFirst as jest.Mock).mockResolvedValue({
      id: 'stage-coach-1',
      coachId: 'coach-id-1',
    });
    // Vérification que l'élève est dans le stage
    (prisma.stageReservation.findFirst as jest.Mock).mockResolvedValue({
      id: 'reservation-1',
      stageId: STAGE_OTHER.id,
      studentId: VALID_BILAN_BODY.studentId,
      richStatus: 'CONFIRMED',
    });
    (prisma.stageBilan.upsert as jest.Mock).mockResolvedValue({
      id: 'bilan-2',
      isPublished: true,
    });

    const params = Promise.resolve({ stageSlug: STAGE_OTHER.slug });
    const res = await POST(makePostRequest(STAGE_OTHER.slug, VALID_BILAN_BODY), { params });

    expect(res.status).toBe(200);
  });

  it('✅ ASSISTANTE peut créer bilan dans nimporte quel stage (POST)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', email: 'assistant@test.com' },
    });

    (prisma.stage.findUnique as jest.Mock).mockResolvedValue(STAGE_OTHER);
    // ASSISTANTE a besoin d'un coach assigné au stage pour créer le bilan
    (prisma.stageCoach.findFirst as jest.Mock).mockResolvedValue({
      id: 'stage-coach-1',
      coachId: 'coach-id-1',
    });
    // Vérification que l'élève est dans le stage
    (prisma.stageReservation.findFirst as jest.Mock).mockResolvedValue({
      id: 'reservation-1',
      stageId: STAGE_OTHER.id,
      studentId: VALID_BILAN_BODY.studentId,
      richStatus: 'CONFIRMED',
    });
    (prisma.stageBilan.upsert as jest.Mock).mockResolvedValue({
      id: 'bilan-3',
      isPublished: false,
    });

    const params = Promise.resolve({ stageSlug: STAGE_OTHER.slug });
    const res = await POST(makePostRequest(STAGE_OTHER.slug, VALID_BILAN_BODY), { params });

    expect(res.status).toBe(200);
  });

  it('🔴 Validation: studentId manquant → 400', async () => {
    mockAuth.mockResolvedValue({
      user: { id: COACH_PROFILE.userId, role: 'COACH', email: 'coach@test.com' },
    });

    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(COACH_PROFILE);
    (prisma.stageCoach.findFirst as jest.Mock).mockResolvedValue(COACH_ASSIGNED);
    (prisma.stage.findUnique as jest.Mock).mockResolvedValue(STAGE_ASSIGNED);

    const params = Promise.resolve({ stageSlug: STAGE_ASSIGNED.slug });
    const invalidBody = { ...VALID_BILAN_BODY, studentId: undefined };
    const res = await POST(makePostRequest(STAGE_ASSIGNED.slug, invalidBody), { params });

    expect(res.status).toBe(400);
  });
});

describe('Edge Cases — Traversée de ressources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('🔴 Coach A tente accès aux bilans du stage du Coach B — DOIT être bloqué', async () => {
    const COACH_A = { id: 'coach-a-profile', userId: 'coach-a-user', pseudonym: 'Coach A' };
    const COACH_B = { id: 'coach-b-profile', userId: 'coach-b-user', pseudonym: 'Coach B' };
    const STAGE_B = { id: 'stage-b', slug: 'stage-coach-b', title: 'Stage Coach B' };

    // Coach A est authentifié
    mockAuth.mockResolvedValue({
      user: { id: COACH_A.userId, role: 'COACH', email: 'coach-a@test.com' },
    });

    // Coach A n'est pas assigné au stage de Coach B
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(COACH_A);
    (prisma.stageCoach.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.stage.findUnique as jest.Mock).mockResolvedValue(STAGE_B);

    const params = Promise.resolve({ stageSlug: STAGE_B.slug });
    const res = await GET(makeGetRequest(STAGE_B.slug), { params });

    // AVANT CORRECTION: 200 (Coach A voit les bilans de Coach B !)
    // APRÈS CORRECTION: 403
    if (res.status === 200) {
      console.log('🔴 FAILLE TRAVERSALE: Coach A accède au stage de Coach B');
    }

    expect(res.status).toBe(403);
  });

  it('🔴 Tentative enumeration stageSlug par coach non assigné — DOIT être bloquée', async () => {
    const COACH_UNASSIGNED = { id: 'coach-unassigned', userId: 'coach-unassigned-user', pseudonym: 'Coach Unassigned' };

    mockAuth.mockResolvedValue({
      user: { id: COACH_UNASSIGNED.userId, role: 'COACH', email: 'coach-unassigned@test.com' },
    });

    // Le coach n'est assigné à aucun stage
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(COACH_UNASSIGNED);
    (prisma.stageCoach.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.stage.findUnique as jest.Mock).mockResolvedValue({
      id: 'some-stage',
      slug: 'some-stage-slug',
      title: 'Some Stage',
    });

    const params = Promise.resolve({ stageSlug: 'some-stage-slug' });
    const res = await GET(makeGetRequest('some-stage-slug'), { params });

    expect(res.status).toBe(403);
  });
});
