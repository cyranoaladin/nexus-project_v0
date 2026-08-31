jest.mock('@/lib/aria/infrastructure/rag/manifest', () => ({
  getAriaRagCorpusCapability: jest.fn(),
}));

import { getCourseCapabilities } from '@/lib/aria/curriculum';
import { getAriaRagCorpusCapability } from '@/lib/aria/infrastructure/rag/manifest';

const identityEnvironmentKeys = [
  'E2E_DISPOSABLE_STACK',
  'NEXUS_INTERNAL_TOKEN_SECRET',
  'ARIA_E2E_RAG_CANDIDAT',
  'ARIA_E2E_RAG_AUDIENCE',
  'ARIA_E2E_RAG_ZONE',
  'ARIA_E2E_RAG_STATUS_DETAIL',
] as const;

describe('ARIA grounded chat runtime readiness', () => {
  const originalEnvironment = Object.fromEntries(
    identityEnvironmentKeys.map((key) => [key, process.env[key]]),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of identityEnvironmentKeys) delete process.env[key];
    (getAriaRagCorpusCapability as jest.Mock).mockReturnValue({
      status: 'AVAILABLE',
      corpus: {},
    });
  });

  afterAll(() => {
    for (const key of identityEnvironmentKeys) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('CODEX_RAG_IDENTITY_NOT_ADVERTISED keeps grounded chat disabled without an identity resolver', () => {
    const capabilities = getCourseCapabilities('eds-maths-premiere');

    expect(capabilities.hasRagCorpus).toBe(true);
    expect(capabilities.chatPolicy).toBe('GROUNDED_REQUIRED');
    expect(capabilities.hasChat).toBe(false);
  });

  it('enables the disposable grounded-chat fixture only with its complete sealed identity configuration', () => {
    Object.assign(process.env, {
      E2E_DISPOSABLE_STACK: '1',
      NEXUS_INTERNAL_TOKEN_SECRET: 'k'.repeat(32),
      ARIA_E2E_RAG_CANDIDAT: 'scolarise',
      ARIA_E2E_RAG_AUDIENCE: 'aefe',
      ARIA_E2E_RAG_ZONE: 'aefe',
      ARIA_E2E_RAG_STATUS_DETAIL: 'aefe',
    });

    expect(getCourseCapabilities('eds-maths-premiere').hasChat).toBe(true);
  });
});
