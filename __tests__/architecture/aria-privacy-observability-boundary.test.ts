import { source } from './aria-boundary-helpers';

describe('ARIA privacy, telemetry and performance boundary', () => {
  it('H012 requires a server requestId in both JSON and SSE execution adapters', () => {
    const route = source('app/api/aria/chat/route.ts');
    expect(route.match(/requestId:\s*logger\.getRequestId\(\)/g)).toHaveLength(2);
  });

  it('keeps raw learning content outside the strict telemetry contract', () => {
    const telemetry = source('lib/aria/domain/observability/telemetry.ts');
    expect(telemetry).toMatch(/\.strict\(\)/);
    expect(telemetry).not.toMatch(/\b(?:message|prompt|email|userId|studentId|providerPayload)\s*:/);
  });

  it('keeps privacy and technical budgets in canonical domain modules', () => {
    expect(source('lib/aria/application/conversation/run-conversation.ts')).toMatch(/STUDENT_PRIVATE/);
    expect(source('lib/aria/domain/observability/performance-budgets.ts')).toMatch(
      /contextDbOperationsMax/,
    );
  });
});
