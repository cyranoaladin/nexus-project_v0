/** @jest-environment node */
import { formatAriaSSEEvent, parseAriaSSEResponse } from '@/lib/aria/transport/sse-parser';
import type { AriaSSEEvent } from '@/lib/aria/transport/contracts';

function response(courseKey: string, citationCourseKey: string) {
  const events: AriaSSEEvent[] = [
    { event: 'start', data: {
      turnId: 'turn', conversationId: 'conversation', messageId: 'message',
      courseKey, status: 'RUNNING', disposition: 'EXECUTED',
    } },
    { event: 'citation', data: { citation: {
      id: 'citation', resourceId: 'resource', resourceVersionId: 'version',
      contentSha256: 'a'.repeat(64), chunkId: 'chunk', locator: { page: 1 },
      corpusId: 'corpus', corpusVersionId: 'corpus-version', manifestSha256: 'b'.repeat(64),
      sourceTitle: 'Synthetic source', sourceDocument: 'synthetic.pdf',
      courseKey: citationCourseKey, provenance: 'OFFICIEL_MEN', snippet: 'Synthetic excerpt',
    } } },
    { event: 'done', data: { turnId: 'turn', messageId: 'message', status: 'COMPLETED', fullText: 'Synthetic answer' } },
  ];
  return new Response(events.map(formatAriaSSEEvent).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
}

test.each([
  ['maths-terminale-eds', 'eds-maths-terminale'],
  ['maths-premiere-eds', 'eds-maths-premiere'],
])('accepts the canonical citation of cockpit course %s through EOF', async (courseKey, canonicalKey) => {
  const seen: string[] = [];
  await parseAriaSSEResponse(response(courseKey, canonicalKey), {
    onCitation: ({ citation }) => seen.push(citation.courseKey),
    onDone: () => seen.push('done'),
  });
  // Keep canonical provenance intact; only identity comparison crosses namespaces.
  expect(seen).toEqual([canonicalKey, 'done']);
});

test.each(['eds-nsi-terminale', 'eds-maths-premiere', 'maths-expertes-terminale', 'maths-terminale-unknown'])
  ('rejects a citation from %s before publishing a completed turn', async citationCourseKey => {
    const onCitation = jest.fn(), onDone = jest.fn();
    await expect(parseAriaSSEResponse(response('maths-terminale-eds', citationCourseKey), { onCitation, onDone }))
      .rejects.toMatchObject({ code: 'EVENT_IDENTITY_MISMATCH' });
    expect(onCitation).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
