import type { FactSheet } from '../facts/fact-sheet';
import {
  bilanPackSubjectLabel,
  type BilanPackSubject,
} from '../catalog/subjects';
import { BILAN_PRINT_BRAND, bilanPrintTokenCss } from './brand';
import { renderCalibrationSvg, renderScoreBarsSvg } from './charts';
import { domainTitle } from './domain-labels';
import { buildDeterministicReport } from './report';
import {
  PAPER_ENTRY_DURATION_MEASUREMENT,
  PAPER_ENTRY_DURATION_NOTICE,
} from './passation-presentation';
import type { RenderIdentity } from './render-identity';
import {
  assertHumanRenderIdentity,
  type HumanRenderIdentity,
} from './human-identity';
import type { ReportAudience } from './profile-copy';
import {
  chosenOption,
  confidenceLabel,
  correctOption,
  evidenceItemStatus,
  meanConfidenceByDomain,
  type EvidenceItem,
  type QuestionEvidence,
} from './question-evidence';
import { bilanPackLevelLabel } from './stage-label';
import { STAGE_SESSION_COUNT, sessionCountWord, sessionLabel } from './stage-constants';
import { groupDomainsForDisplay, subjectDisplayPolicy } from './subject-display';
import { frenchTypography } from './typography';

export const BILAN_HTML_TEMPLATE_VERSION = 'nexus-bilan-html.v2' as const;

interface Narrative {
  headline: string;
  introduction: string;
  methodNote: string;
  conclusion: string;
  calibration: string;
  strengths: string[];
  priorities: string[];
  actionPlan: string[];
}

interface RenderDomain {
  id: string;
  title: string;
  gesture: string;
  narrative: string;
  profileLabel?: string;
  profile?: string;
  score?: number;
}

interface RenderStep {
  domainId: string;
  domainTitle: string;
  phaseDidactique: string;
  objectif: string;
  demarche: string;
  seanceLabel: string;
  profileLabel?: string;
  profil?: string;
}

interface RenderContent {
  narrative: Narrative;
  domains: RenderDomain[];
  learningPath: { version: string; steps: RenderStep[] };
  internalFacts?: {
    globalScore: number;
    coverage: number;
    calibrationIndex: number | null;
    domainScores: Array<{ id: string; score: number }>;
  };
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Texte visible : typographie française puis échappement HTML. */
function T(value: unknown): string {
  return escapeHtml(frenchTypography(String(value)));
}

function list(items: readonly string[], className = ''): string {
  return `<ol class="${className}">${items.map((item) => `<li>${T(item)}</li>`).join('')}</ol>`;
}

/* -------------------------------------------------------------------------- */
/* En-tête et pied de page                                                     */
/* -------------------------------------------------------------------------- */

function header(
  identity: RenderIdentity,
  audience: ReportAudience,
  humanIdentity?: HumanRenderIdentity,
): string {
  const displayName = humanIdentity === undefined
    ? identity.displayName
    : assertHumanRenderIdentity(humanIdentity).displayName;
  const durationNotice = identity.durationMeasurement === PAPER_ENTRY_DURATION_MEASUREMENT
    ? `<p class="passation-note" style="margin:1.5mm 0 0;color:var(--color-lux-slate);font-size:9pt">${T(PAPER_ENTRY_DURATION_NOTICE)}</p>`
    : '';
  const audienceLabel = audience === 'ELEVE' ? 'Bilan élève' : audience === 'PARENTS' ? 'Bilan parents' : 'Synthèse interne Nexus';
  return `<header class="report-header">
    <img class="brand-logo" src="${BILAN_PRINT_BRAND.logos.header}" alt="Nexus Réussite">
    <div class="identity"><p class="eyebrow">${T(audienceLabel)}</p><h1>${T(identity.stageLabel)}</h1>
    <p><strong>${T(displayName)}</strong> · ${T(bilanPackLevelLabel(identity.level))} · ${T(bilanPackSubjectLabel(identity.subject))} · ${T(identity.date)}</p>${durationNotice}</div>
  </header>`;
}

/* -------------------------------------------------------------------------- */
/* Carte maîtrise × confiance (qualitative, audiences publiques)               */
/* -------------------------------------------------------------------------- */

const PROFILE_BY_QUADRANT = Object.freeze({
  confidentRight: { profile: 'solide', title: 'Réponses justes, données avec confiance', hint: 'Acquis : on entretient.' },
  cautiousRight: { profile: 'fragile / à consolider', title: 'Réponses justes, mais hésitantes', hint: 'Presque acquis : on consolide.' },
  confidentWrong: { profile: 'sûr mais à revoir', title: 'Réponses sûres… mais à revoir', hint: 'Priorité : on confronte, puis on reconstruit.' },
  cautiousWrong: { profile: 'à combler (déjà repéré)', title: 'Difficulté repérée, sans fausse certitude', hint: 'Prêt à apprendre : on installe.' },
});

/**
 * Un quadrant vide n'affiche jamais un tiret nu : un titre sans contenu donne
 * l'impression d'un document cassé. Le vide EST une information pédagogique —
 * chaque quadrant la formule dans le registre de l'audience (tutoiement
 * élève ; la carte n'est rendue que côté élève).
 */
const EMPTY_QUADRANT_ELEVE: Readonly<Record<keyof typeof PROFILE_BY_QUADRANT, string>> = Object.freeze({
  confidentRight: 'Rien ici pour l’instant : aucun domaine n’est à la fois juste et sûr. C’est exactement ce que le stage va construire.',
  cautiousRight: 'Rien ici : quand tu réussis, tu le sais. Ta confiance est bien calée sur tes réussites.',
  confidentWrong: 'Rien ici — c’est une excellente nouvelle : aucune notion où tu te trompes en croyant savoir. On bâtit sur du vrai.',
  cautiousWrong: 'Rien ici : tu n’as pas de notion que tu sais déjà ne pas maîtriser. Tes points à travailler sont des réponses que tu croyais justes — c’est le cas le plus utile à traiter.',
});

function masteryMap(domains: readonly RenderDomain[]): string {
  const quadrant = (key: keyof typeof PROFILE_BY_QUADRANT, extraClass: string): string => {
    const zone = PROFILE_BY_QUADRANT[key];
    const matching = domains.filter((domain) => domain.profileLabel === zone.profile).map((domain) => T(domain.title));
    const body = matching.length > 0
      ? `<p class="quadrant-domains">${matching.join(' · ')}</p><p class="quadrant-hint">${T(zone.hint)}</p>`
      : `<p class="quadrant-hint quadrant-empty">${T(EMPTY_QUADRANT_ELEVE[key])}</p>`;
    return `<section class="quadrant ${extraClass}"><h3>${T(zone.title)}</h3>${body}</section>`;
  };
  const untested = domains.filter((domain) => domain.profileLabel === 'non évalué').map((domain) => T(domain.title));
  const untestedRow = untested.length > 0
    ? `<p class="untested">${T('Sans réponse, à situer au démarrage :')} ${untested.join(' · ')}.</p>`
    : '';
  return `<div class="mastery-map">
    ${quadrant('confidentWrong', 'alert')}${quadrant('confidentRight', 'good')}
    ${quadrant('cautiousWrong', '')}${quadrant('cautiousRight', '')}
  </div>${untestedRow}`;
}

/* -------------------------------------------------------------------------- */
/* Parcours en séances                                                         */
/* -------------------------------------------------------------------------- */

type SessionCard = Readonly<{ seanceLabel: string; body: string }>;

function sessionCards(steps: readonly RenderStep[], audience: 'ELEVE' | 'NEXUS'): readonly SessionCard[] {
  return Array.from({ length: STAGE_SESSION_COUNT }, (_, index) => {
    const label = sessionLabel(index + 1);
    const own = steps.filter((step) => step.seanceLabel === label);
    if (own.length === 0) {
      const filler = audience === 'ELEVE'
        ? 'Consolidation d’ensemble : réinvestir ce qui a été repris, automatiser, mesurer le chemin parcouru. Le contenu précis est ajusté avec le groupe.'
        : 'Consolidation d’ensemble et mesure des progrès — contenu ajusté après lecture collective du groupe.';
      return { seanceLabel: label, body: `<p class="session-filler">${T(filler)}</p>` };
    }
    const body = own.map((step) => `<div class="session-step"><h4>${T(step.domainTitle)} <span class="phase-tag">${T(step.phaseDidactique)}</span></h4><p><strong>Objectif${T(' :')}</strong> ${T(step.objectif)}</p><p><strong>Démarche${T(' :')}</strong> ${T(step.demarche)}</p></div>`).join('');
    return { seanceLabel: label, body };
  });
}

function publicLearningPath(steps: readonly RenderStep[]): string {
  const cards = sessionCards(steps, 'ELEVE')
    .map((card) => `<article class="path-step"><p class="session">${T(card.seanceLabel)} · ${T('deux heures')}</p>${card.body}</article>`)
    .join('');
  return `<section class="section print-break"><h2>Ton parcours pendant le stage — ${T(`${sessionCountWord(STAGE_SESSION_COUNT)} séances`)}</h2><div class="path">${cards}</div></section>`;
}

/* -------------------------------------------------------------------------- */
/* Détail des réponses                                                         */
/* -------------------------------------------------------------------------- */

const STATUS_PRESENTATION = Object.freeze({
  JUSTE: { label: 'Juste', className: 'qa-right' },
  A_REVOIR: { label: 'À revoir', className: 'qa-wrong' },
  NON_TRAITE: { label: 'Non traitée', className: 'qa-blank' },
});

function evidenceAnswerRows(
  evidence: QuestionEvidence,
  item: EvidenceItem,
  audience: 'ELEVE' | 'NEXUS',
): string {
  const status = evidenceItemStatus(item);
  const presentation = STATUS_PRESENTATION[status];
  const chosen = chosenOption(item);
  const correct = correctOption(item);
  const declared = confidenceLabel(evidence, item.confidence);
  const confidenceText = declared === null
    ? 'Certitude non renseignée'
    : `Certitude déclarée : ${item.confidence}/4 — « ${declared} »`;

  const answerLine = status === 'NON_TRAITE'
    ? `<p class="qa-answer">Réponse : <em>non traitée</em></p>`
    : `<p class="qa-answer">Réponse donnée : ${T(chosen?.text ?? '')}</p>`;
  const correctLine = status === 'JUSTE' || correct === null
    ? ''
    : `<p class="qa-correct">Réponse attendue : ${T(correct.text)}</p>`;
  const rationale = status === 'A_REVOIR' && chosen?.distractorRationale
    ? `<p class="qa-rationale">D’où vient l’erreur : ${T(chosen.distractorRationale)}</p>`
    : '';
  const correction = `<p class="qa-explain">Ce qu’il faut retenir : ${T(item.shortCorrection)}</p>`;
  const techId = audience === 'NEXUS' ? ` <span class="qa-id">${T(item.itemId)}</span>` : '';

  return `<article class="qa-item ${presentation.className}">
    <p class="qa-head"><span class="qa-status">${T(presentation.label)}</span> <span class="qa-confidence">${T(confidenceText)}</span>${techId}</p>
    <p class="qa-question">${T(item.questionText)}</p>
    ${answerLine}${correctLine}${rationale}${correction}
  </article>`;
}

function evidenceSection(
  evidence: QuestionEvidence | undefined,
  content: RenderContent,
  subject: BilanPackSubject,
  audience: 'ELEVE' | 'NEXUS',
): string {
  if (evidence === undefined || evidence.items.length === 0) return '';
  const heading = audience === 'ELEVE' ? 'Le détail de tes réponses' : 'Détail des réponses';
  const intro = audience === 'ELEVE'
    ? 'Question par question : ta réponse, la réponse attendue quand elles diffèrent, et ce qu’il faut en retenir. C’est ta meilleure base de révision d’ici la première séance.'
    : 'Relevé intégral de la passation : réponse choisie, réponse attendue, certitude déclarée, correction courte.';
  const byDomain = new Map<string, EvidenceItem[]>();
  for (const item of evidence.items) {
    const bucket = byDomain.get(item.domainId) ?? [];
    bucket.push(item);
    byDomain.set(item.domainId, bucket);
  }
  const orderedDomains = content.domains.map(({ id }) => id).filter((id) => byDomain.has(id));
  for (const id of byDomain.keys()) {
    if (!orderedDomains.includes(id)) orderedDomains.push(id);
  }
  const groups = orderedDomains.map((domainId) => {
    const items = byDomain.get(domainId) ?? [];
    const cards = items.map((item) => evidenceAnswerRows(evidence, item, audience)).join('');
    return `<div class="qa-domain"><h3>${T(domainTitle(domainId, subject))}</h3>${cards}</div>`;
  }).join('');
  return `<section class="section print-break qa-section"><h2>${T(heading)}</h2><p class="qa-intro">${T(intro)}</p>${groups}</section>`;
}


/* -------------------------------------------------------------------------- */
/* Repères chiffrés familles — décision produit du 2026-08-12                  */
/* Du concret chiffré, jamais une note : couverture, calibration, répartition  */
/* par profil et réussite par domaine. Le score global ne se rend JAMAIS ici.  */
/* -------------------------------------------------------------------------- */

const FAMILY_PROFILE_BUCKETS = Object.freeze([
  { singular: 'domaine solide', plural: 'domaines solides', profileLabel: 'solide' },
  { singular: 'domaine à consolider', plural: 'domaines à consolider', profileLabel: 'fragile / à consolider' },
  { singular: 'domaine à installer', plural: 'domaines à installer', profileLabel: 'à combler (déjà repéré)' },
  { singular: 'domaine à rectifier en priorité', plural: 'domaines à rectifier en priorité', profileLabel: 'sûr mais à revoir' },
]);

function familyFiguresSection(
  factSheet: FactSheet,
  content: RenderContent,
  audience: 'ELEVE' | 'PARENTS',
  evidence?: QuestionEvidence,
): string {
  const student = audience === 'ELEVE';
  const cards: string[] = [];

  // Couverture : nombre de questions traitées sur le total quand le détail
  // des réponses est disponible, proportion sinon.
  if (evidence !== undefined && evidence.items.length > 0) {
    const treated = evidence.items.filter((item) => evidenceItemStatus(item) !== 'NON_TRAITE').length;
    cards.push(`<article class="figure-card"><p class="figure-value">${treated}<span class="figure-unit"> sur ${evidence.items.length}</span></p><p class="figure-label">${T('questions traitées')}</p></article>`);
  } else if (Number.isFinite(factSheet.coverage)) {
    cards.push(`<article class="figure-card"><p class="figure-value">${T(String(Math.round(factSheet.coverage)))}<span class="figure-unit"> %</span></p><p class="figure-label">${T('du test traité')}</p></article>`);
  }

  // Calibration — le différenciateur Nexus, mis en valeur.
  if (factSheet.calibrationIndex !== null && Number.isFinite(factSheet.calibrationIndex)) {
    const percent = Math.round(factSheet.calibrationIndex);
    const label = student
      ? 'des cas où tu sais dire si ta réponse est sûre — c’est ta boussole de révision'
      : 'des cas où votre enfant sait où il en est — c’est ce que nous mesurons en plus de la réussite';
    cards.push(`<article class="figure-card figure-card-gold"><p class="figure-value">${percent}<span class="figure-unit"> %</span></p><p class="figure-label">${T(label)}</p></article>`);
  }

  // Répartition par profil : compte et proportion.
  const total = content.domains.length;
  const distribution = FAMILY_PROFILE_BUCKETS
    .map((bucket) => ({ bucket, count: content.domains.filter((domain) => domain.profileLabel === bucket.profileLabel).length }))
    .filter(({ count }) => count > 0)
    .map(({ bucket, count }) => `<li><strong>${count}</strong>&nbsp;${T(count > 1 ? bucket.plural : bucket.singular)} <span class="figure-muted">(${Math.round((count / total) * 100)}&nbsp;%)</span></li>`)
    .join('');

  // Réussite par domaine : barres avec pourcentage — jamais le mot « note ».
  const bars = renderScoreBarsSvg(
    factSheet.domains.map((domain) => {
      const rendered = content.domains.find(({ id }) => id === domain.id);
      return {
        label: rendered?.title ?? domainTitle(domain.id),
        score: domain.score,
        priority: domain.profile === 'ERREUR_CONFIANTE' || domain.profile === 'LACUNE_CONSCIENTE',
      };
    }),
    'Réussite par domaine, en pourcentage',
  );

  const heading = student ? 'Tes repères en chiffres' : 'Les repères en chiffres';
  const barsTitle = student ? 'Ta réussite par domaine' : 'La réussite par domaine';
  const note = student
    ? 'Ces chiffres décrivent ta réussite domaine par domaine — ce bilan ne donne pas de note.'
    : 'Ces chiffres décrivent la réussite domaine par domaine — ce bilan ne comporte aucune note.';
  return `<section class="section figures"><h2>${T(heading)}</h2>
    <div class="figure-grid">${cards.join('')}</div>
    ${distribution ? `<ul class="figure-distribution">${distribution}</ul>` : ''}
    <h3 class="figure-bars-title">${T(barsTitle)}</h3>${bars}
    <p class="figure-note">${T(note)}</p>
  </section>`;
}

/* -------------------------------------------------------------------------- */
/* Corps public (élève / parents)                                              */
/* -------------------------------------------------------------------------- */

function methodSection(content: RenderContent, audience: 'ELEVE' | 'PARENTS'): string {
  const title = audience === 'ELEVE' ? 'Comment lire ce bilan' : 'La méthode Nexus : réussite × confiance';
  return `<section class="section method"><h2>${T(title)}</h2><p>${T(content.narrative.methodNote)}</p></section>`;
}

function parentReadingTable(content: RenderContent, subject: BilanPackSubject): string {
  const policy = subjectDisplayPolicy(subject);
  const groups = groupDomainsForDisplay(subject, content.domains);
  const rows = (domains: readonly RenderDomain[]): string => domains
    .map((domain) => `<tr><td>${T(domain.title)}</td><td>${T(domain.profileLabel ?? '')}</td><td>${T(domain.gesture)}</td></tr>`)
    .join('');
  const tables = groups.map((group) => `<h3>${T(group.label)}</h3><table><thead><tr><th>${T(policy.tableNoun === 'aptitudes' ? 'Aptitude' : 'Domaine')}</th><th>Lecture</th><th>Geste pédagogique</th></tr></thead><tbody>${rows(group.domains)}</tbody></table>`).join('');
  return `<section class="section"><h2>Les repères observés</h2>${tables}</section>`;
}

function publicBody(
  factSheet: FactSheet,
  content: RenderContent,
  audience: 'ELEVE' | 'PARENTS',
  subject: BilanPackSubject,
  evidence?: QuestionEvidence,
): string {
  const student = audience === 'ELEVE';
  if (student) {
    return `<main>
    <p class="lead">${T(content.narrative.introduction)}</p>
    ${methodSection(content, audience)}
    <section class="section"><h2>Ta carte maîtrise × confiance</h2>${masteryMap(content.domains)}</section>
    ${familyFiguresSection(factSheet, content, 'ELEVE', evidence)}
    <section class="section"><h2>Tes points d’appui</h2>${list(content.narrative.strengths, 'strengths')}</section>
    <section class="section"><h2>Tes priorités pour le stage</h2>${list(content.narrative.priorities, 'priorities')}</section>
    ${publicLearningPath(content.learningPath.steps)}
    <section class="section"><h2>Ton plan d’action entre les séances</h2>${list(content.narrative.actionPlan, 'action-plan')}</section>
    <section class="section"><h2>Ton auto-évaluation</h2><p>${T(content.narrative.calibration)}</p></section>
    ${evidenceSection(evidence, content, subject, 'ELEVE')}
    <section class="closing"><h2>Pour finir</h2><p>${T(content.narrative.conclusion)}</p></section>
  </main>`;
  }
  return `<main>
    <p class="lead">${T(content.narrative.introduction)}</p>
    ${methodSection(content, audience)}
    ${parentReadingTable(content, subject)}
    ${familyFiguresSection(factSheet, content, 'PARENTS', evidence)}
    <section class="section"><h2>Points d’appui</h2>${list(content.narrative.strengths, 'strengths')}</section>
    <section class="section"><h2>Les priorités du stage</h2>${list(content.narrative.priorities, 'priorities')}</section>
    <section class="section print-break"><h2>Ce que le stage fera, concrètement</h2>${list(content.narrative.actionPlan, 'action-plan')}</section>
    <section class="section"><h2>L’auto-évaluation de votre enfant</h2><p>${T(content.narrative.calibration)}</p><p class="qa-pointer">${T('Le détail question par question figure dans le document remis à votre enfant ; l’équipe le commente volontiers avec vous.')}</p></section>
    <section class="closing"><h2>En synthèse</h2><p>${T(content.narrative.conclusion)}</p></section>
  </main>`;
}

/* -------------------------------------------------------------------------- */
/* Corps Nexus                                                                 */
/* -------------------------------------------------------------------------- */

function nexusBody(
  content: RenderContent,
  subject: BilanPackSubject,
  evidence?: QuestionEvidence,
): string {
  if (content.internalFacts === undefined) throw new Error('BILAN_HTML_NEXUS_FACTS_MISSING');
  const policy = subjectDisplayPolicy(subject);
  const groups = groupDomainsForDisplay(subject, content.domains);
  const alerts = content.domains.filter(({ profile }) => profile === 'ERREUR_CONFIANTE');
  const priorityIds = new Set(content.domains
    .filter(({ profile }) => profile === 'ERREUR_CONFIANTE' || profile === 'LACUNE_CONSCIENTE')
    .map(({ id }) => id));

  const scoreChart = renderScoreBarsSvg(content.domains.map((domain) => ({
    label: domain.title,
    score: domain.score ?? 0,
    priority: priorityIds.has(domain.id),
  })));

  let calibrationChart = '';
  if (evidence !== undefined) {
    const means = meanConfidenceByDomain(evidence);
    const points = content.domains
      .map((domain) => ({ domain, confidence: means.get(domain.id) ?? null }))
      .filter((entry): entry is { domain: RenderDomain; confidence: number } => entry.confidence !== null)
      .map(({ domain, confidence }) => ({ label: domain.title, score: domain.score ?? 0, confidence }));
    if (points.length > 0) {
      calibrationChart = `<section class="section"><h2>${T('Calibration : réussite × confiance déclarée')}</h2>${renderCalibrationSvg(points)}</section>`;
    }
  }

  const sessions = sessionCards(content.learningPath.steps, 'NEXUS')
    .map((card) => `<article><h3>${T(card.seanceLabel)}</h3>${card.body}</article>`)
    .join('');

  const domainTables = groups.map((group) => `<h3>${T(group.label)}</h3><table><thead><tr><th>Repère</th><th>Profil</th><th>Score</th><th>Geste</th></tr></thead><tbody>${group.domains.map((domain) => `<tr><td>${T(domain.title)}</td><td>${T(domain.profile)}</td><td>${T(domain.score)}</td><td>${T(domain.gesture)}</td></tr>`).join('')}</tbody></table>`).join('');

  return `<main>
    <p class="lead">${T(content.narrative.introduction)}</p>
    <section class="section internal"><h2>Données internes</h2><div class="kpis"><p><strong>Score global</strong><span>${T(content.internalFacts.globalScore)}</span></p><p><strong>Couverture</strong><span>${T(content.internalFacts.coverage)}</span></p><p><strong>Calibration</strong><span>${T(content.internalFacts.calibrationIndex ?? 'non mesurable')}</span></p></div><p class="method-note">${T(content.narrative.methodNote)}</p><p class="method-note">${T(content.narrative.calibration)}</p></section>
    <section class="section"><h2>Tableau des ${policy.tableNoun}</h2>${domainTables}</section>
    <section class="section"><h2>Scores par ${policy.tableNoun === 'aptitudes' ? 'aptitude' : 'domaine'}</h2>${scoreChart}</section>
    ${calibrationChart}
    <section class="section print-break"><h2>Plan des ${T(sessionCountWord(STAGE_SESSION_COUNT))} séances</h2><div class="weeks">${sessions}</div></section>
    <section class="section alerts"><h2>Alertes pédagogiques</h2>${alerts.length > 0 ? alerts.map((domain) => `<p><strong>${T(domain.title)}</strong> · ERREUR_CONFIANTE — ${T(domain.gesture)}</p>`).join('') : '<p>Aucune alerte prioritaire.</p>'}</section>
    ${evidenceSection(evidence, content, subject, 'NEXUS')}
  </main>`;
}

/* -------------------------------------------------------------------------- */
/* Feuille de style                                                            */
/* -------------------------------------------------------------------------- */

function styleSheet(): string {
  return `@font-face{font-family:'${BILAN_PRINT_BRAND.fonts.display}';src:url('${BILAN_PRINT_BRAND.fonts.displayAsset}') format('woff2')}@font-face{font-family:'${BILAN_PRINT_BRAND.fonts.body}';src:url('${BILAN_PRINT_BRAND.fonts.bodyAsset}') format('woff2')}
  :root{${bilanPrintTokenCss()}}*{box-sizing:border-box}body{margin:0;background:var(--color-lux-ivory);color:var(--color-lux-ink);font-family:var(--font-dm-sans);font-size:10.5pt;line-height:1.5}.page{width:210mm;min-height:297mm;margin:0 auto;padding:16mm 16mm 18mm;background:var(--color-lux-paper)}h1,h2,h3{font-family:var(--font-fraunces);font-weight:600}h1{font-size:22pt;margin:0 0 2mm}h2{font-size:15pt;border-bottom:1px solid var(--color-lux-gold);padding-bottom:2mm}h3{font-size:11.5pt}h4{margin:0 0 1mm;font-size:10.5pt}.report-header{display:flex;gap:7mm;align-items:center;border-bottom:2px solid var(--color-lux-gold);padding-bottom:6mm}.brand-logo{width:48mm;height:auto}.identity{flex:1}.eyebrow,.session{color:var(--color-lux-gold-deep);font-weight:700;text-transform:uppercase;letter-spacing:.08em}.lead{font-family:var(--font-fraunces);font-size:13pt}.section{margin-top:8mm;break-inside:avoid}.qa-section{break-inside:auto}.method{background:var(--color-lux-white);border:1px solid var(--color-lux-line);border-left:3px solid var(--color-lux-gold);border-radius:3mm;padding:4mm 5mm}.method h2{border-bottom:none;margin:0 0 2mm;padding-bottom:0}.mastery-map{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm}.quadrant{border:1px solid var(--color-lux-line);border-radius:3mm;padding:4mm;background:var(--color-lux-white)}.quadrant.alert{border-color:var(--color-lux-gold-deep);background:var(--color-lux-gold-wash)}.quadrant.good{border-color:var(--color-lux-evergreen)}.quadrant h3{margin:0 0 1.5mm}.quadrant-domains{margin:0 0 1mm;font-weight:600}.quadrant-hint{margin:0;color:var(--color-lux-slate);font-size:9.5pt}.untested{margin-top:3mm;color:var(--color-lux-slate)}.kpis,.weeks{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm}.kpis{grid-template-columns:repeat(3,1fr)}.path{display:grid;gap:4mm}.path-step,.kpis p,.weeks article{border:1px solid var(--color-lux-line);border-radius:3mm;padding:4mm;background:var(--color-lux-white)}.session-step{margin-top:2mm}.session-filler{color:var(--color-lux-slate);margin:1mm 0 0}.phase-tag{display:inline-block;margin-left:2mm;padding:0.5mm 2mm;border:1px solid var(--color-lux-gold);border-radius:2mm;color:var(--color-lux-gold-deep);font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-family:var(--font-dm-sans)}.priorities li{border-left:3px solid var(--color-lux-gold);padding-left:3mm;margin-bottom:2mm}.strengths li{color:var(--color-lux-evergreen);margin-bottom:2mm}.action-plan li{margin-bottom:2mm}.closing{margin-top:9mm;padding:5mm;background:var(--color-lux-ink);color:var(--color-lux-on-dark)}.closing h2{color:var(--color-lux-gold-bright);border-bottom-color:var(--color-lux-gold-deep)}table{width:100%;border-collapse:collapse;margin-bottom:5mm}th,td{text-align:left;padding:2mm;border-bottom:1px solid var(--color-lux-line);vertical-align:top}th{color:var(--color-lux-slate);font-size:9pt;text-transform:uppercase;letter-spacing:.05em}.kpis p{display:flex;justify-content:space-between;align-items:baseline}.kpis span{font-family:var(--font-fraunces);font-size:18pt}.method-note{color:var(--color-lux-ink-700);font-size:9.5pt;margin:3mm 0 0}.qa-intro{color:var(--color-lux-slate)}.qa-domain{margin-top:4mm}.qa-domain h3{border-bottom:1px solid var(--color-lux-line);padding-bottom:1mm}.qa-item{border:1px solid var(--color-lux-line);border-left:3px solid var(--color-lux-slate);border-radius:2mm;padding:3mm 4mm;margin-bottom:3mm;background:var(--color-lux-white);break-inside:avoid}.qa-item.qa-right{border-left-color:var(--color-lux-evergreen)}.qa-item.qa-wrong{border-left-color:var(--color-lux-gold-deep)}.qa-item.qa-blank{border-left-color:var(--color-lux-slate)}.qa-head{margin:0 0 1.5mm;font-size:9pt;color:var(--color-lux-slate)}.qa-status{font-weight:700;text-transform:uppercase;letter-spacing:.05em}.qa-right .qa-status{color:var(--color-lux-evergreen)}.qa-wrong .qa-status{color:var(--color-lux-gold-deep)}.qa-confidence{margin-left:3mm}.qa-id{float:right;color:var(--color-lux-slate)}.qa-question{margin:0 0 1.5mm;font-weight:600}.qa-answer,.qa-correct,.qa-rationale,.qa-explain{margin:0 0 1mm;font-size:9.5pt}.qa-correct{color:var(--color-lux-evergreen)}.qa-rationale{color:var(--color-lux-ink-700)}.qa-explain{color:var(--color-lux-slate)}.qa-pointer{color:var(--color-lux-slate);font-size:9.5pt}.figures h2{margin-bottom:4mm}.figure-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm}.figure-card{border:1px solid var(--color-lux-line);border-radius:3mm;padding:4mm;background:var(--color-lux-white)}.figure-card-gold{border-color:var(--color-lux-gold);background:var(--color-lux-gold-wash)}.figure-value{margin:0;font-family:var(--font-fraunces);font-size:22pt;color:var(--color-lux-ink)}.figure-unit{font-size:11pt;color:var(--color-lux-slate)}.figure-label{margin:1mm 0 0;font-size:9.5pt;color:var(--color-lux-slate)}.figure-distribution{margin:4mm 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:3mm 6mm}.figure-distribution li{font-size:10pt}.figure-muted{color:var(--color-lux-slate)}.figure-bars-title{margin-top:5mm}.figure-note{margin-top:2mm;font-size:9pt;color:var(--color-lux-slate)}.footer{display:flex;align-items:center;gap:3mm;margin-top:10mm;padding-top:4mm;border-top:1px solid var(--color-lux-line);color:var(--color-lux-slate)}.footer img{width:9mm;height:9mm}.print-break{break-before:auto}@page{size: A4;margin:0}@media print{body{background:var(--color-lux-white)}.page{margin:0;box-shadow:none}.print-break{break-before:page}}`;
}

/* -------------------------------------------------------------------------- */
/* Document                                                                    */
/* -------------------------------------------------------------------------- */

export function renderDeterministicBilanHtml(
  factSheet: FactSheet,
  audience: ReportAudience,
  identity: RenderIdentity,
  humanIdentity?: HumanRenderIdentity,
  evidence?: QuestionEvidence,
): string {
  // The canonical identity is deliberately sent to the deterministic engine.
  // The human identity is projected only after that content exists, in the
  // document header below.
  const report = buildDeterministicReport(factSheet, audience, identity);
  const content = report.content as unknown as RenderContent;
  const body = audience === 'NEXUS'
    ? nexusBody(content, identity.subject, evidence)
    : publicBody(factSheet, content, audience, identity.subject, evidence);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${T(identity.stageLabel)} · ${escapeHtml(audience)}</title><style>${styleSheet()}</style></head><body><article class="page" data-audience="${audience}" data-template="${BILAN_HTML_TEMPLATE_VERSION}">${header(identity, audience, humanIdentity)}${body}<footer class="footer"><img src="${BILAN_PRINT_BRAND.logos.compact}" alt=""><span>Nexus Réussite · Document pédagogique confidentiel</span></footer></article></body></html>`;
}
