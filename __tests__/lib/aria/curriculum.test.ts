import {
  getCourseCapabilities,
  getCourseDisplayName,
  getSubjectDisplayName,
  isKnownCourseKey,
  listCourses,
} from '@/lib/aria/curriculum';

describe('ARIA Curriculum & Capabilities Engine', () => {
  describe('Invariants de catalogue (COURSE_IDENTITY_SOURCES=1)', () => {
    it('charge les cours depuis le catalogue SSoT unique', () => {
      const courses = listCourses();
      expect(courses.length).toBeGreaterThan(10);
      expect(isKnownCourseKey('eds-maths-premiere')).toBe(true);
      expect(isKnownCourseKey('eds-maths-terminale')).toBe(true);
      expect(isKnownCourseKey('stmg-sgn-premiere')).toBe(true);
      expect(isKnownCourseKey('cours-fantome-inexistant')).toBe(false);
    });

    it('retourne le libellé canonique du cours', () => {
      expect(getCourseDisplayName('eds-maths-premiere')).toBe('Mathématiques');
      expect(getCourseDisplayName('eds-nsi-premiere')).toBe('NSI');
      expect(getCourseDisplayName('cours-inconnu')).toBe('cours-inconnu');
    });

    it('fournit une source unique pour les libellés de matières (SUBJECT_LABEL_SOURCES=1)', () => {
      expect(getSubjectDisplayName('MATHEMATIQUES')).toBe('Mathématiques');
      expect(getSubjectDisplayName('NSI')).toBe('Numérique et Sciences Informatiques');
      expect(getSubjectDisplayName('FRANCAIS')).toBe('Français');
    });
  });

  describe('Capacités produit prouvées', () => {
    it('ne confond pas une déclaration de corpus avec un corpus servable pour Maths Première', () => {
      const caps = getCourseCapabilities('eds-maths-premiere');
      expect(caps.hasSkillGraph).toBe(true);
      expect(caps.skillGraphRef).toBe('maths-premiere-p2');
      expect(caps.hasRagCorpus).toBe(false);
      expect(caps.hasChat).toBe(false);
      expect(caps.hasAssessmentContext).toBe(true);
      expect(caps.hasResources).toBe(false);
      expect(caps.resourceCount).toBe(0);
    });

    it('échoue fermé sans manifeste servable pour la spécialité NSI Terminale', () => {
      const caps = getCourseCapabilities('eds-nsi-terminale');
      expect(caps.hasSkillGraph).toBe(true);
      expect(caps.skillGraphRef).toBe('nsi-terminale-p2');
      expect(caps.hasRagCorpus).toBe(false);
      expect(caps.hasChat).toBe(false);
      expect(caps.hasAssessmentContext).toBe(true);
      expect(caps.hasResources).toBe(true);
    });

    it('refuse toute approximation SES pour les modules technologiques STMG', () => {
      const sgnCaps = getCourseCapabilities('stmg-sgn-premiere');
      expect(sgnCaps.hasSkillGraph).toBe(true); // Skill graph compilé présent
      expect(sgnCaps.hasRagCorpus).toBe(false); // Pas de corpus RAG
      expect(sgnCaps.hasChat).toBe(false);

      const mgtCaps = getCourseCapabilities('stmg-management-premiere');
      expect(mgtCaps.hasSkillGraph).toBe(true);
      expect(mgtCaps.hasRagCorpus).toBe(false);

      const droitCaps = getCourseCapabilities('stmg-droit-eco-premiere');
      expect(droitCaps.hasSkillGraph).toBe(true);
      expect(droitCaps.hasRagCorpus).toBe(false);
    });

  it('U005 retourne des capacités vides pour un cours inconnu', () => {
      const caps = getCourseCapabilities('cours-inexistant');
      expect(caps.hasSkillGraph).toBe(false);
      expect(caps.hasRagCorpus).toBe(false);
      expect(caps.hasChat).toBe(false);
      expect(caps.skillGraphRef).toBeNull();
    });
  });
});
