import { selectInitialAriaCourse } from '@/components/aria/useAriaConversation';
import { createAriaClientRequest, type AriaClientCourse } from '@/lib/aria/client';

const available = (courseKey: string): AriaClientCourse => ({
  courseKey,
  label: courseKey,
  capabilities: { hasChat: true },
  access: { status: 'AVAILABLE', commerciallyEntitled: true },
});
const unavailable = (courseKey: string, hasChat = true): AriaClientCourse => ({
  courseKey,
  label: courseKey,
  capabilities: { hasChat },
  access: { status: hasChat ? 'LOCKED' : 'AVAILABLE', commerciallyEntitled: hasChat ? false : true },
});

describe('useAriaConversation deterministic selection and idempotency', () => {
  it('uses an explicitly requested available course', () => {
    expect(selectInitialAriaCourse(
      [available('nsi'), available('maths')], 'maths', 'nsi',
    )).toBe('nsi');
  });

  it('uses focusedCourseKey when no requested context is available', () => {
    expect(selectInitialAriaCourse(
      [available('nsi'), available('maths')], 'maths', undefined,
    )).toBe('maths');
  });

  it('preserves an explicit available user selection across a curriculum refresh', () => {
    expect(selectInitialAriaCourse(
      [available('nsi'), available('maths')], 'nsi', undefined, 'maths',
    )).toBe('maths');
  });

  it('requires an explicit course when no requested, current or focused context exists', () => {
    expect(selectInitialAriaCourse(
      [unavailable('stmg', false), available('nsi')], 'missing', undefined,
    )).toBeNull();
  });

  it('returns null when every course is unavailable', () => {
    expect(selectInitialAriaCourse(
      [unavailable('stmg', false), unavailable('maths')], null, undefined,
    )).toBeNull();
  });

  it('creates a strict SSE request with one stable clientRequestId', () => {
    const request = createAriaClientRequest({
      courseKey: 'eds-nsi-terminale', content: 'Question', conversationId: null,
    }, () => 'd9428888-122b-4fd9-806c-02948637efeb');
    expect(request).toEqual({
      clientRequestId: 'd9428888-122b-4fd9-806c-02948637efeb',
      courseKey: 'eds-nsi-terminale',
      content: 'Question',
    });
    expect(Object.isFrozen(request)).toBe(true);
  });

  it('keeps the same immutable payload available for 202 replay retries', () => {
    const request = createAriaClientRequest({
      courseKey: 'eds-nsi-terminale', content: 'Question', conversationId: 'conv-1',
    }, () => 'd9428888-122b-4fd9-806c-02948637efeb');
    expect(request).toBe(request);
    expect(request.clientRequestId).toBe('d9428888-122b-4fd9-806c-02948637efeb');
  });
});
