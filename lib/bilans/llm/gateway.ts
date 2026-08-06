import {
  isBoundPseudonymizedFactSheet,
  type PseudonymizedFactSheet,
} from '../local-first/contracts';
import {
  loadAgentDefinitions,
  parseAgentOutput,
  type BilanAgentDefinition,
} from '../agents';
import {
  validateAgentBundle,
  type AgentBundle,
  type ValidationFailure,
} from '../validators';
import type { ValidatedPack } from '../validators/contracts';

const AGENT_ORDER = ['preAnalysis', 'eleve', 'parents', 'nexus', 'verifier'] as const;
type AgentId = (typeof AGENT_ORDER)[number];

export type BilanRagEvidence = Readonly<{
  id: string;
  source: string;
  content: string;
}>;

export type BilanRagRetriever = Readonly<{
  search(
    factSheet: PseudonymizedFactSheet,
    pack: ValidatedPack,
  ): Promise<readonly BilanRagEvidence[]>;
}>;

type AttemptResult = Readonly<{
  outputs: Readonly<Record<string, unknown>>;
  bundle: AgentBundle | null;
  failures: readonly ValidationFailure[];
}>;

function failureTargets(failures: readonly ValidationFailure[]): AgentId[] {
  const targets = new Set<AgentId>();
  for (const current of failures) {
    const target = AGENT_ORDER.find((agentId) => current.path.includes(agentId));
    if (target !== undefined) targets.add(target);
  }
  if ([...targets].some((target) => target !== 'verifier')) targets.add('verifier');
  return AGENT_ORDER.filter((agentId) => targets.has(agentId));
}

function failuresForAgent(
  agentId: AgentId,
  failures: readonly ValidationFailure[],
): readonly ValidationFailure[] {
  if (agentId === 'verifier') return failures;
  return failures.filter((current) => current.path.includes(agentId));
}

export type BilanGenerationRequest = Readonly<{
  schemaVersion: 'nexus-bilan-gateway/v1';
  pack: Readonly<{
    slug: string;
    version: number;
  }>;
  agent: BilanAgentDefinition;
  factSheet: PseudonymizedFactSheet['value'];
  ragEvidence: readonly BilanRagEvidence[];
  priorOutputs: Readonly<Record<string, unknown>>;
  correctionFailures?: readonly ValidationFailure[];
}>;

export type BilanLlmTransport = Readonly<{
  generate(request: BilanGenerationRequest): Promise<unknown>;
}>;

export type BilanGatewayResult = Readonly<{
  status: 'REPORT_PENDING_REVIEW';
  attempts: 1 | 2;
  validationFailures: readonly ValidationFailure[];
  bundle: AgentBundle | null;
}>;

export class BilanLlmGateway {
  constructor(
    private readonly transport: BilanLlmTransport,
    private readonly ragRetriever?: BilanRagRetriever,
  ) {}

  private async loadRagEvidence(
    factSheet: PseudonymizedFactSheet,
    pack: ValidatedPack,
  ): Promise<readonly BilanRagEvidence[]> {
    if (!pack.reporting.rag.enabled) return Object.freeze([]);
    if (this.ragRetriever === undefined) throw new Error('RAG_RETRIEVER_REQUIRED');

    const evidence = await this.ragRetriever.search(factSheet, pack);
    if (evidence.length === 0) throw new Error('RAG_ENABLED_WITHOUT_EVIDENCE');
    return Object.freeze([...evidence]);
  }

  private async runAttempt(
    factSheet: PseudonymizedFactSheet,
    pack: ValidatedPack,
    ragEvidence: readonly BilanRagEvidence[],
    seedOutputs: Readonly<Record<string, unknown>> = Object.freeze({}),
    selectedAgents: readonly AgentId[] = AGENT_ORDER,
    correctionFailures?: readonly ValidationFailure[],
  ): Promise<AttemptResult> {
    const outputs: Record<string, unknown> = { ...seedOutputs };
    const schemaFailures: ValidationFailure[] = [];
    const selected = new Set(selectedAgents);
    for (const agent of loadAgentDefinitions(pack)) {
      if (!selected.has(agent.id)) continue;
      delete outputs[agent.id];
      try {
        const raw = await this.transport.generate(Object.freeze({
          schemaVersion: 'nexus-bilan-gateway/v1' as const,
          pack: Object.freeze({ slug: pack.slug, version: pack.version }),
          agent,
          factSheet: factSheet.value,
          ragEvidence,
          priorOutputs: Object.freeze({ ...outputs }),
          ...(correctionFailures === undefined
            ? {}
            : { correctionFailures: failuresForAgent(agent.id, correctionFailures) }),
        }));
        outputs[agent.id] = parseAgentOutput(agent, raw);
      } catch {
        schemaFailures.push({
          rule: 'V1',
          path: `$.${agent.id}`,
          message: 'Agent output failed its pack-bound Zod schema',
        });
      }
    }
    if (schemaFailures.length > 0) {
      return Object.freeze({
        outputs: Object.freeze(outputs),
        bundle: null,
        failures: Object.freeze(schemaFailures),
      });
    }
    const failures = validateAgentBundle({ bundle: outputs, factSheet: factSheet.value, pack });
    return Object.freeze({
      outputs: Object.freeze(outputs),
      bundle: failures.length === 0 ? outputs as AgentBundle : null,
      failures: Object.freeze([...failures]),
    });
  }

  async run(
    factSheet: PseudonymizedFactSheet,
    pack: ValidatedPack,
  ): Promise<BilanGatewayResult> {
    if (!isBoundPseudonymizedFactSheet(factSheet)) {
      throw new Error('PII scan checksum does not match the FactSheet payload');
    }
    if (pack.scoring.domains.length !== factSheet.value.domains.length) {
      throw new Error('Validated pack and FactSheet domain counts differ');
    }
    if (pack.slug !== factSheet.value.bankSlug || pack.version !== factSheet.value.bankVersion) {
      throw new Error('Validated pack identity does not match the FactSheet');
    }

    const ragEvidence = await this.loadRagEvidence(factSheet, pack);
    const first = await this.runAttempt(factSheet, pack, ragEvidence);
    if (first.failures.length === 0) {
      return Object.freeze({
        status: 'REPORT_PENDING_REVIEW', attempts: 1, validationFailures: Object.freeze([]),
        bundle: first.bundle,
      });
    }

    const targets = failureTargets(first.failures);
    if (targets.length === 0) {
      return Object.freeze({
        status: 'REPORT_PENDING_REVIEW', attempts: 1,
        validationFailures: first.failures, bundle: null,
      });
    }
    const second = await this.runAttempt(
      factSheet,
      pack,
      ragEvidence,
      first.outputs,
      targets,
      first.failures,
    );
    return Object.freeze({
      status: 'REPORT_PENDING_REVIEW',
      attempts: 2,
      validationFailures: second.failures,
      bundle: second.bundle,
    });
  }
}
