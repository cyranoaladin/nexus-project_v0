import { formatSSEMessage, parseAriaSSEStream, type AriaSSECallbacks } from '@/lib/aria/sse';

describe('ARIA SSE Protocol (ARIA_SSE_PROTOCOL=1)', () => {
  describe('formatSSEMessage', () => {
    it('formate correctement les événements SSE avec double saut de ligne', () => {
      const formatted = formatSSEMessage('delta', { text: 'bonjour' });
      expect(formatted).toBe('event: delta\ndata: {"text":"bonjour"}\n\n');
    });

    it('formate les métadonnées complexes', () => {
      const formatted = formatSSEMessage('start', {
        conversationId: 'c-1',
        messageId: 'm-1',
        model: 'gpt-4o',
      });
      expect(formatted).toContain('event: start\n');
      expect(formatted).toContain('"conversationId":"c-1"');
      expect(formatted.endsWith('\n\n')).toBe(true);
    });
  });

  describe('parseAriaSSEStream', () => {
    function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });
    }

    it('parse un flux complet avec tous les types d événements', async () => {
      const events: string[] = [];
      const deltas: string[] = [];
      let startPayload: { conversationId: string } | null = null;
      let donePayload: { status: string } | null = null;

      const callbacks: AriaSSECallbacks = {
        onStart: (p) => {
          events.push('start');
          startPayload = p;
        },
        onDelta: (p) => {
          events.push('delta');
          deltas.push(p.text);
        },
        onCitation: () => events.push('citation'),
        onMetadata: () => events.push('metadata'),
        onDone: (p) => {
          events.push('done');
          donePayload = p;
        },
      };

      const stream = createMockStream([
        'event: start\ndata: {"conversationId":"c-123","messageId":"m-456","model":"gpt-4o"}\n\n',
        'event: citation\ndata: {"citation":{"sourceTitle":"BO Maths","snippet":"Programme"}}\n\n',
        'event: delta\ndata: {"text":"Pour résoudre "}\n\n',
        'event: delta\ndata: {"text":"cette équation..."}\n\n',
        'event: metadata\ndata: {"tokens":42,"latencyMs":350}\n\n',
        'event: done\ndata: {"messageId":"m-456","status":"COMPLETED"}\n\n',
      ]);

      await parseAriaSSEStream(stream, callbacks);

      expect(events).toEqual(['start', 'citation', 'delta', 'delta', 'metadata', 'done']);
      expect(deltas.join('')).toBe('Pour résoudre cette équation...');
      expect(startPayload.conversationId).toBe('c-123');
      expect(donePayload.status).toBe('COMPLETED');
    });

    it('gère les chunks fragmentés / découpés au milieu d une ligne', async () => {
      const deltas: string[] = [];

      const callbacks: AriaSSECallbacks = {
        onDelta: (p) => deltas.push(p.text),
      };

      // Le message est découpé en 3 morceaux réseau arbitraires
      const stream = createMockStream([
        'event: del',
        'ta\ndata: {"text":"mo',
        'rceau complet"}\n\n',
      ]);

      await parseAriaSSEStream(stream, callbacks);

      expect(deltas).toEqual(['morceau complet']);
    });
  });
});
