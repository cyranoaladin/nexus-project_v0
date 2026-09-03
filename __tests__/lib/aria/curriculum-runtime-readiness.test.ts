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

  // P0-ARIA-01 Section 6 (behavioral closure): once the production identity
  // resolver's OWN base configuration is present (E2E off, a real signing
  // secret), this course-level capability flag must reflect that grounded
  // chat is genuinely reachable in production — not stay hardcoded to the
  // E2E-only fixture check forever, or the resolver built for P0-ARIA-01
  // could never actually be reflected by `hasChat` no matter what closes.
  it('CODEX_P0_ARIA_01_CLOSURE_RED: enables grounded-chat readiness from the PRODUCTION resolver\'s base configuration alone — no E2E variable involved', () => {
    process.env.NEXUS_INTERNAL_TOKEN_SECRET = 'k'.repeat(32);

    expect(getCourseCapabilities('eds-maths-premiere').hasChat).toBe(true);
  });

  it('still disabled when the production secret is too short — a base-configuration check, not a blank check', () => {
    process.env.NEXUS_INTERNAL_TOKEN_SECRET = 'x'.repeat(9); // < 32 bytes required

    expect(getCourseCapabilities('eds-maths-premiere').hasChat).toBe(false);
  });

  it('E2E_DISPOSABLE_STACK=1 still blocks the production path even with a valid secret (hermetic separation preserved)', () => {
    // No ARIA_E2E_RAG_* vars — the disposable resolver's own config is
    // incomplete, and the production path must not silently take over.
    process.env.E2E_DISPOSABLE_STACK = '1';
    process.env.NEXUS_INTERNAL_TOKEN_SECRET = 'k'.repeat(32);

    expect(getCourseCapabilities('eds-maths-premiere').hasChat).toBe(false);
  });
});
