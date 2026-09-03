/**
 * P0-ARIA-01 — end-to-end scenario C (mission §4), now BEHAVIORALLY CLOSED:
 *
 *   production student → canonical academic context
 *     → production RAG identity (`resolveProductionAriaRagIdentity`, REAL)
 *     → signed identity envelope
 *     → manifest-bound retrieval request
 *     → real RAG client contract (real AJV validation)
 *     → SUCCESS
 *     → NO E2E_DISPOSABLE_STACK / ARIA_E2E_* variables anywhere
 *
 * `resolveProductionAriaRagIdentity` used to honestly return `null`
 * unconditionally (the `audience` SSoT gap). That gap is now closed WITHOUT
 * a Nexus-side per-student field: `audience` is derived from the corpus's
 * own promoted manifest (`plan.retrievalScope.target_policy.audiences`,
 * required to be a member set BEFORE any request builds by
 * `identityMatchesPlan()` in `lib/aria/rag.ts` already) when that corpus is
 * mono-audience — see `production-academic-identity.ts`'s
 * `resolveProductionAriaRagAudience()` docstring for the full architectural
 * justification (exhaustive search confirming no Nexus SSoT is warranted).
 * The test below ("closes the loop") calls the REAL resolver end to end,
 * not a hand-built stand-in identity — this is the actual proof, not a
 * simulation of what the proof would look like once the gap closed.
 *
 * Cubic P2: this file previously injected `executeAriaRetrieval`'s `search`
 * dependency as a raw `jest.fn()` returning a hand-written object directly —
 * bypassing `searchAriaRagV2` (and therefore the real AJV
 * `validateConfig`/`validateRequest`/`validateResponse` it runs) entirely.
 * The fixtures it fed that mock were in fact NOT contract-valid (missing
 * required `doc_id`/`citation.rights`, non-UUID `resource_id`, an
 * under-length `serviceToken`, an over-limit `maxResponseBytes`) — none of
 * which the old test could ever have caught. It now calls the REAL
 * `searchAriaRagV2`, injecting only a hermetic `fetchImpl` (no real network
 * I/O), so the full AJV-validated contract pipeline actually executes.
 */

import {
  resolveProductionAcademicVocabulary,
  resolveProductionCandidateStatus,
  resolveProductionAriaRagPseudonym,
  resolveProductionAriaRagIdentity,
} from '@/lib/aria/infrastructure/rag/production-academic-identity';
import { executeAriaRetrieval, type AriaResolvedRagStudentIdentity } from '@/lib/aria/rag';
import { searchAriaRagV2 } from '@/lib/aria/infrastructure/rag/rag-engine-client';
import type { AriaRetrievalPlan } from '@/lib/aria/contracts';

function hermeticResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

const CLIENT_CONFIG = Object.freeze({
  baseUrl: 'https://rag.internal.test',
  serviceToken: 't'.repeat(32), // real validateConfig requires >= 32 bytes
  timeoutMs: 5_000, // real validateConfig caps at 5_000
  maxResponseBytes: 262_144, // real validateConfig caps at 262_144
});

const SIGNER_CONFIG = Object.freeze({
  signingKey: 'k'.repeat(32),
  issuer: 'nexus',
  audience: 'rag',
  identityIssuer: 'nexus',
  identityAudience: 'rag',
});

describe('P0-ARIA-01 — production identity dimensions are RAG-contract-valid end to end', () => {
  const E2E_ENV_KEYS = [
    'E2E_DISPOSABLE_STACK',
    'ARIA_E2E_RAG_CANDIDAT',
    'ARIA_E2E_RAG_AUDIENCE',
    'ARIA_E2E_RAG_ZONE',
    'ARIA_E2E_RAG_STATUS_DETAIL',
  ] as const;

  beforeAll(() => {
    for (const key of E2E_ENV_KEYS) delete process.env[key];
  });

  function buildScenario() {
    // 1. Real server truth (Academic Map + curriculum catalogue), exactly as
    //    `resolveProductionAriaRagIdentity` derives it — no E2E fixture.
    const vocabulary = resolveProductionAcademicVocabulary({
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      courseKey: 'eds-maths-terminale',
    });
    if (!vocabulary) throw new Error('unreachable');

    const candidat = resolveProductionCandidateStatus({
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' }],
    }, 'eds-maths-terminale');
    if (candidat !== 'scolarise') throw new Error('unreachable');

    const pseudonym = resolveProductionAriaRagPseudonym('student-prod-1', 'p'.repeat(32));

    // 2. The exact `retrieval_scope` shape a real, promoted servable-corpus
    //    manifest carries for this corpus (same shape as the committed E2E
    //    fixture at data/aria/testing/rag/*.json — verified against it).
    const retrievalScope = {
      target_policy: {
        tenant: 'nexus',
        niveau: vocabulary.niveau,
        voie: vocabulary.voie,
        matiere: vocabulary.matiere,
        statut_enseignement: vocabulary.statutEnseignement,
        candidates: ['scolarise'],
        audiences: ['aefe'],
        roles: ['student'],
      },
      evidence_subject: {
        tenant: 'nexus',
        niveau: vocabulary.niveau,
        voie: vocabulary.voie,
        matiere: vocabulary.matiere,
        statut_enseignement: vocabulary.statutEnseignement,
        candidat: 'scolarise',
        audiences: ['aefe'],
        collection: 'aria_maths_terminale',
        programme_version: 'fr-national-2026',
        school_year: '2026-2027',
        visibility: 'public',
        rights: ['officiel_public'],
      },
      scope_id: 'scope_prod_test_1',
    };

    const resourceId = '11111111-1111-4111-8111-111111111111';
    const resourceVersionId = '22222222-2222-4222-8222-222222222222';
    const contentSha256 = 'd'.repeat(64);

    const plan: AriaRetrievalPlan = Object.freeze({
      courseKey: 'eds-maths-terminale',
      pedagogicalMode: 'DISCOVERY',
      collection: 'aria_maths_terminale',
      corpusId: 'aria-maths-terminale',
      corpusVersionId: 'v1',
      manifestSha256: 'a'.repeat(64),
      resourceRegistrySha256: 'b'.repeat(64),
      academicYear: '2026-2027',
      curriculumVersion: 'v1',
      retrievalScope: retrievalScope,
      retrievalScopeSha256: 'c'.repeat(64),
      resourceBindings: [{
        resourceId,
        resourceVersionId,
        contentSha256,
        chunks: [{ chunkId: 'chunk-1', locator: { page: 1 } }],
      }],
    });

    // The identity this fork's production resolver would build, once the
    // (separately tracked) `audience` gap closes — same shape/contract as
    // the E2E-fixture identity, just sourced from real data.
    const identity: AriaResolvedRagStudentIdentity = Object.freeze({
      pseudonymousSubject: pseudonym,
      niveau: vocabulary.niveau,
      voie: vocabulary.voie,
      matiere: vocabulary.matiere,
      statutEnseignement: vocabulary.statutEnseignement,
      candidat,
      audience: 'aefe',
      schoolYear: plan.academicYear,
      zone: 'TN',
      statusDetail: 'unknown',
    });

    // A REAL, contract-valid /search/v2 response for this exact plan —
    // every field required by `data/aria/generated/rag-contracts/v1/retrieval-response.json`
    // is present (doc_id, citation.rights) and every UUID-formatted field
    // (resource_id, resource_version_id) is an actual UUID, so it only
    // passes because the real AJV `validateResponse` accepts it, not
    // because nothing checked.
    const contractValidResult = {
      chunk_id: 'chunk-1',
      doc_id: 'doc-1',
      resource_id: resourceId,
      resource_version_id: resourceVersionId,
      content_sha256: contentSha256,
      corpus_id: plan.corpusId,
      corpus_version_id: plan.corpusVersionId,
      manifest_sha256: plan.manifestSha256,
      locator: { page: 1 },
      citation: {
        source_label: 'Programme officiel',
        source_uri: 'https://example.test/prog.pdf',
        rights: 'officiel_public',
      },
      excerpt: 'Extrait pertinent.',
      score: 0.9,
    };

    return { plan, identity, contractValidResult };
  }

  it('builds a manifest-bound identity from real server truth only, and the REAL AJV-validated RAG client accepts it (SUCCESS)', async () => {
    const { plan, identity, contractValidResult } = buildScenario();

    const fetchImpl = jest.fn(async (_url: string, _init?: RequestInit) => hermeticResponse({
      results: [contractValidResult],
      filters_applied: {},
      warnings: [],
    }));

    const result = await executeAriaRetrieval(plan, 'Comment dériver une fonction ?', identity, {
      // The REAL searchAriaRagV2 — this is what actually runs
      // validateConfig/validateRequest/validateResponse (AJV) — with only
      // network I/O replaced by a hermetic fetchImpl. Nothing about the
      // contract-validation layer itself is mocked.
      search: (input) => searchAriaRagV2({ ...input, fetchImpl }),
      clientConfig: CLIENT_CONFIG,
      signerConfig: SIGNER_CONFIG,
    });

    expect(result.status).toBe('SUCCESS');
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // The request the client actually sent (i.e. what real AJV
    // validateRequest accepted) must carry the production-derived
    // vocabulary verbatim — not an E2E value, not a guess.
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://rag.internal.test/search/v2');
    const sentRequest = JSON.parse((init as RequestInit).body as string);
    expect(sentRequest.curriculum_scope).toEqual({
      niveau: identity.niveau,
      voie: identity.voie,
      matiere: identity.matiere,
      statut_enseignement: identity.statutEnseignement,
    });
    expect(sentRequest.student_profile.candidat).toBe('scolarise');
    expect(sentRequest.student_profile.school_year).toBe('2026-2027');

    // Zero E2E configuration was read anywhere in this scenario.
    for (const key of E2E_ENV_KEYS) expect(process.env[key]).toBeUndefined();
  });

  it('CODEX_P0_ARIA_01_CLOSURE: the REAL resolveProductionAriaRagIdentity() — not a hand-built stand-in — closes the full chain end to end', async () => {
    const { plan, contractValidResult } = buildScenario();
    // The plan built by buildScenario() already carries a mono-audience
    // corpus (audiences: ['aefe']) — exactly the manifest shape that lets
    // resolveProductionAriaRagAudience() resolve without guessing.

    const identity = resolveProductionAriaRagIdentity({
      context: {
        courseKey: 'eds-maths-terminale',
        subject: { studentId: 'student-prod-1' },
        student: {
          gradeLevel: 'TERMINALE',
          academicTrack: 'EDS_GENERALE',
          academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' }],
        },
      },
      plan,
      environment: { NEXUS_INTERNAL_TOKEN_SECRET: 'p'.repeat(32) },
    });
    expect(identity).not.toBeNull();
    expect(identity!.audience).toBe('aefe');

    const fetchImpl = jest.fn(async () => hermeticResponse({
      results: [contractValidResult],
      filters_applied: {},
      warnings: [],
    }));

    const result = await executeAriaRetrieval(plan, 'Comment dériver une fonction ?', identity, {
      search: (input) => searchAriaRagV2({ ...input, fetchImpl }),
      clientConfig: CLIENT_CONFIG,
      signerConfig: SIGNER_CONFIG,
    });

    expect(result.status).toBe('SUCCESS');
    for (const key of E2E_ENV_KEYS) expect(process.env[key]).toBeUndefined();
  });

  it('CODEX_CUBIC_P2_RED: a response that violates the real RAG contract (missing required doc_id/citation.rights, non-UUID resource_id) is rejected by real AJV validation, not silently accepted', async () => {
    const { plan, identity } = buildScenario();

    // This is exactly the shape the OLD version of this test fed its raw
    // jest.fn() `search` mock — and that mock happily "succeeded" with it,
    // because nothing ever validated it against the real contract.
    const contractInvalidResult = {
      chunk_id: 'chunk-1',
      // doc_id: MISSING — required by retrieval-response.json
      resource_id: 'res-1', // not a UUID — schema requires format: uuid
      resource_version_id: 'res-1-v1', // not a UUID
      content_sha256: 'd'.repeat(64),
      corpus_id: plan.corpusId,
      corpus_version_id: plan.corpusVersionId,
      manifest_sha256: plan.manifestSha256,
      locator: { page: 1 },
      citation: {
        source_label: 'Programme officiel',
        source_uri: 'https://example.test/prog.pdf',
        // rights: MISSING — required by the Citation schema
      },
      excerpt: 'Extrait pertinent.',
      score: 0.9,
    };

    const fetchImpl = jest.fn(async () => hermeticResponse({
      results: [contractInvalidResult],
      filters_applied: {},
      warnings: [],
    }));

    const result = await executeAriaRetrieval(plan, 'Comment dériver une fonction ?', identity, {
      search: (input) => searchAriaRagV2({ ...input, fetchImpl }),
      clientConfig: CLIENT_CONFIG,
      signerConfig: SIGNER_CONFIG,
    });

    expect(result.status).toBe('RUNTIME_UNAVAILABLE');
    expect(result.status === 'RUNTIME_UNAVAILABLE' && result.error).toBe('RAG_PROTOCOL_INVALID');
  });
});
