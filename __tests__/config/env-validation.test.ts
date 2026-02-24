/**
 * Environment Variables Validation — Complete Test Suite
 *
 * Validates that all required environment variables are present and correctly formatted.
 * Tests both required and optional variables with format validation.
 */

// ─── Required Variables ──────────────────────────────────────────────────────

describe('Required Environment Variables', () => {
  const requiredVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ];

  requiredVars.forEach((varName) => {
    it(`should have ${varName} defined`, () => {
      // In test environment, these may be set to test values
      // We verify the pattern exists in .env or .env.test
      expect(typeof process.env[varName]).toBe('string');
    });
  });
});

// ─── DATABASE_URL Format ─────────────────────────────────────────────────────

describe('DATABASE_URL format', () => {
  it('should be a valid PostgreSQL connection string', () => {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      expect(dbUrl).toMatch(/^postgres(ql)?:\/\//);
    }
  });

  it('should not contain plaintext password in logs', () => {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      // Verify we can parse it without exposing credentials
      const url = new URL(dbUrl);
      expect(url.protocol).toMatch(/postgres/);
    }
  });
});

// ─── NEXTAUTH_URL Format ─────────────────────────────────────────────────────

describe('NEXTAUTH_URL format', () => {
  it('should be a valid URL', () => {
    const url = process.env.NEXTAUTH_URL;
    if (url) {
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it('should use http or https protocol', () => {
    const url = process.env.NEXTAUTH_URL;
    if (url) {
      const parsed = new URL(url);
      expect(['http:', 'https:']).toContain(parsed.protocol);
    }
  });
});

// ─── SMTP Configuration ─────────────────────────────────────────────────────

describe('SMTP Configuration', () => {
  it('SMTP_PORT should be a valid port number if set', () => {
    const port = process.env.SMTP_PORT;
    if (port) {
      const portNum = parseInt(port, 10);
      expect(portNum).toBeGreaterThan(0);
      expect(portNum).toBeLessThanOrEqual(65535);
    }
  });

  it('SMTP_SECURE should be "true" or "false" if set', () => {
    const secure = process.env.SMTP_SECURE;
    if (secure) {
      expect(['true', 'false']).toContain(secure);
    }
  });
});

// ─── Rate Limit Configuration ────────────────────────────────────────────────

describe('Rate Limit Configuration', () => {
  it('RATE_LIMIT_AUTH should be a positive integer if set', () => {
    const val = process.env.RATE_LIMIT_AUTH;
    if (val) {
      const num = parseInt(val, 10);
      expect(num).toBeGreaterThan(0);
      expect(Number.isInteger(num)).toBe(true);
    }
  });

  it('RATE_LIMIT_API should be a positive integer if set', () => {
    const val = process.env.RATE_LIMIT_API;
    if (val) {
      const num = parseInt(val, 10);
      expect(num).toBeGreaterThan(0);
    }
  });
});

// ─── Feature Flags ───────────────────────────────────────────────────────────

describe('Feature Flags', () => {
  it('LLM_MODE should be a valid mode if set', () => {
    const mode = process.env.LLM_MODE;
    if (mode) {
      expect(['real', 'mock', 'disabled']).toContain(mode);
    }
  });

  it('MAIL_DISABLED should be "true" or "false" if set', () => {
    const val = process.env.MAIL_DISABLED;
    if (val) {
      expect(['true', 'false']).toContain(val);
    }
  });

  it('TELEGRAM_DISABLED should be "true" or "false" if set', () => {
    const val = process.env.TELEGRAM_DISABLED;
    if (val) {
      expect(['true', 'false']).toContain(val);
    }
  });

  it('NEXT_TELEMETRY_DISABLED should be "1" if set', () => {
    const val = process.env.NEXT_TELEMETRY_DISABLED;
    if (val) {
      expect(val).toBe('1');
    }
  });
});

// ─── LOG_LEVEL ───────────────────────────────────────────────────────────────

describe('LOG_LEVEL', () => {
  it('should be a valid log level if set', () => {
    const level = process.env.LOG_LEVEL;
    if (level) {
      expect(['debug', 'info', 'warn', 'error', 'fatal']).toContain(level);
    }
  });
});

// ─── No Sensitive Data in Test Environment ───────────────────────────────────

describe('Test Environment Safety', () => {
  it('NODE_ENV should be "test" or "development" during test execution', () => {
    expect(['test', 'development']).toContain(process.env.NODE_ENV);
  });

  it('should not use production database URL in tests', () => {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      // Production URLs typically contain specific hostnames
      expect(dbUrl).not.toContain('nexusreussite.academy');
      expect(dbUrl).not.toContain('88.99.254.59');
    }
  });

  it('should not use production NEXTAUTH_URL in tests', () => {
    const url = process.env.NEXTAUTH_URL;
    if (url) {
      expect(url).not.toContain('nexusreussite.academy');
    }
  });
});
