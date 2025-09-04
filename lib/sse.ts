export type Client = { id: number; controller: ReadableStreamDefaultController<Uint8Array>; };
const clients = new Map<number, Client>();
let CID = 0;

export function sseAdd(controller: ReadableStreamDefaultController<Uint8Array>) {
  const id = ++CID;
  clients.set(id, { id, controller });
  return id;
}
export function sseRemove(id: number) { clients.delete(id); }
export function sseBroadcast(event: string, data: any) {
  const line = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  const enc = new TextEncoder();
  for (const c of clients.values()) {
    try { c.controller.enqueue(enc.encode(line)); } catch {}
  }
}
