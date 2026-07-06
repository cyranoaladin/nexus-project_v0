import {
  ASSESSMENT_FLOW_COOKIE_NAME,
  buildAssessmentAliasEmail,
  createAssessmentFlowToken,
  createAssessmentPublicToken,
  hashAssessmentLeadEmail,
  verifyAssessmentFlowToken,
  verifyAssessmentPublicToken,
} from '@/lib/assessments/public-token';
import { Subject } from '@/lib/assessments/core/types';

describe('assessment public token binding', () => {
  const originalSecret = process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;

  beforeEach(() => {
    process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = 'test-assessment-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;
    } else {
      process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = originalSecret;
    }
  });

  it('uses a dedicated HttpOnly flow cookie name for lead-bound assessment access', () => {
    expect(ASSESSMENT_FLOW_COOKIE_NAME).toBe('nexus_assessment_flow');
  });

  it('creates and verifies a signed lead-bound flow token without raw email', () => {
    const leadEmailHash = hashAssessmentLeadEmail('Parent.Example@Email.TEST');
    const flowToken = createAssessmentFlowToken({
      subject: Subject.MATHS,
      grade: 'TERMINALE',
      source: 'bilan-gratuit',
      leadEmailHash,
    });

    expect(flowToken).not.toContain('Parent.Example');
    expect(flowToken).not.toContain('Email.TEST');

    const verification = verifyAssessmentFlowToken(flowToken, {
      source: 'bilan-gratuit',
    });

    expect(verification.valid).toBe(true);
    if (verification.valid) {
      expect(verification.payload.leadEmailHash).toBe(leadEmailHash);
      expect(verification.payload.subject).toBe(Subject.MATHS);
      expect(verification.payload.grade).toBe('TERMINALE');
    }
  });

  it('binds public submit tokens to the lead hash and pseudonymous assessment email', () => {
    const leadEmailHash = hashAssessmentLeadEmail('parent@example.test');
    const assessmentEmail = buildAssessmentAliasEmail(leadEmailHash);
    const token = createAssessmentPublicToken({
      subject: Subject.MATHS,
      grade: 'TERMINALE',
      source: 'bilan-gratuit',
      binding: 'lead',
      leadEmailHash,
    });

    const ok = verifyAssessmentPublicToken(token, {
      usage: 'assessment_submit',
      subject: Subject.MATHS,
      grade: 'TERMINALE',
      source: 'bilan-gratuit',
      binding: 'lead',
      leadEmailHash,
      studentEmail: assessmentEmail,
    });
    expect(ok.valid).toBe(true);

    const wrongEmail = verifyAssessmentPublicToken(token, {
      usage: 'assessment_submit',
      subject: Subject.MATHS,
      grade: 'TERMINALE',
      source: 'bilan-gratuit',
      binding: 'lead',
      leadEmailHash,
      studentEmail: 'attacker@example.test',
    });
    expect(wrongEmail).toEqual({ valid: false, reason: 'scope_mismatch' });

    const wrongLead = verifyAssessmentPublicToken(token, {
      usage: 'assessment_submit',
      subject: Subject.MATHS,
      grade: 'TERMINALE',
      source: 'bilan-gratuit',
      binding: 'lead',
      leadEmailHash: hashAssessmentLeadEmail('other@example.test'),
      studentEmail: assessmentEmail,
    });
    expect(wrongLead).toEqual({ valid: false, reason: 'scope_mismatch' });
  });
});
