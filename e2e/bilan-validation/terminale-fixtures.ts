import { randomBytes } from 'node:crypto';
import { test as base } from '@playwright/test';
import { prisma } from '../../lib/prisma';
import { applyProvisioning, parseRoster } from '../../lib/espace/provisioning';
import { createSession, publishSession } from '../../lib/espace/sessions';
import { BILAN_PROFILES } from '../../lib/espace/bilan-profiles';
import type { EspaceActor } from '../../lib/espace/guards';
import { assertLocalHarness, type Account } from './fixtures';

export { expect, login, goStep, waitSaved } from './fixtures';
export type TerminaleLevel = 'tle-maths' | 'tle-nsi';
export interface TerminaleCohort {
  mathsTeacher: Account; nsiTeacher: Account;
  dual: Account; mathsOnly: Account; nsiOnly: Account; unassigned: Account;
  sessions: Record<TerminaleLevel, string>;
}
export const terminalePath = (level: TerminaleLevel) => `/espace/bilan/${level}`;

/** Each test owns synthetic users and two subject-specific published sessions.
 * Both teachers share the same group: refusal must depend on subject, not group.
 * The unassigned pupil is enrolled in both subjects in a group without a session.
 */
export const test = base.extend<{ terminale: TerminaleCohort }>({
  terminale: async ({}, provide) => {
    assertLocalHarness();
    const run = randomBytes(5).toString('hex');
    const groupSlug = `bt-${run}-terminale`;
    const unassignedSlug = `bt-${run}-no-session`;
    const username = (key: string) => `bt.${run}.${key}`;
    const roster = parseRoster({
      groups: [groupSlug, unassignedSlug].map(slug => ({ slug, name: `Fictif ${slug}` })),
      teachers: [
        { username: username('mathsTeacher'), firstName: 'ProfMaths', lastName: `Fictif${run}`, teaches: [groupSlug, unassignedSlug].map(group => ({ group, subjects: ['MATHS'] })) },
        { username: username('nsiTeacher'), firstName: 'ProfNSI', lastName: `Fictif${run}`, teaches: [groupSlug, unassignedSlug].map(group => ({ group, subjects: ['NSI'] })) },
      ],
      students: [
        { key: 'dual', group: groupSlug, subjects: ['MATHS', 'NSI'] },
        { key: 'mathsOnly', group: groupSlug, subjects: ['MATHS'] },
        { key: 'nsiOnly', group: groupSlug, subjects: ['NSI'] },
        { key: 'unassigned', group: unassignedSlug, subjects: ['MATHS', 'NSI'] },
      ].map(({ key, group, subjects }) => ({ username: username(key), firstName: key, lastName: `Fictif${run}`, enrollments: [{ group, subjects }] })),
    });
    const provisioned = await applyProvisioning(prisma, roster, { adopt: false, temporaryCodes: false });
    const secrets = new Map(provisioned.credentials.map(c => [c.username, c.secret]));
    const users = await prisma.user.findMany({ where: { username: { in: [...roster.teachers, ...roster.students].map(u => u.username) } } });
    const accounts = Object.fromEntries(['mathsTeacher', 'nsiTeacher', 'dual', 'mathsOnly', 'nsiOnly', 'unassigned'].map(key => {
      const user = users.find(u => u.username === username(key).toLowerCase())!;
      return [key, { id: user.id, username: user.username!, secret: secrets.get(user.username!)!, firstName: user.firstName, lastName: user.lastName }];
    })) as unknown as Omit<TerminaleCohort, 'sessions'>;
    const groups = await prisma.espaceGroup.findMany({ where: { slug: { in: [groupSlug, unassignedSlug] } } });
    const groupId = groups.find(g => g.slug === groupSlug)!.id;
    const sessions = {} as TerminaleCohort['sessions'];
    try {
      for (const level of ['tle-maths', 'tle-nsi'] as const) {
        const teacher: EspaceActor = { ...(level === 'tle-maths' ? accounts.mathsTeacher : accounts.nsiTeacher), role: 'COACH' };
        const session = await createSession(teacher, { groupId, subject: level === 'tle-maths' ? 'MATHEMATIQUES' : 'NSI', activitySlug: BILAN_PROFILES[level].slug });
        await publishSession(teacher, session.id);
        sessions[level] = session.id;
      }
      await provide({ ...accounts, sessions });
    } finally {
      const ids = users.map(u => u.id);
      const work = { studentId: { in: ids } };
      await prisma.espaceAnnotation.deleteMany({ where: { work } });
      await prisma.espaceWorkVersion.deleteMany({ where: { work } });
      await prisma.espaceWorkAttachment.deleteMany({ where: { work } });
      await prisma.espaceWork.deleteMany({ where: work });
      await prisma.espaceSession.deleteMany({ where: { groupId: { in: groups.map(g => g.id) } } });
      await prisma.espaceGroup.deleteMany({ where: { id: { in: groups.map(g => g.id) } } });
      await prisma.espaceSecurityEvent.deleteMany({ where: { OR: [{ userId: { in: ids } }, { actorId: { in: ids } }] } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  },
});
