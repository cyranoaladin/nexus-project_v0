import {
  listResourcesForCourse,
  listResourcesForStudentCourses,
  verifyResourceOnDisk,
  assertResourcesIntegrity,
} from '@/lib/aria/resources';

describe('ARIA Resource Mapping Engine', () => {
  describe('Zéro contamination inter-niveaux / inter-voies', () => {
    it('isole strictement les ressources Maths Première et Maths Terminale', () => {
      const premiereResources = listResourcesForCourse('eds-maths-premiere');
      const terminaleResources = listResourcesForCourse('eds-maths-terminale');

      expect(premiereResources.length).toBeGreaterThan(0);
      expect(terminaleResources.length).toBeGreaterThan(0);

      const premiereIds = new Set(premiereResources.map((r) => r.id));
      const terminaleIds = new Set(terminaleResources.map((r) => r.id));

      // Aucune intersection
      for (const id of premiereIds) {
        expect(terminaleIds.has(id)).toBe(false);
      }
    });

    it('isole strictement la voie Générale et la voie STMG', () => {
      const edsMaths = listResourcesForCourse('eds-maths-premiere');
      const stmgMaths = listResourcesForCourse('stmg-maths-premiere');

      const edsIds = new Set(edsMaths.map((r) => r.id));
      for (const res of stmgMaths) {
        expect(edsIds.has(res.id)).toBe(false);
      }
    });

    it('isole strictement NSI Première et NSI Terminale', () => {
      const nsi1 = listResourcesForCourse('eds-nsi-premiere');
      const nsiT = listResourcesForCourse('eds-nsi-terminale');

      const nsi1Ids = new Set(nsi1.map((r) => r.id));
      for (const res of nsiT) {
        expect(nsi1Ids.has(res.id)).toBe(false);
      }
    });

    it('agrège fidèlement les ressources pour les cours autorisés de l élève', () => {
      const all = listResourcesForStudentCourses(['eds-maths-terminale', 'eds-nsi-terminale']);
      expect(all).toHaveLength(2);
      for (const r of all) {
        expect(['eds-maths-terminale', 'eds-nsi-terminale']).toContain(r.courseKey);
      }
    });
  });

  describe('Vérification physique des documents officiels sur disque', () => {
    it('confirme la taille et le hash réels des PDF officiels du Ministère', async () => {
      await expect(verifyResourceOnDisk('res-maths-1ere-prog-bo')).resolves.toBe(true);
      await expect(verifyResourceOnDisk('res-maths-1ere-automatismes-bo')).resolves.toBe(true);
      await expect(verifyResourceOnDisk('res-maths-tle-prog-bo')).resolves.toBe(true);
      await expect(verifyResourceOnDisk('res-nsi-1ere-prog-bo')).resolves.toBe(true);
      await expect(verifyResourceOnDisk('res-nsi-tle-prog-bo')).resolves.toBe(true);
      await expect(assertResourcesIntegrity()).resolves.toBeUndefined();
    });

    it('rejette une ressource inconnue sans résoudre de chemin', async () => {
      await expect(verifyResourceOnDisk('ressource-bidon')).resolves.toBe(false);
    });
  });
});
