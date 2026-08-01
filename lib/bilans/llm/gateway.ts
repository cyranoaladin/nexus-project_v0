import {
  isBoundPseudonymizedFactSheet,
  type PseudonymizedFactSheet,
} from '../local-first/contracts';
import {
  validateAgentBundle,
  type AgentBundle,
  type ValidationFailure,
} from '../validators';
import type { ValidatedPack } from '../validators/contracts';

export type BilanGenerationRequest = Readonly<{
  schemaVersion: 'nexus-bilan-gateway/v1';
  pack: Readonly<{
    slug: string;
    version: number;
    promptFiles: ValidatedPack['reporting']['promptFiles'];
  }>;
  factSheet: PseudonymizedFactSheet['value'];
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
  constructor(private readonly transport: BilanLlmTransport) {}

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

    const baseRequest = Object.freeze({
      schemaVersion: 'nexus-bilan-gateway/v1' as const,
      pack: Object.freeze({
        slug: pack.slug,
        version: pack.version,
        promptFiles: pack.reporting.promptFiles,
      }),
      factSheet: factSheet.value,
    });
    const first = await this.transport.generate(baseRequest);
    const firstFailures = validateAgentBundle({ bundle: first, factSheet: factSheet.value, pack });
    if (firstFailures.length === 0) {
      return Object.freeze({
        status: 'REPORT_PENDING_REVIEW', attempts: 1, validationFailures: Object.freeze([]),
        bundle: first as AgentBundle,
      });
    }

    const second = await this.transport.generate(Object.freeze({
      ...baseRequest,
      correctionFailures: Object.freeze([...firstFailures]),
    }));
    const secondFailures = validateAgentBundle({ bundle: second, factSheet: factSheet.value, pack });
    return Object.freeze({
      status: 'REPORT_PENDING_REVIEW',
      attempts: 2,
      validationFailures: Object.freeze([...secondFailures]),
      bundle: secondFailures.length === 0 ? second as AgentBundle : null,
    });
  }
}
