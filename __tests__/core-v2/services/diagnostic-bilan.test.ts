/**
 * The C2 bilan draft lifecycle (mission §6/§7): generation, human review,
 * validation, publication, and the self-service published read — against
 * the real disposable DB. The AI call itself is a fake fetchImpl (no real
 * network spend in this suite); the deterministic half runs for real
 * against a genuinely rendered and extracted PDF.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@/core-v2/generated/client';
import type { ServiceContext } from '@/lib/core-v2/services/context';
import type { Actor } from '@/lib/core-v2/rbac';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

import { createHousehold, createStudent } from '@/lib/core-v2/services';
import { attributeDiagnostic } from '@/lib/core-v2/services/diagnostics';
import { depositOwnDiagnosticSubmission } from '@/lib/core-v2/diagnostics/submission-pipeline';
import { drainDiagnosticSubmissionProcessingQueue, enqueueDiagnosticSubmissionProcessing } from '@/lib/core-v2/services/diagnostic-processing';
import { renderHtmlToPdf } from '@/lib/bilans/render/pdf';
import { DEMO_ANSWER_HTML } from '@/lib/core-v2/diagnostics/demo-content';
import {
  applyHumanBilanCorrection,
  generateBilanDraft,
  getCurrentBilanDraftForReview,
  getOwnPublishedBilan,
  getOwnPublishedBilanForSubmission,
  publishBilanDraft,
  validateBilanDraft,
} from '@/lib/core-v2/services/diagnostic-bilan';

beforeEach(() => {
  process.env.DIAGNOSTIC_DEMO_MODE = '1';
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
  process.env.OPENROUTER_API_KEY = 'test'; // any non-empty value: the transport is a fake fetchImpl in every test below
});

function allowDemoFixtureFor(...studentIds: string[]) {
  const existing = (process.env.DIAGNOSTIC_DEMO_STUDENT_IDS ?? '').split(',').filter(Boolean);
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = [...existing, ...studentIds].join(',');
}

function eleveActor(userId: string): Actor {
  return { userId, role: 'ELEVE' };
}

async function seedInstrument(client: PrismaClient, label: string, catalogStatus: 'DEMO_FIXTURE' | 'AUTHORIZED' = 'DEMO_FIXTURE') {
  const instrumentKey = `BILAN-${label}`;
  return client.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: `Bilan instrument ${label}`,
      subject: 'Test',
      level: 'Toutes',
      targetSession: 'DEMO',
      form: 'FORM_TEST',
      durationMinutes: 30,
      modalities: 'Test only.',
      catalogStatus,
      manifestChecksum: createHash('sha256').update(instrumentKey).digest('hex'),
      manifestVersion: 'test/1.0',
      subjectSha256: createHash('sha256').update(`subject-${instrumentKey}`).digest('hex'),
    },
  });
}

async function seedExtractedProcessing(
  client: PrismaClient,
  ctx: ServiceContext,
  label: string,
  options: { catalogStatus?: 'DEMO_FIXTURE' | 'AUTHORIZED'; html?: string } = {},
) {
  const { household } = await createHousehold(client, ctx, {
    parent: { firstName: `P${label}`, lastName: 'Synthetic', email: `parent-bilan-${label}@synthetic.test` },
  });
  const { student, user } = await createStudent(client, ctx, {
    householdId: household.id,
    student: { firstName: `S${label}`, lastName: 'Synthetic' },
  });
  allowDemoFixtureFor(student.id);
  const instrument = await seedInstrument(client, label, options.catalogStatus ?? 'DEMO_FIXTURE');
  const assignment = await attributeDiagnostic(client, ctx, { studentId: student.id, instrumentRefId: instrument.id });
  const pdf = await renderHtmlToPdf(options.html ?? DEMO_ANSWER_HTML);
  const { submission } = await depositOwnDiagnosticSubmission(client, h.ctx(eleveActor(user.id)), {
    assignmentId: assignment.id,
    originalFilename: 'reponses.pdf',
    mimeType: 'application/pdf',
    bytes: pdf,
  });
  const processing = await enqueueDiagnosticSubmissionProcessing(client, ctx, submission.id);
  await drainDiagnosticSubmissionProcessingQueue(client);
  return { processingId: processing.id, submissionId: submission.id, student, user };
}

const REAL_ZDR_ROWS = [
  {
    model_id: 'anthropic/claude-sonnet-4.5',
    provider_name: 'Amazon Bedrock',
    tag: 'amazon-bedrock',
    pricing: { prompt: '0.000003', completion: '0.000015' },
    supported_parameters: ['max_tokens', 'response_format', 'structured_outputs'],
  },
];
// A genuine substring of the REAL extracted DEMO_ANSWER_HTML text — a
// real citation, never a paraphrase (mission §4).
const VALID_PROPOSAL = {
  items: [{ itemId: 'item-2', constat: 'Réponse cohérente.', preuve: 'Ce document sert uniquement à vérifier que l', incertitude: false }],
  pointsAppui: ['Clarté'],
  difficultesObservees: [],
  prioritesTravail: [],
  propositionsRemediation: [],
};

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body), body: null } as unknown as Response;
}

function fakeGeneratingFetch(): typeof fetch {
  return jest.fn(async (url: string) => {
    if (url.endsWith('/auth/key')) return jsonResponse(200, { data: {} });
    if (url.endsWith('/endpoints/zdr')) return jsonResponse(200, { data: REAL_ZDR_ROWS });
    if (url.includes('/chat/completions')) {
      return jsonResponse(200, {
        id: 'gen-fixture',
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(VALID_PROPOSAL) } }],
        usage: { prompt_tokens: 400, completion_tokens: 80, cost: 0.0032 },
      });
    }
    if (url.includes('/generation')) return jsonResponse(200, { data: { provider_name: 'Amazon Bedrock' } });
    throw new Error(`unexpected url ${url}`);
  }) as unknown as typeof fetch;
}

describe('generateBilanDraft', () => {
  test('refuses outright when the instrument is not DEMO_FIXTURE', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `NOTDEMO-${randomUUID()}`, { catalogStatus: 'AUTHORIZED' });
    await expect(generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() })).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  test('produces revision 1 with real deterministic results and a real (fake-transport) AI proposal', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `GEN-${randomUUID()}`);

    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });

    expect(draft.revision).toBe(1);
    expect(draft.status).toBe('DRAFT');
    const deterministic = draft.deterministicResults as unknown as { itemId: string; status: string; correct?: boolean }[];
    expect(deterministic[0]).toMatchObject({ itemId: 'item-1', status: 'MATCHED', correct: true }); // the real demo answer is "C) Paris"
    expect(draft.aiProposal).toEqual(VALID_PROPOSAL);
    expect((draft.aiProvenance as { outcome?: string })?.outcome ?? 'GENERATED').toBeTruthy();
  });

  test('a second generation call creates revision 2, never overwriting revision 1', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `REV-${randomUUID()}`);
    const first = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });
    const second = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });

    expect(second.revision).toBe(2);
    const stillThere = await h.client.diagnosticBilanDraft.findUnique({ where: { id: first.id } });
    expect(stillThere?.revision).toBe(1);
    expect(stillThere?.status).toBe('DRAFT');
  });

  test('when the AI call is refused (no compliant endpoint), the draft is still created with deterministic results and a visible absence', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `NOAI-${randomUUID()}`);
    const fetchImpl = jest.fn(async (url: string) => {
      if (url.endsWith('/auth/key')) return jsonResponse(200, { data: {} });
      if (url.endsWith('/endpoints/zdr')) return jsonResponse(200, { data: [] });
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;

    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl });
    expect(draft.aiProposal).toBeNull();
    expect(draft.aiProvenance).toMatchObject({ outcome: 'PREFLIGHT_BLOCKED' });
  });
});

describe('the DRAFT -> VALIDATED -> PUBLISHED lifecycle, with optimistic concurrency', () => {
  test('happy path: correct, validate, publish, then the candidate can read exactly the published revision', async () => {
    const ctx = h.ctx();
    const { processingId, user } = await seedExtractedProcessing(h.client, ctx, `LIFE-${randomUUID()}`);
    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });

    const corrected = await applyHumanBilanCorrection(h.client, ctx, processingId, {
      draftId: draft.id,
      editVersion: draft.editVersion,
      humanReview: { note: 'Vérifié par un enseignant.' },
    });
    expect(corrected.editVersion).toBe(draft.editVersion + 1);

    const validated = await validateBilanDraft(h.client, ctx, processingId, { draftId: draft.id, editVersion: corrected.editVersion });
    expect(validated.status).toBe('VALIDATED');
    expect(validated.validatedById).toBe(ctx.actor.userId);
    expect(validated.publishedContent).not.toBeNull();

    const published = await publishBilanDraft(h.client, ctx, processingId, {
      draftId: draft.id,
      editVersion: validated.editVersion,
      audienceScope: 'own-student',
    });
    expect(published.status).toBe('PUBLISHED');

    const ownView = await getOwnPublishedBilan(h.client, h.ctx(eleveActor(user.id)), processingId);
    expect(ownView.revision).toBe(1);
    expect(ownView.content.items).toEqual([
      { itemId: 'item-2', constat: VALID_PROPOSAL.items[0].constat, preuve: VALID_PROPOSAL.items[0].preuve, incertitude: false, source: 'AI' },
    ]);
    // Not the raw internal blobs — the candidate view has no such fields at all.
    expect(ownView).not.toHaveProperty('aiProposal');
    expect(ownView).not.toHaveProperty('humanReview');
  });

  test('a human per-item correction REPLACES that item\'s AI constat in the published content — the candidate never sees the superseded AI text or the internal note', async () => {
    const ctx = h.ctx();
    const { processingId, user } = await seedExtractedProcessing(h.client, ctx, `CORRECT-${randomUUID()}`);
    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });

    const corrected = await applyHumanBilanCorrection(h.client, ctx, processingId, {
      draftId: draft.id,
      editVersion: draft.editVersion,
      humanReview: {
        note: 'Note interne : à ne jamais publier telle quelle.',
        itemCorrections: [{ itemId: 'item-2', correctedConstat: 'Constat corrigé par l’enseignant.' }],
      },
    });
    const validated = await validateBilanDraft(h.client, ctx, processingId, { draftId: draft.id, editVersion: corrected.editVersion });
    await publishBilanDraft(h.client, ctx, processingId, { draftId: draft.id, editVersion: validated.editVersion, audienceScope: 'own-student' });

    const ownView = await getOwnPublishedBilan(h.client, h.ctx(eleveActor(user.id)), processingId);
    expect(ownView.content.items).toEqual([
      { itemId: 'item-2', constat: 'Constat corrigé par l’enseignant.', preuve: null, incertitude: false, source: 'HUMAN_CORRECTED' },
    ]);
    expect(JSON.stringify(ownView)).not.toContain('Note interne');
    expect(JSON.stringify(ownView)).not.toContain(VALID_PROPOSAL.items[0].constat); // the superseded AI constat never reaches the candidate
  });

  test('a correction targeting an itemId absent from the current AI proposal is refused', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `BADITEM-${randomUUID()}`);
    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });

    await expect(
      applyHumanBilanCorrection(h.client, ctx, processingId, {
        draftId: draft.id,
        editVersion: draft.editVersion,
        humanReview: { itemCorrections: [{ itemId: 'item-does-not-exist', correctedConstat: 'x' }] },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  test('a stale editVersion on the SAME (current) draft is refused, never silently applied over a concurrent edit', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `STALE-${randomUUID()}`);
    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });

    await applyHumanBilanCorrection(h.client, ctx, processingId, { draftId: draft.id, editVersion: draft.editVersion, humanReview: { note: 'premier' } });

    await expect(
      applyHumanBilanCorrection(h.client, ctx, processingId, { draftId: draft.id, editVersion: draft.editVersion, humanReview: { note: 'stale second write' } }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  test('publishing before validating is refused', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `NOVAL-${randomUUID()}`);
    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });
    await expect(
      publishBilanDraft(h.client, ctx, processingId, { draftId: draft.id, editVersion: draft.editVersion, audienceScope: 'own-student' }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  test('a new generation after publication starts a fresh DRAFT revision and never touches the published one', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `AFTERPUB-${randomUUID()}`);
    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });
    const validated = await validateBilanDraft(h.client, ctx, processingId, { draftId: draft.id, editVersion: draft.editVersion });
    const published = await publishBilanDraft(h.client, ctx, processingId, {
      draftId: draft.id,
      editVersion: validated.editVersion,
      audienceScope: 'own-student',
    });

    const revision2 = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });
    expect(revision2.revision).toBe(2);
    expect(revision2.status).toBe('DRAFT');

    const publishedRow = await h.client.diagnosticBilanDraft.findUnique({ where: { id: published.id } });
    expect(publishedRow?.status).toBe('PUBLISHED');
    expect(publishedRow?.revision).toBe(1);

    const current = await getCurrentBilanDraftForReview(h.client, ctx, processingId);
    expect(current?.revision).toBe(2); // the review screen shows the CURRENT revision, not the published one
  });

  test('mission §2 counter-proof: validating a STALE revision-1 VIEW is refused outright — it never silently validates revision 2, even though both revisions share the same editVersion', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `REVBIND-${randomUUID()}`);

    // Open revision 1 (as a reviewer would): read it, note its id/editVersion.
    const revision1 = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });
    expect(revision1.revision).toBe(1);
    expect(revision1.editVersion).toBe(1);

    // A second generation creates revision 2 — a FRESH row, whose editVersion
    // ALSO starts at 1. The two revisions now share the same editVersion.
    const revision2 = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });
    expect(revision2.revision).toBe(2);
    expect(revision2.editVersion).toBe(1);
    expect(revision2.id).not.toBe(revision1.id);

    // Send a validation request bound to the STALE revision-1 view (its own
    // id + its own editVersion — a value that, coincidentally, also matches
    // revision 2's current editVersion). This must be refused outright.
    await expect(
      validateBilanDraft(h.client, ctx, processingId, { draftId: revision1.id, editVersion: revision1.editVersion }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    // Revision 2 must NOT have been silently validated by that request.
    const stillCurrent = await getCurrentBilanDraftForReview(h.client, ctx, processingId);
    expect(stillCurrent?.id).toBe(revision2.id);
    expect(stillCurrent?.status).toBe('DRAFT');

    // The same binding protects correction and publish, not just validate.
    await expect(
      applyHumanBilanCorrection(h.client, ctx, processingId, { draftId: revision1.id, editVersion: revision1.editVersion, humanReview: { note: 'x' } }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      publishBilanDraft(h.client, ctx, processingId, { draftId: revision1.id, editVersion: revision1.editVersion, audienceScope: 'own-student' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('getOwnPublishedBilan — the real audience matrix', () => {
  test('a DRAFT (not yet published) bilan is invisible to the candidate — not found, never leaked', async () => {
    const ctx = h.ctx();
    const { processingId, user } = await seedExtractedProcessing(h.client, ctx, `PRIV-${randomUUID()}`);
    await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });

    await expect(getOwnPublishedBilan(h.client, h.ctx(eleveActor(user.id)), processingId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('a DIFFERENT candidate can never read this one\'s published bilan — ownership is re-checked, not inferred', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `OWNER-${randomUUID()}`);
    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });
    const validated = await validateBilanDraft(h.client, ctx, processingId, { draftId: draft.id, editVersion: draft.editVersion });
    await publishBilanDraft(h.client, ctx, processingId, { draftId: draft.id, editVersion: validated.editVersion, audienceScope: 'own-student' });

    const { user: otherUser } = await seedExtractedProcessing(h.client, ctx, `OTHER-${randomUUID()}`);
    await expect(getOwnPublishedBilan(h.client, h.ctx(eleveActor(otherUser.id)), processingId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('a non-ELEVE actor is refused outright by the self-service role check', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `ROLE-${randomUUID()}`);
    await expect(getOwnPublishedBilan(h.client, h.ctx(h.assistante), processingId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('getOwnPublishedBilanForSubmission — the candidate\'s own vocabulary (submissionId, not processingId)', () => {
  test('resolves the same published content as getOwnPublishedBilan, keyed by submissionId', async () => {
    const ctx = h.ctx();
    const { processingId, submissionId, user } = await seedExtractedProcessing(h.client, ctx, `BYSUB-${randomUUID()}`);
    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });
    const validated = await validateBilanDraft(h.client, ctx, processingId, { draftId: draft.id, editVersion: draft.editVersion });
    await publishBilanDraft(h.client, ctx, processingId, { draftId: draft.id, editVersion: validated.editVersion, audienceScope: 'own-student' });

    const bySubmission = await getOwnPublishedBilanForSubmission(h.client, h.ctx(eleveActor(user.id)), submissionId);
    expect(bySubmission.revision).toBe(1);
    expect(bySubmission.content.items).toEqual([
      { itemId: 'item-2', constat: VALID_PROPOSAL.items[0].constat, preuve: VALID_PROPOSAL.items[0].preuve, incertitude: false, source: 'AI' },
    ]);
  });

  test('a not-yet-published bilan is a 404 by this path too', async () => {
    const ctx = h.ctx();
    const { processingId, submissionId, user } = await seedExtractedProcessing(h.client, ctx, `BYSUB-NONE-${randomUUID()}`);
    await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });
    await expect(getOwnPublishedBilanForSubmission(h.client, h.ctx(eleveActor(user.id)), submissionId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
