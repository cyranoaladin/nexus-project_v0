import { randomUUID } from 'node:crypto';
const testPassword = ['Synthetic', randomUUID()].join('-');
import { GET, POST } from '@/app/api/auth/parent-phone/route';
import { POST as requestRecovery } from '@/app/api/auth/parent-phone/recovery/route';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { verifyParentPhoneChallenge, consumeParentPhoneChallenge, issueParentPhoneChallenge } from '@/lib/auth/parent-phone';
import { enqueueParentWhatsAppInvitation } from '@/lib/whatsapp/invitation-outbox';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn() }));
jest.mock('@/lib/auth/parent-phone', () => ({
 parentPhoneTokenPattern:/^(ppact_|pprst_)[A-Za-z0-9_-]{43}$/,
 verifyParentPhoneChallenge:jest.fn(),consumeParentPhoneChallenge:jest.fn(),issueParentPhoneChallenge:jest.fn(),
}));
jest.mock('@/lib/whatsapp/invitation-scheduler', () => ({ kickParentWhatsAppOutboxDrain: jest.fn() }));
jest.mock('@/lib/whatsapp/invitation-outbox', () => ({ enqueueParentWhatsAppInvitation:jest.fn() }));
const token='ppact_'+ 'a'.repeat(43);
const request=(body:unknown,url='http://localhost/api/auth/parent-phone')=>new NextRequest(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{jest.clearAllMocks();(guardSensitiveRateLimit as jest.Mock).mockResolvedValue(null);});
it('verifies a bearer challenge with security headers and no account details',async()=>{
 (verifyParentPhoneChallenge as jest.Mock).mockResolvedValue({valid:true,purpose:'ACTIVATION',phoneHint:'•••• 2829'});
 const response=await GET(new NextRequest('http://localhost/api/auth/parent-phone?token='+token));
 expect(await response.json()).toEqual({valid:true,purpose:'ACTIVATION',phoneHint:'•••• 2829'});expect(response.headers.get('Cache-Control')).toContain('no-store');
});
it('consumes only a valid bounded password and challenge',async()=>{
 (consumeParentPhoneChallenge as jest.Mock).mockResolvedValue({success:true,redirectUrl:'/auth/signin'});
 expect((await POST(request({token,password:testPassword}))).status).toBe(200);
 expect(consumeParentPhoneChallenge).toHaveBeenCalledWith(token,testPassword);
 expect((await POST(request({token,password:'short'}))).status).toBe(400);
});
it('honors throttling before mutation',async()=>{
 (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(NextResponse.json({error:'Too many requests'},{status:429}));
 expect((await POST(request({token,password:testPassword}))).status).toBe(429);expect(consumeParentPhoneChallenge).not.toHaveBeenCalled();
});
it('returns the same recovery answer for missing and valid phone account',async()=>{
 const tx={user:{findMany:jest.fn().mockResolvedValue([])}};
 (prisma.$transaction as jest.Mock).mockImplementation(cb=>cb(tx));
 const missing=await requestRecovery(request({identifier:'+21699192829'}));const body=await missing.json();
 expect(missing.status).toBe(200);expect(enqueueParentWhatsAppInvitation).not.toHaveBeenCalled();
 tx.user.findMany.mockResolvedValue([{id:'parent'}] as never);
 (issueParentPhoneChallenge as jest.Mock).mockResolvedValue({challengeId:'challenge',rawToken:token,phoneNormalized:'99192829',phoneVersion:2,purpose:'RECOVERY',expiresAt:new Date()});
 const valid=await requestRecovery(request({identifier:'+21699192829'}));expect(await valid.json()).toEqual(body);
 expect(enqueueParentWhatsAppInvitation).toHaveBeenCalledWith(tx,expect.objectContaining({userId:'parent',rawToken:token}));
 expect(JSON.stringify(body)).not.toContain(token);
});
it('never picks one of two ambiguous phone accounts',async()=>{
 (prisma.$transaction as jest.Mock).mockImplementation(cb=>cb({user:{findMany:jest.fn().mockResolvedValue([{id:'one'},{id:'two'}])}}));
 expect((await requestRecovery(request({identifier:'99192829'}))).status).toBe(200);expect(issueParentPhoneChallenge).not.toHaveBeenCalled();
});

it.each([['activation', POST], ['recovery', requestRecovery]] as const)('bounds the %s stream before parsing or account access', async (_name, handler) => {
 const oversized = request({ padding: 'x'.repeat(1024 * 1024) });
 const response = await handler(oversized);
 expect(response.status).toBe(413);
 expect(response.headers.get('Cache-Control')).toContain('no-store');
 expect(consumeParentPhoneChallenge).not.toHaveBeenCalled();
 expect(prisma.$transaction).not.toHaveBeenCalled();
});
it('rejects malformed telephone syntax without looking up an account', async () => {
 expect((await requestRecovery(request({ identifier: 'invalid contact' }))).status).toBe(400);
 expect(prisma.$transaction).not.toHaveBeenCalled();
});
