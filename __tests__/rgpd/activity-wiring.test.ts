import fs from 'node:fs';
import path from 'node:path';

const mockUpdate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: { candidateDiagnostic: { update: (...a: unknown[]) => mockUpdate(...a) } },
}));

import { noteStudentActivity } from '@/lib/rgpd/last-activity.server';

/**
 * Câblage de l'activité.
 *
 * La conservation se compte sur `lastActivityAt` : si rien ne l'alimente, la
 * purge ne mesure rien et la promesse de la notice devient inopérante. Ces
 * tests vérifient donc à la fois que les points d'appel existent réellement
 * dans les routes, et que seul l'étudiant repousse l'échéance.
 */

const ROUTES = path.join(process.cwd(), 'app/api/diagnostics/candidat-libre');

beforeEach(() => jest.clearAllMocks());

describe('noteStudentActivity — qui repousse l’échéance', () => {
  it('enregistre l’activité de l’étudiant', async () => {
    await noteStudentActivity({ diagnosticId: 'd1', activity: 'MODULE_RENSEIGNE', actorRole: 'ELEVE' });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const { where, data } = mockUpdate.mock.calls[0][0];
    expect(where).toEqual({ id: 'd1' });
    expect(data.lastActivityAt).toBeInstanceOf(Date);
  });

  /**
   * Le cœur : une consultation par un tiers prolongerait la rétention sans que
   * l'intéressé y soit pour quelque chose. Seul son propre usage compte.
   */
  it.each(['PARENT', 'COACH', 'ADMIN', 'ASSISTANTE'])(
    'n’enregistre rien pour un acteur %s',
    async (actorRole) => {
      await noteStudentActivity({ diagnosticId: 'd1', activity: 'RESULTATS_CONSULTES', actorRole });
      expect(mockUpdate).not.toHaveBeenCalled();
    },
  );

  it('n’interrompt pas l’interaction si l’écriture échoue', async () => {
    mockUpdate.mockRejectedValue(new Error('db down'));
    await expect(
      noteStudentActivity({ diagnosticId: 'd1', activity: 'DOSSIER_SOUMIS', actorRole: 'ELEVE' }),
    ).resolves.toBeUndefined();
  });
});

describe('points d’appel réellement posés dans les routes', () => {
  /**
   * Un test unitaire prouve que la fonction marche ; seul celui-ci prouve
   * qu'elle est appelée. Sans ces appels, la purge ne mesurerait jamais rien.
   */
  it.each([
    ['consultation du dossier', '[diagnosticId]/route.ts', 'RESULTATS_CONSULTES'],
    ['module renseigné', '[diagnosticId]/modules/[moduleKey]/route.ts', 'MODULE_RENSEIGNE'],
    ['dépôt de document', '[diagnosticId]/documents/route.ts', 'DOCUMENT_DEPOSE'],
    ['soumission du dossier', '[diagnosticId]/submit/route.ts', 'DOSSIER_SOUMIS'],
  ])('%s', (_label, relative, activity) => {
    const source = fs.readFileSync(path.join(ROUTES, relative), 'utf8');
    expect(source).toContain('noteStudentActivity');
    expect(source).toContain(activity);
    // L'acteur est transmis : c'est lui qui décide si l'échéance bouge.
    expect(source).toMatch(/actorRole:\s*sessionOrError\.user\.role/);
  });

  /** Le questionnaire parent ne doit jamais repousser l'échéance de l'étudiant. */
  it('ne pose aucun appel dans la route du questionnaire parent', () => {
    const source = fs.readFileSync(path.join(ROUTES, '[diagnosticId]/parent/route.ts'), 'utf8');
    expect(source).not.toContain('noteStudentActivity');
  });
});
