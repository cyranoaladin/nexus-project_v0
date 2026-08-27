/**
 * P1C — chaîne pédagogique centrale :
 * évaluation → compétence → preuve → ressource/activité → prochaine action
 * → reprise avec l'enseignant. Preuves de cohérence exigées par le gate
 * P1C §12 (A à F).
 */
import {
  getAssessmentTrajectory,
  getCompetencyOverview,
  getDemoDocuments,
  getLearningEvidence,
  getPedagogicalFocus,
  getStudentResources,
} from '@/lib/demo/utica-2026/selectors';
import { demoScenario } from '@/lib/demo/utica-2026/scenario';

describe('A. Focus — identifiants stables reliés à une vraie compétence', () => {
  test('fragileCompetencyId et masteredCompetencyId désignent des compétences réelles de subjectTracks', () => {
    const focus = getPedagogicalFocus();
    const mathsTrack = demoScenario.subjectTracks.find((t) => t.subject === focus.subject)!;
    const fragile = mathsTrack.competencies.find((c) => c.id === focus.fragileCompetencyId);
    const mastered = mathsTrack.competencies.find((c) => c.id === focus.masteredCompetencyId);

    expect(fragile).toBeDefined();
    expect(fragile!.label).toBe(focus.fragileCompetency);
    expect(fragile!.level).toBe('À consolider');

    expect(mastered).toBeDefined();
    expect(mastered!.label).toBe(focus.masteredCompetency);
    expect(mastered!.level).toBe('Maîtrisé');
  });
});

describe('B. Preuve — le focus possède au moins une preuve réellement associée', () => {
  test('getLearningEvidence(fragileCompetencyId) renvoie au moins une preuve', () => {
    const focus = getPedagogicalFocus();
    const evidence = getLearningEvidence(focus.fragileCompetencyId);
    expect(evidence.length).toBeGreaterThan(0);
  });

  test("le résultat de la preuve correspond exactement aux chiffres de focus.evidenceSummary (même source, jamais un second jeu de chiffres)", () => {
    const focus = getPedagogicalFocus();
    const [evidence] = getLearningEvidence(focus.fragileCompetencyId);
    expect(focus.evidenceSummary).toContain(evidence.resultLabel.replace('/', ' sur '));
  });

  test('aucune preuve n\'est orpheline : chaque preuve cite au moins une compétence existante', () => {
    const allCompetencyIds = new Set(demoScenario.subjectTracks.flatMap((t) => t.competencies.map((c) => c.id)));
    for (const evidence of demoScenario.learningEvidence) {
      expect(evidence.competencyIds.length).toBeGreaterThan(0);
      for (const id of evidence.competencyIds) {
        expect(allCompetencyIds.has(id)).toBe(true);
      }
    }
  });
});

describe('C. Ressource — la ressource recommandée cible la compétence du focus', () => {
  test('getStudentResources().recommended porte competencyIds incluant fragileCompetencyId', () => {
    const focus = getPedagogicalFocus();
    const { recommended } = getStudentResources();
    expect(recommended).not.toBeNull();
    expect(recommended!.competencyIds).toContain(focus.fragileCompetencyId);
  });
});

describe('D. Évaluation — le statut de compétence est compatible avec les preuves du scénario', () => {
  test('getCompetencyOverview() expose la dernière preuve de chaque compétence ayant au moins une preuve', () => {
    const overview = getCompetencyOverview();
    for (const competency of overview) {
      const evidenceForCompetency = getLearningEvidence(competency.id);
      if (evidenceForCompetency.length === 0) {
        expect(competency.lastEvidence).toBeNull();
      } else {
        expect(competency.lastEvidence).not.toBeNull();
        expect(competency.lastEvidence!.label).toBe(evidenceForCompetency[0].label);
      }
    }
  });

  test('une compétence "Non encore vu" ne porte aucune preuve (honnête : rien n\'a encore été observé)', () => {
    const overview = getCompetencyOverview();
    const notStarted = overview.filter((c) => c.level === 'Non encore vu');
    expect(notStarted.length).toBeGreaterThan(0);
    for (const c of notStarted) {
      expect(c.lastEvidence).toBeNull();
    }
  });

  test('getAssessmentTrajectory() se termine par l\'activité ciblée puis la situation actuelle, dérivées du même focus', () => {
    const focus = getPedagogicalFocus();
    const trajectory = getAssessmentTrajectory();
    expect(trajectory.length).toBeGreaterThanOrEqual(3); // au moins 1 preuve + activité ciblée + situation actuelle

    const activityStep = trajectory[trajectory.length - 2];
    const situationStep = trajectory[trajectory.length - 1];
    expect(activityStep.detail).toContain(focus.recommendedActivityLabel);
    expect(situationStep.detail).toContain(focus.fragileCompetency);
  });

  test('aucun score de réussite futur ni tendance calculée (interdiction gate §3/§11)', () => {
    const serialized = JSON.stringify(getAssessmentTrajectory()).toLowerCase();
    expect(serialized).not.toMatch(/%|moyenne|tendance|prédi/);
  });
});

describe('E. Documents — aucune référence à un stockage réel', () => {
  test('les documents de démonstration ne portent ni chemin de fichier ni URL', () => {
    const documents = getDemoDocuments();
    expect(documents.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(documents);
    expect(serialized).not.toMatch(/https?:\/\/|\.pdf|\/storage\/|DOCUMENT_STORAGE_ROOT/i);
  });
});
