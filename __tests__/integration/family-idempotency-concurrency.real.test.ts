jest.unmock('@/lib/prisma');
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
jest.mock('@/lib/whatsapp/invitation-scheduler', () => ({ kickParentWhatsAppOutboxDrain: jest.fn() }));
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createFamilyHandler } from '@/lib/families/create-family';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
const prefix = 'family-idempotency-' + randomUUID();
const staffId = prefix + '-staff';
let verified = false;
const oldOrigin = process.env.NEXTAUTH_URL;
const oldMode = process.env.WHATSAPP_SEND_ENABLED;
beforeAll(async () => {
 assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''); verified = true;
 process.env.NEXTAUTH_URL = 'http://localhost:3000'; delete process.env.WHATSAPP_SEND_ENABLED;
 await prisma.user.create({data:{id:staffId,role:'ASSISTANTE',lastName:prefix}});
});
afterAll(async () => {
 if (verified) {
  const users = await prisma.user.findMany({where:{lastName:prefix}, select:{id:true}}); const ids=users.map(user=>user.id);
  await prisma.canonicalApiIdempotencyKey.deleteMany({where:{userId:staffId}});
  await prisma.parentStudentLink.deleteMany({where:{parentUserId:{in:ids}}});
  await prisma.student.deleteMany({where:{userId:{in:ids}}});
  await prisma.parentProfile.deleteMany({where:{userId:{in:ids}}});
  await prisma.user.deleteMany({where:{id:{in:ids}}}); await prisma.$disconnect();
 }
 if(oldOrigin===undefined)delete process.env.NEXTAUTH_URL;else process.env.NEXTAUTH_URL=oldOrigin;
 if(oldMode===undefined)delete process.env.WHATSAPP_SEND_ENABLED;else process.env.WHATSAPP_SEND_ENABLED=oldMode;
});
function request(key:string, phone:string, child='One') {
 return new NextRequest('http://localhost:3000/api/assistante/families',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json','idempotency-key':key},body:JSON.stringify({parentFirstName:key,parentLastName:prefix,parentPhone:phone,duplicateResolution:{mode:'CREATE_NEW'},children:[{firstName:child,email:key+'-'+child+'@example.test',grade:'Terminale'},{firstName:'Two',email:key+'-two@example.test',grade:'Premiere'}]})});
}
// Force both initial lookups to observe no reservation before either transaction starts.
function simultaneousDatabase() {
 let arrivals=0; let release!:()=>void; const both=new Promise<void>(resolve=>{release=resolve;});
 return {
  canonicalApiIdempotencyKey: {
   ...prisma.canonicalApiIdempotencyKey,
   findUnique: async (args: Parameters<typeof prisma.canonicalApiIdempotencyKey.findUnique>[0]) => {
    const value=await prisma.canonicalApiIdempotencyKey.findUnique(args);
    if(arrivals<2){arrivals++;if(arrivals===2)release();await both;} return value;
   },
  },
  $transaction: prisma.$transaction.bind(prisma),
 };
}
test.each([false,true])('concurrent family writes: different payload=%s', async different => {
 const key='family-race-'+randomUUID(); const phone=different?'99234568':'99234567';
 const inviteParent=jest.fn(async()=>({queued:false,required:true}));
 const db=simultaneousDatabase();
 const deps={prisma:db as never,authenticate:async()=>({user:{id:staffId,role:'ASSISTANTE'}} as never),now:()=>new Date(),inviteParent};
 const primary=createFamilyHandler(deps,{mode:'WHATSAPP'});
 const alias=createFamilyHandler(deps,{mode:'WHATSAPP',legacy:true,route:'POST:/api/assistante/students'});
 const results=await Promise.all([primary(request(key,phone)),alias(request(key,phone,different?'Changed':'One'))]);
 const bodies=await Promise.all(results.map(result=>result.json()));
 expect(results.map(result=>result.status).sort()).toEqual(different?[201,409]:[201,201]);
 if(different)expect(bodies[results.findIndex(result=>result.status===409)]).toEqual({error:{code:'IDEMPOTENCY_CONFLICT'}});
 else expect(bodies[0]).toEqual(bodies[1]);
 const winning=bodies[results.findIndex(result=>result.status===201)];
 expect(await prisma.student.count({where:{parent:{userId:winning.parentUserId}}})).toBe(2);
 expect(await prisma.user.count({where:{lastName:prefix,firstName:key,role:'PARENT'}})).toBe(1);
 expect(await prisma.canonicalApiIdempotencyKey.count({where:{userId:staffId,key}})).toBe(1);
 expect(inviteParent).toHaveBeenCalledTimes(1);
 expect(await prisma.jobOutbox.count({where:{aggregateId:winning.parentUserId}})).toBe(0);
});
