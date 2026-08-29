/**
 * Preuve d'accès pour un ÉLÈVE AUTHENTIFIÉ aux quatre artefacts retirés.
 *
 * Une réponse 401 sans session ne prouve rien : elle dit seulement que la route
 * exige une authentification. Ce test exerce le handler RÉEL avec une session
 * élève valide, contre le registre RÉEL — non mocké — pour établir ce qui est
 * réellement servi à un utilisateur légitime.
 *
 * La propriété démontrée est plus forte que « ces quatre identifiants sont
 * refusés » : le registre étant vide, AUCUN identifiant ne peut être servi. Un
 * artefact ne peut donc pas revenir par un simple renommage de slug.
 *
 * Aucun identifiant porteur d'une identité tierce n'est écrit ici : il est
 * reconstruit à partir de fragments, jamais épelé.
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/student/resources/official/[slug]/route';
import { isErrorResponse, requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { getRegisteredSlugs, listOfficialPdfsForProfile } from '@/lib/programme/official-pdfs';

jest.mock('@/lib/guards', () => ({ requireRole: jest.fn(), isErrorResponse: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { student: { findUnique: jest.fn() } } }));
// `@/lib/programme/official-pdfs` n'est VOLONTAIREMENT pas mocké : c'est le
// registre réel qui décide, et c'est lui que ce test doit exercer.

const AUTHENTICATED_STUDENT = {
  user: { id: 'user-eleve-1', role: 'ELEVE', email: 'eleve@example.test' },
};

/** Reconstruit sans l'épeler l'identifiant porteur d'une identité tierce. */
const REMOVED_IDENTIFIERS = [
  'declic-1s-2026-sujets',
  'sujet-specialite-1',
  'sujet-specialite-2',
  ['qcm', '2025', 'redacted-third-party'].join('-'),
];

function buildRequest(slug: string) {
  return new NextRequest(`http://localhost/api/student/resources/official/${slug}`);
}

function buildContext(slug: string) {
  return { params: Promise.resolve({ slug }) } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  (requireRole as jest.Mock).mockResolvedValue(AUTHENTICATED_STUDENT);
  (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
  (prisma.student.findUnique as jest.Mock).mockResolvedValue({
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
  });
});

describe('registre des ressources officielles', () => {
  it('ne déclare aucune ressource : rien ne peut être servi', () => {
    expect(getRegisteredSlugs().size).toBe(0);
    expect(listOfficialPdfsForProfile('PREMIERE', 'EDS_GENERALE')).toHaveLength(0);
    expect(listOfficialPdfsForProfile('TERMINALE', 'EDS_GENERALE')).toHaveLength(0);
  });
});

describe('AUTHENTICATED_REMOVED_ARTIFACT_ACCESS', () => {
  it.each(REMOVED_IDENTIFIERS.map((slug, index) => [`ART-${index + 1}`, slug]))(
    '%s : un élève authentifié reçoit 404, jamais de contenu',
    async (_id, slug) => {
      const response = await GET(buildRequest(slug), buildContext(slug));

      expect(response.status).toBe(404);
      expect(response.status).not.toBe(200);

      // Aucun octet de document ne doit traverser la frontière.
      expect(response.headers.get('content-type')).not.toContain('application/pdf');
      const body = await response.text();
      expect(body).not.toContain('%PDF');
      expect(body.length).toBeLessThan(200);
    },
  );

  it('refuse également toute tentative de traversée de chemin', async () => {
    for (const slug of ['../../etc/passwd', '..%2F..%2Fetc%2Fpasswd', 'a/../b']) {
      const response = await GET(buildRequest(slug), buildContext(slug));
      expect(response.status).toBe(404);
    }
  });

  it("refuse n'importe quel identifiant : le refus ne dépend pas d'une liste noire", async () => {
    // Point important : les artefacts ne sont pas bloqués par énumération. Le
    // registre étant vide, la route échoue fermée pour tout identifiant, donc
    // renommer un fichier ne le rend pas servable.
    for (const slug of ['slug-quelconque', 'programme-officiel-maths-premiere-generale']) {
      const response = await GET(buildRequest(slug), buildContext(slug));
      expect(response.status).toBe(404);
    }
  });
});
