/**
 * Prompt Context Pack — Builds the structured context injected into LLM calls.
 *
 * Aggregates: programme info, chapters seen/notYet, scoring results,
 * weakest domains, errors, priorities, exam format, risk factors, RAG context.
 */

import type { BilanDiagnosticMathsData } from '@/lib/validations';
import type {
  PromptContextPack,
  ChapterDefinition,
  ChaptersSelection,
  DiagnosticDefinition,
  ScoringV2Result,
} from './types';

/**
 * Resolve chapters selection from form data + definition.
 * Computes notYet automatically from the full programme.
 */
export function resolveChaptersSelection(
  data: BilanDiagnosticMathsData,
  definition: DiagnosticDefinition | null
): ChaptersSelection {
  const allChapterIds = (definition?.chapters ?? []).map((ch) => ch.chapterId);
  const selected = data.chapters?.selected ?? [];
  const inProgress = data.chapters?.inProgress ?? [];
  const seenSet = new Set([...selected, ...inProgress]);
  const notYet = allChapterIds.filter((id) => !seenSet.has(id));

  return { selected, inProgress, notYet };
}

/**
 * Get the set of skill IDs that belong to "notYet" chapters.
 * These skills should be excluded or penalized lightly in scoring.
 */
export function getNotYetSkillIds(
  chaptersSelection: ChaptersSelection,
  chapters: ChapterDefinition[]
): Set<string> {
  const notYetSet = new Set(chaptersSelection.notYet);
  const skillIds = new Set<string>();
  for (const ch of chapters) {
    if (notYetSet.has(ch.chapterId)) {
      for (const sid of ch.skills) {
        skillIds.add(sid);
      }
    }
  }
  return skillIds;
}

/**
 * Get chapter labels for a list of chapter IDs.
 */
export function getChapterLabels(
  chapterIds: string[],
  chapters: ChapterDefinition[]
): string[] {
  const map = new Map(chapters.map((ch) => [ch.chapterId, ch.chapterLabel]));
  return chapterIds.map((id) => map.get(id) ?? id);
}

/**
 * Build the full prompt context pack for LLM injection.
 */
export function buildPromptContextPack(
  data: BilanDiagnosticMathsData,
  scoring: ScoringV2Result,
  definition: DiagnosticDefinition | null,
  ragContext: string
): PromptContextPack {
  const chapters = definition?.chapters ?? [];
  const chaptersSelection = resolveChaptersSelection(data, definition);

  const weakestDomains = [...scoring.domainScores]
    .filter((d) => d.score > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((d) => ({ domain: d.domain, score: d.score }));

  const dominantErrors = scoring.domainScores
    .flatMap((d) => d.dominantErrors)
    .filter((e, i, arr) => arr.indexOf(e) === i)
    .slice(0, 5);

  const topPriorities = scoring.topPriorities.slice(0, 5).map((p) => ({
    skill: p.skillLabel,
    reason: p.reason,
  }));

  const examFormat = definition?.examFormat
    ? {
        duration: definition.examFormat.duration,
        calculatorAllowed: definition.examFormat.calculatorAllowed,
        structure: definition.examFormat.structure,
      }
    : null;

  return {
    programme: {
      discipline: data.discipline ?? definition?.track ?? 'maths',
      level: data.level ?? definition?.level ?? 'premiere',
      definitionKey: data.definitionKey ?? definition?.key ?? 'maths-premiere-p2',
    },
    chaptersSeen: getChapterLabels(chaptersSelection.selected, chapters),
    chaptersInProgress: getChapterLabels(chaptersSelection.inProgress, chapters),
    chaptersNotYet: getChapterLabels(chaptersSelection.notYet, chapters),
    scoring: {
      readinessScore: scoring.readinessScore,
      riskIndex: scoring.riskIndex,
      trustScore: scoring.trustScore,
      recommendation: scoring.recommendation,
    },
    weakestDomains,
    dominantErrors,
    topPriorities,
    examFormat,
    riskFactors: definition?.riskModel?.factors ?? [],
    ragContext,
  };
}

/**
 * Render the prompt context pack as a string for LLM injection.
 */
export function renderPromptContext(ctx: PromptContextPack): string {
  const lines: string[] = [];

  lines.push(`PROGRAMME: ${ctx.programme.discipline.toUpperCase()} ${ctx.programme.level} (${ctx.programme.definitionKey})`);
  lines.push('');

  if (ctx.chaptersSeen.length > 0) {
    lines.push(`CHAPITRES VUS (${ctx.chaptersSeen.length}):`);
    for (const ch of ctx.chaptersSeen) lines.push(`  ✅ ${ch}`);
  }
  if (ctx.chaptersInProgress.length > 0) {
    lines.push(`CHAPITRES EN COURS (${ctx.chaptersInProgress.length}):`);
    for (const ch of ctx.chaptersInProgress) lines.push(`  🔄 ${ch}`);
  }
  if (ctx.chaptersNotYet.length > 0) {
    lines.push(`CHAPITRES NON VUS (${ctx.chaptersNotYet.length}):`);
    for (const ch of ctx.chaptersNotYet) lines.push(`  ⏳ ${ch}`);
  }
  lines.push('');

  lines.push('CONSIGNE IMPORTANTE:');
  lines.push('- Ne PAS exiger de notions issues des chapitres non vus.');
  lines.push('- Priorités uniquement sur les chapitres vus OU prérequis indispensables.');
  lines.push('- Distinguer clairement: "sécuriser les acquis vus" vs "préparer les prochains chapitres".');
  lines.push('');

  lines.push('SCORES:');
  lines.push(`  ReadinessScore: ${ctx.scoring.readinessScore}/100`);
  lines.push(`  RiskIndex: ${ctx.scoring.riskIndex}/100`);
  lines.push(`  TrustScore: ${ctx.scoring.trustScore}/100`);
  lines.push(`  Recommandation: ${ctx.scoring.recommendation}`);
  lines.push('');

  if (ctx.weakestDomains.length > 0) {
    lines.push('DOMAINES LES PLUS FAIBLES:');
    for (const d of ctx.weakestDomains) lines.push(`  - ${d.domain}: ${d.score}%`);
    lines.push('');
  }

  if (ctx.dominantErrors.length > 0) {
    lines.push(`ERREURS DOMINANTES: ${ctx.dominantErrors.join(', ')}`);
    lines.push('');
  }

  if (ctx.topPriorities.length > 0) {
    lines.push('PRIORITÉS:');
    for (const p of ctx.topPriorities) lines.push(`  - ${p.skill}: ${p.reason}`);
    lines.push('');
  }

  if (ctx.examFormat) {
    lines.push('FORMAT ÉPREUVE:');
    lines.push(`  Durée: ${ctx.examFormat.duration}min`);
    lines.push(`  Calculatrice: ${ctx.examFormat.calculatorAllowed ? 'autorisée' : 'interdite'}`);
    lines.push(`  Structure: ${ctx.examFormat.structure}`);
    lines.push('');
  }

  if (ctx.riskFactors.length > 0) {
    lines.push(`FACTEURS DE RISQUE: ${ctx.riskFactors.join(', ')}`);
    lines.push('');
  }

  if (ctx.ragContext) {
    lines.push('CONTEXTE PÉDAGOGIQUE (base de connaissances):');
    lines.push(ctx.ragContext);
  }

  return lines.join('\n');
}

/**
 * Build chapter-aware RAG queries.
 * Focuses on: weakest seen chapters, dominant errors, exam format.
 */
export function buildChapterAwareRAGQueries(
  data: BilanDiagnosticMathsData,
  scoring: ScoringV2Result,
  definition: DiagnosticDefinition | null
): string[] {
  const queries: string[] = [];
  const discipline = data.discipline ?? definition?.track ?? 'maths';
  const level = data.level ?? definition?.level ?? 'premiere';
  const chapters = definition?.chapters ?? [];
  const chaptersSelection = resolveChaptersSelection(data, definition);

  // 1. Weakest seen chapters (2-3 queries)
  const seenChapterIds = new Set([...chaptersSelection.selected, ...chaptersSelection.inProgress]);
  const weakDomains = [...scoring.domainScores]
    .filter((d) => d.score > 0 && d.priority !== 'low')
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  for (const domain of weakDomains) {
    const domainChapters = chapters
      .filter((ch) => ch.domainId === domain.domain && seenChapterIds.has(ch.chapterId));
    if (domainChapters.length > 0) {
      const chLabel = domainChapters[0].chapterLabel;
      queries.push(`${chLabel} ${discipline} ${level} exercices méthode`);
    } else {
      queries.push(`${domain.domain} ${discipline} ${level} méthode`);
    }
  }

  // 2. Dominant error types (1 query)
  const errorTypes = data.methodology?.errorTypes ?? [];
  if (errorTypes.length > 0) {
    queries.push(`erreurs fréquentes ${errorTypes.slice(0, 2).join(' ')} ${discipline} méthode correction`);
  }

  // 3. Exam format specific (1 query)
  if (definition?.examFormat) {
    const calcStr = definition.examFormat.calculatorAllowed ? 'avec calculatrice' : 'sans calculatrice';
    queries.push(`épreuve ${discipline} ${level} préparation ${calcStr}`);
  }

  return queries.slice(0, 4);
}
