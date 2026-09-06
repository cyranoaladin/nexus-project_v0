import bcrypt from 'bcryptjs';
import { issueParentPhoneChallenge, consumeParentPhoneChallenge, verifyParentPhoneChallenge, hashParentPhoneToken } from '@/lib/auth/parent-phone';
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));
const now = new Date('2026-09-06T12:00:00Z');
const pending = { id: 'parent', role: 'PARENT', email: null, activatedAt: null, phoneNormalized: '99192829', parentPhoneVersion: 1, parentPhoneState: 'RESERVED', phoneVerifiedAt: null, mergedIntoUserId: null };
function database(user = pending) {
 const tx: any = { user: { findUnique: jest.fn().mockResolvedValue(user), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, parentPhoneChallenge: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), create: jest.fn().mockImplementation(({data}) => ({id:'challenge',...data})), findUnique: jest.fn() } };
 tx.$transaction = jest.fn(async (callback: any) => { try { return await callback(tx); } catch(error) { tx.rolledBack = true; throw error; } }); return tx;
}
function challenge(user = pending) { return { id:'challenge',userId:'parent',tokenHash:hashParentPhoneToken('ppact_'+ 'x'.repeat(43)),phoneNormalized:'99192829',phoneVersion:1,purpose:'ACTIVATION',expiresAt:new Date(now.getTime()+3600000),consumedAt:null,revokedAt:null,user }; }
it('issues a hashed challenge without marking the parent verified or activated', async () => {
 const tx=database(); const result=await issueParentPhoneChallenge(tx,{userId:'parent',purpose:'ACTIVATION',now});
 expect(result.rawToken).toMatch(/^ppact_/); expect(result.phoneVersion).toBe(1);
 expect(tx.parentPhoneChallenge.create).toHaveBeenCalledWith({data:expect.objectContaining({tokenHash:hashParentPhoneToken(result.rawToken),purpose:'ACTIVATION'})});
 expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({parentPhoneState:'RESERVED'})}));
 expect(tx.user.updateMany.mock.calls[0][0].data).not.toHaveProperty('activatedAt');
});
it('does not reactivate an already active email parent while adding a child', async () => {
 const tx=database({...pending,activatedAt:now} as any);
 await expect(issueParentPhoneChallenge(tx,{userId:'parent',purpose:'ACTIVATION',now})).rejects.toThrow('PHONE_ACTIVATION_NOT_ALLOWED');
 expect(tx.parentPhoneChallenge.create).not.toHaveBeenCalled();
});
it('consumes a phone-bound challenge and chooses password without email', async () => {
 const tx=database(); tx.parentPhoneChallenge.findUnique.mockResolvedValue(challenge());
 expect(await consumeParentPhoneChallenge('ppact_'+ 'x'.repeat(43),'Strong-password-2026',{prisma:tx,now})).toEqual(expect.objectContaining({success:true}));
 expect(tx.parentPhoneChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({consumedAt:null,revokedAt:null}),data:{consumedAt:now}}));
 expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({phoneNormalized:'99192829',parentPhoneVersion:1}),data:expect.objectContaining({activatedAt:now,parentPhoneState:'VERIFIED',phoneVerifiedAt:now,password:'hashed-password',sessionVersion:{increment:1}})}));
});
it.each([{phoneVersion:0},{revokedAt:now},{consumedAt:now},{expiresAt:new Date(0)},{user:{...pending,mergedIntoUserId:'other'}},{user:{...pending,role:'ELEVE'}},{user:{...pending,parentPhoneState:'NONE'}},{user:{...pending,phoneNormalized:'22111111'}}])('rejects stale, expired, replayed or foreign identity %#', async patch => {
 const tx=database();tx.parentPhoneChallenge.findUnique.mockResolvedValue({...challenge(),...patch});
 expect(await verifyParentPhoneChallenge('ppact_'+ 'x'.repeat(43),{prisma:tx,now})).toEqual({valid:false});
 expect(await consumeParentPhoneChallenge('ppact_'+ 'x'.repeat(43),'Strong-password-2026',{prisma:tx,now})).toEqual({success:false});
 expect(tx.user.updateMany).not.toHaveBeenCalled();
});
it('fails closed when a concurrent claim already consumed the token',async()=>{
 const tx=database();tx.parentPhoneChallenge.findUnique.mockResolvedValue(challenge());tx.parentPhoneChallenge.updateMany.mockResolvedValue({count:0});
 expect(await consumeParentPhoneChallenge('ppact_'+ 'x'.repeat(43),'Strong-password-2026',{prisma:tx,now})).toEqual({success:false});expect(tx.rolledBack).toBe(true);
});
it('requires verified identity for recovery and preserves activation date', async()=>{
 const user={...pending,activatedAt:new Date('2026-01-01'),parentPhoneState:'VERIFIED',phoneVerifiedAt:now};const tx=database(user as any);
 const result=await issueParentPhoneChallenge(tx,{userId:'parent',purpose:'RECOVERY',now});
 tx.parentPhoneChallenge.findUnique.mockResolvedValue({...challenge(user as any),purpose:'RECOVERY',tokenHash:hashParentPhoneToken(result.rawToken)});
 expect(await consumeParentPhoneChallenge(result.rawToken,'New-password-2026',{prisma:tx,now})).toEqual(expect.objectContaining({success:true}));
 expect(tx.user.updateMany.mock.calls.at(-1)[0].data).not.toHaveProperty('activatedAt');
});

it('manual reissue revokes prior unused links and persists only hashes with bounded expiry', async()=>{
 const tx=database();
 const first=await issueParentPhoneChallenge(tx,{userId:'parent',purpose:'ACTIVATION',now});
 const later=new Date(now.getTime()+1000);
 const second=await issueParentPhoneChallenge(tx,{userId:'parent',purpose:'ACTIVATION',now:later});
 expect(first.rawToken).not.toBe(second.rawToken);
 expect(second.expiresAt.getTime()-later.getTime()).toBe(72*60*60*1000);
 expect(tx.parentPhoneChallenge.updateMany).toHaveBeenLastCalledWith({where:{userId:'parent',consumedAt:null,revokedAt:null},data:{revokedAt:later}});
 const writes=JSON.stringify(tx.parentPhoneChallenge.create.mock.calls);
 expect(writes).not.toContain(first.rawToken);expect(writes).not.toContain(second.rawToken);
 expect(tx.parentPhoneChallenge.create.mock.calls[1][0].data.tokenHash).toBe(hashParentPhoneToken(second.rawToken));
 const active=database({...pending,activatedAt:now,parentPhoneState:'VERIFIED',phoneVerifiedAt:now} as never);
 const recovery=await issueParentPhoneChallenge(active,{userId:'parent',purpose:'RECOVERY',now});
 expect(recovery.expiresAt.getTime()-now.getTime()).toBe(60*60*1000);
});
