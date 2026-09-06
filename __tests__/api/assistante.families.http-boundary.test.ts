import { NextRequest, NextResponse } from 'next/server';
import { createFamilyHandler } from '@/lib/families/create-family';
import { executeIdempotently } from '@/lib/bilans/api/idempotency';
import { checkCsrf } from '@/lib/csrf';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
jest.mock('@/lib/csrf', () => ({ checkCsrf: jest.fn(() => null) }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));
jest.mock('@/lib/bilans/api/idempotency', () => ({ ...jest.requireActual('@/lib/bilans/api/idempotency'), executeIdempotently: jest.fn(async () => ({ status: 201, body: { children: [] }, replayed: false })) }));
const body = { parentPhone: '+216 99 19 28 29', parentFirstName: 'Claire', parentLastName: 'Bernard', children: [{ firstName: 'Ines', grade: 'Terminale' }] };
const origin = 'http://localhost:3000';
function request(value: unknown = body, headers: Record<string,string> = {}) {
  return new NextRequest(origin+'/api/assistante/families', { method: 'POST', headers: { origin, 'content-type': 'application/json', 'idempotency-key': 'family-test-key', ...headers }, body: JSON.stringify(value) });
}
const dependencies = { prisma: {} as never, authenticate: async () => ({ user: { id: 'staff', role: 'ASSISTANTE' } } as never), now: () => new Date() };
const handler = createFamilyHandler(dependencies, { mode: 'WHATSAPP' });
beforeEach(() => { jest.clearAllMocks(); process.env.NEXTAUTH_URL = origin; (checkCsrf as jest.Mock).mockReturnValue(null); (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(null); });
test.each(['', 'https://attacker.test', origin+'/fake'])('rejects missing or forged Origin %s before reading body', async value => {
 const req=request(body,{ origin:value, host:'attacker.test' });
 expect((await handler(req)).status).toBe(403); expect(req.bodyUsed).toBe(false); expect(executeIdempotently).not.toHaveBeenCalled();
});
test('CSRF denial happens before parsing', async () => {
 (checkCsrf as jest.Mock).mockReturnValue(NextResponse.json({}, {status:403})); const req=request();
 expect((await handler(req)).status).toBe(403); expect(req.bodyUsed).toBe(false);
});
test('actor/source throttle happens before parsing', async () => {
 (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(NextResponse.json({}, {status:429})); const req=request();
 expect((await handler(req)).status).toBe(429); expect(req.bodyUsed).toBe(false);
 expect(guardSensitiveRateLimit).toHaveBeenCalledWith(req,{scope:'family-create',identity:'staff'});
});
test('rejects declared oversized body before consuming it', async () => {
 const req=request(body,{'content-length':'100000'}); expect((await handler(req)).status).toBe(413); expect(req.bodyUsed).toBe(false);
});
test('rejects chunked oversized body without trusting Content-Length', async () => {
 const req=request({ ...body, padding:'x'.repeat(70000) }); req.headers.delete('content-length');
 expect((await handler(req)).status).toBe(413); expect(executeIdempotently).not.toHaveBeenCalled();
});
test('normalizes aliases to same digest and route; paper remains separate', async () => {
 expect((await handler(request())).status).toBe(201);
 const first=(executeIdempotently as jest.Mock).mock.calls[0][0];
 const legacy=createFamilyHandler(dependencies,{mode:'WHATSAPP',legacy:true,route:'POST:/api/assistante/students'});
 expect((await legacy(request({parentFirstName:' Claire ',parentLastName:'Bernard',parentPhone:'99192829',studentFirstName:'Ines',studentLastName:'Bernard',studentGrade:'terminale'}))).status).toBe(201);
 const second=(executeIdempotently as jest.Mock).mock.calls[1][0];
 expect(first.route).toBe('POST:/api/assistante/families'); expect(second.route).toBe(first.route); expect(second.payloadHash).toBe(first.payloadHash); expect(first.payloadHash).toMatch(/^[a-f0-9]{64}$/);
 await createFamilyHandler(dependencies)(request()); expect((executeIdempotently as jest.Mock).mock.calls[2][0].route).toBe('POST:/api/bilans/saisie-papier/famille');
});
