#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';

const prisma = new PrismaClient();
const userId = process.argv.includes('--user') ? process.argv[process.argv.indexOf('--user') + 1] : null;

if (!userId) {
  console.error('Usage: node scripts/rgpd/export-user.mjs --user <USER_ID>');
  process.exit(2);
}

async function main() {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const student = await prisma.student.findFirst({ where: { userId: userId } });
  const sessions = await prisma.session.findMany({ where: { studentId: student?.id || '' } });
  const payments = await prisma.payment.findMany({ where: { userId } });
  const payload = { user, student, sessions, payments };
  await prisma.auditLog.create({ data: { actor: 'system', action: 'RGPD_EXPORT', diff: { userId } } });
  if (process.env.SLACK_WEBHOOK_URL) {
    spawnSync('node', ['scripts/notify/slack-webhook.mjs', `RGPD export executed for user=${userId}`], { stdio: 'inherit' });
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
