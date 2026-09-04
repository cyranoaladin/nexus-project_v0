import { extractPdfText } from '@/lib/bilans/render/pdf';
import type { QuestionEvidence } from '@/lib/bilans/render/question-evidence';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import type { DossierGroupAnalysis, DossierSessionPlan } from '@/lib/bilans/teacher-dossier/aggregate';
import {
  renderTeacherDossierHtml,
  renderTeacherDossierPdf,
  type TeacherDossierDocument,
} from '@/lib/bilans/teacher-dossier/render';

/**
 * Budget des tests qui produisent un VRAI PDF.
 *
 * `renderTeacherDossierPdf` lance un Chromium Playwright complet
 * (`renderHtmlToPdf` -> `createBilanPdfRendererSession`) et `extractPdfText`
 * ouvre un second sous-processus Node chargeant pdfjs. C'est de l'I/O reelle,
 * dont la duree depend de la charge de la machine, pas du code teste.
 *
 * Mesures sur ce depot : ~2,4 s a vide, 5,0 s sous contention CPU (16 boucles
 * sur 16 coeurs). Le budget par defaut de Jest (5 s) etait donc franchi des que
 * la voie unitaire complete occupait les coeurs : le test echouait a 5001 ms
 * pendant que son jumeau, deja dote d'un budget explicite, passait a 5422 ms
 * en faisant exactement le meme travail. La cause n'est ni une course, ni une
 * fuite de ressource, ni jsdom — seulement un budget absent.
 *
 * Le budget est pose au niveau du fichier, comme dans les autres suites a PDF
 * reel du depot (`pdf-renderer-session`, `render-pdf`, `rendered-examples`) :
 * tout test ajoute ici en herite, au lieu d'etre oublie a son tour.
 */
jest.setTimeout(30_000);

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
    ...overrides,
  });
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

  it('signals deterministic fallback when no approved brief exists', () => {
    const html = renderTeacherDossierHtml(document());
    expect(html).toContain('Socle pédagogique déterministe utilisé — aucun brief enrichi validé.');
    expect(html).toContain('Version sécurisée — tout enrichissement LLM non validé est exclu.');
  });

  it('rejects an unverified or unmarked brief with a security exception', () => {
    const unsafeBrief = {
      version: 'teacher-brief.v2',
      domaines: [{ domainId: 'second-degre', erreursTypiques: [], prerequisAVerifier: [], activite: { titre: 't', objectif: 'o', materiel: 'm', deroule: [], differenciation: 'd' }, indicateurProgres: 'i' }],
    };
    const docWithUnsafe = document({
      students: Object.freeze([{
        ...document().students[0],
        brief: unsafeBrief as never,
        // briefSafetyMarker missing
      }]),
    });
    expect(() => renderTeacherDossierHtml(docWithUnsafe)).toThrow('TEACHER_DOSSIER_UNSAFE_BRIEF_RENDER_BLOCKED');
  });

  it('demonstrates that a spread/clone of brief content without explicit briefSafetyMarker fails render', () => {
    const safeBrief = {
      version: 'teacher-brief.v2',
      domaines: [{
        domainId: 'second-degre',
        erreursTypiques: [{ constat: 'Erreur de signe', origine: 'Formule mal apprise', itemIds: [] }],
        prerequisAVerifier: ['Calcul algébrique'],
        activite: { titre: 'Activité 1', objectif: 'Maîtriser le discriminant', materiel: 'Tableau', deroule: [{ nom: 'Phase 1', dureeMin: 15, consigne: 'Résoudre' }, { nom: 'P2', dureeMin: 10, consigne: 'C2' }, { nom: 'P3', dureeMin: 10, consigne: 'C3' }], differenciation: 'Calculatrice' },
        indicateurProgres: '80% de réussite',
      }],
    };
    const clonedBrief = { ...safeBrief };
    const docWithClonedWithoutMarker = document({
      students: Object.freeze([{
        ...document().students[0],
        brief: clonedBrief as never,
        // no briefSafetyMarker on student detail!
      }]),
    });
    expect(() => renderTeacherDossierHtml(docWithClonedWithoutMarker)).toThrow('TEACHER_DOSSIER_UNSAFE_BRIEF_RENDER_BLOCKED');
  });

  it('renders a verified safe brief carrying briefSafetyMarker and ensures unapproved sentinel is absent from HTML and PDF', async () => {
    const safeBrief = {
      version: 'teacher-brief.v2',
      domaines: [{
        domainId: 'second-degre',
        erreursTypiques: [{ constat: 'Erreur de signe', origine: 'Formule mal apprise', itemIds: [] }],
        prerequisAVerifier: ['Calcul algébrique'],
        activite: { titre: 'Activité 1', objectif: 'Maîtriser le discriminant', materiel: 'Tableau', deroule: [{ nom: 'Phase 1', dureeMin: 15, consigne: 'Résoudre' }, { nom: 'P2', dureeMin: 10, consigne: 'C2' }, { nom: 'P3', dureeMin: 10, consigne: 'C3' }], differenciation: 'Calculatrice' },
        indicateurProgres: '80% de réussite',
      }],
    };

    const docWithSafe = document({
      students: Object.freeze([{
        ...document().students[0],
        brief: safeBrief as never,
        briefSafetyMarker: 'APPROVED_AND_CURRENT_VERIFIED',
      }]),
    });

    const html = renderTeacherDossierHtml(docWithSafe);
    expect(html).toContain('Maîtriser le discriminant');
    const sentinel = 'SENTINELLE-BRIEF-NON-RELUE-INTERDITE-20260816';
    expect(html).not.toContain(sentinel);

    const pdfResult = await renderTeacherDossierPdf(docWithSafe);
    expect(pdfResult.status).toBe('AVAILABLE');
    if (pdfResult.status === 'AVAILABLE') {
      expect(pdfResult.pdf.toString('utf-8')).not.toContain(sentinel);
      const text = await extractPdfText(pdfResult.pdf);
      expect(text).not.toContain(sentinel);
      expect(text).toMatch(/Maîtriser le discriminant|second-degre/i);
    }
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

describe('renderTeacherDossierPdf', () => {
  it('renders a real A4 PDF whose extracted text carries the confidential banner and correct math glyphs', async () => {
    const result = await renderTeacherDossierPdf(document());
    expect(result.status).toBe('AVAILABLE');
    if (result.status !== 'AVAILABLE') return;
    const text = await extractPdfText(result.pdf);
    expect(text).toMatch(/confidentiel/i);
    expect(text).toContain('Socle pédagogique déterministe utilisé — aucun brief enrichi validé.');
  });
});
