import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { PrismaClient } from '@prisma/client';

import lexicon from '@/data/bilans/lexique-interdit.json';
import modelPolicy from '@/data/bilans/model-policy.json';
import { prisma } from '@/lib/prisma';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import type { FactSheet } from '../facts/fact-sheet';
import { scanPiiFields } from '../local-first/pii';
import {
  buildQuestionEvidence,
  chosenOption,
  correctOption,
  evidenceItemStatus,
} from '../render/question-evidence';
import { orderPriorityDomains } from '../render/profile-copy';
import { domainTitle } from '../render/domain-labels';
import {
  TEACHER_BRIEF_DOMAIN_MAX_CHARS,
  TEACHER_BRIEF_JSON_SHAPE,
  TEACHER_BRIEF_PROMPT_VERSION,
  teacherBriefDomainResponseSchema,
  teacherBriefSchema,
  type TeacherBriefContent,
} from './teacher-brief-schema';

/**
 * Brief enseignant enrichi par LLM — génération, repli, coût.
 *
 * Le LLM habille le diagnostic déterministe (profils, priorités, items
 * réellement ratés) ; il ne le recalcule jamais. Tout échec — clé absente,
 * réseau, JSON invalide, schéma violé, lexique enfreint, budget dépassé —
 * aboutit au même repli : PAS de brief, le document Nexus déterministe
 * reste la référence (mode PLANCHER), sans erreur bloquante.
 *
 * Pseudonymisation : le payload envoyé ne contient que l'alias, les faits
 * pédagogiques et les contenus de banque. Il est passé au scanner PII
 * fail-closed AVANT tout appel réseau.
 */

export const TEACHER_BRIEF_SERVICE_VERSION = 'teacher-brief-service.v1' as const;

/** Le fichier de prompt SUIT la version : aucun chemin à resynchroniser à la main. */
const PROMPT_PATH = path.join('data', 'bilans', 'prompts', `${TEACHER_BRIEF_PROMPT_VERSION}.md`);
const FORBIDDEN_TERMS: readonly string[] = Object.values(lexicon.categories).flat();

/**
 * Plafond de sortie d'un appel unitaire (un domaine), dérivé des bornes du
 * schéma plutôt que deviné : le pire cas d'un domaine en caractères, converti
 * en jetons au ratio prudent du français en JSON (~2,5 car./jeton), majoré
 * d'une marge de 40 %. Un appel = un domaine, donc ce plafond ne dépend PAS
 * du nombre de domaines prioritaires du bilan.
 */
const CHARS_PER_TOKEN_FR_JSON = 2.5;
const OUTPUT_MARGIN = 1.4;
export const TEACHER_BRIEF_DEFAULT_MAX_TOKENS = Math.ceil(
  (TEACHER_BRIEF_DOMAIN_MAX_CHARS / CHARS_PER_TOKEN_FR_JSON) * OUTPUT_MARGIN / 100,
) * 100;
const MAX_TOKENS_FLOOR = 500;
const MAX_TOKENS_CEILING = 8_000;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_TIMEOUT_MS = 45_000;
const TIMEOUT_FLOOR_MS = 5_000;
const TIMEOUT_CEILING_MS = 120_000;
const DEFAULT_MONTHLY_BUDGET_USD = 20;
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

/** Lit un nombre d'environnement, borné ; toute valeur invalide → défaut. */
function boundedNumber(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
  integer: boolean,
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  if (integer && !Number.isSafeInteger(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}

export class TeacherBriefError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'TeacherBriefError';
  }
}

type BriefPolicy = Readonly<{
  allowedModels: readonly string[];
  defaultModel: string;
  promptCaching: Readonly<Record<string, boolean>>;
  pricingUsdPerMillionTokens: Readonly<Record<string, Readonly<{ input: number; cachedInput: number; output: number }>>>;
}>;

const BRIEF_POLICY = (modelPolicy as { teacherBrief: BriefPolicy }).teacherBrief;

export type TeacherBriefConfig = Readonly<{
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  monthlyBudgetUsd: number;
  baseUrl: string;
  supportsPromptCaching: boolean;
}>;

/**
 * Modèle en constante de configuration (env), contraint par l'allowlist
 * versionnée — modifiable sans redéploiement, jamais hors liste.
 */
export function resolveTeacherBriefConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): TeacherBriefConfig {
  const apiKey = environment.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new TeacherBriefError('OPENROUTER_API_KEY_MISSING');
  const model = environment.NEXUS_TEACHER_BRIEF_MODEL?.trim() || BRIEF_POLICY.defaultModel;
  if (!BRIEF_POLICY.allowedModels.includes(model)) throw new TeacherBriefError('TEACHER_BRIEF_MODEL_NOT_ALLOWLISTED');
  return Object.freeze({
    apiKey,
    model,
    maxTokens: boundedNumber(
      environment.NEXUS_TEACHER_BRIEF_MAX_TOKENS,
      TEACHER_BRIEF_DEFAULT_MAX_TOKENS,
      MAX_TOKENS_FLOOR,
      MAX_TOKENS_CEILING,
      true,
    ),
    temperature: boundedNumber(environment.NEXUS_TEACHER_BRIEF_TEMPERATURE, DEFAULT_TEMPERATURE, 0, 1, false),
    timeoutMs: boundedNumber(
      environment.NEXUS_TEACHER_BRIEF_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      TIMEOUT_FLOOR_MS,
      TIMEOUT_CEILING_MS,
      true,
    ),
    monthlyBudgetUsd: boundedNumber(
      environment.NEXUS_TEACHER_BRIEF_MONTHLY_BUDGET_USD,
      DEFAULT_MONTHLY_BUDGET_USD,
      0.01,
      Number.MAX_SAFE_INTEGER,
      false,
    ),
    baseUrl: environment.OPENROUTER_BASE_URL?.trim() || DEFAULT_BASE_URL,
    supportsPromptCaching: BRIEF_POLICY.promptCaching[model] === true,
  });
}

export function estimateCostUsd(
  model: string,
  usage: Readonly<{ promptTokens: number; cachedPromptTokens: number; completionTokens: number }>,
): number {
  const pricing = BRIEF_POLICY.pricingUsdPerMillionTokens[model];
  if (pricing === undefined) return 0;
  const freshPrompt = Math.max(0, usage.promptTokens - usage.cachedPromptTokens);
  const cost = (freshPrompt * pricing.input + usage.cachedPromptTokens * pricing.cachedInput + usage.completionTokens * pricing.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/* -------------------------------------------------------------------------- */
/* Payload — partie stable (cacheable) et partie variable (par élève)          */
/* -------------------------------------------------------------------------- */

export function loadTeacherBriefPrompt(): string {
  return readFileSync(path.join(process.cwd(), PROMPT_PATH), 'utf8');
}

/** Partie STABLE du prompt — identique pour tous les bilans → cache. */
export function buildStableSystemPrompt(): string {
  return [
    loadTeacherBriefPrompt(),
    '',
    '## Schéma JSON exact de la sortie',
    JSON.stringify(TEACHER_BRIEF_JSON_SHAPE),
    '',
    `## Termes et tournures STRICTEMENT interdits`,
    JSON.stringify(FORBIDDEN_TERMS),
  ].join('\n');
}

export type TeacherBriefFactsPayload = Readonly<{
  eleve: Readonly<{ alias: string; niveau: string }>;
  matiere: string;
  domainesPrioritaires: readonly Readonly<{
    domainId: string;
    libelle: string;
    profil: string;
    itemsRates: readonly Readonly<{
      itemId: string;
      enonce: string;
      reponseChoisie: string;
      mecanismeErreur: string | null;
      bonneReponse: string;
      correction: string;
    }>[];
  }>[];
}>;

/** Partie VARIABLE — les faits de l'élève, pseudonymisés, scan PII fail-closed. */
export function buildStudentFactsPayload(
  factSheet: FactSheet,
  pack: Parameters<typeof buildQuestionEvidence>[0],
  answers: unknown,
  subjectLabel: string,
): TeacherBriefFactsPayload {
  const evidence = buildQuestionEvidence(pack, answers);
  const priorities = orderPriorityDomains(factSheet.domains).slice(0, 4);
  if (priorities.length < 2) throw new TeacherBriefError('TEACHER_BRIEF_TOO_FEW_PRIORITIES');

  const domains = priorities.map((domain) => {
    const failed = evidence.items
      .filter((item) => item.domainId === domain.id && evidenceItemStatus(item) === 'A_REVOIR')
      .map((item) => {
        const chosen = chosenOption(item);
        const correct = correctOption(item);
        return Object.freeze({
          itemId: item.itemId,
          enonce: item.questionText,
          reponseChoisie: chosen?.text ?? 'non traité',
          mecanismeErreur: chosen?.distractorRationale ?? null,
          bonneReponse: correct?.text ?? '',
          correction: item.shortCorrection,
        });
      });
    const untreated = evidence.items
      .filter((item) => item.domainId === domain.id && evidenceItemStatus(item) === 'NON_TRAITE')
      .map((item) => Object.freeze({
        itemId: item.itemId,
        enonce: item.questionText,
        reponseChoisie: 'non traité',
        mecanismeErreur: null,
        bonneReponse: correctOption(item)?.text ?? '',
        correction: item.shortCorrection,
      }));
    return Object.freeze({
      domainId: domain.id,
      libelle: domainTitle(domain.id),
      profil: domain.profile,
      itemsRates: Object.freeze([...failed, ...untreated]),
    });
  });

  const payload: TeacherBriefFactsPayload = Object.freeze({
    eleve: Object.freeze({ alias: factSheet.student.alias, niveau: factSheet.student.level }),
    matiere: subjectLabel,
    domainesPrioritaires: Object.freeze(domains),
  });

  // Frontière PII fail-closed : rien ne part si le scan n'est pas CLEAN.
  const fields: { path: string; text: string; source: 'CONTROLLED_TEMPLATE' }[] = [];
  const collect = (value: unknown, at: string): void => {
    if (typeof value === 'string') fields.push({ path: at, text: value, source: 'CONTROLLED_TEMPLATE' });
    else if (Array.isArray(value)) value.forEach((entry, index) => collect(entry, `${at}[${index}]`));
    else if (value !== null && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) collect(child, `${at}.${key}`);
    }
  };
  collect(payload, '$');
  const scan = scanPiiFields(fields);
  if (scan.result.status !== 'CLEAN') throw new TeacherBriefError('TEACHER_BRIEF_PII_BOUNDARY');

  return payload;
}

/* -------------------------------------------------------------------------- */
/* Appel OpenRouter avec cache prompting                                       */
/* -------------------------------------------------------------------------- */

export type TeacherBriefGeneration = Readonly<{
  content: TeacherBriefContent;
  promptTokens: number;
  cachedPromptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  generationMs: number;
  model: string;
  promptVersion: typeof TEACHER_BRIEF_PROMPT_VERSION;
}>;

/** Usage brut d'un appel unitaire, avant agrégation. */
type DomainCallOutcome = Readonly<{
  domaine: TeacherBriefContent['domaines'][number];
  promptTokens: number;
  cachedPromptTokens: number;
  completionTokens: number;
}>;

/**
 * Appel UNITAIRE : un domaine prioritaire, une réponse. La partie stable du
 * prompt (consignes + schéma + lexique) est identique d'un appel à l'autre :
 * elle est mise en cache par le fournisseur, si bien que le surcoût d'un
 * appel supplémentaire porte presque uniquement sur les jetons de sortie.
 */
async function callTeacherBriefDomain(
  config: TeacherBriefConfig,
  facts: TeacherBriefFactsPayload,
  fetchImpl: typeof fetch,
): Promise<DomainCallOutcome> {
  const systemContent = config.supportsPromptCaching
    ? [{ type: 'text', text: buildStableSystemPrompt(), cache_control: { type: 'ephemeral' } }]
    : buildStableSystemPrompt();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Nexus Reussite Brief Enseignant',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: JSON.stringify(facts) },
        ],
        usage: { include: true },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
    throw new TeacherBriefError(aborted ? 'TEACHER_BRIEF_TIMEOUT' : 'TEACHER_BRIEF_NETWORK');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new TeacherBriefError(`TEACHER_BRIEF_HTTP_${response.status}`);

  const payload = await response.json() as {
    choices?: readonly { message?: { content?: unknown }; finish_reason?: string }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
      cache_read_input_tokens?: number;
    };
  };
  const raw = payload.choices?.[0]?.message?.content;
  if (typeof raw !== 'string' || raw.trim() === '') throw new TeacherBriefError('TEACHER_BRIEF_EMPTY');

  // Une sortie coupée au plafond est signalée pour ce qu'elle est : le repli
  // doit rester lisible comme une panne de dimensionnement, pas comme un
  // « JSON invalide » du modèle.
  if (payload.choices?.[0]?.finish_reason === 'length') {
    throw new TeacherBriefError('TEACHER_BRIEF_TRUNCATED');
  }

  let parsed: unknown;
  try {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    parsed = JSON.parse(fenced ? fenced[1] : trimmed);
  } catch {
    throw new TeacherBriefError('TEACHER_BRIEF_INVALID_JSON');
  }
  const validated = teacherBriefDomainResponseSchema.safeParse(parsed);
  if (!validated.success) {
    // Seuls les CHEMINS de schéma et les codes sont journalisés — jamais le
    // texte produit. Sans cela, un repli PLANCHER pour schéma invalide reste
    // impossible à diagnostiquer en production.
    console.error(JSON.stringify({
      event: 'TEACHER_BRIEF_SCHEMA_REJECTED',
      domainId: facts.domainesPrioritaires[0]?.domainId,
      issues: validated.error.issues.slice(0, 8).map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
      })),
    }));
    throw new TeacherBriefError('TEACHER_BRIEF_SCHEMA_REJECTED');
  }

  assertBriefRespectsFacts(validated.data, facts);

  return Object.freeze({
    domaine: validated.data.domaines[0],
    promptTokens: payload.usage?.prompt_tokens ?? 0,
    cachedPromptTokens: payload.usage?.prompt_tokens_details?.cached_tokens
      ?? payload.usage?.cache_read_input_tokens
      ?? 0,
    completionTokens: payload.usage?.completion_tokens ?? 0,
  });
}

/**
 * Brief complet : UN APPEL PAR DOMAINE PRIORITAIRE, puis réassemblage et
 * validation d'un bloc.
 *
 * Pourquoi par lots plutôt qu'un seul appel au plafond relevé — un appel
 * unique fait dépendre la taille de sortie du NOMBRE de domaines : à quatre
 * domaines développés (erreurs typiques, prérequis, activité en cinq phases,
 * indicateur), la sortie dépasse tout plafond raisonnable et la troncature
 * fait perdre le brief ENTIER. Découpé par domaine, le pire cas d'un appel
 * est celui d'un seul domaine — borné par le schéma, indépendant du bilan.
 * La partie stable du prompt étant mise en cache, le surcoût des appels
 * supplémentaires est marginal (jetons d'entrée à tarif cache).
 *
 * Fail-closed inchangé : si UN domaine échoue, aucun brief n'est produit —
 * jamais de brief partiel présenté comme complet.
 */
export async function callTeacherBriefModel(
  config: TeacherBriefConfig,
  facts: TeacherBriefFactsPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<TeacherBriefGeneration> {
  const startedAt = Date.now();
  const outcomes: DomainCallOutcome[] = [];
  for (const domaine of facts.domainesPrioritaires) {
    const singleDomainFacts: TeacherBriefFactsPayload = Object.freeze({
      eleve: facts.eleve,
      matiere: facts.matiere,
      domainesPrioritaires: Object.freeze([domaine]),
    });
    outcomes.push(await callTeacherBriefDomain(config, singleDomainFacts, fetchImpl));
  }

  // Code distinct de celui d'un appel unitaire : un rejet au réassemblage ne
  // met pas en cause la sortie du modèle mais le recollement (nombre de
  // domaines hors bornes). Sans cette distinction, le repli est indiagnosticable.
  const content = teacherBriefSchema.safeParse({
    version: TEACHER_BRIEF_PROMPT_VERSION,
    domaines: outcomes.map((outcome) => outcome.domaine),
  });
  if (!content.success) throw new TeacherBriefError('TEACHER_BRIEF_ASSEMBLY_REJECTED');
  // Second ancrage, sur l'ensemble réassemblé : l'ordre et la couverture des
  // domaines doivent correspondre exactement aux faits fournis.
  assertBriefRespectsFacts(content.data, facts);

  const promptTokens = outcomes.reduce((total, o) => total + o.promptTokens, 0);
  const cachedPromptTokens = outcomes.reduce((total, o) => total + o.cachedPromptTokens, 0);
  const completionTokens = outcomes.reduce((total, o) => total + o.completionTokens, 0);

  return Object.freeze({
    content: content.data,
    promptTokens,
    cachedPromptTokens,
    completionTokens,
    estimatedCostUsd: estimateCostUsd(config.model, { promptTokens, cachedPromptTokens, completionTokens }),
    generationMs: Date.now() - startedAt,
    model: config.model,
    promptVersion: TEACHER_BRIEF_PROMPT_VERSION,
  });
}

/**
 * Ancrage factuel : domaines couverts = domaines fournis (exactement),
 * chaque erreur typique cite au moins un item réellement fourni, et le
 * lexique interdit est respecté. Une violation rejette la sortie entière.
 */
export function assertBriefRespectsFacts(content: TeacherBriefContent, facts: TeacherBriefFactsPayload): void {
  const expectedDomains = facts.domainesPrioritaires.map(({ domainId }) => domainId);
  const producedDomains = content.domaines.map(({ domainId }) => domainId);
  if (JSON.stringify(expectedDomains) !== JSON.stringify(producedDomains)) {
    throw new TeacherBriefError('TEACHER_BRIEF_DOMAIN_MISMATCH');
  }
  const knownItems = new Map(facts.domainesPrioritaires.map((domain) => [
    domain.domainId,
    new Set(domain.itemsRates.map(({ itemId }) => itemId)),
  ]));
  for (const domain of content.domaines) {
    const allowed = knownItems.get(domain.domainId) ?? new Set<string>();
    for (const erreur of domain.erreursTypiques) {
      if (allowed.size > 0 && !erreur.itemIds.some((id) => allowed.has(id))) {
        throw new TeacherBriefError('TEACHER_BRIEF_UNGROUNDED_ERROR');
      }
    }
  }
  const flat: string[] = [];
  const collect = (value: unknown): void => {
    if (typeof value === 'string') flat.push(value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, ''));
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(content);
  const haystack = flat.join(' \n ');
  for (const term of FORBIDDEN_TERMS) {
    if (haystack.includes(term)) throw new TeacherBriefError('TEACHER_BRIEF_FORBIDDEN_TERM');
  }
}

/* -------------------------------------------------------------------------- */
/* Orchestration : idempotence, budget, repli, persistance                     */
/* -------------------------------------------------------------------------- */

type BriefDatabase = Pick<PrismaClient, '$transaction' | 'teacherBrief' | 'reportArtifact'>;

export type GenerateBriefResult =
  | Readonly<{ mode: 'GENERATED'; briefId: string; version: number }>
  | Readonly<{ mode: 'ALREADY_PRESENT'; briefId: string }>
  | Readonly<{ mode: 'PLANCHER'; reason: string }>;

export async function generateTeacherBrief(input: Readonly<{
  prisma?: BriefDatabase;
  actor: Readonly<{ userId: string; role: string }>;
  reportArtifactId: string;
  resolvePack?: PackResolver;
  environment?: Readonly<Record<string, string | undefined>>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}>): Promise<GenerateBriefResult> {
  if (input.actor.role !== 'ASSISTANTE' || !input.actor.userId.trim()) {
    throw new TeacherBriefError('NOT_FOUND');
  }
  const database = input.prisma ?? prisma;
  const now = (input.now ?? (() => new Date()))();

  // Cache applicatif : un brief déjà généré (et non renvoyé en correction)
  // ne se régénère JAMAIS.
  const existing = await database.teacherBrief.findFirst({
    where: { reportArtifactId: input.reportArtifactId, status: { in: ['PENDING_REVIEW', 'APPROVED'] } },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  if (existing !== null) return Object.freeze({ mode: 'ALREADY_PRESENT' as const, briefId: existing.id });

  let config: TeacherBriefConfig;
  try {
    config = resolveTeacherBriefConfig(input.environment);
  } catch (error) {
    return Object.freeze({ mode: 'PLANCHER' as const, reason: (error as TeacherBriefError).code ?? 'CONFIG' });
  }

  // Budget mensuel : dépassé → repli, jamais d'erreur bloquante.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const spent = await database.teacherBrief.aggregate({
    _sum: { estimatedCostUsd: true },
    where: { createdAt: { gte: monthStart } },
  });
  const spentUsd = Number(spent._sum.estimatedCostUsd ?? 0);
  if (spentUsd >= config.monthlyBudgetUsd) {
    return Object.freeze({ mode: 'PLANCHER' as const, reason: 'TEACHER_BRIEF_BUDGET_EXCEEDED' });
  }

  const artifact = await database.reportArtifact.findUnique({
    where: { id: input.reportArtifactId },
    select: {
      id: true,
      assessmentAttempt: {
        select: {
          answers: true,
          assessmentPackId: true,
          assessmentPackVersion: true,
          assessmentPackChecksum: true,
        },
      },
      revisions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { scoreSnapshotId: true, scoreSnapshot: { select: { result: true } } },
      },
    },
  });
  if (artifact === null || artifact.revisions.length === 0) throw new TeacherBriefError('NOT_FOUND');

  const resolvePack = input.resolvePack ?? resolveEnabledPack;
  const resolved = resolvePack(
    artifact.assessmentAttempt.assessmentPackId,
    Number(artifact.assessmentAttempt.assessmentPackVersion),
  );
  if (resolved === null) return Object.freeze({ mode: 'PLANCHER' as const, reason: 'PACK_UNAVAILABLE' });
  if (artifact.assessmentAttempt.assessmentPackChecksum !== resolved.checksum) {
    return Object.freeze({ mode: 'PLANCHER' as const, reason: 'PACK_CHECKSUM_MISMATCH' });
  }

  const factSheet = artifact.revisions[0].scoreSnapshot.result as unknown as FactSheet;

  let generation: TeacherBriefGeneration;
  try {
    const facts = buildStudentFactsPayload(
      factSheet,
      resolved.pack,
      artifact.assessmentAttempt.answers,
      resolved.pack.subject,
    );
    generation = await callTeacherBriefModel(config, facts, input.fetchImpl);
  } catch (error) {
    const code = error instanceof TeacherBriefError ? error.code : 'TEACHER_BRIEF_UNKNOWN';
    console.error(JSON.stringify({ event: 'TEACHER_BRIEF_GENERATION_FELL_BACK', reason: code }));
    return Object.freeze({ mode: 'PLANCHER' as const, reason: code });
  }

  const created = await database.$transaction(async (transaction) => {
    // Régénération après correction : l'ancienne version passe SUPERSEDED,
    // l'historique (contenu, annotations, relecture) reste intact.
    await transaction.teacherBrief.updateMany({
      where: { reportArtifactId: input.reportArtifactId, status: 'CORRECTION_REQUESTED' },
      data: { status: 'SUPERSEDED' },
    });
    const latest = await transaction.teacherBrief.findFirst({
      where: { reportArtifactId: input.reportArtifactId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return transaction.teacherBrief.create({
      data: {
        reportArtifactId: input.reportArtifactId,
        scoreSnapshotId: artifact.revisions[0].scoreSnapshotId,
        version: (latest?.version ?? 0) + 1,
        status: 'PENDING_REVIEW',
        content: generation.content as never,
        promptVersion: generation.promptVersion,
        model: generation.model,
        promptTokens: generation.promptTokens,
        cachedPromptTokens: generation.cachedPromptTokens,
        completionTokens: generation.completionTokens,
        estimatedCostUsd: generation.estimatedCostUsd,
        generationMs: generation.generationMs,
        createdById: input.actor.userId,
      },
      select: { id: true, version: true },
    });
  });
  console.info(JSON.stringify({
    event: 'TEACHER_BRIEF_GENERATED',
    model: generation.model,
    promptVersion: generation.promptVersion,
    promptTokens: generation.promptTokens,
    cachedPromptTokens: generation.cachedPromptTokens,
    completionTokens: generation.completionTokens,
    estimatedCostUsd: generation.estimatedCostUsd,
  }));
  return Object.freeze({ mode: 'GENERATED' as const, briefId: created.id, version: created.version });
}

/** Usage cumulé du mois — compteur consultable dans le dashboard. */
export async function teacherBriefMonthlyUsage(
  dependencies: Readonly<{ prisma?: Pick<PrismaClient, 'teacherBrief'>; now?: () => Date }> = {},
): Promise<Readonly<{ briefs: number; promptTokens: number; cachedPromptTokens: number; completionTokens: number; estimatedCostUsd: number }>> {
  const database = dependencies.prisma ?? prisma;
  const now = (dependencies.now ?? (() => new Date()))();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const aggregate = await database.teacherBrief.aggregate({
    _count: { id: true },
    _sum: { promptTokens: true, cachedPromptTokens: true, completionTokens: true, estimatedCostUsd: true },
    where: { createdAt: { gte: monthStart } },
  });
  return Object.freeze({
    briefs: aggregate._count.id,
    promptTokens: aggregate._sum.promptTokens ?? 0,
    cachedPromptTokens: aggregate._sum.cachedPromptTokens ?? 0,
    completionTokens: aggregate._sum.completionTokens ?? 0,
    estimatedCostUsd: Number(aggregate._sum.estimatedCostUsd ?? 0),
  });
}
