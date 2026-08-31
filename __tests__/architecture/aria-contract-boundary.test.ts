import { source } from './aria-boundary-helpers';

describe('ARIA transport contracts', () => {
  it('H007 requires courseKey and clientRequestId and rejects subject in the canonical chat request', () => {
    const contracts = source('lib/aria/transport/contracts.ts');
    expect(contracts).toMatch(/clientRequestId:\s*z\.string\(\)\.uuid\(\)/);
    expect(contracts).toMatch(/courseKey:\s*z\.string\(\)\.min\(1\)/);
    expect(contracts).not.toMatch(/ariaChatRequestSchema[\s\S]{0,500}subject\s*:/);
    expect(contracts).toMatch(/ariaChatRequestSchema[\s\S]{0,700}\.strict\(\)/);
  });

  it('has one runtime-validating SSE parser implementation', () => {
    expect(source('lib/aria/transport/sse-parser.ts')).toMatch(/ariaSSEEventSchema\.safeParse/);
    expect(source('lib/aria/transport/sse.ts')).not.toMatch(/function parseWireEvent/);
  });

  it('does not export test-only Subject chat, feedback, or message lifecycle contracts', () => {
    const validations = source('lib/validations.ts');
    const contracts = source('lib/aria/contracts.ts');
    const catalog = source('lib/curriculum/catalog.ts');

    for (const obsolete of [
      'ariaMessageSchema',
      'ariaFeedbackSchema',
    ]) {
      expect(validations).not.toContain(`export const ${obsolete}`);
    }
    for (const obsolete of [
      'AriaLearningProfileDTO',
      'AriaMessageRole',
      'AriaMessageStatus',
      'AriaMessageCitationDTO',
      'AriaMessageDTO',
      'AriaConversationDTO',
      'AriaFeedbackDTO',
    ]) {
      expect(contracts).not.toMatch(new RegExp(`export (?:interface|type) ${obsolete}\\b`));
    }
    expect(contracts).not.toContain('readonly legacySubject:');
    expect(catalog).not.toContain('export function findCourseByLegacySubject');
  });
});
