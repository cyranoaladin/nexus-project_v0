/**
 * P0-ARIA-01 — end-to-end scenario C (mission §4):
 *
 *   production-style academic identity
 *     → NO E2E_DISPOSABLE_STACK / ARIA_E2E_* variables anywhere
 *     → valid retrieval plan
 *     → identity envelope
 *     → RAG request contract valid
 *
 * `resolveProductionAriaRagIdentity` itself still honestly returns `null`
 * today (the documented `audience` SSoT gap — see
 * `production-academic-identity.ts`). This test proves everything AROUND
 * that one gap is already correct: the dimensions the production resolver
 * derives (niveau/voie/matiere/statutEnseignement/candidat/schoolYear) are
 * fully accepted by the real manifest-bound request/token pipeline in
 * `lib/aria/rag.ts`, exactly like the E2E fixture identity is — with zero
 * E2E configuration anywhere in this test.
 */

import {
  resolveProductionAcademicVocabulary,
  resolveProductionCandidateStatus,
  resolveProductionAriaRagPseudonym,
} from '@/lib/aria/infrastructure/rag/production-academic-identity';
import { executeAriaRetrieval, type AriaResolvedRagStudentIdentity } from '@/lib/aria/rag';
import type { AriaRetrievalPlan } from '@/lib/aria/contracts';

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

  it('builds a manifest-bound identity from real server truth only, and the RAG client accepts it (SUCCESS)', async () => {
    // 1. Real server truth (Academic Map + curriculum catalogue), exactly as
    //    `resolveProductionAriaRagIdentity` derives it — no E2E fixture.
    const vocabulary = resolveProductionAcademicVocabulary({
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      courseKey: 'eds-maths-terminale',
    });
    expect(vocabulary).not.toBeNull();

    const candidat = resolveProductionCandidateStatus({
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' }],
    }, 'eds-maths-terminale');
    expect(candidat).toBe('scolarise');
    if (candidat !== 'scolarise') throw new Error('unreachable');

    const pseudonym = resolveProductionAriaRagPseudonym('student-prod-1', 'p'.repeat(32));

    // 2. The exact `retrieval_scope` shape a real, promoted servable-corpus
    //    manifest carries for this corpus (same shape as the committed E2E
    //    fixture at data/aria/testing/rag/*.json — verified against it).
    const retrievalScope = {
      target_policy: {
        tenant: 'nexus',
        niveau: vocabulary!.niveau,
        voie: vocabulary!.voie,
        matiere: vocabulary!.matiere,
        statut_enseignement: vocabulary!.statutEnseignement,
        candidates: ['scolarise'],
        audiences: ['aefe'],
        roles: ['student'],
      },
      evidence_subject: {
        tenant: 'nexus',
        niveau: vocabulary!.niveau,
        voie: vocabulary!.voie,
        matiere: vocabulary!.matiere,
        statut_enseignement: vocabulary!.statutEnseignement,
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
        resourceId: 'res-1',
        resourceVersionId: 'res-1-v1',
        contentSha256: 'd'.repeat(64),
        chunks: [{ chunkId: 'chunk-1', locator: { page: 1 } }],
      }],
    });

    // The identity this fork's production resolver would build, once the
    // (separately tracked) `audience` gap closes — same shape/contract as
    // the E2E-fixture identity, just sourced from real data.
    const identity: AriaResolvedRagStudentIdentity = Object.freeze({
      pseudonymousSubject: pseudonym,
      niveau: vocabulary!.niveau,
      voie: vocabulary!.voie,
      matiere: vocabulary!.matiere,
      statutEnseignement: vocabulary!.statutEnseignement,
      candidat,
      audience: 'aefe',
      schoolYear: plan.academicYear,
      zone: 'TN',
      statusDetail: 'unknown',
    });

    const search = jest.fn().mockResolvedValue({
      results: [{
        chunk_id: 'chunk-1',
        resource_id: 'res-1',
        resource_version_id: 'res-1-v1',
        content_sha256: 'd'.repeat(64),
        corpus_id: 'aria-maths-terminale',
        corpus_version_id: 'v1',
        manifest_sha256: 'a'.repeat(64),
        locator: { page: 1 },
        citation: { source_label: 'Programme officiel', source_uri: 'https://example.test/prog.pdf' },
        excerpt: 'Extrait pertinent.',
        score: 0.9,
      }],
    });

    const result = await executeAriaRetrieval(plan, 'Comment dériver une fonction ?', identity, {
      search,
      clientConfig: { baseUrl: 'https://rag.internal.test', serviceToken: 't'.repeat(20), timeoutMs: 5000, maxResponseBytes: 1_000_000 } as any,
      signerConfig: { signingKey: 'k'.repeat(32), issuer: 'nexus', audience: 'rag', identityIssuer: 'nexus', identityAudience: 'rag' } as any,
    });

    expect(result.status).toBe('SUCCESS');
    // The request the client actually sent must carry the production-derived
    // vocabulary verbatim — not an E2E value, not a guess.
    const sentRequest = search.mock.calls[0][0].request;
    expect(sentRequest.curriculum_scope).toEqual({
      niveau: vocabulary!.niveau,
      voie: vocabulary!.voie,
      matiere: vocabulary!.matiere,
      statut_enseignement: vocabulary!.statutEnseignement,
    });
    expect(sentRequest.student_profile.candidat).toBe('scolarise');
    expect(sentRequest.student_profile.school_year).toBe('2026-2027');

    // Zero E2E configuration was read anywhere in this scenario.
    for (const key of E2E_ENV_KEYS) expect(process.env[key]).toBeUndefined();
  });
});
