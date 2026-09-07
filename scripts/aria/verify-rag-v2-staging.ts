import { createHash } from 'node:crypto';
import {
  readAriaRagTaxonomyV2,
  loadAriaRagEngineClientConfig,
  searchAriaRagV2,
} from '../../lib/aria/infrastructure/rag/rag-engine-client';
import { loadAriaRagIdentitySignerConfig } from '../../lib/aria/infrastructure/rag/internal-identity';
import {
  executeAriaRetrieval,
  resolveAriaRetrievalPlan,
  type AriaResolvedRagStudentIdentity,
} from '../../lib/aria/rag';

type ResolvePlan = typeof resolveAriaRetrievalPlan;
type ExecuteRetrieval = typeof executeAriaRetrieval;
type Search = typeof searchAriaRagV2;
type ReadTaxonomy = typeof readAriaRagTaxonomyV2;
type LoadClientConfig = typeof loadAriaRagEngineClientConfig;
type LoadSignerConfig = typeof loadAriaRagIdentitySignerConfig;
type JsonRecord = Readonly<Record<string, unknown>>;

interface StagingCheckDependencies {
  readonly resolvePlan: ResolvePlan;
  readonly executeRetrieval: ExecuteRetrieval;
  readonly search: Search;
  readonly readTaxonomy: ReadTaxonomy;
  readonly loadClientConfig: LoadClientConfig;
  readonly loadSignerConfig: LoadSignerConfig;
}

const defaultDependencies: StagingCheckDependencies = {
  resolvePlan: resolveAriaRetrievalPlan,
  executeRetrieval: executeAriaRetrieval,
  search: searchAriaRagV2,
  readTaxonomy: readAriaRagTaxonomyV2,
  loadClientConfig: loadAriaRagEngineClientConfig,
  loadSignerConfig: loadAriaRagIdentitySignerConfig,
};

function record(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function soleString(value: unknown): string | null {
  return Array.isArray(value) && value.length === 1 ? stringValue(value[0]) : null;
}

function buildStagingProbeIdentity(
  plan: Extract<ReturnType<ResolvePlan>, { readonly status: 'AVAILABLE' }>['plan'],
  baseUrl: string,
): AriaResolvedRagStudentIdentity {
  const target = record(plan.retrievalScope.target_policy);
  const evidence = record(plan.retrievalScope.evidence_subject);
  const niveau = stringValue(target?.niveau);
  const voie = stringValue(target?.voie);
  const matiere = stringValue(target?.matiere);
  const statutEnseignement = stringValue(target?.statut_enseignement);
  const candidat = soleString(target?.candidates);
  const audience = soleString(target?.audiences);
  const schoolYear = stringValue(evidence?.school_year);
  if (!niveau || !voie || !matiere || !statutEnseignement
    || !candidat || !audience || !schoolYear) {
    throw new Error('RAG_V2_STAGING_IDENTITY_UNREPRESENTABLE');
  }
  const pseudonym = createHash('sha256')
    .update(`nexus-rag-v2-staging:${baseUrl}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
  return Object.freeze({
    pseudonymousSubject: `psn_${pseudonym}`,
    niveau,
    voie,
    matiere,
    statutEnseignement,
    candidat,
    audience,
    schoolYear,
    zone: 'TN',
    statusDetail: 'unknown',
  });
}

function taxonomyContainsCollection(taxonomy: Record<string, unknown>, collection: string): boolean {
  return Array.isArray(taxonomy.collections) && taxonomy.collections.some((entry) =>
    record(entry)?.collection === collection,
  );
}

interface RagV2StagingCheckOptions {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly dependencies?: StagingCheckDependencies;
  readonly write?: (value: string) => void;
}

export async function runRagV2StagingCheck(
  options: RagV2StagingCheckOptions = {},
): Promise<0> {
  const environment = options.environment ?? process.env;
  if (environment.RAG_STAGING_RUN !== '1') {
    throw new Error('RAG_V2_STAGING_RUN_REQUIRED');
  }
  const dependencies = options.dependencies ?? defaultDependencies;
  const clientConfig = dependencies.loadClientConfig(environment);
  const signerConfig = dependencies.loadSignerConfig(environment);
  const courseKey = environment.RAG_STAGING_COURSE_KEY?.trim() || 'eds-maths-premiere';
  const resolution = dependencies.resolvePlan(courseKey, 'DISCOVERY', 'TUTOR');
  if (resolution.status !== 'AVAILABLE') {
    throw new Error(`RAG_V2_STAGING_PLAN_UNAVAILABLE:${resolution.reasonCode}`);
  }
  const identity = buildStagingProbeIdentity(resolution.plan, clientConfig.baseUrl);
  let taxonomyVerified = false;

  const result = await dependencies.executeRetrieval(
    resolution.plan,
    environment.RAG_STAGING_QUERY?.trim() || 'fonction dérivée méthode exercice',
    identity,
    {
      clientConfig,
      signerConfig,
      search: async (searchInput) => {
        const taxonomy = await dependencies.readTaxonomy({
          identityToken: searchInput.identityToken,
          config: searchInput.config,
          signal: searchInput.signal,
        });
        if (!taxonomyContainsCollection(taxonomy, resolution.plan.collection)) {
          throw new Error('RAG_V2_STAGING_TAXONOMY_MISMATCH');
        }
        taxonomyVerified = true;
        return dependencies.search(searchInput);
      },
    },
  );

  if (!taxonomyVerified || result.status !== 'SUCCESS' || result.hits.length === 0) {
    throw new Error('RAG_V2_STAGING_SEARCH_FAILED');
  }
  const write = options.write ?? process.stdout.write.bind(process.stdout);
  write('COCKPIT_RAG_V2_CLIENT=PASS\n');
  write('COCKPIT_TO_RAG_STAGING=PASS\n');
  write(`RAG_STAGING_CITABLE_HITS=${result.hits.length}\n`);
  return 0;
}

if (require.main === module) {
  void runRagV2StagingCheck().catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : 'RAG_V2_STAGING_CHECK_FAILED';
    process.stderr.write(`COCKPIT_TO_RAG_STAGING=FAIL reason=${reason}\n`);
    process.exitCode = 1;
  });
}
