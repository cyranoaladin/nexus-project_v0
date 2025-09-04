#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const res = await prisma.notification.deleteMany({ where: { read: true, updatedAt: { lt: cutoff } } });
  await prisma.auditLog.create({ data: { actor: 'system', action: 'RGPD_PURGE', diff: { purgedNotifications: res.count, cutoff } } });
  const msg = `RGPD purge: purgedNotifications=${res.count} cutoff=${cutoff.toISOString()}`;
  if (process.env.SLACK_WEBHOOK_URL) {
    spawnSync('node', ['scripts/notify/slack-webhook.mjs', msg], { stdio: 'inherit' });
  }
  console.log(JSON.stringify({ purgedNotifications: res.count, cutoff }));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
