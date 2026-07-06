import { Subject } from '@/lib/assessments/core/types';
import {
  ASSESSMENT_PUBLIC_TOKEN_TTL_SECONDS,
  createAssessmentPublicToken,
  verifyAssessmentPublicToken,
} from '@/lib/assessments/public-token';

describe('assessment public short-lived token', () => {
  const originalEnv = {
    ASSESSMENT_PUBLIC_TOKEN_SECRET: process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };

  beforeEach(() => {
    Object.assign(process.env, { NODE_ENV: 'test' });
    process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = 'test-assessment-secret';
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_SECRET;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key as keyof NodeJS.ProcessEnv];
      } else {
        process.env[key as keyof NodeJS.ProcessEnv] = value;
      }
    }
  });

  it('creates and verifies a short-lived scoped token', () => {
    const token = createAssessmentPublicToken({
      subject: Subject.MATHS,
      grade: 'TERMINALE',
      source: 'bilan-gratuit',
      campaignId: 'meta-july',
    });

    const result = verifyAssessmentPublicToken(token, {
      usage: 'assessment_submit',
      subject: Subject.MATHS,
      grade: 'TERMINALE',
    });

    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error(result.reason);
    expect(result.payload.usage).toBe('assessment_submit');
    expect(result.payload.expiresAt - result.payload.issuedAt).toBe(ASSESSMENT_PUBLIC_TOKEN_TTL_SECONDS);
  });

  it('rejects expired tokens', () => {
    const token = createAssessmentPublicToken(
      {
        subject: Subject.MATHS,
        grade: 'TERMINALE',
      },
      { now: 1_000, ttlSeconds: 1 },
    );

    const result = verifyAssessmentPublicToken(
      token,
      { usage: 'assessment_submit', subject: Subject.MATHS, grade: 'TERMINALE' },
      { now: 3_000 },
    );

    expect(result).toEqual({ valid: false, reason: 'expired' });
  });

  it('rejects bad signatures and scope mismatches without exposing token data', () => {
    const token = createAssessmentPublicToken({
      subject: Subject.MATHS,
      grade: 'TERMINALE',
    });

    expect(
      verifyAssessmentPublicToken(`${token.slice(0, -2)}xx`, {
        usage: 'assessment_submit',
        subject: Subject.MATHS,
        grade: 'TERMINALE',
      }),
    ).toEqual({ valid: false, reason: 'bad_signature' });

    expect(
      verifyAssessmentPublicToken(token, {
        usage: 'assessment_submit',
        subject: Subject.NSI,
        grade: 'TERMINALE',
      }),
    ).toEqual({ valid: false, reason: 'scope_mismatch' });
  });

  it('does not provide an insecure production fallback when no secret exists', () => {
    delete process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_SECRET;
    Object.assign(process.env, { NODE_ENV: 'production' });

    expect(() =>
      createAssessmentPublicToken({
        subject: Subject.MATHS,
        grade: 'TERMINALE',
      }),
    ).toThrow('ASSESSMENT_PUBLIC_TOKEN_SECRET_REQUIRED');
  });
});
