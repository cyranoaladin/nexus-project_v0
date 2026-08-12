import type { FactSheet } from '../facts/fact-sheet';
import { BILAN_PRINT_BRAND_VERSION } from '../render/brand';
import {
  renderDeterministicBilanPdf,
  type BilanPdfResult,
} from '../render/pdf';
import type { ReportAudience } from '../render/profile-copy';
import {
  assertPseudonymousRenderIdentity,
  type RenderIdentity,
} from '../render/render-identity';
import { renderDeterministicBilanHtml } from '../render/html';
import {
  assertHumanRenderIdentity,
  type HumanRenderIdentity,
} from '../render/human-identity';
import type { QuestionEvidence } from '../render/question-evidence';
import { applyReportPassationPresentation } from '../render/passation-presentation';
import {
  assertPublicRenderedArtifact,
  audienceArtifactChecksum,
  materializationGlobalChecksum,
} from './report-artifact-integrity';

export {
  audienceArtifactChecksum,
  materializationGlobalChecksum,
  storedAudienceArtifactIsIntact,
} from './report-artifact-integrity';

export const REPORT_MATERIALIZATION_AUDIENCES = ['ELEVE', 'PARENTS', 'NEXUS'] as const;

export type PreparedAudienceArtifact = Readonly<{
  audience: ReportAudience;
  html: string;
  pdf: Buffer | null;
  pdfStatus: 'READY' | 'UNAVAILABLE';
  checksum: string;
}>;

export type PreparedReportMaterialization = Readonly<{
  brandVersion: typeof BILAN_PRINT_BRAND_VERSION;
  globalChecksum: string;
  audiences: readonly PreparedAudienceArtifact[];
}>;

export type ReportRenderContext = Readonly<{
  factSheet: FactSheet;
  identity: RenderIdentity;
  humanIdentity?: HumanRenderIdentity;
  evidence?: QuestionEvidence;
}>;

export type PublicationRenderOptions = Readonly<{
  humanIdentity?: HumanRenderIdentity;
  evidence?: QuestionEvidence;
}>;

export type PublicationRenderer = (
  factSheet: FactSheet,
  audience: ReportAudience,
  identity: RenderIdentity,
  options?: PublicationRenderOptions,
) => Promise<BilanPdfResult>;

const defaultPublicationRenderer: PublicationRenderer = (
  factSheet,
  audience,
  identity,
  options,
) => renderDeterministicBilanPdf(factSheet, audience, identity, {
  humanIdentity: options?.humanIdentity,
  evidence: options?.evidence,
});

export class ReportMaterializationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ReportMaterializationError';
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseFactSheet(value: unknown): FactSheet {
  if (
    !isRecord(value)
    || typeof value.engineVersion !== 'string'
    || typeof value.bankSlug !== 'string'
    || !Number.isInteger(value.bankVersion)
    || !isRecord(value.student)
    || typeof value.student.alias !== 'string'
    || typeof value.student.level !== 'string'
    || !Array.isArray(value.domains)
    || !Array.isArray(value.nodes)
  ) throw new ReportMaterializationError('REPORT_RENDER_INPUT_INVALID');
  return value as unknown as FactSheet;
}

function parseIdentity(content: unknown): RenderIdentity {
  if (!isRecord(content) || !isRecord(content.NEXUS) || !isRecord(content.NEXUS.identity)) {
    throw new ReportMaterializationError('REPORT_RENDER_INPUT_INVALID');
  }
  return assertPseudonymousRenderIdentity(content.NEXUS.identity as unknown as RenderIdentity);
}

export function parseReportRenderContext(
  scoreResult: unknown,
  reportContent: unknown,
  humanIdentity?: HumanRenderIdentity,
  evidence?: QuestionEvidence,
): ReportRenderContext {
  const identity = parseIdentity(reportContent);
  return Object.freeze({
    factSheet: applyReportPassationPresentation(parseFactSheet(scoreResult), identity.durationMeasurement),
    identity,
    ...(humanIdentity === undefined
      ? {}
      : { humanIdentity: assertHumanRenderIdentity(humanIdentity) }),
    ...(evidence === undefined ? {} : { evidence }),
  });
}

export async function prepareReportMaterialization(
  context: ReportRenderContext,
  renderAudience: PublicationRenderer = defaultPublicationRenderer,
): Promise<PreparedReportMaterialization> {
  let rendered: readonly BilanPdfResult[];
  try {
    rendered = await Promise.all(REPORT_MATERIALIZATION_AUDIENCES.map((audience) => (
      renderAudience(context.factSheet, audience, context.identity, {
        humanIdentity: context.humanIdentity,
        evidence: context.evidence,
      })
    )));
  } catch {
    throw new ReportMaterializationError('REPORT_HTML_RENDER_FAILED');
  }

  const audiences = rendered.map((result, index): PreparedAudienceArtifact => {
    const audience = REPORT_MATERIALIZATION_AUDIENCES[index];
    if (result.html.trim().length === 0) throw new ReportMaterializationError('REPORT_HTML_RENDER_FAILED');
    assertPublicRenderedArtifact(audience, result.html, context.factSheet.bankSlug);
    const pdfStatus = result.status === 'AVAILABLE' ? 'READY' as const : 'UNAVAILABLE' as const;
    const pdf = result.status === 'AVAILABLE' ? Buffer.from(result.pdf) : null;
    return Object.freeze({
      audience,
      html: result.html,
      pdf,
      pdfStatus,
      checksum: audienceArtifactChecksum({ audience, html: result.html, pdfStatus, pdf }),
    });
  });
  return Object.freeze({
    brandVersion: BILAN_PRINT_BRAND_VERSION,
    globalChecksum: materializationGlobalChecksum(BILAN_PRINT_BRAND_VERSION, audiences),
    audiences: Object.freeze(audiences),
  });
}

export function prepareCoachPreview(context: ReportRenderContext) {
  return Object.freeze({
    official: false as const,
    label: 'PRÉVISUALISATION NON OFFICIELLE' as const,
    audiences: Object.freeze(REPORT_MATERIALIZATION_AUDIENCES.map((audience) => Object.freeze({
      audience,
      html: renderDeterministicBilanHtml(
        context.factSheet,
        audience,
        context.identity,
        context.humanIdentity,
        context.evidence,
      ),
    }))),
  });
}
