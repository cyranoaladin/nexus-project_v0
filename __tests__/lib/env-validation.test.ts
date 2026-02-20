/**
 * Tests for lib/env-validation.ts
 *
 * Verifies:
 * - REQUIRED vars cause throw in production if missing
 * - RECOMMENDED vars produce warnings but no throw
 * - OPTIONAL vars are silent
 * - NEXTAUTH_SECRET length warning
 * - Dev mode: no throw even if REQUIRED missing
 */

describe('validateEnv', () => {
  const originalEnv = { ...process.env };

  /** Helper to set NODE_ENV without TS readonly complaint */
  function setNodeEnv(val: string) {
    (process.env as Record<string, string | undefined>).NODE_ENV = val;
  }

  beforeEach(() => {
    jest.resetModules();
    // Start with minimal valid env
    process.env = { ...originalEnv };
    setNodeEnv('test');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadValidateEnv() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@/lib/env-validation').validateEnv as () => {
      ok: boolean;
      missing: string[];
      warnings: string[];
    };
  }

  describe('in development/test mode', () => {
    it('does not throw even if REQUIRED vars are missing', () => {
      delete process.env.DATABASE_URL;
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.NEXTAUTH_URL;
      setNodeEnv('development');

      const validateEnv = loadValidateEnv();
      // DATABASE_URL is not prodOnly, so it will be in missing
      const result = validateEnv();
      expect(result.missing.length).toBeGreaterThanOrEqual(1);
      // But no throw
    });

    it('skips prodOnly vars in non-production', () => {
      setNodeEnv('test');
      process.env.DATABASE_URL = 'postgresql://test';
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.NEXTAUTH_URL;

      const validateEnv = loadValidateEnv();
      const result = validateEnv();
      // NEXTAUTH_SECRET and NEXTAUTH_URL are prodOnly, so not in missing
      expect(result.missing.some((m) => m.includes('NEXTAUTH_SECRET'))).toBe(false);
      expect(result.missing.some((m) => m.includes('NEXTAUTH_URL'))).toBe(false);
    });
  });

  describe('in production mode', () => {
    it('throws if DATABASE_URL is missing', () => {
      setNodeEnv('production');
      delete process.env.DATABASE_URL;
      process.env.NEXTAUTH_SECRET = 'a'.repeat(32);
      process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';

      const validateEnv = loadValidateEnv();
      expect(() => validateEnv()).toThrow('FATAL');
    });

    it('throws if NEXTAUTH_SECRET is missing', () => {
      setNodeEnv('production');
      process.env.DATABASE_URL = 'postgresql://prod';
      delete process.env.NEXTAUTH_SECRET;
      process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';

      const validateEnv = loadValidateEnv();
      expect(() => validateEnv()).toThrow('FATAL');
    });

    it('throws if NEXTAUTH_URL is missing', () => {
      setNodeEnv('production');
      process.env.DATABASE_URL = 'postgresql://prod';
      process.env.NEXTAUTH_SECRET = 'a'.repeat(32);
      delete process.env.NEXTAUTH_URL;

      const validateEnv = loadValidateEnv();
      expect(() => validateEnv()).toThrow('FATAL');
    });

    it('does NOT throw if all REQUIRED vars are present', () => {
      setNodeEnv('production');
      process.env.DATABASE_URL = 'postgresql://prod';
      process.env.NEXTAUTH_SECRET = 'a'.repeat(32);
      process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';

      const validateEnv = loadValidateEnv();
      const result = validateEnv();
      expect(result.ok).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('warns if NEXTAUTH_SECRET is too short', () => {
      setNodeEnv('production');
      process.env.DATABASE_URL = 'postgresql://prod';
      process.env.NEXTAUTH_SECRET = 'short16charsXXX!';
      process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';

      const validateEnv = loadValidateEnv();
      const result = validateEnv();
      expect(result.warnings.some((w) => w.includes('NEXTAUTH_SECRET'))).toBe(true);
    });
  });

  describe('RECOMMENDED vars', () => {
    it('produces warnings for missing RECOMMENDED vars', () => {
      setNodeEnv('production');
      process.env.DATABASE_URL = 'postgresql://prod';
      process.env.NEXTAUTH_SECRET = 'a'.repeat(32);
      process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';
      delete process.env.OLLAMA_URL;
      delete process.env.SMTP_HOST;

      const validateEnv = loadValidateEnv();
      const result = validateEnv();
      expect(result.ok).toBe(true); // No throw
      expect(result.warnings.some((w) => w.includes('OLLAMA_URL'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('SMTP_HOST'))).toBe(true);
    });
  });

  describe('OPTIONAL vars', () => {
    it('does not warn for missing OPTIONAL vars', () => {
      setNodeEnv('production');
      process.env.DATABASE_URL = 'postgresql://prod';
      process.env.NEXTAUTH_SECRET = 'a'.repeat(32);
      process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';
      process.env.OLLAMA_URL = 'http://ollama:11434';
      process.env.RAG_INGESTOR_URL = 'http://ingestor:8001';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_FROM = 'noreply@example.com';
      process.env.CLICTOPAY_API_KEY = 'key';
      process.env.TELEGRAM_BOT_TOKEN = 'token';
      delete process.env.LLM_MODE;
      delete process.env.SENTRY_DSN;

      const validateEnv = loadValidateEnv();
      const result = validateEnv();
      expect(result.warnings.some((w) => w.includes('LLM_MODE'))).toBe(false);
      expect(result.warnings.some((w) => w.includes('SENTRY_DSN'))).toBe(false);
    });
  });
});
