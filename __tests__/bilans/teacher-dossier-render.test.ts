import { extractPdfText } from '@/lib/bilans/render/pdf';
import type { QuestionEvidence } from '@/lib/bilans/render/question-evidence';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import type { DossierGroupAnalysis, DossierSessionPlan } from '@/lib/bilans/teacher-dossier/aggregate';
import {
  renderTeacherDossierHtml,
  renderTeacherDossierPdf,
  TEACHER_BRIEF_SAFETY_MARKER,
  type TeacherDossierDocument,
} from '@/lib/bilans/teacher-dossier/render';
import type { TeacherBriefContent } from '@/lib/bilans/llm/teacher-brief-schema';

const identity: RenderIdentity = Object.freeze({
  displayName: 'Terminale — Mathématiques', level: 'TERMINALE', subject: 'MATHS', date: '2026-08-14',
  stageLabel: 'Stage de pré-rentrée — Entrée en Terminale, Mathématiques',
});

const evidence: QuestionEvidence = Object.freeze({
  version: 'question-evidence.v1', packSlug: 'entree-terminale-maths-v1', packVersion: 1,
  confidenceLabels: Object.freeze(['je devine', 'peu sûr', 'plutôt sûr', 'certain']) as readonly [string, string, string, string],
  items: Object.freeze([
    Object.freeze({
      itemId: 'ITEM-1', domainId: 'second-degre', category: 'Discriminant', questionText: 'Résoudre x^2-3x+2=0 sur R.',
      options: Object.freeze([
        Object.freeze({ id: 'A', text: '1 et 2', isCorrect: true, distractorRationale: null }),
        Object.freeze({ id: 'B', text: '-1 et -2', isCorrect: false, distractorRationale: "Signe oublié à l'étape finale" }),
      ]),
      shortCorrection: 'Discriminant positif, deux racines distinctes.', chosenOptionId: 'B', confidence: 3,
    }),
  ]),
});

const analysis: DossierGroupAnalysis = Object.freeze({
  version: 'teacher-dossier-aggregate.v1', memberCount: 1,
  profileDistribution: Object.freeze({ MAITRISE: 0, MAITRISE_FRAGILE: 0, LACUNE_CONSCIENTE: 0, ERREUR_CONFIANTE: 1, NON_TRAITE: 0 }),
  domains: Object.freeze([Object.freeze({ domainId: 'second-degre', profile: 'ERREUR_CONFIANTE', profileCounts: Object.freeze({ MAITRISE: 0, MAITRISE_FRAGILE: 0, LACUNE_CONSCIENTE: 0, ERREUR_CONFIANTE: 1, NON_TRAITE: 0 }), severityWeight: 75 })]),
  items: Object.freeze([Object.freeze({ itemId: 'ITEM-1', domainId: 'second-degre', questionText: 'Résoudre x^2-3x+2=0 sur R.', totalMembers: 1, correctCount: 0, notTreatedCount: 0, distractorCounts: Object.freeze({ B: 1 }), majorityDistractorOptionId: 'B', collectiveError: true })]),
  calibration: Object.freeze({ mean: 70, stddev: 0, sampleSize: 1 }),
  heterogeneity: Object.freeze({ scoreMean: 40, scoreStddev: 0, classification: 'HOMOGENE', thresholdStddev: 15 }),
  acquiredByAll: Object.freeze([]),
  atypicalStudents: Object.freeze([]),
  clusters: Object.freeze([]),
});

const sessionPlan: DossierSessionPlan = Object.freeze({
  nodes: Object.freeze([Object.freeze({
    nodeCpsId: '1re.maths.fixture.node-1', label: 'Second degré', sequenceOrder: 1, profile: 'ERREUR_CONFIANTE',
    minutes: 90, treatment: "Reprise complète : déconstruction explicite de l'erreur",
    profileCounts: Object.freeze({ MAITRISE: 0, MAITRISE_FRAGILE: 0, LACUNE_CONSCIENTE: 0, ERREUR_CONFIANTE: 1, NON_TRAITE: 0 }),
  })]),
  sessions: Object.freeze([Object.freeze({ index: 1, contentMinutes: 90, nodes: Object.freeze([]) })]),
  schedulingStatus: 'READY', schedulingWarnings: Object.freeze([]),
});

function document(overrides: Partial<TeacherDossierDocument> = {}): TeacherDossierDocument {
  return Object.freeze({
    identity,
    header: Object.freeze({ teacherName: 'Mme Trabelsi' }),
    students: Object.freeze([Object.freeze({
      displayName: "Ahmed Ben M'Rad", factSheet: Object.freeze({
        engineVersion: '1.1.0', bankSlug: 'entree-terminale-maths-v1', bankVersion: 1,
        student: Object.freeze({ alias: 'ELEVE_A', level: 'TERMINALE' }), globalScore: 40, coverage: 100, calibrationIndex: 70,
        domains: Object.freeze([Object.freeze({ id: 'second-degre', score: 30, profile: 'ERREUR_CONFIANTE' })]),
        flags: Object.freeze([]), groupBand: 'CONSOLIDATION_STANDARD', nodes: Object.freeze([]),
      }), evidence, brief: null,
    })]),
    excludedStudents: Object.freeze([]),
    analysis, sessionPlan, evidenceCatalog: evidence, generatedAt: '2026-08-14',
    completeness: Object.freeze({ tier: 'SOCLE_DETERMINISTE', studentsIncluded: 1, briefsApproved: 0, socleOnlyCount: 1 }),
    ...overrides,
  });
}

const SENTINEL_UNAPPROVED_TEXT = 'SENTINELLE-CONTENU-NON-RELU-JAMAIS-RENDU-7f3c9a';

function approvedBriefContent(): TeacherBriefContent {
  return {
    version: 'teacher-brief.v2',
    domaines: [{
      domainId: 'second-degre',
      erreursTypiques: [{ constat: 'Constat approuvé.', origine: 'Origine approuvée.', itemIds: [] }],
      prerequisAVerifier: ['Prérequis approuvé.'],
      activite: {
        titre: 'Activité approuvée', objectif: 'Objectif approuvé.', materiel: 'Matériel.',
        deroule: [
          { nom: 'Phase 1', dureeMin: 10, consigne: 'Consigne 1.' },
          { nom: 'Phase 2', dureeMin: 10, consigne: 'Consigne 2.' },
          { nom: 'Phase 3', dureeMin: 10, consigne: 'Consigne 3.' },
        ],
        differenciation: 'Différenciation.',
      },
      indicateurProgres: 'Indicateur approuvé.',
    }],
  };
}

function sentinelBriefContent(): TeacherBriefContent {
  const content = approvedBriefContent();
  return { ...content, domaines: [{ ...content.domaines[0], indicateurProgres: SENTINEL_UNAPPROVED_TEXT }] };
}

describe('renderTeacherDossierHtml', () => {
  it('marks the document confidential and internal', () => {
    const html = renderTeacherDossierHtml(document());
    expect(html).toContain('confidentiel');
    expect(html).toMatch(/interne/i);
  });

  it('prints real student names, never a pseudonym', () => {
    const html = renderTeacherDossierHtml(document());
    expect(html).toContain('Ahmed Ben M’Rad');
    expect(html).not.toContain('ELEVE_A');
  });

  it('renders each student block as a single non-breaking unit', () => {
    const html = renderTeacherDossierHtml(document());
    expect(html).toMatch(/\.student-block[^{]*\{[^}]*break-inside:\s*avoid/);
  });

  it('prints a blank, hand-fillable field for header data left unset', () => {
    const html = renderTeacherDossierHtml(document({ header: Object.freeze({}) }));
    expect(html).toMatch(/class="fill-blank"/);
  });

  it('flags excluded students by name and reason rather than silently dropping them', () => {
    const html = renderTeacherDossierHtml(document({ excludedStudents: Object.freeze([{ displayName: 'Sonia Gharbi', reason: 'pack différent (maths-terminale-bilan-v1)' }]) }));
    expect(html).toContain('Sonia Gharbi');
    expect(html).toContain('pack différent');
  });

  it('signals a missing brief instead of rendering a silently empty section', () => {
    const html = renderTeacherDossierHtml(document());
    expect(html).toMatch(/brief.*non disponible/i);
  });

  it('flags a majority distractor as a collective error to treat at the board', () => {
    const html = renderTeacherDossierHtml(document());
    expect(html).toMatch(/erreur collective/i);
  });

  it('never uses the unsupported arrow glyph missing from the embedded fonts', () => {
    const html = renderTeacherDossierHtml(document());
    expect(html).not.toContain('→');
  });
});

describe('renderTeacherDossierHtml — défense en profondeur, couche 3 (§2 de l’incident P0)', () => {
  it('un brief non nul SANS marqueur de sûreté fait échouer le rendu (jamais silencieusement omis, jamais rendu)', () => {
    const doc = document({
      students: Object.freeze([Object.freeze({
        ...document().students[0], brief: sentinelBriefContent(), // pas de briefSafetyMarker
      })]),
    });
    expect(() => renderTeacherDossierHtml(doc)).toThrow('TEACHER_DOSSIER_UNSAFE_BRIEF_RENDER_BLOCKED');
  });

  it('un brief avec le marqueur de sûreté correct est rendu normalement', () => {
    const doc = document({
      students: Object.freeze([Object.freeze({
        ...document().students[0], brief: approvedBriefContent(), briefSafetyMarker: TEACHER_BRIEF_SAFETY_MARKER,
      })]),
      completeness: Object.freeze({ tier: 'ENRICHI_COMPLET', studentsIncluded: 1, briefsApproved: 1, socleOnlyCount: 0 }),
    });
    expect(() => renderTeacherDossierHtml(doc)).not.toThrow();
  });

  it('la sentinelle de contenu non relu est absente octet par octet du HTML si le marqueur manque (le rendu échoue avant impression)', () => {
    const doc = document({
      students: Object.freeze([Object.freeze({
        ...document().students[0], brief: sentinelBriefContent(),
      })]),
    });
    let html = '';
    try {
      html = renderTeacherDossierHtml(doc);
    } catch {
      // attendu — le test porte sur l'ABSENCE de la sentinelle dans tout html produit avant l'exception.
    }
    expect(html).not.toContain(SENTINEL_UNAPPROVED_TEXT);
  });

  it('affiche la complétude SOCLE_DETERMINISTE et la phrase sobre par élève sans brief approuvé', () => {
    const html = renderTeacherDossierHtml(document());
    expect(html).toContain('Socle déterministe');
    expect(html).toContain('Socle pédagogique déterministe utilisé — aucun brief enrichi validé.');
    expect(html).not.toMatch(/en attente de relecture|pending.review/i);
  });

  it('affiche la complétude ENRICHI_SECURISE_PARTIEL quand certains élèves ont un brief approuvé et d’autres non', () => {
    const withBrief = Object.freeze({ ...document().students[0], displayName: 'Ahmed Ben M’Rad', brief: approvedBriefContent(), briefSafetyMarker: TEACHER_BRIEF_SAFETY_MARKER });
    const withoutBrief = Object.freeze({ ...document().students[0], displayName: 'Sonia Gharbi', brief: null });
    const html = renderTeacherDossierHtml(document({
      students: Object.freeze([withBrief, withoutBrief]),
      completeness: Object.freeze({ tier: 'ENRICHI_SECURISE_PARTIEL', studentsIncluded: 2, briefsApproved: 1, socleOnlyCount: 1 }),
    }));
    expect(html).toContain('Enrichi sécurisé partiel');
    expect(html).toContain('Sonia Gharbi');
    expect(html).toContain('Socle pédagogique déterministe utilisé');
  });

  it('affiche la complétude ENRICHI_COMPLET quand chaque élève inclus a un brief approuvé', () => {
    const html = renderTeacherDossierHtml(document({
      students: Object.freeze([Object.freeze({ ...document().students[0], brief: approvedBriefContent(), briefSafetyMarker: TEACHER_BRIEF_SAFETY_MARKER })]),
      completeness: Object.freeze({ tier: 'ENRICHI_COMPLET', studentsIncluded: 1, briefsApproved: 1, socleOnlyCount: 0 }),
    }));
    expect(html).toContain('Enrichi complet');
  });

  it('ne rend jamais une formulation laissant croire qu’un contenu non relu a été approuvé', () => {
    const html = renderTeacherDossierHtml(document());
    expect(html).not.toMatch(/approuvé\s+automatiquement|validé\s+par\s+défaut/i);
  });
});

describe('renderTeacherDossierPdf', () => {
  it('renders a real A4 PDF whose extracted text carries the confidential banner and correct math glyphs', async () => {
    const result = await renderTeacherDossierPdf(document());
    expect(result.status).toBe('AVAILABLE');
    if (result.status !== 'AVAILABLE') return;
    const text = await extractPdfText(result.pdf);
    expect(text).toMatch(/confidentiel/i);
    expect(text).toContain('x²');
  }, 30000);

  it('un brief APPROUVÉ correctement marqué apparaît dans le texte extrait du PDF, jamais un brief non marqué', async () => {
    const doc = document({
      students: Object.freeze([Object.freeze({ ...document().students[0], brief: approvedBriefContent(), briefSafetyMarker: TEACHER_BRIEF_SAFETY_MARKER })]),
      completeness: Object.freeze({ tier: 'ENRICHI_COMPLET', studentsIncluded: 1, briefsApproved: 1, socleOnlyCount: 0 }),
    });
    const result = await renderTeacherDossierPdf(doc);
    expect(result.status).toBe('AVAILABLE');
    if (result.status !== 'AVAILABLE') return;
    const text = await extractPdfText(result.pdf);
    expect(text).toContain('Indicateur approuvé');
  }, 30000);

  it('rejette la génération PDF (jamais silencieuse) quand un brief non nul manque son marqueur de sûreté', async () => {
    const doc = document({
      students: Object.freeze([Object.freeze({ ...document().students[0], brief: sentinelBriefContent() })]),
    });
    await expect(renderTeacherDossierPdf(doc)).rejects.toThrow('TEACHER_DOSSIER_UNSAFE_BRIEF_RENDER_BLOCKED');
  }, 30000);
});
