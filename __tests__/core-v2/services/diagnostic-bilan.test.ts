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
  return { processingId: processing.id, student, user };
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
const VALID_PROPOSAL = {
  items: [{ itemId: 'item-2', constat: 'Réponse cohérente.', preuve: 'Extrait pertinent.', incertitude: false }],
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
    if (url.endsWith('/chat/completions')) {
      return jsonResponse(200, {
        id: 'gen-fixture',
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(VALID_PROPOSAL) } }],
        usage: { prompt_tokens: 400, completion_tokens: 80, cost: 0.0032 },
      });
    }
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
      editVersion: draft.editVersion,
      humanReview: { note: 'Vérifié par un enseignant.' },
    });
    expect(corrected.editVersion).toBe(draft.editVersion + 1);

    const validated = await validateBilanDraft(h.client, ctx, processingId, { editVersion: corrected.editVersion });
    expect(validated.status).toBe('VALIDATED');
    expect(validated.validatedById).toBe(ctx.actor.userId);

    const published = await publishBilanDraft(h.client, ctx, processingId, { editVersion: validated.editVersion, audienceScope: 'own-student' });
    expect(published.status).toBe('PUBLISHED');

    const ownView = await getOwnPublishedBilan(h.client, h.ctx(eleveActor(user.id)), processingId);
    expect(ownView.revision).toBe(1);
    expect(ownView.aiProposal).toEqual(VALID_PROPOSAL);
  });

  test('a stale editVersion is refused, never silently applied over a concurrent edit', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `STALE-${randomUUID()}`);
    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });

    await applyHumanBilanCorrection(h.client, ctx, processingId, { editVersion: draft.editVersion, humanReview: { note: 'premier' } });

    await expect(
      applyHumanBilanCorrection(h.client, ctx, processingId, { editVersion: draft.editVersion, humanReview: { note: 'stale second write' } }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  test('publishing before validating is refused', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `NOVAL-${randomUUID()}`);
    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });
    await expect(
      publishBilanDraft(h.client, ctx, processingId, { editVersion: draft.editVersion, audienceScope: 'own-student' }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  test('a new generation after publication starts a fresh DRAFT revision and never touches the published one', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `AFTERPUB-${randomUUID()}`);
    const draft = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });
    const validated = await validateBilanDraft(h.client, ctx, processingId, { editVersion: draft.editVersion });
    const published = await publishBilanDraft(h.client, ctx, processingId, { editVersion: validated.editVersion, audienceScope: 'own-student' });

    const revision2 = await generateBilanDraft(h.client, ctx, processingId, { fetchImpl: fakeGeneratingFetch() });
    expect(revision2.revision).toBe(2);
    expect(revision2.status).toBe('DRAFT');

    const publishedRow = await h.client.diagnosticBilanDraft.findUnique({ where: { id: published.id } });
    expect(publishedRow?.status).toBe('PUBLISHED');
    expect(publishedRow?.revision).toBe(1);

    const current = await getCurrentBilanDraftForReview(h.client, ctx, processingId);
    expect(current?.revision).toBe(2); // the review screen shows the CURRENT revision, not the published one
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
    const validated = await validateBilanDraft(h.client, ctx, processingId, { editVersion: draft.editVersion });
    await publishBilanDraft(h.client, ctx, processingId, { editVersion: validated.editVersion, audienceScope: 'own-student' });

    const { user: otherUser } = await seedExtractedProcessing(h.client, ctx, `OTHER-${randomUUID()}`);
    await expect(getOwnPublishedBilan(h.client, h.ctx(eleveActor(otherUser.id)), processingId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('a non-ELEVE actor is refused outright by the self-service role check', async () => {
    const ctx = h.ctx();
    const { processingId } = await seedExtractedProcessing(h.client, ctx, `ROLE-${randomUUID()}`);
    await expect(getOwnPublishedBilan(h.client, h.ctx(h.assistante), processingId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
