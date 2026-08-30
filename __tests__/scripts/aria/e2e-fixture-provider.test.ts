import {
  createAriaRagInternalIdentityToken,
  sha256AriaRagJson,
} from '@/lib/aria/infrastructure/rag/internal-identity';
import { createHmac } from 'node:crypto';
import manifest from '@/data/aria/testing/rag/debbfb31c0a95e3e16ff33772f0626856e8dc01c52faab8270820b7f4374608a.json';
import { startAriaE2EFixtureProvider } from '@/scripts/e2e/aria-fixture-provider';

function fixtureCredential(label: string): string {
  return `aria-e2e-${label}-`.padEnd(32, label.at(0) ?? 'x');
}

const fixtureSecrets = Object.fromEntries([
  ['ARIA_E2E_FIXTURE_ADMIN_TOKEN', fixtureCredential('admin')],
  ['ARIA_E2E_MODEL_API_KEY', fixtureCredential('model')],
  ['RAG_BFF_SERVICE_TOKEN', fixtureCredential('rag')],
  ['NEXUS_INTERNAL_TOKEN_SECRET', fixtureCredential('identity')],
]);

const environment = Object.freeze({
  E2E_DISPOSABLE_STACK: '1',
  ...fixtureSecrets,
  NEXUS_INTERNAL_TOKEN_ISSUER: 'nexus-cockpit',
  NEXUS_INTERNAL_TOKEN_AUDIENCE: 'nexus-rag-engine',
  NEXUS_SSO_ISSUER: 'nexus-cockpit',
  NEXUS_SSO_AUDIENCE: 'nexus-rag-engine',
});

async function waitForFixtureState(
  read: () => Promise<Record<string, unknown>>,
  expected: Readonly<Record<string, unknown>>,
): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const value = await read();
    if (Object.entries(expected).every(([key, expectedValue]) => value[key] === expectedValue)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  expect(await read()).toMatchObject(expected);
}

function fixtureRequest(corpusIndex = 1) {
  const corpus = manifest.corpora[corpusIndex]!;
  const target = corpus.retrieval_scope.target_policy;
  return {
    student_profile: {
      availability: {}, candidat: 'scolarise', candidate_status_ref: null,
      establishment: null, matieres: [target.matiere], needs: [], nexus_group_id: null,
      nexus_offer: null, niveau: target.niveau, objective: null, official_level_ref: null,
      options: [], risk_level: null, school_calendar_zone: null,
      school_year: '2026-2027', specialites: [], status_detail: 'aefe',
      statut_enseignement: target.statut_enseignement, student_id: null, target_pathway: null,
      teacher_confirmed: false, voie: target.voie, warnings: [], zone: 'aefe',
    },
    curriculum_scope: {
      niveau: target.niveau, voie: target.voie, matiere: target.matiere,
      statut_enseignement: target.statut_enseignement,
    },
    need: {
      desired_doc_types: [], difficulty_max: null, intent: 'context', notions: [],
      query: 'Explique une pile.',
    },
    retrieval: { hybrid: true, include_citations: true, k: 8, rerank: true },
    manifest_sha256: manifest.manifest_sha256,
    corpus_id: corpus.corpus_id,
    corpus_version_id: corpus.corpus_version_id,
  };
}

function identityToken(request: ReturnType<typeof fixtureRequest>, corpusIndex = 1): string {
  const corpus = manifest.corpora[corpusIndex]!;
  const target = corpus.retrieval_scope.target_policy;
  const now = Math.floor(Date.now() / 1_000);
  const subject = 'psn_fixture_student_1';
  return createAriaRagInternalIdentityToken({
    signingKey: environment.NEXUS_INTERNAL_TOKEN_SECRET,
    envelope: {
      protocol_version: '1',
      iss: environment.NEXUS_INTERNAL_TOKEN_ISSUER,
      aud: environment.NEXUS_INTERNAL_TOKEN_AUDIENCE,
      sub: subject,
      jti: 'e2e-fixture-request-1',
      iat: now,
      exp: now + 30,
      identity: {
        iss: environment.NEXUS_SSO_ISSUER,
        aud: environment.NEXUS_SSO_AUDIENCE,
        sub: subject,
        jti: 'e2e-fixture-request-1',
        exp: now + 30,
        tenant: 'nexus',
        niveau: target.niveau,
        role: 'student',
        school_year: '2026-2027',
        pedagogical_profile: {
          voie: target.voie, matieres: [target.matiere], statut_enseignement: target.statut_enseignement,
          candidat: 'scolarise', audience: 'aefe',
        },
      },
      scope_id: corpus.retrieval_scope.scope_id,
      scope_digest: sha256AriaRagJson(corpus.retrieval_scope),
      request_sha256: sha256AriaRagJson(request),
      manifest_sha256: manifest.manifest_sha256,
      allowed_collections: [corpus.physical_collection],
    },
  });
}

function mutateSignedIdentityToken(
  token: string,
  mutate: (envelope: Record<string, unknown>) => void,
): string {
  const [header, payload] = token.split('.');
  if (!header || !payload) throw new Error('ARIA_E2E_TEST_IDENTITY_INVALID');
  const envelope = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  mutate(envelope);
  const encoded = Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
  const signature = createHmac('sha256', environment.NEXUS_INTERNAL_TOKEN_SECRET)
    .update(`${header}.${encoded}`, 'ascii')
    .digest('base64url');
  return `${header}.${encoded}.${signature}`;
}

describe('ARIA disposable provider and RAG fixture service', () => {
  it('refuses to start outside the disposable stack', async () => {
    await expect(startAriaE2EFixtureProvider({
      environment: { ...environment, E2E_DISPOSABLE_STACK: '0' },
      port: 0,
    })).rejects.toThrow('ARIA_E2E_FIXTURE_FORBIDDEN');
  });

  it('serves the exact manifest and rejects unsigned retrieval', async () => {
    const server = await startAriaE2EFixtureProvider({ environment, port: 0 });
    try {
      const headers = { authorization: `Bearer ${environment.RAG_BFF_SERVICE_TOKEN}` };
      const manifestResponse = await fetch(
        `${server.baseUrl}/corpora/servable/v1/${manifest.manifest_sha256}`,
        { headers },
      );
      expect(manifestResponse.status).toBe(200);
      await expect(manifestResponse.json()).resolves.toEqual(manifest);

      const unsigned = await fetch(`${server.baseUrl}/search/v2`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(fixtureRequest()),
      });
      expect(unsigned.status).toBe(403);
    } finally {
      await server.close();
    }
  });

  it('validates the signed manifest-bound request and returns immutable hit identity', async () => {
    const server = await startAriaE2EFixtureProvider({ environment, port: 0 });
    try {
      const request = fixtureRequest();
      const response = await fetch(`${server.baseUrl}/search/v2`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${environment.RAG_BFF_SERVICE_TOKEN}`,
          'content-type': 'application/json',
          'x-nexus-identity': identityToken(request),
        },
        body: JSON.stringify(request),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        results: [{
          resource_id: manifest.corpora[1].resources[0].resource_id,
          resource_version_id: manifest.corpora[1].resources[0].resource_version_id,
          content_sha256: manifest.corpora[1].resources[0].content_sha256,
          chunk_id: manifest.corpora[1].resources[0].chunks[0].chunk_id,
          manifest_sha256: manifest.manifest_sha256,
        }],
      });
    } finally {
      await server.close();
    }
  });

  it('rejects every validly signed request with stale, divergent or mismatched identity context', async () => {
    const server = await startAriaE2EFixtureProvider({ environment, port: 0 });
    try {
      const original = fixtureRequest();
      const valid = identityToken(original);
      const cases = [
        {
          name: 'tampered request',
          request: { ...original, need: { ...original.need, query: 'requête modifiée après signature' } },
          token: valid,
        },
        {
          name: 'expired envelope',
          request: original,
          token: mutateSignedIdentityToken(valid, (envelope) => {
            envelope.exp = Math.floor(Date.now() / 1_000) - 1;
          }),
        },
        {
          name: 'wrong audience',
          request: original,
          token: mutateSignedIdentityToken(valid, (envelope) => { envelope.aud = 'another-service'; }),
        },
        {
          name: 'wrong retrieval scope',
          request: original,
          token: mutateSignedIdentityToken(valid, (envelope) => { envelope.scope_id = 'another-scope'; }),
        },
        {
          name: 'wrong manifest',
          request: original,
          token: mutateSignedIdentityToken(valid, (envelope) => { envelope.manifest_sha256 = 'f'.repeat(64); }),
        },
        {
          name: 'mismatched academic identity',
          request: original,
          token: mutateSignedIdentityToken(valid, (envelope) => {
            const identity = envelope.identity as Record<string, unknown>;
            identity.niveau = 'terminale';
            identity.pedagogical_profile = {
              voie: 'generale', matieres: ['mathematiques'], statut_enseignement: 'specialite',
              candidat: 'scolarise', audience: 'aefe',
            };
          }),
        },
      ];
      for (const candidate of cases) {
        const response = await fetch(`${server.baseUrl}/search/v2`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${environment.RAG_BFF_SERVICE_TOKEN}`,
            'content-type': 'application/json',
            'x-nexus-identity': candidate.token,
          },
          body: JSON.stringify(candidate.request),
        });
        if (response.status !== 403) {
          throw new Error(`ARIA_E2E_IDENTITY_CASE_ACCEPTED:${candidate.name}:${response.status}`);
        }
      }
    } finally {
      await server.close();
    }
  });

  it('returns course-specific grounding and model output instead of an NSI fallback for Maths', async () => {
    const server = await startAriaE2EFixtureProvider({ environment, port: 0 });
    try {
      const request = fixtureRequest(0);
      const retrieval = await fetch(`${server.baseUrl}/search/v2`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${environment.RAG_BFF_SERVICE_TOKEN}`,
          'content-type': 'application/json',
          'x-nexus-identity': identityToken(request, 0),
        },
        body: JSON.stringify(request),
      });
      expect(retrieval.status).toBe(200);
      await expect(retrieval.json()).resolves.toMatchObject({
        results: [{
          excerpt: expect.stringContaining('dérivée'),
          resource_id: manifest.corpora[0].resources[0].resource_id,
        }],
      });

      const model = await fetch(`${server.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${environment.ARIA_E2E_MODEL_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'aria-e2e', stream: true,
          messages: [{ role: 'system', content: 'Discipline : Mathématiques' }],
        }),
      });
      expect(await model.text()).toContain('Une dérivée positive');
    } finally {
      await server.close();
    }
  });

  it('streams OpenAI-compatible chunks and exposes counters only to the admin token', async () => {
    const server = await startAriaE2EFixtureProvider({ environment, port: 0 });
    try {
      const response = await fetch(`${server.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${environment.ARIA_E2E_MODEL_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'aria-e2e', stream: true,
          messages: [{ role: 'user', content: 'Explique une pile.' }],
        }),
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('data: [DONE]');
      const state = await fetch(`${server.baseUrl}/__e2e/state`, {
        headers: { authorization: `Bearer ${environment.ARIA_E2E_FIXTURE_ADMIN_TOKEN}` },
      });
      await expect(state.json()).resolves.toMatchObject({ modelInvocations: 1 });
    } finally {
      await server.close();
    }
  });

  it('tracks an active stream and records cancellation only when the response closes unfinished', async () => {
    const server = await startAriaE2EFixtureProvider({ environment, port: 0 });
    const controller = new AbortController();
    const adminHeaders = { authorization: `Bearer ${environment.ARIA_E2E_FIXTURE_ADMIN_TOKEN}` };
    try {
      const response = await fetch(`${server.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${environment.ARIA_E2E_MODEL_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'aria-e2e', stream: true,
          messages: [{ role: 'user', content: '[CANCEL] réponse partielle' }],
        }),
        signal: controller.signal,
      });
      await response.body?.getReader().read();

      const active = await fetch(`${server.baseUrl}/__e2e/state`, { headers: adminHeaders });
      await expect(active.json()).resolves.toMatchObject({
        activeModelStreams: 1,
        cancelledModelStreams: 0,
      });

      const resetWhileActive = await fetch(`${server.baseUrl}/__e2e/reset`, {
        method: 'POST', headers: adminHeaders,
      });
      expect(resetWhileActive.status).toBe(409);
      controller.abort();

      await waitForFixtureState(async () => {
        const state = await fetch(`${server.baseUrl}/__e2e/state`, { headers: adminHeaders });
        return state.json() as Promise<Record<string, unknown>>;
      }, { activeModelStreams: 0, cancelledModelStreams: 1 });
    } finally {
      controller.abort();
      await server.close();
    }
  });

  it('provides a controlled slow stream and hostile assistant output for browser recovery/security proofs', async () => {
    const server = await startAriaE2EFixtureProvider({ environment, port: 0 });
    try {
      const requestModel = async (content: string) => fetch(`${server.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${environment.ARIA_E2E_MODEL_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: 'aria-e2e', stream: true, messages: [{ role: 'user', content }] }),
      });

      const slow = await requestModel('[RETRY_AFTER_FIRST_DELTA] reconnexion');
      const reader = slow.body!.getReader();
      const first = await reader.read();
      expect(new TextDecoder().decode(first.value)).toContain('Une pile ');
      const secondRead = reader.read();
      const secondBeforeDelay = await Promise.race([
        secondRead.then(() => 'received'),
        new Promise<'waiting'>((resolve) => setTimeout(() => resolve('waiting'), 50)),
      ]);
      expect(secondBeforeDelay).toBe('waiting');
      expect((await secondRead).done).toBe(false);
      while (!(await reader.read()).done) {
        // Consume the bounded fixture stream before issuing the next request.
      }

      const hostile = await requestModel('[HOSTILE_ASSISTANT_OUTPUT] sécurité');
      const hostileWire = await hostile.text();
      expect(hostileWire).toContain('<script>window.__ariaXss=1</script>');
      expect(hostileWire).toContain('javascript:');
    } catch (error: unknown) {
      const diagnostic = await fetch(`${server.baseUrl}/__e2e/state`, {
        headers: { authorization: `Bearer ${environment.ARIA_E2E_FIXTURE_ADMIN_TOKEN}` },
      });
      throw new Error(`ARIA_E2E_FIXTURE_DIAGNOSTIC:${await diagnostic.text()}`, { cause: error });
    } finally {
      await server.close();
    }
  });
});
