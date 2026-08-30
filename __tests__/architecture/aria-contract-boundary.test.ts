import { source } from './aria-boundary-helpers';

describe('H007 ARIA transport contracts', () => {
  it('requires courseKey and clientRequestId and rejects subject in the canonical chat request', () => {
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
});
