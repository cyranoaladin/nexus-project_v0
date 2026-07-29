import 'server-only';

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parseDocument } from 'yaml';
import type { z } from 'zod';

import {
  assessmentDefinitionSchema,
  moduleCatalogSchema,
  pedagogyManifestSchema,
  type RawAssessmentDefinition,
  type RawModuleCatalog,
  type RawPedagogyManifest,
} from './schemas';
import type {
  AssessmentDefinition,
  AssessmentDefinitionRef,
  AssessmentItem,
  AssessmentNode,
  ContentPublicationStatus,
  ContentUsePurpose,
  ModuleDefinition,
  PedagogyCatalog,
  PedagogyCatalogCounts,
} from './types';

const MODULE_CATALOG_PATH = 'content/pre-rentree-2026/modules.json';
const PEDAGOGY_MANIFEST_PATH = 'content/pre-rentree-2026/pedagogy/manifest.yaml';
const FORBIDDEN_SECOND_PHYSICS_MODULE = 'seconde-physique-chimie';

export const PEDAGOGY_CATALOG_ERROR_CODES = [
  'INVALID_SOURCE',
  'SOURCE_HASH_MISMATCH',
  'CATALOG_RELATION_MISMATCH',
  'FORBIDDEN_MODULE',
  'UNKNOWN_DEFINITION',
  'CONTENT_NOT_ASSIGNABLE',
  'CONTENT_NOT_PUBLISHABLE',
  'DEFINITION_REF_MISMATCH',
] as const;

export type PedagogyCatalogErrorCode = (typeof PEDAGOGY_CATALOG_ERROR_CODES)[number];
export type PedagogySourceReader = (relativePath: string) => Buffer;

export class PedagogyCatalogError extends Error {
  constructor(public readonly code: PedagogyCatalogErrorCode) {
    super(code);
    this.name = 'PedagogyCatalogError';
  }
}

type LoadOptions = Readonly<{
  repoRoot?: string;
  readSource?: PedagogySourceReader;
}>;

function fail(code: PedagogyCatalogErrorCode): never {
  throw new PedagogyCatalogError(code);
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function prefixedSha256(bytes: Buffer): `sha256:${string}` {
  return `sha256:${sha256(bytes)}`;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function createFileSystemReader(repoRoot: string): PedagogySourceReader {
  const resolvedRoot = path.resolve(repoRoot);
  return (relativePath) => {
    if (path.isAbsolute(relativePath) || relativePath.includes('\0')) {
      fail('INVALID_SOURCE');
    }
    const resolvedPath = path.resolve(resolvedRoot, relativePath);
    if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
      fail('INVALID_SOURCE');
    }
    return readFileSync(resolvedPath);
  };
}

function safelyRead(reader: PedagogySourceReader, relativePath: string): Buffer {
  try {
    return reader(relativePath);
  } catch (error) {
    if (error instanceof PedagogyCatalogError) throw error;
    return fail('INVALID_SOURCE');
  }
}

function parseJson<T extends z.ZodTypeAny>(
  bytes: Buffer,
  schema: T,
): z.infer<T> {
  try {
    return schema.parse(JSON.parse(bytes.toString('utf8')));
  } catch {
    return fail('INVALID_SOURCE');
  }
}

function parseYaml<T extends z.ZodTypeAny>(
  bytes: Buffer,
  schema: T,
): z.infer<T> {
  try {
    const document = parseDocument(bytes.toString('utf8'), {
      prettyErrors: false,
    });
    if (document.errors.length) fail('INVALID_SOURCE');
    return schema.parse(document.toJS({ maxAliasCount: 100 }));
  } catch (error) {
    if (error instanceof PedagogyCatalogError) throw error;
    return fail('INVALID_SOURCE');
  }
}

function assertUnique(values: readonly string[]): void {
  if (new Set(values).size !== values.length) fail('CATALOG_RELATION_MISMATCH');
}

function assertHumanValidationCoherence(
  status: ContentPublicationStatus,
  validation: RawPedagogyManifest['humanValidation'],
): void {
  const humanReviewPending = status === 'HUMAN_VALIDATION_REQUIRED';
  if (validation.status !== status
    || validation.required !== humanReviewPending
    || (humanReviewPending && (validation.reviewer !== null || validation.validatedAt !== null))
    || (!humanReviewPending && (!validation.reviewer || !validation.validatedAt))) {
    fail('CATALOG_RELATION_MISMATCH');
  }
}

function verifySourceHash(
  reader: PedagogySourceReader,
  source: { path: string; sha256: string },
): Buffer {
  const bytes = safelyRead(reader, source.path);
  if (sha256(bytes) !== source.sha256) fail('SOURCE_HASH_MISMATCH');
  return bytes;
}

function adaptItems(
  node: RawAssessmentDefinition['noeuds'][number],
): AssessmentItem[] {
  return (node.items ?? []).map((item) => {
    if (item.type === 'qcm_unique') {
      return {
        id: item.id,
        nodeId: node.id,
        tier: item.palier,
        prompt: item.enonce,
        rationale: item.justification,
        responseMode: 'AUTOMATIC_QCM',
        options: item.propositions.map((option) => ({
          text: option.texte,
          correct: option.correcte,
          ...(option.obstacleVise === undefined
            ? {}
            : { targetedObstacle: option.obstacleVise }),
        })),
      };
    }

    return {
      id: item.id,
      nodeId: node.id,
      tier: item.palier,
      prompt: item.enonce,
      rationale: item.justification,
      responseMode: 'MANUAL_SHORT_RESPONSE',
      maxCharacters: item.longueurMaxCaracteres,
      gradingCriteria: item.criteresCorrection,
      admissibleAnswerExample: item.exempleReponseAdmissible,
    };
  });
}

function adaptAssessment(
  raw: RawAssessmentDefinition,
  manifestModule: RawPedagogyManifest['modules'][number],
  manifest: RawPedagogyManifest,
): AssessmentDefinition {
  if (raw.niveauEntree !== manifestModule.level
    || raw.matiere !== manifestModule.subject
    || raw.statutValidation !== manifestModule.editorialStatus
    || manifestModule.editorialStatus !== manifest.publicationStatus) {
    fail('CATALOG_RELATION_MISMATCH');
  }

  assertHumanValidationCoherence(
    manifestModule.editorialStatus,
    manifestModule.humanValidation,
  );
  assertUnique(raw.noeuds.map(({ id }) => id));
  assertUnique(raw.noeuds.map(({ ordre }) => String(ordre)));

  const items = raw.noeuds.flatMap(adaptItems);
  assertUnique(items.map(({ id }) => id));
  for (const node of raw.noeuds) {
    if ((node.items ?? []).some(({ id }) => !id.startsWith(`${node.id}-i`))) {
      fail('CATALOG_RELATION_MISMATCH');
    }
  }

  const version = `${manifest.campaignId}:manifest-${manifest.version}:edition-${raw.edition}`;
  const ref: AssessmentDefinitionRef = {
    definitionId: raw.id,
    moduleId: manifestModule.id,
    version,
    sha256: `sha256:${manifestModule.cps.sha256}`,
  };
  const nodes: AssessmentNode[] = raw.noeuds.map((node) => ({
    id: node.id,
    order: node.ordre,
    evaluated: node.evalueParTest,
    priorKnowledge: node.acquisN1,
    targetUse: node.usageN,
    obstacles: node.obstacles,
    masteryCriterion: node.critereMaitrise,
    sessionNumber: node.seanceRattachement,
    itemIds: (node.items ?? []).map(({ id }) => id),
  }));

  return {
    id: raw.id,
    moduleId: manifestModule.id,
    level: raw.niveauEntree,
    subject: raw.matiere,
    edition: raw.edition,
    targetDurationMinutes: raw.dureeCibleMinutes,
    title: raw.intitulePublic,
    framing: raw.cadrage,
    publicationStatus: raw.statutValidation,
    ref,
    nodes,
    items,
  };
}

function adaptModules(
  rawCatalog: RawModuleCatalog,
  manifest: RawPedagogyManifest,
  assessmentsByModule: Map<string, AssessmentDefinition>,
): ModuleDefinition[] {
  assertUnique(rawCatalog.modules.map(({ id }) => id));
  assertUnique(manifest.modules.map(({ id }) => id));

  if (rawCatalog.modules.some(({ id, level, subjectId }) => (
    id === FORBIDDEN_SECOND_PHYSICS_MODULE
    || (level === 'SECONDE' && subjectId === 'PHYSIQUE_CHIMIE')
  ))) {
    fail('FORBIDDEN_MODULE');
  }
  if (rawCatalog.modules.length !== manifest.modules.length) {
    fail('CATALOG_RELATION_MISMATCH');
  }

  return rawCatalog.modules.map((rawModule) => {
    const manifestModule = manifest.modules.find(({ id }) => id === rawModule.id);
    const assessment = assessmentsByModule.get(rawModule.id);
    if (!manifestModule || !assessment
      || rawModule.level !== manifestModule.level
      || rawModule.subjectId !== manifestModule.subject) {
      return fail('CATALOG_RELATION_MISMATCH');
    }

    const sessionNumbers = rawModule.sessions.map(({ number }) => number);
    const manifestSessionNumbers = manifestModule.sessions.map(({ number }) => number);
    if (sessionNumbers.join(',') !== '1,2,3,4,5'
      || sessionNumbers.join(',') !== manifestSessionNumbers.join(',')) {
      fail('CATALOG_RELATION_MISMATCH');
    }

    return {
      id: rawModule.id,
      level: rawModule.level,
      subject: rawModule.subjectId,
      title: rawModule.title,
      subtitle: rawModule.subtitle,
      catalogStatus: rawModule.publicationStatus,
      publicationStatus: manifestModule.editorialStatus,
      sessions: rawModule.sessions.map((session, index) => ({
        id: `${rawModule.id}:session:${session.number}`,
        moduleId: rawModule.id,
        number: session.number,
        title: session.title,
        objective: session.objective,
        topics: session.topics,
        method: session.method,
        deliverable: session.deliverable,
        sourceSha256: manifestModule.sessions[index].files.map(
          ({ sha256: hash }) => `sha256:${hash}` as const,
        ),
      })),
      assessmentRef: assessment.ref,
    };
  });
}

function deriveCounts(
  modules: readonly ModuleDefinition[],
  assessments: readonly AssessmentDefinition[],
  manifest: RawPedagogyManifest,
): PedagogyCatalogCounts {
  return {
    modules: modules.length,
    sessions: modules.reduce((sum, module) => sum + module.sessions.length, 0),
    cps: assessments.length,
    nodes: assessments.reduce((sum, assessment) => sum + assessment.nodes.length, 0),
    evaluatedNodes: assessments.reduce(
      (sum, assessment) => sum + assessment.nodes.filter(({ evaluated }) => evaluated).length,
      0,
    ),
    items: assessments.reduce((sum, assessment) => sum + assessment.items.length, 0),
    manualResponses: assessments.reduce(
      (sum, assessment) => sum + assessment.items.filter(
        ({ responseMode }) => responseMode === 'MANUAL_SHORT_RESPONSE',
      ).length,
      0,
    ),
    sessionUnitFiles: manifest.modules.reduce(
      (sum, module) => sum + module.sessions.reduce(
        (sessionSum, session) => sessionSum + session.files.length,
        0,
      ),
      0,
    ),
  };
}

function assertCounts(
  counts: PedagogyCatalogCounts,
  manifest: RawPedagogyManifest,
): void {
  const expected: PedagogyCatalogCounts = {
    modules: manifest.counts.modules,
    sessions: manifest.counts.sessions,
    cps: manifest.counts.cps,
    nodes: manifest.counts.nodes,
    evaluatedNodes: manifest.counts.evaluatedNodes,
    items: manifest.counts.items,
    manualResponses: manifest.counts.manualResponses,
    sessionUnitFiles: manifest.counts.sessionUnitFiles,
  };
  if (JSON.stringify(counts) !== JSON.stringify(expected)
    || manifest.counts.sessionsPerModule * counts.modules !== counts.sessions
    || manifest.positioning.expectedCps !== counts.cps
    || manifest.sessionKits.expectedModules !== counts.modules
    || manifest.sessionKits.expectedSessions !== counts.sessions) {
    fail('CATALOG_RELATION_MISMATCH');
  }
}

function enforcePurpose(
  assessment: AssessmentDefinition,
  purpose: ContentUsePurpose,
): void {
  if (purpose === 'ASSIGNMENT'
    && !['CLASSROOM_READY', 'PUBLICATION_APPROVED'].includes(
      assessment.publicationStatus,
    )) {
    fail('CONTENT_NOT_ASSIGNABLE');
  }
  if (purpose === 'PUBLICATION'
    && assessment.publicationStatus !== 'PUBLICATION_APPROVED') {
    fail('CONTENT_NOT_PUBLISHABLE');
  }
}

export function loadPedagogyCatalog(options: LoadOptions = {}): PedagogyCatalog {
  const reader = options.readSource
    ?? createFileSystemReader(options.repoRoot ?? process.cwd());
  const moduleCatalogBytes = safelyRead(reader, MODULE_CATALOG_PATH);
  const manifestBytes = safelyRead(reader, PEDAGOGY_MANIFEST_PATH);
  const rawCatalog = parseJson(moduleCatalogBytes, moduleCatalogSchema);
  const manifest = parseYaml(manifestBytes, pedagogyManifestSchema);

  assertHumanValidationCoherence(manifest.publicationStatus, manifest.humanValidation);
  for (const source of manifest.sharedSources) verifySourceHash(reader, source);

  const assessments = manifest.modules.map((manifestModule) => {
    verifySourceHash(reader, manifestModule.readme);
    for (const session of manifestModule.sessions) {
      for (const source of session.files) verifySourceHash(reader, source);
    }
    const cpsBytes = verifySourceHash(reader, manifestModule.cps);
    return adaptAssessment(
      parseYaml(cpsBytes, assessmentDefinitionSchema),
      manifestModule,
      manifest,
    );
  });
  assertUnique(assessments.map(({ id }) => id));

  const assessmentsByModule = new Map(
    assessments.map((assessment) => [assessment.moduleId, assessment]),
  );
  const modules = adaptModules(rawCatalog, manifest, assessmentsByModule);
  const counts = deriveCounts(modules, assessments, manifest);
  assertCounts(counts, manifest);

  const modulesById = new Map(modules.map((module) => [module.id, module]));
  const assessmentsById = new Map(
    assessments.map((assessment) => [assessment.id, assessment]),
  );
  const catalog: PedagogyCatalog = {
    version: {
      campaignId: manifest.campaignId,
      manifestVersion: manifest.version,
      manifestSha256: prefixedSha256(manifestBytes),
      moduleCatalogVersion: rawCatalog.version,
      moduleCatalogSha256: prefixedSha256(moduleCatalogBytes),
    },
    counts,
    modules,
    assessments,
    getModule(id) {
      const definition = modulesById.get(id);
      if (!definition) fail('UNKNOWN_DEFINITION');
      return definition;
    },
    getAssessment(id, purpose) {
      const assessment = assessmentsById.get(id);
      if (!assessment) fail('UNKNOWN_DEFINITION');
      enforcePurpose(assessment, purpose);
      return assessment;
    },
    assertAssessmentRef(ref) {
      const assessment = assessmentsById.get(ref.definitionId);
      if (!assessment) fail('UNKNOWN_DEFINITION');
      if (assessment.ref.moduleId !== ref.moduleId
        || assessment.ref.version !== ref.version
        || assessment.ref.sha256 !== ref.sha256) {
        fail('DEFINITION_REF_MISMATCH');
      }
      return assessment;
    },
  };

  return deepFreeze(catalog);
}
