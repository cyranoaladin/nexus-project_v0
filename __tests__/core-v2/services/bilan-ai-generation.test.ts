/**
 * The C2 AI pilot's bounded completion call (mission §3/§4/§5/§6),
 * exercised against the REAL disposable Core v2 DB (real ledger rows)
 * with a fake `fetchImpl` standing in for the network (no real OpenRouter
 * traffic in this suite — the one real live call is exercised separately,
 * deliberately outside the automated test suite so it never spends real
 * pilot budget on a CI run). The ZDR fixture is the same real capture used
 * by openrouter-preflight.test.ts.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@/core-v2/generated/client';
import type { ServiceContext } from '@/lib/core-v2/services/context';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

import { createHousehold, createStudent } from '@/lib/core-v2/services';
import { attributeDiagnostic } from '@/lib/core-v2/services/diagnostics';
import { depositOwnDiagnosticSubmission } from '@/lib/core-v2/diagnostics/submission-pipeline';
import { drainDiagnosticSubmissionProcessingQueue, enqueueDiagnosticSubmissionProcessing } from '@/lib/core-v2/services/diagnostic-processing';
import { renderHtmlToPdf } from '@/lib/bilans/render/pdf';
import { runBoundedBilanGeneration } from '@/lib/core-v2/diagnostics/bilan-ai-generation';
import { extractSubmissionTextBounded } from '@/lib/core-v2/diagnostics/text-extraction';
import { DEMO_ANSWER_HTML, DEMO_FIXTURE_AI_REVIEW_ITEMS } from '@/lib/core-v2/diagnostics/demo-content';
import { PER_AUDIENCE_CAP_USD, reserveAiBudget, commitAiBudgetEntry } from '@/lib/core-v2/diagnostics/ai-budget-ledger';

beforeEach(() => {
  process.env.DIAGNOSTIC_DEMO_MODE = '1';
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
});

function allowDemoFixtureFor(...studentIds: string[]) {
  const existing = (process.env.DIAGNOSTIC_DEMO_STUDENT_IDS ?? '').split(',').filter(Boolean);
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = [...existing, ...studentIds].join(',');
}

function eleveActor(userId: string) {
  return { userId, role: 'ELEVE' as const };
}

const ALLOWED_ITEM_IDS = DEMO_FIXTURE_AI_REVIEW_ITEMS.map((i) => i.itemId);
let realExtractedText = '';

beforeAll(async () => {
  const pdf = await renderHtmlToPdf(DEMO_ANSWER_HTML);
  const result = await extractSubmissionTextBounded(pdf);
  if (result.status !== 'SUCCEEDED') throw new Error('fixture extraction failed');
  realExtractedText = result.text;
});

/** A real deposit → real extraction, using the genuine DEMO_ANSWER_HTML fixture rendered to a real PDF. */
async function seedExtractedProcessing(client: PrismaClient, ctx: ServiceContext, label: string): Promise<string> {
  const { household } = await createHousehold(client, ctx, {
    parent: { firstName: `P${label}`, lastName: 'Synthetic', email: `parent-ai-gen-${label}@synthetic.test` },
  });
  const { student, user } = await createStudent(client, ctx, {
    householdId: household.id,
    student: { firstName: `S${label}`, lastName: 'Synthetic' },
  });
  allowDemoFixtureFor(student.id);
  const instrumentKey = `AI-GEN-${label}`;
  const instrument = await client.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: `AI generation instrument ${label}`,
      subject: 'Test',
      level: 'Toutes',
      targetSession: 'DEMO',
      form: 'FORM_TEST',
      durationMinutes: 30,
      modalities: 'Test only.',
      catalogStatus: 'DEMO_FIXTURE',
      manifestChecksum: createHash('sha256').update(instrumentKey).digest('hex'),
      manifestVersion: 'test/1.0',
      subjectSha256: createHash('sha256').update(`subject-${instrumentKey}`).digest('hex'),
    },
  });
  const assignment = await attributeDiagnostic(client, ctx, { studentId: student.id, instrumentRefId: instrument.id });
  const pdf = await renderHtmlToPdf(DEMO_ANSWER_HTML);
  const { submission } = await depositOwnDiagnosticSubmission(client, h.ctx(eleveActor(user.id)), {
    assignmentId: assignment.id,
    originalFilename: 'reponses.pdf',
    mimeType: 'application/pdf',
    bytes: pdf,
  });
  const processing = await enqueueDiagnosticSubmissionProcessing(client, ctx, submission.id);
  await drainDiagnosticSubmissionProcessingQueue(client);
  return processing.id;
}

const REAL_ZDR_ROWS_FOR_SONNET_45 = [
  {
    model_id: 'anthropic/claude-sonnet-4.5',
    provider_name: 'Amazon Bedrock',
    tag: 'amazon-bedrock',
    pricing: { prompt: '0.000003', completion: '0.000015' },
    supported_parameters: ['max_tokens', 'response_format', 'structured_outputs'],
  },
];

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => text,
    body: null,
  } as unknown as Response;
}

/** Literal substrings of the REAL extracted DEMO_ANSWER_HTML text — genuine citations, never a paraphrase/ellipsis stand-in. */
const VALID_PROPOSAL = {
  items: [
    { itemId: 'item-2', constat: 'Réponse cohérente avec la consigne.', preuve: 'Ce document sert uniquement à vérifier que l', incertitude: false },
    { itemId: 'item-3', constat: 'Étapes décrites de façon claire.', preuve: 'Je me suis connecté avec mon compte candidat', incertitude: false },
  ],
  pointsAppui: ['Expression claire'],
  difficultesObservees: [],
  prioritesTravail: ['Aucune priorité identifiée sur cette fixture'],
  propositionsRemediation: [],
};

function fakeFetch(handlers: {
  key?: () => Response | Promise<Response>;
  zdr?: () => Response | Promise<Response>;
  chat?: () => Response | Promise<Response>;
  generation?: () => Response | Promise<Response>;
}): jest.Mock {
  return jest.fn(async (url: string) => {
    if (url.endsWith('/auth/key')) return (handlers.key ?? (() => jsonResponse(200, { data: {} })))();
    if (url.endsWith('/endpoints/zdr')) return (handlers.zdr ?? (() => jsonResponse(200, { data: REAL_ZDR_ROWS_FOR_SONNET_45 })))();
    if (url.includes('/chat/completions')) return (handlers.chat ?? (() => { throw new Error('no chat handler configured'); }))();
    if (url.includes('/generation')) return (handlers.generation ?? (() => jsonResponse(200, { data: { provider_name: 'Amazon Bedrock' } })))();
    throw new Error(`Unexpected URL in test: ${url}`);
  });
}

async function currentLedgerRow(client: PrismaClient, processingId: string) {
  return client.diagnosticAiBudgetLedger.findFirst({ where: { processingId }, orderBy: { createdAt: 'desc' } });
}

function baseInput(overrides: Partial<Parameters<typeof runBoundedBilanGeneration>[0]>) {
  return {
    client: h.client,
    apiKey: 'sk-or-test',
    model: 'anthropic/claude-sonnet-4.5',
    audienceScope: 'pedagogical-review',
    systemPrompt: 'system',
    userPayload: 'user payload with the extracted copy',
    maxOutputTokens: 2048,
    promptVersion: 'v1',
    schemaVersion: 'v1',
    extractedText: realExtractedText,
    allowedItemIds: ALLOWED_ITEM_IDS,
    ...overrides,
  } as Parameters<typeof runBoundedBilanGeneration>[0];
}

describe('runBoundedBilanGeneration — success path', () => {
  test('a valid 200 response commits the REAL reported cost, returns the validated proposal, and resolves the actual provider via /generation', async () => {
    const ctx = h.ctx();
    const processingId = await seedExtractedProcessing(h.client, ctx, `OK-${randomUUID()}`);
    const fetchImpl = fakeFetch({
      chat: () =>
        jsonResponse(200, {
          id: 'gen-abc123',
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(VALID_PROPOSAL) } }],
          usage: { prompt_tokens: 500, completion_tokens: 120, cost: 0.0041 },
        }),
      generation: () => jsonResponse(200, { data: { provider_name: 'Amazon Bedrock' } }),
    });

    const result = await runBoundedBilanGeneration(baseInput({ processingId, fetchImpl }));

    expect(result.outcome).toBe('GENERATED');
    if (result.outcome !== 'GENERATED') throw new Error('expected GENERATED');
    expect(result.proposal).toEqual(VALID_PROPOSAL);
    expect(result.provenance.actualCostUsd).toBe(0.0041);
    expect(result.provenance.providerRequestId).toBe('gen-abc123');
    expect(result.provenance.providerName).toBe('Amazon Bedrock'); // from the /generation lookup, not the preflight's theoretical list
    expect(result.provenance.preflightCandidateProviders).toEqual(['Amazon Bedrock']);
    expect(result.provenance.coverage.missingItemIds).toEqual([]);

    const row = await currentLedgerRow(h.client, processingId);
    expect(row?.status).toBe('COMMITTED');
    expect(Number(row?.actualCostUsd)).toBe(0.0041);
  });

  test('a failed /generation lookup still returns GENERATED, with providerName null rather than a guess', async () => {
    const ctx = h.ctx();
    const processingId = await seedExtractedProcessing(h.client, ctx, `NOLOOKUP-${randomUUID()}`);
    const fetchImpl = fakeFetch({
      chat: () =>
        jsonResponse(200, {
          id: 'gen-nolookup',
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(VALID_PROPOSAL) } }],
          usage: { prompt_tokens: 500, completion_tokens: 120, cost: 0.0041 },
        }),
      generation: () => jsonResponse(500, { error: 'unavailable' }),
    });

    const result = await runBoundedBilanGeneration(baseInput({ processingId, fetchImpl }));
    expect(result.outcome).toBe('GENERATED');
    if (result.outcome !== 'GENERATED') throw new Error('expected GENERATED');
    expect(result.provenance.providerName).toBeNull();
  });
});

describe('runBoundedBilanGeneration — refusal paths never spend on a doomed call', () => {
  test('PREFLIGHT_BLOCKED when no ZDR endpoint supports this model: no ledger row is ever created', async () => {
    const ctx = h.ctx();
    const processingId = await seedExtractedProcessing(h.client, ctx, `PRE-${randomUUID()}`);
    const fetchImpl = fakeFetch({ zdr: () => jsonResponse(200, { data: [] }) });

    const result = await runBoundedBilanGeneration(baseInput({ processingId, fetchImpl }));

    expect(result.outcome).toBe('PREFLIGHT_BLOCKED');
    expect(await currentLedgerRow(h.client, processingId)).toBeNull();
  });

  test('BUDGET_BLOCKED when the per-audience cap is already spent: the chat endpoint is never called', async () => {
    const ctx = h.ctx();
    const processingId = await seedExtractedProcessing(h.client, ctx, `BUD-${randomUUID()}`);
    const priorReservation = await reserveAiBudget(h.client, {
      processingId,
      audienceScope: 'pedagogical-review',
      estimatedCostUsd: PER_AUDIENCE_CAP_USD,
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.5',
    });
    await commitAiBudgetEntry(h.client, priorReservation.id, { actualCostUsd: PER_AUDIENCE_CAP_USD });

    const fetchImpl = fakeFetch({});
    const result = await runBoundedBilanGeneration(baseInput({ processingId, fetchImpl }));

    expect(result.outcome).toBe('BUDGET_BLOCKED');
    expect(fetchImpl.mock.calls.some(([url]: [string]) => url.includes('/chat/completions'))).toBe(false);
  });
});

describe('runBoundedBilanGeneration — ambiguous-outcome calls (provider status genuinely unknown) never auto-release the reservation', () => {
  test('a network error leaves the reservation RESERVED, never released, for later reconciliation', async () => {
    const ctx = h.ctx();
    const processingId = await seedExtractedProcessing(h.client, ctx, `NET-${randomUUID()}`);
    const fetchImpl = fakeFetch({
      chat: () => {
        throw new Error('ECONNRESET');
      },
    });

    const result = await runBoundedBilanGeneration(baseInput({ processingId, fetchImpl }));

    expect(result).toMatchObject({ outcome: 'CALL_FAILED', reason: 'NETWORK_ERROR_OR_TIMEOUT', budgetStatus: 'RESERVED_UNRECONCILED' });
    const row = await currentLedgerRow(h.client, processingId);
    expect(row?.status).toBe('RESERVED');
  });

  test('an HTTP error response leaves the reservation RESERVED — an error status is never assumed to mean "free"', async () => {
    const ctx = h.ctx();
    const processingId = await seedExtractedProcessing(h.client, ctx, `HTTP-${randomUUID()}`);
    const fetchImpl = fakeFetch({ chat: () => jsonResponse(503, { error: 'no provider available' }) });

    const result = await runBoundedBilanGeneration(baseInput({ processingId, fetchImpl }));

    expect(result).toMatchObject({ outcome: 'CALL_FAILED', reason: 'OPENROUTER_HTTP_503', budgetStatus: 'RESERVED_UNRECONCILED' });
    const row = await currentLedgerRow(h.client, processingId);
    expect(row?.status).toBe('RESERVED');
  });

  test('a 200 response missing usage.cost is an anomaly, not "free": stays RESERVED, never committed at the worst-case estimate', async () => {
    const ctx = h.ctx();
    const processingId = await seedExtractedProcessing(h.client, ctx, `NOCOST-${randomUUID()}`);
    const fetchImpl = fakeFetch({
      chat: () =>
        jsonResponse(200, {
          id: 'gen-nocost',
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(VALID_PROPOSAL) } }],
          usage: { prompt_tokens: 500, completion_tokens: 120 }, // no cost field
        }),
    });

    const result = await runBoundedBilanGeneration(baseInput({ processingId, fetchImpl }));

    expect(result).toMatchObject({ outcome: 'CALL_FAILED', reason: 'USAGE_COST_MISSING', budgetStatus: 'RESERVED_UNRECONCILED' });
    const row = await currentLedgerRow(h.client, processingId);
    expect(row?.status).toBe('RESERVED'); // never committed at the reserved worst-case estimate
  });
});

describe('runBoundedBilanGeneration — REJECTED: a real, billed generation that is unusable (never "still RESERVED")', () => {
  test('a response truncated at max_tokens is never accepted as a complete bilan, but its real cost is still committed', async () => {
    const ctx = h.ctx();
    const processingId = await seedExtractedProcessing(h.client, ctx, `TRUNC-${randomUUID()}`);
    const fetchImpl = fakeFetch({
      chat: () =>
        jsonResponse(200, {
          id: 'gen-truncated',
          choices: [{ finish_reason: 'length', message: { content: '{"items": [' } }],
          usage: { prompt_tokens: 500, completion_tokens: 2048, cost: 0.0308 },
        }),
    });

    const result = await runBoundedBilanGeneration(baseInput({ processingId, fetchImpl }));

    expect(result).toMatchObject({ outcome: 'REJECTED', reason: 'RESPONSE_TRUNCATED_AT_MAX_TOKENS', budgetStatus: 'COMMITTED', actualCostUsd: 0.0308 });
    const row = await currentLedgerRow(h.client, processingId);
    expect(row?.status).toBe('COMMITTED'); // a real generation was billed even though it is unusable
    expect(Number(row?.actualCostUsd)).toBe(0.0308);
  });

  test('a response that fails the app-side schema is rejected even though the provider returned 200 with valid JSON', async () => {
    const ctx = h.ctx();
    const processingId = await seedExtractedProcessing(h.client, ctx, `SCHEMA-${randomUUID()}`);
    const fetchImpl = fakeFetch({
      chat: () =>
        jsonResponse(200, {
          id: 'gen-badschema',
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ items: [] }) } }], // missing required arrays, empty items
          usage: { prompt_tokens: 400, completion_tokens: 20, cost: 0.0007 },
        }),
    });

    const result = await runBoundedBilanGeneration(baseInput({ processingId, fetchImpl }));

    expect(result).toMatchObject({ outcome: 'REJECTED', reason: 'SCHEMA_VALIDATION_FAILED', budgetStatus: 'COMMITTED' });
    const row = await currentLedgerRow(h.client, processingId);
    expect(row?.status).toBe('COMMITTED');
  });

  test('an unknown itemId (not among the ones actually asked about) is rejected even though it is schema-valid', async () => {
    const ctx = h.ctx();
    const processingId = await seedExtractedProcessing(h.client, ctx, `UNKNOWNITEM-${randomUUID()}`);
    const badProposal = { ...VALID_PROPOSAL, items: [{ itemId: 'item-99', constat: 'x', preuve: 'y', incertitude: true }] };
    const fetchImpl = fakeFetch({
      chat: () =>
        jsonResponse(200, {
          id: 'gen-unknownitem',
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(badProposal) } }],
          usage: { prompt_tokens: 400, completion_tokens: 20, cost: 0.0007 },
        }),
    });

    const result = await runBoundedBilanGeneration(baseInput({ processingId, fetchImpl }));
    expect(result).toMatchObject({ outcome: 'REJECTED', reason: 'EVIDENCE_VALIDATION_FAILED:UNKNOWN_ITEM_ID', budgetStatus: 'COMMITTED' });
  });

  test('a fabricated citation (not present in the extracted copy, incertitude=false) is rejected, never accepted as a real quote', async () => {
    const ctx = h.ctx();
    const processingId = await seedExtractedProcessing(h.client, ctx, `FAKEQUOTE-${randomUUID()}`);
    const badProposal = {
      ...VALID_PROPOSAL,
      items: [{ itemId: 'item-2', constat: 'x', preuve: 'Ceci est une citation totalement inventée qui ne figure nulle part', incertitude: false }],
    };
    const fetchImpl = fakeFetch({
      chat: () =>
        jsonResponse(200, {
          id: 'gen-fakequote',
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(badProposal) } }],
          usage: { prompt_tokens: 400, completion_tokens: 20, cost: 0.0007 },
        }),
    });

    const result = await runBoundedBilanGeneration(baseInput({ processingId, fetchImpl }));
    expect(result).toMatchObject({ outcome: 'REJECTED', reason: 'EVIDENCE_VALIDATION_FAILED:UNVERIFIABLE_EVIDENCE', budgetStatus: 'COMMITTED' });
  });

  test('incertitude=true with no matching quote is accepted — an honestly-flagged absence is not a fabricated citation', async () => {
    const ctx = h.ctx();
    const processingId = await seedExtractedProcessing(h.client, ctx, `UNCERTAIN-${randomUUID()}`);
    const honestProposal = {
      ...VALID_PROPOSAL,
      items: [
        { itemId: 'item-2', constat: 'Réponse cohérente.', preuve: 'Ce document sert uniquement à vérifier que l', incertitude: false },
        { itemId: 'item-3', constat: 'Absence de réponse identifiable.', preuve: 'aucun passage identifiable', incertitude: true },
      ],
    };
    const fetchImpl = fakeFetch({
      chat: () =>
        jsonResponse(200, {
          id: 'gen-honest',
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(honestProposal) } }],
          usage: { prompt_tokens: 400, completion_tokens: 20, cost: 0.0007 },
        }),
    });

    const result = await runBoundedBilanGeneration(baseInput({ processingId, fetchImpl }));
    expect(result.outcome).toBe('GENERATED');
  });
});
