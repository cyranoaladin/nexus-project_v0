jest.mock('@/lib/aria/infrastructure/rag/manifest', () => ({
  getAriaRagCorpusCapability: jest.fn(),
}));

import { getCourseCapabilities } from '@/lib/aria/curriculum';
import { getAriaRagCorpusCapability } from '@/lib/aria/infrastructure/rag/manifest';

const identityEnvironmentKeys = [
  'E2E_DISPOSABLE_STACK',
  'NEXUS_INTERNAL_TOKEN_SECRET',
  'NEXUS_INTERNAL_TOKEN_ISSUER',
  'NEXUS_INTERNAL_TOKEN_AUDIENCE',
  'NEXUS_SSO_ISSUER',
  'NEXUS_SSO_AUDIENCE',
  'RAG_API_BASE_URL',
  'RAG_BFF_SERVICE_TOKEN',
  'RAG_ENGINE_API_KEY',
  'ARIA_E2E_RAG_CANDIDAT',
  'ARIA_E2E_RAG_AUDIENCE',
  'ARIA_E2E_RAG_ZONE',
  'ARIA_E2E_RAG_STATUS_DETAIL',
] as const;

/** A complete, valid production RAG runtime configuration (signer + client). */
function setFullProductionRagRuntimeEnv() {
  process.env.NEXUS_INTERNAL_TOKEN_SECRET = 'k'.repeat(32);
  process.env.NEXUS_INTERNAL_TOKEN_ISSUER = 'nexus';
  process.env.NEXUS_INTERNAL_TOKEN_AUDIENCE = 'rag';
  process.env.NEXUS_SSO_ISSUER = 'nexus-sso';
  process.env.NEXUS_SSO_AUDIENCE = 'rag-sso';
  process.env.RAG_API_BASE_URL = 'https://rag.internal.example';
  process.env.RAG_BFF_SERVICE_TOKEN = 't'.repeat(32);
  process.env.RAG_ENGINE_API_KEY = 'k'.repeat(32);
}

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

  // P0-ARIA-01 Section 6 (behavioral closure): once the production identity
  // resolver's OWN full configuration is present (E2E off, a complete
  // signer + RAG client configuration), this course-level capability flag
  // must reflect that grounded chat is genuinely reachable in production —
  // not stay hardcoded to the E2E-only fixture check forever, or the
  // resolver built for P0-ARIA-01 could never actually be reflected by
  // `hasChat` no matter what closes.
  it('CODEX_P0_ARIA_01_CLOSURE_RED: enables grounded-chat readiness from the PRODUCTION resolver\'s COMPLETE runtime configuration — no E2E variable involved', () => {
    setFullProductionRagRuntimeEnv();

    expect(getCourseCapabilities('eds-maths-premiere').hasChat).toBe(true);
  });

  it('still disabled when the production secret is too short — a base-configuration check, not a blank check', () => {
    setFullProductionRagRuntimeEnv();
    process.env.NEXUS_INTERNAL_TOKEN_SECRET = 'x'.repeat(9); // < 32 bytes required

    expect(getCourseCapabilities('eds-maths-premiere').hasChat).toBe(false);
  });

  it('E2E_DISPOSABLE_STACK=1 still blocks the production path even with a valid full config (hermetic separation preserved)', () => {
    // No ARIA_E2E_RAG_* vars — the disposable resolver's own config is
    // incomplete, and the production path must not silently take over.
    setFullProductionRagRuntimeEnv();
    process.env.E2E_DISPOSABLE_STACK = '1';

    expect(getCourseCapabilities('eds-maths-premiere').hasChat).toBe(false);
  });

  // Cubic P2 (confidence 9): the base-configuration check alone
  // (E2E off + a valid signing secret) previously advertised `hasChat=true`
  // even when the OTHER required signer fields (issuer/audience/SSO) or the
  // RAG engine client's own configuration (base URL/service token) were
  // still missing — a request would then genuinely fail (RAG_NOT_CONFIGURED)
  // despite the UI advertising readiness. `hasChat` must reflect the FULL
  // configuration surface actually required by the retrieval chain.
  it.each([
    ['NEXUS_INTERNAL_TOKEN_ISSUER'],
    ['NEXUS_INTERNAL_TOKEN_AUDIENCE'],
    ['NEXUS_SSO_ISSUER'],
    ['NEXUS_SSO_AUDIENCE'],
    ['RAG_API_BASE_URL'],
    ['RAG_BFF_SERVICE_TOKEN'],
    ['RAG_ENGINE_API_KEY'],
  ])('CODEX_CUBIC_P2_HASCHAT_FULL_CONFIG_RED: stays disabled when only %s is missing from an otherwise-complete production runtime configuration', (missingKey) => {
    setFullProductionRagRuntimeEnv();
    delete process.env[missingKey as keyof NodeJS.ProcessEnv];

    expect(getCourseCapabilities('eds-maths-premiere').hasChat).toBe(false);
  });
});
