import { createHash } from 'node:crypto';

import { loadBilanPack, loadValidatedPack } from '@/lib/bilans/catalog/load-pack';
import {
  BilanReportServiceError,
  previewReportRevision,
  renderReportRevisionAudiencePdf,
} from '@/lib/bilans/core/report-service';
import type { PackResolver } from '@/lib/bilans/api/pack-access';
import { PREMIERE_ENTRY_RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

const PACK_PATH = 'data/bilans/banks/entree-premiere-maths-v1.json';
const SLUG = 'entree-premiere-maths-v1';

const pack = loadBilanPack(PACK_PATH);
const validatedPack = loadValidatedPack(PACK_PATH);
const packChecksum = createHash('sha256').update(JSON.stringify(pack)).digest('hex');

const resolvePack: PackResolver = (slug, version) => (
  slug === SLUG && version === 1
    ? { pack, validatedPack, checksum: packChecksum, path: PACK_PATH }
    : null
);

function firstAnswers(): Record<string, { optionId: string; confidence: 1 | 2 | 3 | 4 | null }> {
  const item = pack.questionnaire.items[0];
  const correct = item.options.find(({ isCorrect }) => isCorrect);
  if (correct === undefined) throw new Error('FIXTURE_INVALID');
  return { [item.id]: { optionId: correct.id, confidence: 3 } };
}

function fakePrisma(attempt: Record<string, unknown> | null) {
  const factSheet = PREMIERE_ENTRY_RECIPE_FACT_SHEETS[0];
  const identity = {
    displayName: factSheet.student.alias,
    level: 'PREMIERE',
    subject: 'MATHS',
    date: '2026-08-12',
    stageLabel: 'Stage de pré-rentrée — Entrée en 1re, Mathématiques',
  };
  return {
    reportRevision: {
      findUnique: async () => ({
        status: 'PENDING_REVIEW',
        validationFailures: [],
        content: { NEXUS: { identity } },
        scoreSnapshot: { result: factSheet },
        reportArtifact: {
          assessmentAttempt: attempt,
          student: { user: { firstName: 'kamel', lastName: 'ben rhouma' } },
        },
      }),
    },
  } as never;
}

describe('Évidence des réponses dans le service de restitution', () => {
  it('rend l’aperçu avec le détail des réponses quand le pack se résout', async () => {
    const preview = await previewReportRevision({
      prisma: fakePrisma({
        answers: firstAnswers(),
        assessmentPackId: SLUG,
        assessmentPackVersion: 1,
        assessmentPackChecksum: packChecksum,
      }),
      revisionId: 'revision-1',
      resolvePack,
    });
    const eleveHtml = preview.audiences.find(({ audience }) => audience === 'ELEVE')?.html ?? '';
    expect(eleveHtml).toContain('Le détail de tes réponses');
    // Le vrai nom, correctement capitalisé, figure dans l'en-tête.
    expect(eleveHtml).toContain('Kamel Ben Rhouma');
    const parentsHtml = preview.audiences.find(({ audience }) => audience === 'PARENTS')?.html ?? '';
    expect(parentsHtml).not.toContain('Le détail de tes réponses');
  });

  it('rend l’aperçu SANS section détail quand le pack ne se résout pas', async () => {
    const preview = await previewReportRevision({
      prisma: fakePrisma({
        answers: firstAnswers(),
        assessmentPackId: 'pack-inconnu',
        assessmentPackVersion: 1,
        assessmentPackChecksum: 'abc',
      }),
      revisionId: 'revision-1',
      resolvePack,
    });
    const eleveHtml = preview.audiences.find(({ audience }) => audience === 'ELEVE')?.html ?? '';
    expect(eleveHtml).not.toContain('Le détail de tes réponses');
  });

  it('refuse un pack résolu dont le checksum ne correspond plus à la passation', async () => {
    await expect(previewReportRevision({
      prisma: fakePrisma({
        answers: firstAnswers(),
        assessmentPackId: SLUG,
        assessmentPackVersion: 1,
        assessmentPackChecksum: 'checksum-perime',
      }),
      revisionId: 'revision-1',
      resolvePack,
    })).rejects.toThrow(new BilanReportServiceError('REPORT_EVIDENCE_PACK_MISMATCH'));
  });

  it('reste rétrocompatible quand la tentative ne porte pas les champs pack', async () => {
    const preview = await previewReportRevision({
      prisma: fakePrisma(null),
      revisionId: 'revision-1',
      resolvePack,
    });
    expect(preview.audiences).toHaveLength(3);
  });

  it('injecte l’évidence dans le PDF par audience', async () => {
    const rendered: Array<{ audience: string; evidence: unknown }> = [];
    await renderReportRevisionAudiencePdf({
      prisma: fakePrisma({
        answers: firstAnswers(),
        assessmentPackId: SLUG,
        assessmentPackVersion: 1,
        assessmentPackChecksum: packChecksum,
      }),
      revisionId: 'revision-1',
      audience: 'ELEVE',
      resolvePack,
      renderAudience: async (_factSheet, audience, _identity, dependencies) => {
        rendered.push({ audience, evidence: dependencies.evidence });
        return { status: 'AVAILABLE', html: '<html></html>', pdf: Buffer.from('%PDF-'), engineVersion: 'nexus-html-chromium-pdf.v1' } as never;
      },
    });
    expect(rendered).toHaveLength(1);
    expect(rendered[0].evidence).toBeDefined();
  });
});
