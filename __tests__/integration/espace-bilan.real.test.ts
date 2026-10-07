/** @jest-environment node */
jest.unmock('@/lib/prisma');
import { randomUUID } from 'node:crypto';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import type { EspaceActor } from '@/lib/espace/guards';
import { applyProvisioning, parseRoster } from '@/lib/espace/provisioning';
import { createSession, publishSession, closeSession } from '@/lib/espace/sessions';
import { openWork, saveWork, submitWork } from '@/lib/espace/works';
import { loadWorkForActor } from '@/lib/espace/access';
import { getStudentDashboard, getTeacherOverview } from '@/lib/espace/overview';

const run = randomUUID().slice(0,8);
const username = (id:string) => `bilan.${id}.${run}`;
const slug = (id:string) => `bilan-${id}-${run}`;
const roster = parseRoster({
 groups:['3e','2nde'].map(l=>({slug:slug(l),name:`Bilan test ${l}`})),
 teachers:[{username:username('prof'),firstName:'Prof',lastName:`Bilan${run}`,teaches:['3e','2nde'].map(l=>({group:slug(l),subjects:['MATHS']}))}],
 students:['3e','2nde'].map(l=>({username:username(l),firstName:'Élève',lastName:`Test${l}${run}`,enrollments:[{group:slug(l),subjects:['MATHS']}]})),
});
const actors: Record<string,EspaceActor> = {};
const sessions: Record<string,string> = {};
const ids:string[]=[]; const groups:string[]=[];
const activity = (level:string) => `maths-bilan-septembre-2026-${level}`;
let workId:string;
beforeAll(async()=>{
 assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || '');
 await applyProvisioning(prisma,roster,{adopt:false});
 for (const key of ['prof','3e','2nde']) {
  const u=await prisma.user.findUniqueOrThrow({where:{username:username(key)}});
  ids.push(u.id); actors[key]={id:u.id,role:u.role as EspaceActor['role'],firstName:u.firstName,lastName:u.lastName};
 }
 for (const level of ['3e','2nde']) {
  const group=await prisma.espaceGroup.findUniqueOrThrow({where:{slug:slug(level)}}); groups.push(group.id);
  const s=await createSession(actors.prof,{groupId:group.id,subject:'MATHEMATIQUES',activitySlug:activity(level),title:`Bilan ${level}`});
  sessions[level]=s.id;
 }
},120000);
afterAll(async()=>{
 const works={studentId:{in:ids}};
 await prisma.espaceWorkVersion.deleteMany({where:{work:works}});
 await prisma.espaceWork.deleteMany({where:works});
 await prisma.espaceSession.deleteMany({where:{groupId:{in:groups}}});
 await prisma.espaceEnrollment.deleteMany({where:{groupId:{in:groups}}});
 await prisma.espaceTeacherAssignment.deleteMany({where:{groupId:{in:groups}}});
 await prisma.espaceGroup.deleteMany({where:{id:{in:groups}}});
 await prisma.user.deleteMany({where:{id:{in:ids}}});
 await prisma.$disconnect();
});
it('une inscription maths ne suffit pas avant publication',async()=>{
 await expect(openWork(actors['3e'],{activitySlug:activity('3e')})).rejects.toMatchObject({code:'NOT_FOUND'});
});
it('attribue une seule page par niveau et refuse l’URL du niveau voisin',async()=>{
 for(const l of ['3e','2nde']) await publishSession(actors.prof,sessions[l]);
 const work=await openWork(actors['3e'],{activitySlug:activity('3e')}); workId=work.id;
 await expect(openWork(actors['3e'],{activitySlug:activity('2nde')})).rejects.toMatchObject({code:'NOT_FOUND'});
 await expect(openWork(actors['2nde'],{activitySlug:activity('3e'),sessionId:sessions['3e']})).rejects.toMatchObject({code:'NOT_FOUND'});
 const dashboard=await getStudentDashboard(actors['3e']);
 const slugs=dashboard.subjects.flatMap(s=>s.activities.map(a=>a.slug));
 expect(slugs).toContain(activity('3e')); expect(slugs).not.toContain(activity('2nde'));
 const teacherOverview=await getTeacherOverview(actors.prof,activity('3e'));
 expect(teacherOverview.rows.map(r=>r.studentId)).toEqual([actors['3e'].id]);
 await expect(loadWorkForActor(actors['2nde'],workId)).rejects.toMatchObject({code:'NOT_FOUND'});
});
it('enregistre durablement, bloque les révisions concurrentes et exige la relecture',async()=>{
 const saved=await saveWork(actors['3e'],workId,{baseRevision:0,patch:{stepId:'scope',step:{fields:{'3-arith':'yes'}}}});
 expect(saved.revision).toBe(1);
 const read=await loadWorkForActor(actors['3e'],workId);
 expect(read.work.content).toMatchObject({steps:{scope:{fields:{'3-arith':'yes'}}}});
 await expect(saveWork(actors['3e'],workId,{baseRevision:0,patch:{stepId:'scope',step:{fields:{'3-arith':'no'}}}})).rejects.toMatchObject({code:'REVISION_CONFLICT'});
 await expect(submitWork(actors['3e'],workId,1)).rejects.toMatchObject({code:'INVALID_INPUT'});
 const confirmed=await saveWork(actors['3e'],workId,{baseRevision:1,patch:{stepId:'review',step:{fields:{confirmed:'yes'}}}});
 const submitted=await submitWork(actors['3e'],workId,confirmed.revision);
 expect(submitted.status).toBe('SUBMITTED');
 await expect(saveWork(actors['3e'],workId,{baseRevision:submitted.revision,patch:{stepId:'scope',step:{fields:{'3-arith':'no'}}}})).rejects.toMatchObject({code:'WORK_LOCKED'});
 await expect(loadWorkForActor(actors.prof,workId,'teacher')).resolves.toMatchObject({mode:'teacher'});
});
it('une fermeture retire l’accès élève mais préserve la relecture enseignant',async()=>{
 await closeSession(actors.prof,sessions['3e']);
 await expect(loadWorkForActor(actors['3e'],workId)).rejects.toMatchObject({code:'NOT_FOUND'});
 await expect(loadWorkForActor(actors.prof,workId,'teacher')).resolves.toMatchObject({mode:'teacher'});
});
