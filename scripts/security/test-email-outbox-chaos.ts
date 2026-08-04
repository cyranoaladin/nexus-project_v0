import assert from 'node:assert/strict';
import { createServer, type Server, type Socket } from 'node:net';

import { PrismaClient } from '@prisma/client';

import { enqueueEmailIntent } from '../../lib/email/outbox';
import { drainEmailOutbox } from '../../lib/email/outbox-worker';
import { resetTransporter } from '../../lib/email/mailer';

type ChaosMode =
  | 'ACCEPT'
  | 'REJECT_MAIL'
  | 'REJECT_RCPT_TEMPORARY'
  | 'REJECT_RCPT_PERMANENT'
  | 'CUT_BEFORE_BODY'
  | 'CUT_AFTER_BODY'
  | 'DELAY_FINAL';

class ChaosSmtpServer {
  readonly messages: string[] = [];
  mode: ChaosMode = 'ACCEPT';
  private server: Server | null = null;

  async start(): Promise<number> {
    this.server = createServer((socket) => this.handle(socket));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const address = this.server.address();
    assert(address && typeof address === 'object');
    return address.port;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = null;
  }

  private handle(socket: Socket): void {
    socket.setEncoding('utf8');
    socket.write('220 chaos-smtp ESMTP\r\n');
    let buffer = '';
    let dataMode = false;
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      if (dataMode) {
        const end = buffer.indexOf('\r\n.\r\n');
        if (end < 0) return;
        this.messages.push(buffer.slice(0, end));
        buffer = buffer.slice(end + 5);
        dataMode = false;
        if (this.mode === 'CUT_AFTER_BODY') return socket.destroy();
        if (this.mode === 'DELAY_FINAL') {
          setTimeout(() => { if (!socket.destroyed) socket.write('250 2.0.0 accepted\r\n'); }, 1_000);
          return;
        }
        socket.write('250 2.0.0 accepted\r\n');
      }
      let lineEnd: number;
      while (!dataMode && (lineEnd = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        const command = line.split(' ', 1)[0]?.toUpperCase();
        if (command === 'EHLO' || command === 'HELO') socket.write('250-chaos-smtp\r\n250 PIPELINING\r\n');
        else if (command === 'MAIL' && this.mode === 'REJECT_MAIL') socket.write('550 5.7.1 sender rejected\r\n');
        else if (command === 'RCPT' && this.mode === 'REJECT_RCPT_TEMPORARY') socket.write('450 4.2.0 temporary recipient failure\r\n');
        else if (command === 'RCPT' && this.mode === 'REJECT_RCPT_PERMANENT') socket.write('550 5.1.1 recipient rejected\r\n');
        else if (command === 'MAIL' || command === 'RCPT') socket.write('250 2.1.0 ok\r\n');
        else if (command === 'DATA') {
          if (this.mode === 'CUT_BEFORE_BODY') socket.destroy();
          else { dataMode = true; buffer = ''; socket.write('354 End data with <CR><LF>.<CR><LF>\r\n'); }
        } else if (command === 'QUIT') { socket.write('221 2.0.0 bye\r\n'); socket.end(); }
        else if (command === 'RSET' || command === 'NOOP') socket.write('250 2.0.0 ok\r\n');
      }
    });
  }
}

const prisma = new PrismaClient();
const chaos = new ChaosSmtpServer();
let sequence = 0;

async function enqueue(marker: string) {
  const current = ++sequence;
  return prisma.$transaction((transaction) => enqueueEmailIntent(transaction, {
    aggregateId: `synthetic-user-${current}`,
    messageType: 'PARENT_ACTIVATION',
    dedupeKey: `synthetic-transition-${current}`,
    to: `synthetic-${current}@example.test`,
    subject: 'Synthetic activation',
    html: `<a href="http://127.0.0.1/activate?token=${marker}">Activate</a>`,
    text: `Activation token: ${marker}`,
  }));
}

async function status(id: string) {
  return prisma.jobOutbox.findUniqueOrThrow({ where: { id } });
}

function messageId(raw: string): string {
  const match = raw.match(/^Message-ID:\s*(.+)$/im);
  assert(match?.[1]);
  return match[1].trim();
}

async function main(): Promise<void> {
  const target = process.env.DATABASE_URL || '';
  assert.match(target, /(?:127\.0\.0\.1|localhost)/);
  const port = await chaos.start();
  process.env.NODE_ENV = 'test';
  process.env.MAIL_DISABLED = 'false';
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(port);
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_CONNECTION_TIMEOUT_MS = '300';
  process.env.SMTP_GREETING_TIMEOUT_MS = '300';
  process.env.SMTP_SOCKET_TIMEOUT_MS = '300';
  process.env.MAIL_FROM = 'Nexus Synthetic <no-reply@example.test>';
  process.env.EMAIL_OUTBOX_MAX_ATTEMPTS = '4';
  resetTransporter();
  await prisma.jobOutbox.deleteMany({ where: { jobType: 'SEND_EMAIL' } });

  chaos.mode = 'REJECT_RCPT_TEMPORARY';
  const temporary = await enqueue('temporary-marker');
  await drainEmailOutbox({ owner: 'chaos-temporary' });
  assert.equal((await status(temporary.id)).status, 'RETRY_SCHEDULED');

  chaos.mode = 'REJECT_RCPT_PERMANENT';
  const permanent = await enqueue('permanent-marker');
  await drainEmailOutbox({ owner: 'chaos-permanent' });
  assert.equal((await status(permanent.id)).status, 'FAILED_FINAL');

  chaos.mode = 'CUT_BEFORE_BODY';
  const beforeBody = await enqueue('before-body-marker');
  await drainEmailOutbox({ owner: 'chaos-before-body' });
  assert.notEqual((await status(beforeBody.id)).status, 'COMPLETED');

  const stableMarker = 'stable-token-marker-never-logged';
  chaos.mode = 'CUT_AFTER_BODY';
  const ambiguous = await enqueue(stableMarker);
  await drainEmailOutbox({ owner: 'chaos-ambiguous' });
  assert.equal((await status(ambiguous.id)).status, 'AMBIGUOUS');
  assert.equal(chaos.messages.filter((raw) => raw.includes(stableMarker)).length, 1);
  const firstMessageId = messageId(chaos.messages.find((raw) => raw.includes(stableMarker))!);
  await prisma.jobOutbox.update({ where: { id: ambiguous.id }, data: { availableAt: new Date(0) } });
  chaos.mode = 'ACCEPT';
  await drainEmailOutbox({ owner: 'chaos-retry' });
  assert.equal((await status(ambiguous.id)).status, 'COMPLETED');
  const stableMessages = chaos.messages.filter((raw) => raw.includes(stableMarker));
  assert.equal(stableMessages.length, 2);
  assert.equal(messageId(stableMessages[1]), firstMessageId);

  chaos.mode = 'DELAY_FINAL';
  const delayed = await enqueue('delayed-marker');
  await drainEmailOutbox({ owner: 'chaos-delayed' });
  assert.equal((await status(delayed.id)).status, 'AMBIGUOUS');

  chaos.mode = 'ACCEPT';
  const concurrent = await Promise.all(Array.from({ length: 24 }, (_, index) => enqueue(`parallel-${index}`)));
  const [workerA, workerB] = await Promise.all([
    drainEmailOutbox({ limit: 100, owner: 'chaos-worker-a' }),
    drainEmailOutbox({ limit: 100, owner: 'chaos-worker-b' }),
  ]);
  const completed = await prisma.jobOutbox.count({
    where: { id: { in: concurrent.map(({ id }) => id) }, status: 'COMPLETED' },
  });
  assert.equal(completed, 24);
  assert.equal(workerA.completed + workerB.completed, 24);

  const leased = await enqueue('expired-lease-marker');
  await prisma.jobOutbox.update({
    where: { id: leased.id },
    data: { status: 'LEASED', leaseOwner: 'crashed-worker', leaseExpiresAt: new Date(0) },
  });
  await drainEmailOutbox({ owner: 'chaos-recovery' });
  assert.equal((await status(leased.id)).status, 'COMPLETED');

  const serializedRows = JSON.stringify(await prisma.jobOutbox.findMany({
    where: { jobType: 'SEND_EMAIL' },
    select: { payload: true, lastError: true },
  }));
  assert(!serializedRows.includes(stableMarker));
  assert(!serializedRows.includes('@example.test'));

  console.log(JSON.stringify({
    temporaryRetry: true,
    permanentFailureFinal: true,
    ambiguousAcceptanceRecovered: true,
    stableMessageId: true,
    stableToken: true,
    twoWorkersCompleted: completed,
    leaseRecovered: true,
    plaintextPiiInOutbox: 0,
  }));
}

main().finally(async () => {
  resetTransporter();
  await chaos.stop();
  await prisma.$disconnect();
}).catch((error) => {
  console.error(error instanceof Error ? error.message : 'EMAIL_OUTBOX_CHAOS_FAILED');
  process.exitCode = 1;
});
