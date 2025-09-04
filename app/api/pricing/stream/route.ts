export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { sseAdd, sseRemove } from '@/lib/sse';

export async function GET() {
  const enc = new TextEncoder();
  let ctxRef: { id?: number; ping?: any } | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const id = sseAdd(controller);
      const ping = setInterval(() => controller.enqueue(enc.encode(`:\n\n`)), 15000);
      ctxRef = { id, ping };
      controller.enqueue(enc.encode(`event: ready\ndata: {"ok":true}\n\n`));
    },
    cancel() {
      try {
        if (ctxRef?.ping) clearInterval(ctxRef.ping);
        if (ctxRef?.id) sseRemove(ctxRef.id);
      } catch {}
    },
    pull() {},
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
