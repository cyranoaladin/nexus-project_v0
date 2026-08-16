import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

import {
  assertTeacherBriefOperationsEnabled,
  teacherBriefOperationsAreSuspended,
  TeacherBriefOperationsSuspendedError,
  TEACHER_BRIEF_SUSPENSION_CODE,
} from '@/lib/bilans/staff/teacher-brief-operations';
import { APPROVED_BRIEF_SAFETY_MARKER, assertValidTeacherDossierStudentBrief, TeacherDossierUnsafeBriefRenderError } from '@/lib/bilans/staff/teacher-dossier-safety';
import { generateTeacherBrief } from '@/lib/bilans/llm/teacher-brief-service';
import {
  approveTeacherBrief,
  requestTeacherBriefCorrection,
} from '@/lib/bilans/staff/teacher-brief-review-service';
import {
  generateTeacherBriefAction,
  generateGroupTeacherBriefsAction,
  approveTeacherBriefAction,
  requestTeacherBriefCorrectionAction,
} from '@/app/dashboard/assistante/bilans/actions';
import {
  prepareReportRegeneration,
  executeReportRegeneration,
} from '@/lib/bilans/staff/regeneration-service';
import {
  buildStaffTeacherDossierDocument,
} from '@/lib/bilans/staff/teacher-dossier-service';

jest.mock('@/lib/prisma');
jest.mock('@/auth');
jest.mock('@/lib/bilans/staff/teacher-dossier-service', () => ({
  ...jest.requireActual('@/lib/bilans/staff/teacher-dossier-service'),
  buildStaffTeacherDossierDocument: jest.fn(),
}));

import { GET as teacherDossierRouteHandler } from '@/app/dashboard/assistante/bilans/teacher-dossier/route';

process.env.NEXUS_BILAN_PACK_ENTREE_TERMINALE_MATHS_V1_ENABLED = 'true';

describe('Teacher Brief Operations Suspension & Security Anti-Bypass (Hotfix P0)', () => {
  it('has central suspension flag set to true', () => {
    expect(teacherBriefOperationsAreSuspended()).toBe(true);
    expect(() => assertTeacherBriefOperationsEnabled()).toThrow(TeacherBriefOperationsSuspendedError);
  });

  it('refuses generateTeacherBrief immediately before network, DB, or pack resolution', async () => {
    const throwingDb = {
      teacherBrief: {
        findFirst: jest.fn(() => { throw new Error('DB_SHOULD_NOT_BE_CALLED'); }),
        aggregate: jest.fn(() => { throw new Error('DB_SHOULD_NOT_BE_CALLED'); }),
      },
    };
    const throwingResolvePack = () => { throw new Error('PACK_SHOULD_NOT_BE_RESOLVED'); };
    const throwingFetch: typeof fetch = (async () => { throw new Error('FETCH_SHOULD_NOT_BE_CALLED'); }) as typeof fetch;

    await expect(
      generateTeacherBrief({
        prisma: throwingDb as never,
        actor: { userId: 'user-1', role: 'ASSISTANTE' },
        reportArtifactId: 'art-1',
        resolvePack: throwingResolvePack as never,
        fetchImpl: throwingFetch,
      }),
    ).rejects.toThrow(TeacherBriefOperationsSuspendedError);

    expect(throwingDb.teacherBrief.findFirst).not.toHaveBeenCalled();
  });

  it('refuses approveTeacherBrief immediately before DB transaction', async () => {
    const throwingDb = {
      $transaction: jest.fn(() => { throw new Error('DB_TRANSACTION_SHOULD_NOT_BE_CALLED'); }),
    };
    await expect(
      approveTeacherBrief({
        prisma: throwingDb as never,
        actor: { userId: 'user-1', role: 'ASSISTANTE' },
        briefId: 'brief-1',
        motif: 'Validation test',
      }),
    ).rejects.toThrow(TeacherBriefOperationsSuspendedError);

    expect(throwingDb.$transaction).not.toHaveBeenCalled();
  });

  it('refuses requestTeacherBriefCorrection immediately before DB transaction', async () => {
    const throwingDb = {
      $transaction: jest.fn(() => { throw new Error('DB_TRANSACTION_SHOULD_NOT_BE_CALLED'); }),
    };
    await expect(
      requestTeacherBriefCorrection({
        prisma: throwingDb as never,
        actor: { userId: 'user-1', role: 'ASSISTANTE' },
        briefId: 'brief-1',
        motif: 'Correction test',
        annotation: { section: 'activite', remark: 'A revoir' },
      }),
    ).rejects.toThrow(TeacherBriefOperationsSuspendedError);

    expect(throwingDb.$transaction).not.toHaveBeenCalled();
  });

  it('refuses server actions with controlled TeacherBriefOperationsSuspendedError', async () => {
    const formData = new FormData();
    formData.append('artifactId', 'art-1');
    formData.append('briefId', 'brief-1');
    formData.append('motif', 'Motif valide');
    formData.append('subject', 'MATHEMATIQUES');
    formData.append('level', 'TERMINALE');

    await expect(generateTeacherBriefAction(formData)).rejects.toThrow(TeacherBriefOperationsSuspendedError);
    await expect(generateGroupTeacherBriefsAction(formData)).rejects.toThrow(TeacherBriefOperationsSuspendedError);
    await expect(approveTeacherBriefAction(formData)).rejects.toThrow(TeacherBriefOperationsSuspendedError);
    await expect(requestTeacherBriefCorrectionAction(formData)).rejects.toThrow(TeacherBriefOperationsSuspendedError);
  });

  it('keeps report regeneration preview deterministic with briefWillRegenerate = false', async () => {
    process.env.NEXUS_BILAN_PACK_ENTREE_TERMINALE_MATHS_V1_ENABLED = 'true';
    const { resolveEnabledPack } = require('@/lib/bilans/api/pack-access');
    const { buildFactSheet } = require('@/lib/bilans/facts/fact-sheet');
    const enabledPack = resolveEnabledPack('entree-terminale-maths-v1', 1);

    const items = [{
      itemId: 'ETL-MAT-SDG-01',
      nodeCpsId: '1re.maths.second-degre.discriminant-racines',
      weight: 1 as const,
      rawSuccess: 1,
      isSuccess: true,
      isConfident: true,
      profile: 'MAITRISE' as const,
      answered: true,
      elapsedMs: 1000,
    }];
    const nodes = [{ nodeCpsId: '1re.maths.second-degre.discriminant-racines', criticality: 1, nodeScore: 100, profile: 'MAITRISE' as const, itemIds: ['ETL-MAT-SDG-01'], priorityRank: 1 }];
    const computedFactSheet = buildFactSheet(
      enabledPack.pack,
      { student: { alias: 'ELEVE_YASMINE', level: 'TERMINALE' }, result: { globalScore: 100, coverage: 100, calibrationIndex: 100, flags: [], groupBand: 'MAITRISE', items, nodes } },
    );

    const mockDb = {
      reportRevision: {
        findUnique: jest.fn(async () => ({
          id: 'rev-1',
          generation: 1,
          scoreSnapshotId: 'snap-1',
          reportPackId: 'entree-terminale-maths-v1',
          reportPackVersion: '1',
          scoreSnapshot: { result: computedFactSheet },
          reportArtifact: {
            id: 'art-1',
            status: 'PUBLISHED',
            transmissions: [],
            publishedAt: new Date('2026-08-14'),
            assessmentAttempt: {
              answers: {},
              assessmentPackId: 'entree-terminale-maths-v1',
              assessmentPackVersion: '1',
              assessmentPackChecksum: enabledPack.checksum,
            },
            revisions: [],
          },
        })),
        aggregate: jest.fn(async () => ({ _max: { generation: 1 } })),
      },
      evidenceItem: {
        findMany: jest.fn(async () => [
          { payload: { itemId: 'ETL-MAT-SDG-01', nodeCpsId: '1re.maths.second-degre.discriminant-racines', weight: 1, rawSuccess: 1, profile: 'MAITRISE' } },
        ]),
      },
      teacherBrief: {
        findFirst: jest.fn(async () => ({ id: 'brief-1' })),
      },
    };

    const preview = await prepareReportRegeneration({
      prisma: mockDb as never,
      actor: { userId: 'user-1', role: 'ASSISTANTE' },
      revisionId: 'rev-1',
    });

    expect(preview.briefWillRegenerate).toBe(false);
  });

  it('executes report regeneration deterministically without mutating TeacherBrief when operations are suspended', async () => {
    process.env.NEXUS_BILAN_PACK_ENTREE_TERMINALE_MATHS_V1_ENABLED = 'true';
    const { resolveEnabledPack } = require('@/lib/bilans/api/pack-access');
    const { buildFactSheet } = require('@/lib/bilans/facts/fact-sheet');
    const enabledPack = resolveEnabledPack('entree-terminale-maths-v1', 1);

    const items = [{
      itemId: 'ETL-MAT-SDG-01',
      nodeCpsId: '1re.maths.second-degre.discriminant-racines',
      weight: 1 as const,
      rawSuccess: 1,
      isSuccess: true,
      isConfident: true,
      profile: 'MAITRISE' as const,
      answered: true,
      elapsedMs: 1000,
    }];
    const nodes = [{ nodeCpsId: '1re.maths.second-degre.discriminant-racines', criticality: 1, nodeScore: 100, profile: 'MAITRISE_FRAGILE' as const, itemIds: ['ETL-MAT-SDG-01'], priorityRank: 1 }];
    const computedFactSheet = buildFactSheet(
      enabledPack.pack,
      { student: { alias: 'ELEVE_YASMINE', level: 'TERMINALE' }, result: { globalScore: 100, coverage: 100, calibrationIndex: 100, flags: [], groupBand: 'MAITRISE', items, nodes } },
    );

    const writes: string[] = [];
    const mockDb: any = {
      reportRevision: {
        findUnique: jest.fn(async () => ({
          id: 'rev-1',
          generation: 1,
          scoreSnapshotId: 'snap-1',
          reportPackId: 'entree-terminale-maths-v1',
          reportPackVersion: '1',
          scoreSnapshot: { result: computedFactSheet },
          reportArtifact: {
            id: 'art-1',
            status: 'PUBLISHED',
            transmissions: [],
            publishedAt: new Date('2026-08-14'),
            assessmentAttempt: {
              status: 'REPORT_PENDING_REVIEW',
              answers: {},
              assessmentPackId: 'entree-terminale-maths-v1',
              assessmentPackVersion: '1',
              assessmentPackChecksum: enabledPack.checksum,
              submittedAt: new Date('2026-08-14'),
              provenance: 'PAPER',
            },
            revisions: [],
          },
        })),
        aggregate: jest.fn(async () => ({ _max: { generation: 1 } })),
        create: jest.fn(async () => {
          writes.push('reportRevision.create');
          return { id: 'rev-2', generation: 2 };
        }),
      },
      evidenceItem: {
        findMany: jest.fn(async () => [
          { payload: { itemId: 'ETL-MAT-SDG-01', nodeCpsId: '1re.maths.second-degre.discriminant-racines', weight: 1, rawSuccess: 1, profile: 'MAITRISE' } },
        ]),
      },
      teacherBrief: {
        findFirst: jest.fn(async () => {
          writes.push('teacherBrief.findFirst');
          return { id: 'brief-1' };
        }),
      },
      reportRegeneration: {
        create: jest.fn(async () => {
          writes.push('reportRegeneration.create');
          return { id: 'regen-1' };
        }),
      },
      $transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(mockDb)),
    };

    const result = await executeReportRegeneration({
      prisma: mockDb as never,
      actor: { userId: 'user-1', role: 'ASSISTANTE' },
      revisionId: 'rev-1',
      motif: 'Changement de règle',
      confirmAlreadyPublished: true,
      resolvePack: () => ({
        pack: enabledPack.pack,
        validatedPack: null as never,
        checksum: enabledPack.checksum,
        path: 'p',
      }),
      computeFactSheet: () => computedFactSheet as never,
      materializeArtifact: jest.fn(async () => ({ revisionId: 'rev-2', generation: 2 })) as never,
    } as any);

    expect(result.brief).toEqual({
      regenerated: false,
      reason: TEACHER_BRIEF_SUSPENSION_CODE,
    });
    expect(writes).not.toContain('teacherBrief.create');
    expect(writes).not.toContain('teacherBrief.updateMany');
  });

  it('decoupled safety marker: marker is independent of suspension and cannot be fabricated via cloning/deserialization', () => {
    const rawBriefContent = { domaines: [] };

    // 1. Spread / clone does not add safety marker
    const cloned = { ...rawBriefContent };
    expect((cloned as any).briefSafetyMarker).toBeUndefined();

    // 2. Student detail without safety marker fails assertion
    const unsafeStudent = { displayName: 'Élève A', brief: rawBriefContent as any };
    expect(() => assertValidTeacherDossierStudentBrief(unsafeStudent)).toThrow(TeacherDossierUnsafeBriefRenderError);

    // 3. Student detail with explicit safety marker passes
    const safeStudent = { displayName: 'Élève A', brief: rawBriefContent as any, briefSafetyMarker: APPROVED_BRIEF_SAFETY_MARKER };
    expect(() => assertValidTeacherDossierStudentBrief(safeStudent)).not.toThrow();

    // 4. JSON serialization / deserialization never fabricates safety marker
    const serialized = JSON.stringify(rawBriefContent);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.briefSafetyMarker).toBeUndefined();

    // 5. Decoupled module checks
    const dossierServiceCode = fs.readFileSync(path.join(process.cwd(), 'lib/bilans/staff/teacher-dossier-service.ts'), 'utf-8');
    expect(dossierServiceCode).toContain("from './teacher-dossier-safety'");
    expect(dossierServiceCode).not.toContain("APPROVED_BRIEF_SAFETY_MARKER } from './teacher-brief-operations'");

    const renderCode = fs.readFileSync(path.join(process.cwd(), 'lib/bilans/teacher-dossier/render.ts'), 'utf-8');
    expect(renderCode).toContain("from '../staff/teacher-dossier-safety'");
  });

  it('architecture anti-bypass: strictly zero forbidden bypass strings or internal entrypoints in production files', () => {
    const rootDir = process.cwd();

    // 1. Check teacher-dossier-service.ts queries ONLY APPROVED briefs
    const dossierServiceCode = fs.readFileSync(path.join(rootDir, 'lib/bilans/staff/teacher-dossier-service.ts'), 'utf-8');
    expect(dossierServiceCode).not.toContain("status: { in: ['PENDING_REVIEW', 'APPROVED'] }");
    expect(dossierServiceCode).toContain("status: APPROVED_BRIEF_STATUS");

    // 2. Check render.ts calls assertValidTeacherDossierStudentBrief
    const renderCode = fs.readFileSync(path.join(rootDir, 'lib/bilans/teacher-dossier/render.ts'), 'utf-8');
    expect(renderCode).toContain("assertValidTeacherDossierStudentBrief(student)");

    // 3. Check actions.ts calls assertTeacherBriefOperationsEnabled
    const actionsCode = fs.readFileSync(path.join(rootDir, 'app/dashboard/assistante/bilans/actions.ts'), 'utf-8');
    expect(actionsCode).toContain("assertTeacherBriefOperationsEnabled()");

    // 4. Verify low-level LLM calls and internal entrypoints are NOT imported in app/ or lib/bilans/staff/
    const checkedPaths = [
      'lib/bilans/staff/teacher-dossier-service.ts',
      'lib/bilans/teacher-dossier/render.ts',
      'app/dashboard/assistante/bilans/actions.ts',
      'app/dashboard/assistante/bilans/page.tsx',
    ];
    for (const relativePath of checkedPaths) {
      const code = fs.readFileSync(path.join(rootDir, relativePath), 'utf-8');
      expect(code).not.toContain("callTeacherBriefModel");
      expect(code).not.toContain("callTeacherBriefDomain");
      expect(code).not.toContain("executeTeacherBriefGenerationInternal");
    }

    // 5. Static scan for forbidden bypass strings in production files
    const forbiddenPatterns = [
      'bypassSuspension',
      'bypassSuspensionCheckForUnitTests',
      'skipTeacherBriefGuard',
      'ignoreSuspension',
      'testOnly',
      'disableSafety',
    ];
    for (const relativePath of checkedPaths) {
      const code = fs.readFileSync(path.join(rootDir, relativePath), 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(code).not.toContain(pattern);
      }
    }
  });

  it('route & roles: /dashboard/assistante/bilans/teacher-dossier enforces staff roles and private no-store cache control', async () => {
    const mockAuth = require('@/auth').auth as jest.Mock;
    (buildStaffTeacherDossierDocument as jest.Mock).mockResolvedValue({
      body: '<html>dossier</html>',
      contentType: 'text/html; charset=utf-8',
      filename: 'dossier-terminale.html',
    });

    // Anonymous request -> 404
    mockAuth.mockResolvedValueOnce(null);
    const reqAnon = new NextRequest('http://localhost:3000/dashboard/assistante/bilans/teacher-dossier?subject=MATHEMATIQUES&level=TERMINALE&format=html');
    const resAnon = await teacherDossierRouteHandler(reqAnon);
    expect(resAnon.status).toBe(404);

    // Non-staff role (COACH) -> 404
    mockAuth.mockResolvedValueOnce({ user: { id: 'u-coach', role: 'COACH' } });
    const reqCoach = new NextRequest('http://localhost:3000/dashboard/assistante/bilans/teacher-dossier?subject=MATHEMATIQUES&level=TERMINALE&format=html');
    const resCoach = await teacherDossierRouteHandler(reqCoach);
    expect(resCoach.status).toBe(404);

    // Staff role (ASSISTANTE) -> 200 with private, no-store headers
    mockAuth.mockResolvedValueOnce({ user: { id: 'u-assistante', role: 'ASSISTANTE' } });
    const reqAssistante = new NextRequest('http://localhost:3000/dashboard/assistante/bilans/teacher-dossier?subject=MATHEMATIQUES&level=TERMINALE&format=html');
    const resAssistante = await teacherDossierRouteHandler(reqAssistante);
    expect(resAssistante.status).toBe(200);
    expect(resAssistante.headers.get('cache-control')).toBe('private, no-store');
    expect(resAssistante.headers.get('content-type')).toContain('text/html');

    // Staff role (ADMIN) -> 200 with private no-store headers
    mockAuth.mockResolvedValueOnce({ user: { id: 'u-admin', role: 'ADMIN' } });
    const reqAdmin = new NextRequest('http://localhost:3000/dashboard/assistante/bilans/teacher-dossier?subject=MATHEMATIQUES&level=TERMINALE&format=html');
    const resAdmin = await teacherDossierRouteHandler(reqAdmin);
    expect(resAdmin.status).toBe(200);
    expect(resAdmin.headers.get('cache-control')).toBe('private, no-store');
  });
});
