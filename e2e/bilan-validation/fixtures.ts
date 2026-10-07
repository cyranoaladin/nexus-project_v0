import { randomBytes } from 'node:crypto';
import { test as base, expect, type Page } from '@playwright/test';
import { prisma } from '../../lib/prisma';
import { applyProvisioning, parseRoster } from '../../lib/espace/provisioning';
import { createSession, publishSession } from '../../lib/espace/sessions';
import type { EspaceActor } from '../../lib/espace/guards';

export { expect };
export interface Account { id: string; username: string; secret: string; firstName: string; lastName: string }
export interface Cohort {
  teacher: Account; otherTeacher: Account; third: Account; second: Account; peer: Account; unassigned: Account;
  sessions: { third: string; second: string }; groupIds: string[];
}
export function assertLocalHarness() {
  const value = process.env.TEST_DATABASE_URL ?? '';
  const db = new URL(value);
  if (process.env.BILAN_VALIDATION_LOCAL !== '1' || process.env.NEXUS_DISPOSABLE_POSTGRES !== '1'
    || process.env.DATABASE_URL !== value || db.protocol !== 'postgresql:'
    || !['localhost','127.0.0.1'].includes(db.hostname) || !/^\/nexus_disposable_bilan_[a-f0-9]+_test$/.test(db.pathname)
    || !db.port || db.port === '5432') throw new Error('BILAN_DATABASE_NOT_DISPOSABLE');
}
export const bilanPath = (level: '3e' | '2nde') => `/espace/bilan/${level}`;
export async function makeCredentialTemporary(account: Account) {
  assertLocalHarness();
  await prisma.user.update({where:{id:account.id},data:{pinMustChange:true}});
}
export async function login(page: Page, account: Account) {
  await page.goto('/espace/connexion');
  await page.getByTestId('input-username').fill(account.username);
  await page.getByTestId('input-secret').fill(account.secret);
  await page.getByTestId('btn-connexion').click();
  await page.waitForURL(/\/espace\/(eleve|enseignant)(?:\/|\?|$)/);
}
export async function goStep(page: Page, index: number) {
  await page.locator('#bilan-step').selectOption(String(index));
  await expect(page.locator('#bilan-step')).toHaveValue(String(index));
}
export async function waitSaved(page: Page) {
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state','saved');
}
export const test = base.extend<{ cohort: Cohort }>({
  cohort: async ({}, use) => {
    assertLocalHarness();
    const run = randomBytes(5).toString('hex');
    const groupSlugs = ['third','second','unassigned','other'].map(k => `bv-${run}-${k}`);
    const [thirdGroup,secondGroup,unassignedGroup,otherGroup] = groupSlugs;
    const username = (k:string) => `bv.${run}.${k}`;
    const roster = parseRoster({
      groups: groupSlugs.map(slug => ({slug,name:`Fictif ${slug}`})),
      teachers: [
        {username:username('teacher'),firstName:'Professeur',lastName:`Fictif${run}`,teaches:[thirdGroup,secondGroup,unassignedGroup].map(group=>({group,subjects:['MATHS']}))},
        {username:username('otherTeacher'),firstName:'AutreProfesseur',lastName:`Fictif${run}`,teaches:[{group:otherGroup,subjects:['MATHS']}]},
      ],
      students: [['third',thirdGroup],['peer',thirdGroup],['second',secondGroup],['unassigned',unassignedGroup]].map(([key,group])=>({username:username(key),firstName:key,lastName:`Fictif${run}`,enrollments:[{group,subjects:['MATHS']}]})),
    });
    const result = await applyProvisioning(prisma,roster,{adopt:false,temporaryCodes:false});
    const credentials = new Map(result.credentials.map(c=>[c.username,c.secret]));
    const users = await prisma.user.findMany({where:{username:{in:[...roster.teachers,...roster.students].map(x=>x.username)}}});
    const accounts = Object.fromEntries(['teacher','otherTeacher','third','second','peer','unassigned'].map(key=>{
      const u=users.find(row=>row.username===username(key).toLowerCase())!;
      return [key,{id:u.id,username:u.username!,secret:credentials.get(u.username!)!,firstName:u.firstName,lastName:u.lastName}];
    })) as unknown as Omit<Cohort,'sessions'|'groupIds'>;
    const groups = await prisma.espaceGroup.findMany({where:{slug:{in:groupSlugs}}});
    const teacher: EspaceActor = {...accounts.teacher,role:'COACH'};
    const sessions = {} as Cohort['sessions'];
    try {
      for (const [key,level,groupSlug] of [['third','3e',thirdGroup],['second','2nde',secondGroup]] as const) {
        const group = groups.find(g=>g.slug===groupSlug)!;
        const session = await createSession(teacher,{groupId:group.id,subject:'MATHEMATIQUES',activitySlug:`maths-bilan-septembre-2026-${level}`});
        await publishSession(teacher,session.id); sessions[key]=session.id;
      }
      await use({...accounts,sessions,groupIds:groups.map(g=>g.id)});
    } finally {
      const ids = users.map(u=>u.id); const workFilter={studentId:{in:ids}};
      await prisma.espaceAnnotation.deleteMany({where:{work:workFilter}});
      await prisma.espaceWorkVersion.deleteMany({where:{work:workFilter}});
      await prisma.espaceWorkAttachment.deleteMany({where:{work:workFilter}});
      await prisma.espaceWork.deleteMany({where:workFilter});
      await prisma.espaceSession.deleteMany({where:{groupId:{in:groups.map(g=>g.id)}}});
      await prisma.espaceGroup.deleteMany({where:{id:{in:groups.map(g=>g.id)}}});
      await prisma.espaceSecurityEvent.deleteMany({where:{OR:[{userId:{in:ids}},{actorId:{in:ids}}]}});
      await prisma.user.deleteMany({where:{id:{in:ids}}});
    }
  },
});
