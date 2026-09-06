jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/csrf', () => ({ checkCsrf: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn() }));
jest.mock('@/lib/auth/parent-phone', () => ({ ...jest.requireActual('@/lib/auth/parent-phone'), issueParentPhoneChallenge: jest.fn() }));
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { checkCsrf } from '@/lib/csrf';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { issueParentPhoneChallenge, ParentPhoneError } from '@/lib/auth/parent-phone';
import { POST } from '@/app/api/assistante/parents/[parentId]/whatsapp-invitation/route';
import { NextRequest, NextResponse } from 'next/server';
const saved = { ...process.env };
const context = { params: Promise.resolve({ parentId: 'parent-user-id' }) };
const request = () => new NextRequest('https://attacker.example/api/manual', { method: 'POST', headers: { origin: 'https://nexusreussite.academy' } });
const tx = { user: { findUnique: jest.fn() } };
const rawToken = 'ppact_' + 'x'.repeat(43);
beforeEach(() => {
 jest.clearAllMocks(); delete process.env.WHATSAPP_SEND_ENABLED; delete process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY;
 process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';
 (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-id', role: 'ASSISTANTE' } });
 (checkCsrf as jest.Mock).mockReturnValue(null); (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(null);
 tx.user.findUnique.mockResolvedValue({ activatedAt: null });
 (prisma.$transaction as jest.Mock).mockImplementation(fn => fn(tx));
 (issueParentPhoneChallenge as jest.Mock).mockResolvedValue({ rawToken, phoneNormalized: '99123456', purpose: 'ACTIVATION', expiresAt: new Date('2099-01-01') });
});
afterAll(() => { process.env = saved; });
it.each([null, 'PARENT', 'COACH', 'ELEVE'])('refuses nonstaff %s before DB access', async role => {
 (auth as jest.Mock).mockResolvedValue(role ? { user: { id: 'x', role } } : null);
 expect((await POST(request(), context)).status).toBe(404); expect(prisma.$transaction).not.toHaveBeenCalled();
});
it.each(['ADMIN', 'ASSISTANTE'])('allows %s manual link without crypto configuration using canonical DB phone and trusted origin', async role => {
 (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-id', role } });
 const response = await POST(request(), context); const body = await response.json();
 expect(response.status).toBe(200); const url = new URL(body.whatsappUrl);
 expect(url.hostname).toBe('wa.me'); expect(url.pathname).toBe('/21699123456');
 expect(url.searchParams.get('text')).toContain('https://nexusreussite.academy/auth/parent-phone?token='+rawToken);
 expect(JSON.stringify(body)).not.toContain('attacker'); expect(Object.keys(body).sort()).toEqual(['expiresAt','purpose','whatsappUrl']);
 expect(response.headers.get('cache-control')).toContain('no-store'); expect(response.headers.get('referrer-policy')).toBe('no-referrer');
 expect(issueParentPhoneChallenge).toHaveBeenCalledWith(tx, { userId: 'parent-user-id', purpose: 'ACTIVATION' });
});
it('selects RECOVERY server-side for activated parents', async () => {
 tx.user.findUnique.mockResolvedValue({ activatedAt: new Date() });
 await POST(request(),context); expect(issueParentPhoneChallenge).toHaveBeenCalledWith(tx,{userId:'parent-user-id',purpose:'RECOVERY'});
});
it('refuses automatic mode, CSRF and throttling before mutation', async () => {
 process.env.WHATSAPP_SEND_ENABLED='true'; expect((await POST(request(),context)).status).toBe(409);
 delete process.env.WHATSAPP_SEND_ENABLED;
 (checkCsrf as jest.Mock).mockReturnValue(NextResponse.json({}, {status:403})); expect((await POST(request(),context)).status).toBe(403);
 (checkCsrf as jest.Mock).mockReturnValue(null); (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(NextResponse.json({}, {status:429})); expect((await POST(request(),context)).status).toBe(429);
 expect(prisma.$transaction).not.toHaveBeenCalled();
});
it('reports identity conflict without exposing details', async () => {
 (issueParentPhoneChallenge as jest.Mock).mockRejectedValue(new ParentPhoneError('PHONE_IDENTITY_CHANGED'));
 const response=await POST(request(),context);expect(response.status).toBe(409);expect(JSON.stringify(await response.json())).not.toContain(rawToken);
});

it('refuses an untrusted origin even when Host headers and generic CSRF claim it is allowed',async()=>{
 const forged=new NextRequest('https://attacker.example/api/manual',{method:'POST',headers:{origin:'https://attacker.example',host:'attacker.example','x-forwarded-host':'attacker.example'}});
 expect((await POST(forged,context)).status).toBe(403);expect(prisma.$transaction).not.toHaveBeenCalled();
});
it('refuses missing Origin even with a trusted Referer',async()=>{
 const missing=new NextRequest('https://nexusreussite.academy/api/manual',{method:'POST',headers:{referer:'https://nexusreussite.academy/dashboard'}});
 expect((await POST(missing,context)).status).toBe(403);expect(prisma.$transaction).not.toHaveBeenCalled();
});

it.each([{mergedIntoUserId:'merged-target',phoneNormalized:'99123456'},{mergedIntoUserId:null,phoneNormalized:null}])('canonical issuance refuses merged or erased identity %#',async identity=>{
 tx.user.findUnique.mockResolvedValue({id:'parent-user-id',role:'PARENT',activatedAt:null,...identity});
 (issueParentPhoneChallenge as jest.Mock).mockImplementation(jest.requireActual('@/lib/auth/parent-phone').issueParentPhoneChallenge);
 const response=await POST(request(),context);expect(response.status).toBe(409);
 expect(response.headers.get('cache-control')).toContain('no-store');expect(response.headers.get('referrer-policy')).toBe('no-referrer');
 expect(await response.json()).toEqual({error:'Ce compte ne permet pas de préparer ce lien. Actualisez le dossier.'});
});
