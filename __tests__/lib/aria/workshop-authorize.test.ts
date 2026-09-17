import { AriaError } from '@/lib/aria/kernel/errors';
import { decideWorkshopEligibility } from '@/lib/aria/application/workshop/authorize';
import type { AriaCourseAccess } from '@/lib/aria/access';
import type { AriaCapabilities } from '@/lib/aria/kernel/entitlements';

function access(overrides: Partial<AriaCourseAccess> = {}): AriaCourseAccess {
  return {
    courseKey: 'eds-maths-premiere',
    academicallyRelevant: true,
    productSupported: true,
    commerciallyEntitled: true,
    pinnedForAria: false,
    status: 'AVAILABLE',
    ...overrides,
  };
}

const SUIVI_CAPABILITIES: AriaCapabilities = {
  chat: true,
  resources: true,
  practice: true,
  practiceCorrection: true,
  parentReporting: true,
  collectiveWorkshop: true,
  liveSupport: false,
  coachInteraction: false,
  personalizedCorrection: false,
};

const AUTONOMIE_CAPABILITIES: AriaCapabilities = {
  ...SUIVI_CAPABILITIES,
  parentReporting: false,
  collectiveWorkshop: false,
};

describe('decideWorkshopEligibility', () => {
  it('passes silently for a real SUIVI-tier student, academically relevant and entitled', () => {
    expect(() => decideWorkshopEligibility(access(), SUIVI_CAPABILITIES)).not.toThrow();
  });

  it('rejects when the student is not academically relevant to the course', () => {
    try {
      decideWorkshopEligibility(access({ academicallyRelevant: false }), SUIVI_CAPABILITIES);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AriaError);
      expect((error as AriaError).code).toBe('NOT_ENROLLED');
    }
  });

  it('rejects when the student is not commercially entitled', () => {
    try {
      decideWorkshopEligibility(access({ commerciallyEntitled: false }), SUIVI_CAPABILITIES);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AriaError);
      expect((error as AriaError).code).toBe('NOT_ENTITLED');
    }
  });

  it('rejects an AUTONOMIE-tier student even when academically relevant and entitled — collectiveWorkshop is a SUIVI+ capability', () => {
    try {
      decideWorkshopEligibility(access(), AUTONOMIE_CAPABILITIES);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AriaError);
      expect((error as AriaError).code).toBe('NOT_ENTITLED');
      expect((error as AriaError).internalDetails).toMatchObject({ reasonCode: 'ARIA_TIER_COLLECTIVE_WORKSHOP_NOT_INCLUDED' });
    }
  });
});
