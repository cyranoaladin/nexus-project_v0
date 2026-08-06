import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import {
  buildStaffGroupPlanDocument,
  listStaffGroupPlanCandidates,
  StaffGroupPlanError,
} from '@/lib/bilans/staff/group-plan-service';

const NODE_IDS = Array.from({ length: 9 }, (_, index) => `2de.maths.node-${index + 1}`);

function factSheet(alias: string): FactSheet {
  return {
    engineVersion: '1.0.1', bankSlug: 'entree-premiere-maths-v1', bankVersion: 1,
    student: { alias, level: 'PREMIERE' }, globalScore: 50, coverage: 1, calibrationIndex: null,
    domains: [{ id: 'maths', score: 50, profile: 'MAITRISE_FRAGILE' }], flags: [], groupBand: 'RENFORCEMENT',
    nodes: NODE_IDS.map((nodeCpsId, index) => ({
      nodeCpsId, profile: index === 0 ? 'ERREUR_CONFIANTE' : 'MAITRISE_FRAGILE',
      criticality: 1, nodeScore: index === 0 ? 0 : 0.5, confidenceMean: 3,
      answeredCount: 2, itemCount: 2, itemIds: [`item-${index + 1}`], priorityRank: index + 1,
    })),
  };
}

function row(id: string, displayName: string, slug = 'entree-premiere-maths-v1') {
  return {
    id, assessmentPackId: slug, assessmentPackVersion: '1', status: 'REPORT_PENDING_REVIEW',
    displayName, factSheet: factSheet(`ELEVE_${id.toUpperCase()}`),
  } as const;
}

const catalog = {
  schemaVersion: 'nexus-cps-catalog/v1' as const,
  slug: '2de-maths-vers-premiere', version: 1,
  nodes: NODE_IDS.map((id, index) => ({
    id, label: `Nœud ${index + 1}`, sourceLevel: 'SECONDE' as const,
    targetLevel: 'PREMIERE' as const, sequenceOrder: index + 1, pedagogicalRationale: 'Prérequis de test.',
  })),
};

function dependencies(rows = [row('a', 'Aïcha'), row('b', 'Bilel'), row('c', 'Cyrine')]) {
  return {
    findCoach: jest.fn(async () => ({ id: 'coach-1' })),
    listCandidates: jest.fn(async () => rows),
    findAttempts: jest.fn(async () => rows),
    resolvePack: jest.fn(() => ({ pack: { slug: 'entree-premiere-maths-v1', version: 1, level: 'PREMIERE', subject: 'MATHS' } })),
    loadCatalog: jest.fn(() => catalog),
    renderHtml: jest.fn((plan: { students: readonly string[] }) => `<html>${plan.students.join('|')}</html>`),
    renderPdf: jest.fn(async () => ({ status: 'AVAILABLE' as const, html: '<html></html>', pdf: Buffer.from('%PDF-test') })),
    now: () => new Date('2026-08-12T08:00:00.000Z'),
  };
}

describe('A121 staff group-plan surface', () => {
  test('lists only scored attempts assigned to the authenticated coach', async () => {
    const deps = dependencies();
    await expect(listStaffGroupPlanCandidates({ userId: 'user-1', role: 'COACH' }, deps as never))
      .resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'a', displayName: 'Aïcha' })]));
    expect(deps.findCoach).toHaveBeenCalledWith('user-1');
  });

  test('builds an internal HTML plan from three scored attempts of the same pack', async () => {
    const deps = dependencies();
    const result = await buildStaffGroupPlanDocument({
      userId: 'user-1', role: 'COACH', attemptIds: ['a', 'b', 'c'], format: 'html',
    }, deps as never);

    expect(result.contentType).toBe('text/html; charset=utf-8');
    expect(String(result.body)).toContain('Aïcha|Bilel|Cyrine');
    expect(deps.loadCatalog).toHaveBeenCalledWith('entree-premiere-maths-v1');
  });

  test('rejects a mixed-pack selection before rendering', async () => {
    const deps = dependencies([row('a', 'Aïcha'), row('b', 'Bilel'), row('c', 'Cyrine', 'entree-seconde-maths-v1')]);
    await expect(buildStaffGroupPlanDocument({
      userId: 'user-1', role: 'COACH', attemptIds: ['a', 'b', 'c'], format: 'html',
    }, deps as never)).rejects.toEqual(expect.objectContaining<Partial<StaffGroupPlanError>>({ code: 'GROUP_ATTEMPTS_MUST_SHARE_PACK' }));
    expect(deps.renderHtml).not.toHaveBeenCalled();
  });
});
