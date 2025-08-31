import { PrismaClient } from '@prisma/client';

export type ConsistencyReport = {
  ok: boolean;
  summary: string[];
  counts: {
    usersByRole: Record<string, number>;
    students: number;
    parents: number;
    coaches: number;
    admins: number;
    assistantes: number;
    subscriptionsByStatus: Record<string, number>;
    sessionsByStatus: Record<string, number>;
    paymentsByStatus: Record<string, number>;
    bilans: number;
    badges: number;
  };
  invariants: Array<{ name: string; ok: boolean; details?: string; }>;
};

export async function generateConsistencyReport(prisma: PrismaClient): Promise<ConsistencyReport> {
  const users = await prisma.user.findMany({ select: { role: true } });
  const usersByRole = users.reduce<Record<string, number>>((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});
  const students = await prisma.student.count();
  const parents = usersByRole['PARENT'] || 0;
  const coaches = usersByRole['COACH'] || 0;
  const admins = usersByRole['ADMIN'] || 0;
  const assistantes = usersByRole['ASSISTANTE'] || 0;

  const subs = await prisma.subscription.findMany({ select: { status: true } });
  const subscriptionsByStatus = subs.reduce<Record<string, number>>((acc, s) => { acc[s.status as any] = (acc[s.status as any] || 0) + 1; return acc; }, {});

  const sess = await prisma.session.findMany({ select: { status: true } });
  const sessionsByStatus = sess.reduce<Record<string, number>>((acc, s) => { acc[s.status as any] = (acc[s.status as any] || 0) + 1; return acc; }, {});

  const pays = await prisma.payment.findMany({ select: { status: true } });
  const paymentsByStatus = pays.reduce<Record<string, number>>((acc, p) => { acc[p.status as any] = (acc[p.status as any] || 0) + 1; return acc; }, {});

  const bilans = await prisma.bilan.count();
  const badges = await prisma.badge.count();

  const invariants: ConsistencyReport['invariants'] = [];

  invariants.push({ name: 'At least 1 admin', ok: admins >= 1, details: `admins=${admins}` });
  invariants.push({ name: 'At least 1 assistante', ok: assistantes >= 1, details: `assistantes=${assistantes}` });
  invariants.push({ name: 'At least 1 coach', ok: coaches >= 1, details: `coaches=${coaches}` });
  invariants.push({ name: 'At least 1 student', ok: students >= 1, details: `students=${students}` });
  invariants.push({ name: 'Sessions cover multiple statuses', ok: Object.keys(sessionsByStatus).length >= 3, details: JSON.stringify(sessionsByStatus) });
  invariants.push({ name: 'Subscriptions cover statuses', ok: Object.keys(subscriptionsByStatus).length >= 2, details: JSON.stringify(subscriptionsByStatus) });
  invariants.push({ name: 'Payments present', ok: Object.keys(paymentsByStatus).length >= 1, details: JSON.stringify(paymentsByStatus) });
  invariants.push({ name: 'Bilans exist', ok: bilans >= 1, details: `bilans=${bilans}` });
  invariants.push({ name: 'Badges exist', ok: badges >= 1, details: `badges=${badges}` });

  const ok = invariants.every(i => i.ok);
  const summary: string[] = [];
  if (!ok) summary.push('Invariants failed: ' + invariants.filter(i => !i.ok).map(i => i.name).join(', '));

  return {
    ok,
    summary,
    counts: { usersByRole, students, parents, coaches, admins, assistantes, subscriptionsByStatus, sessionsByStatus, paymentsByStatus, bilans, badges },
    invariants,
  };
}
