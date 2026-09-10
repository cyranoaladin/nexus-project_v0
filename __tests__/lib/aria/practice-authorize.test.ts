import { AriaError } from '@/lib/aria/kernel/errors';
import {
  decidePracticeCourseAuthorization,
  decidePracticeCorrectionAuthorization,
} from '@/lib/aria/application/practice/authorize';
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

const FULL_CAPABILITIES: AriaCapabilities = {
  chat: true,
  resources: true,
  practice: true,
  practiceCorrection: true,
  parentReporting: true,
  collectiveWorkshop: true,
  liveSupport: true,
  coachInteraction: true,
  personalizedCorrection: true,
};

describe('decidePracticeCourseAuthorization', () => {
  it('passes silently when academically relevant, commercially entitled, and the tier includes practice', () => {
    expect(() => decidePracticeCourseAuthorization(access(), FULL_CAPABILITIES)).not.toThrow();
  });

  it('rejects when the student is not academically relevant to the course', () => {
    try {
      decidePracticeCourseAuthorization(access({ academicallyRelevant: false }), FULL_CAPABILITIES);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AriaError);
      expect((error as AriaError).code).toBe('NOT_ENROLLED');
    }
  });

  it('rejects when not commercially entitled, before even consulting capabilities', () => {
    try {
      decidePracticeCourseAuthorization(access({ commerciallyEntitled: false }), {
        ...FULL_CAPABILITIES,
        practice: false, // proves commerciallyEntitled is checked first, independent of this
      });
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AriaError);
      expect((error as AriaError).code).toBe('NOT_ENTITLED');
    }
  });

  // Real, forward-looking defense: with today's tier matrix every tier that
  // grants commercial entitlement also grants `practice` (see authorize.ts's
  // own docstring), so this exact combination cannot occur via real seeded
  // data — exercised directly here instead, same principle as
  // lib/aria/cockpit/skill-views.ts's injectable-seam tests.
  it('rejects when commercially entitled but the tier does not include practice', () => {
    try {
      decidePracticeCourseAuthorization(access(), { ...FULL_CAPABILITIES, practice: false });
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AriaError);
      expect((error as AriaError).code).toBe('NOT_ENTITLED');
      expect((error as AriaError).internalDetails).toEqual({ reasonCode: 'ARIA_TIER_PRACTICE_NOT_INCLUDED' });
    }
  });
});

describe('decidePracticeCorrectionAuthorization', () => {
  it('passes silently when academically relevant, commercially entitled, and the tier includes practiceCorrection', () => {
    expect(() => decidePracticeCorrectionAuthorization(access(), FULL_CAPABILITIES)).not.toThrow();
  });

  it('rejects when the student is not academically relevant to the course', () => {
    try {
      decidePracticeCorrectionAuthorization(access({ academicallyRelevant: false }), FULL_CAPABILITIES);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AriaError);
      expect((error as AriaError).code).toBe('NOT_ENROLLED');
    }
  });

  it('rejects when not commercially entitled, before even consulting capabilities', () => {
    try {
      decidePracticeCorrectionAuthorization(access({ commerciallyEntitled: false }), {
        ...FULL_CAPABILITIES,
        practiceCorrection: false, // proves commerciallyEntitled is checked first, independent of this
      });
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AriaError);
      expect((error as AriaError).code).toBe('NOT_ENTITLED');
    }
  });

  // Same reasoning as decidePracticeCourseAuthorization's own `practice`
  // test above: with today's real tier matrix, `practiceCorrection` is
  // granted at the same base tier as `practice`, so this exact combination
  // cannot occur via real seeded data — exercised directly here instead.
  it('rejects when commercially entitled but the tier does not include practiceCorrection', () => {
    try {
      decidePracticeCorrectionAuthorization(access(), { ...FULL_CAPABILITIES, practiceCorrection: false });
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AriaError);
      expect((error as AriaError).code).toBe('NOT_ENTITLED');
      expect((error as AriaError).internalDetails).toEqual({
        reasonCode: 'ARIA_TIER_PRACTICE_CORRECTION_NOT_INCLUDED',
      });
    }
  });
});
