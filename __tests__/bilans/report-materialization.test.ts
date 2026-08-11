import {
  audienceArtifactChecksum,
  parseReportRenderContext,
  prepareCoachPreview,
  prepareReportMaterialization,
  storedAudienceArtifactIsIntact,
} from '@/lib/bilans/core/report-materialization';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import {
  PAPER_ENTRY_DURATION_MEASUREMENT,
  PAPER_ENTRY_DURATION_NOTICE,
} from '@/lib/bilans/render/passation-presentation';
import { BILAN_PDF_ENGINE_VERSION } from '@/lib/bilans/render/pdf';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import type { HumanRenderIdentity } from '@/lib/bilans/render/human-identity';
import { ENTRY_RECIPE_FACT_SHEETS } from '@/__tests__/bilans/fixtures/recipe-fact-sheets';

const factSheet = ENTRY_RECIPE_FACT_SHEETS[0];
const identity: RenderIdentity = {
  displayName: factSheet.student.alias,
  level: factSheet.student.level,
  subject: 'MATHS',
  date: '2026-08-03',
  stageLabel: 'Stage de pré-rentrée — Entrée en Terminale, Mathématiques',
};

const readyRenderer = async (
  sheet: typeof factSheet,
  audience: 'ELEVE' | 'PARENTS' | 'NEXUS',
  renderIdentity: RenderIdentity,
  options?: Readonly<{ humanIdentity?: HumanRenderIdentity }>,
) => ({
  status: 'AVAILABLE' as const,
  html: renderDeterministicBilanHtml(sheet, audience, renderIdentity, options?.humanIdentity),
  pdf: Buffer.from(`%PDF-1.4 ${audience}`),
  engineVersion: BILAN_PDF_ENGINE_VERSION,
});

describe('A90.3 report materialization preparation', () => {
  test('renders all audiences deterministically with integrity checksums', async () => {
    const first = await prepareReportMaterialization({ factSheet, identity }, readyRenderer);
    const second = await prepareReportMaterialization({ factSheet, identity }, readyRenderer);
    expect(first).toEqual(second);
    expect(first.audiences.map(({ audience }) => audience)).toEqual(['ELEVE', 'PARENTS', 'NEXUS']);
    expect(first.audiences.every((artifact) => storedAudienceArtifactIsIntact(artifact))).toBe(true);
  });

  test('keeps HTML publishable when Chromium is unavailable', async () => {
    const prepared = await prepareReportMaterialization({ factSheet, identity }, async (sheet, audience, renderIdentity) => ({
      status: 'UNAVAILABLE' as const,
      html: renderDeterministicBilanHtml(sheet, audience, renderIdentity),
      errorCode: 'BILAN_PDF_RENDER_FAILED' as const,
      engineVersion: BILAN_PDF_ENGINE_VERSION,
    }));
    expect(prepared.audiences.every(({ pdfStatus, pdf }) => pdfStatus === 'UNAVAILABLE' && pdf === null)).toBe(true);
  });

  test('fails before persistence when HTML rendering fails', async () => {
    await expect(prepareReportMaterialization({ factSheet, identity }, async () => {
      throw new Error('HTML_FAILED');
    })).rejects.toMatchObject({ code: 'REPORT_HTML_RENDER_FAILED' });
  });

  test('detects any stored content mutation', () => {
    const input = { audience: 'ELEVE' as const, html: '<p>Solide</p>', pdfStatus: 'UNAVAILABLE' as const, pdf: null };
    const checksum = audienceArtifactChecksum(input);
    expect(storedAudienceArtifactIsIntact({ ...input, checksum })).toBe(true);
    expect(storedAudienceArtifactIsIntact({ ...input, html: '<p>Altéré</p>', checksum })).toBe(false);
  });

  test('coach preview is explicitly unofficial and contains no persistence operation', () => {
    const preview = prepareCoachPreview({ factSheet, identity });
    expect(preview.official).toBe(false);
    expect(preview.label).toContain('NON OFFICIELLE');
    expect(preview.audiences).toHaveLength(3);
  });

  test('reprojects the raw snapshot before materializing a paper-entry report', () => {
    const rawExpressFactSheet = {
      ...factSheet,
      flags: [...factSheet.flags, 'PASSATION_EXPRESS' as const],
    };
    const context = parseReportRenderContext(rawExpressFactSheet, {
      NEXUS: {
        identity: { ...identity, durationMeasurement: PAPER_ENTRY_DURATION_MEASUREMENT },
      },
    });

    expect(rawExpressFactSheet.flags).toContain('PASSATION_EXPRESS');
    expect(context.factSheet.flags).not.toContain('PASSATION_EXPRESS');
  });

  test('materializes the neutral paper-entry notice for all audiences', async () => {
    const paperIdentity = { ...identity, durationMeasurement: PAPER_ENTRY_DURATION_MEASUREMENT };
    const prepared = await prepareReportMaterialization(
      { factSheet, identity: paperIdentity },
      readyRenderer,
    );

    expect(prepared.audiences).toHaveLength(3);
    expect(prepared.audiences.every(({ html }) => html.includes(PAPER_ENTRY_DURATION_NOTICE))).toBe(true);
  });

  test('passes the real identity separately while keeping snapshot and revision aliases immutable', async () => {
    const immutableRevisionContent = Object.freeze({
      NEXUS: Object.freeze({ identity: Object.freeze({ ...identity }) }),
    });
    const context = parseReportRenderContext(
      factSheet,
      immutableRevisionContent,
      { displayName: 'Élise Ben Salah' },
    );
    const receivedCanonicalNames: string[] = [];
    const receivedHumanNames: string[] = [];

    const prepared = await prepareReportMaterialization(context, async (sheet, audience, canonical, options) => {
      receivedCanonicalNames.push(canonical.displayName);
      receivedHumanNames.push(options?.humanIdentity?.displayName ?? '');
      return readyRenderer(sheet, audience, canonical, options);
    });

    expect(factSheet.student.alias).toMatch(/^ELEVE_[A-Z]+$/);
    expect(immutableRevisionContent.NEXUS.identity.displayName).toBe(identity.displayName);
    expect(context.identity.displayName).toBe(identity.displayName);
    expect(receivedCanonicalNames).toEqual([identity.displayName, identity.displayName, identity.displayName]);
    expect(receivedHumanNames).toEqual(['Élise Ben Salah', 'Élise Ben Salah', 'Élise Ben Salah']);
    expect(prepared.audiences.every(({ html }) => html.includes('<strong>Élise Ben Salah</strong>'))).toBe(true);
    expect(prepared.audiences.every(({ html }) => !html.includes(identity.displayName))).toBe(true);
  });
});
