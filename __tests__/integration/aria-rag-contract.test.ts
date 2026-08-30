/** @jest-environment node */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AriaError } from '@/lib/aria/errors';
import {
  createAriaTurnRetrievalAudit,
} from '@/lib/aria/application/conversation/retrieval-evidence';
import {
  decideAriaRetrievalOutcome,
  resolveAriaRetrievalPolicy,
} from '@/lib/aria/domain/retrieval/policy';
import {
  ARIA_INTEGRATION_HIT,
  ariaIntegrationContext,
  ariaIntegrationInput,
  makeAriaApplicationFixture,
} from '../helpers/aria-application-fixture';

const attempted = {
  manifestSha256: ARIA_INTEGRATION_HIT.manifestSha256,
  corpusId: ARIA_INTEGRATION_HIT.corpusId,
  corpusVersionId: ARIA_INTEGRATION_HIT.corpusVersionId,
};

describe('ARIA retrieval contract integration', () => {
  it('I006 executes SUCCESS grounding through checkpoint, prompt, model and citation finalization', async () => {
    const fixture = makeAriaApplicationFixture();
    await expect(fixture.run(ariaIntegrationInput())).resolves.toMatchObject({
      status: 'COMPLETED', ragStatus: 'SUCCESS', citations: [ARIA_INTEGRATION_HIT],
    });
    expect(fixture.repository.checkpointRetrieval).toHaveBeenCalledTimes(1);
    expect(fixture.repository.finalizeTurn).toHaveBeenCalledWith(expect.objectContaining({
      status: 'COMPLETED', citations: [ARIA_INTEGRATION_HIT],
    }));
  });

  it('I007 keeps NO_RESULTS distinct and persists it before required grounding fails', async () => {
    const fixture = makeAriaApplicationFixture({ dependencyOverrides: {
      retrieve: jest.fn(async () => ({ status: 'NO_RESULTS' as const, hits: [], attempted })),
    } });
    await expect(fixture.run(ariaIntegrationInput())).resolves.toMatchObject({
      status: 'ERROR', ragStatus: 'NO_RESULTS', failureCode: 'RAG_UNAVAILABLE',
    });
    expect(fixture.repository.checkpointRetrieval).toHaveBeenCalledWith(expect.objectContaining({
      ragStatus: 'NO_RESULTS',
    }));
  });

  it('I008 keeps NOT_CONFIGURED distinct and never invokes the model for required grounding', async () => {
    const fixture = makeAriaApplicationFixture({ dependencyOverrides: {
      retrieve: jest.fn(async () => ({ status: 'NOT_CONFIGURED' as const, hits: [] })),
    } });
    await expect(fixture.run(ariaIntegrationInput())).resolves.toMatchObject({
      status: 'ERROR', ragStatus: 'NOT_CONFIGURED', failureCode: 'RAG_UNAVAILABLE',
    });
    expect(fixture.dependencies.streamModel).not.toHaveBeenCalled();
  });

  it('I009 keeps RUNTIME_UNAVAILABLE distinct and never silently downgrades required grounding', async () => {
    const fixture = makeAriaApplicationFixture({ dependencyOverrides: {
      retrieve: jest.fn(async () => ({
        status: 'RUNTIME_UNAVAILABLE' as const, hits: [], attempted, failureReason: 'UPSTREAM_DOWN',
      })),
    } });
    await expect(fixture.run(ariaIntegrationInput())).resolves.toMatchObject({
      status: 'ERROR', ragStatus: 'RUNTIME_UNAVAILABLE', failureCode: 'RAG_UNAVAILABLE',
    });
    expect(fixture.dependencies.streamModel).not.toHaveBeenCalled();
  });

  it('I010 maps a retrieval timeout failure to an auditable terminal RAG error', async () => {
    const fixture = makeAriaApplicationFixture({ dependencyOverrides: {
      retrieve: jest.fn(async () => {
        throw new AriaError('RAG_UNAVAILABLE', 503, 'internal timeout', { reasonCode: 'RAG_TIMEOUT' });
      }),
    } });
    await expect(fixture.run(ariaIntegrationInput())).resolves.toMatchObject({
      status: 'ERROR', failureCode: 'RAG_UNAVAILABLE',
    });
    expect(fixture.repository.finalizeTurn).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ERROR', retrievalEvidence: { schemaVersion: 1, hits: [] },
    }));
  });

  it('I011 rejects a manifest or corpus version mismatch before evidence persistence', () => {
    expect(() => createAriaTurnRetrievalAudit({
      status: 'SUCCESS',
      attempted,
      hits: [{ ...ARIA_INTEGRATION_HIT, corpusVersionId: 'wrong-corpus-version' }],
    })).toThrow(expect.objectContaining({ code: 'RAG_UNAVAILABLE' }));
  });

  it('I012 rejects SUCCESS when the requested canonical ResourceVersion is missing', () => {
    const policy = resolveAriaRetrievalPolicy({
      task: 'DISCOVERY', courseKey: 'eds-maths-premiere', agentRole: 'TUTOR',
      visibility: 'STUDENT_PRIVATE',
      requestedResource: { resourceId: 'requested', resourceVersionId: 'requested-v1' },
      capabilities: { hasChat: true, hasRagCorpus: true },
    });
    expect(() => decideAriaRetrievalOutcome(policy, {
      status: 'SUCCESS', hits: [{ resourceId: 'other', resourceVersionId: 'other-v1' }],
    })).toThrow(expect.objectContaining({ code: 'RAG_UNAVAILABLE' }));
  });

  it('I013 allows observable OPTIONAL_GROUNDING downgrade only for the methodology policy', async () => {
    const fixture = makeAriaApplicationFixture({ dependencyOverrides: {
      retrieve: jest.fn(async () => ({ status: 'RUNTIME_UNAVAILABLE' as const, hits: [], attempted })),
    } });
    await expect(fixture.run(ariaIntegrationInput({
      pedagogicalMode: 'METHODOLOGY',
    }))).resolves.toMatchObject({ status: 'COMPLETED', ragStatus: 'RUNTIME_UNAVAILABLE' });
    expect(fixture.dependencies.streamModel).toHaveBeenCalledTimes(1);
  });

  it('I014 fails GROUNDED_REQUIRED on NO_RESULTS with no model invocation', async () => {
    const fixture = makeAriaApplicationFixture({ dependencyOverrides: {
      retrieve: jest.fn(async () => ({ status: 'NO_RESULTS' as const, hits: [], attempted })),
    } });
    await fixture.run(ariaIntegrationInput({ context: ariaIntegrationContext() }));
    expect(fixture.dependencies.streamModel).not.toHaveBeenCalled();
    expect(fixture.repository.finalizeTurn).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ERROR', ragStatus: 'NO_RESULTS',
    }));
  });

  it('I024 verifies every imported cross-repository contract byte against its producer lock', () => {
    const root = resolve(process.cwd(), 'data/aria/generated/rag-contracts/v1');
    const lock = JSON.parse(readFileSync(resolve(process.cwd(), 'data/aria/rag/contracts.lock.json'), 'utf8')) as {
      producerCommit: string;
      schemas: Record<string, { sha256: string }>;
      fixtures: Record<string, { sha256: string }>;
    };
    expect(lock.producerCommit).toMatch(/^[0-9a-f]{40}$/);
    for (const [filename, identity] of Object.entries(lock.schemas)) {
      expect(createHash('sha256').update(readFileSync(resolve(root, filename))).digest('hex'))
        .toBe(identity.sha256);
    }
    for (const [filename, identity] of Object.entries(lock.fixtures)) {
      expect(createHash('sha256').update(readFileSync(resolve(root, 'fixtures', filename))).digest('hex'))
        .toBe(identity.sha256);
    }
  });
});
