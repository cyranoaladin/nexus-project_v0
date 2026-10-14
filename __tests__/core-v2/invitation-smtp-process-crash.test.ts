import net from 'node:net';
import path from 'node:path';
import { fork, type ChildProcess } from 'node:child_process';
import { prisma } from '@/lib/prisma';
import { requestAccountInvitation } from '@/lib/core-v2/services';
import { setupV1Fixture } from './helpers/v1-provisioning-fixture';
const f = setupV1Fixture();

test('SIGKILL after actual SMTP acceptance is durably uncertain and a new worker never redelivers it', async () => {
  const user = await f.coreUser('PARENT', 'smtp-process-crash');
  await requestAccountInvitation(f.h.client, f.h.ctx(), user.id);
  await f.run({ limit: 1 });
  const children = new Set<ChildProcess>(), sockets = new Set<net.Socket>();
  let accepted = 0;
  const server = net.createServer(socket => {
    sockets.add(socket);socket.on('close', () => sockets.delete(socket));socket.on('error', () => undefined);
    let buffer = '', data = false;
    socket.write('220 synthetic loopback SMTP\r\n');
    socket.on('data', chunk => {
      buffer += chunk.toString();if (buffer.length > 65_536) { socket.destroy();return; }
      let index: number;
      while ((index = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, index);buffer = buffer.slice(index + 2);
        if (data) { if (line === '.') { data = false;accepted += 1;socket.write('250 accepted\r\n'); }continue; }
        if (/^EHLO /i.test(line)) socket.write('250-synthetic\r\n250 PIPELINING\r\n');
        else if (/^(MAIL FROM:|RCPT TO:|RSET)/i.test(line)) socket.write('250 OK\r\n');
        else if (line === 'DATA') { data = true;socket.write('354 send data\r\n'); }
        else if (line === 'QUIT') socket.end('221 closing\r\n');
        else socket.write('500 unsupported\r\n');
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as net.AddressInfo).port;
  const launch = (mode: string) => {
    const env: NodeJS.ProcessEnv = { ...process.env, MAIL_DISABLED: 'false', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port),
      SMTP_SECURE: 'false', MAIL_FROM: 'Synthetic <sender@example.test>' };
    delete env.SMTP_USER;delete env.SMTP_PASS;delete env.SMTP_PASSWORD;
    const child = fork(path.resolve('__tests__/core-v2/helpers/email-outbox-crash-process.ts'), [mode], {
      execArgv: ['--import', 'tsx'], env, stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    children.add(child);child.stderr?.on('data', () => undefined);return child;
  };
  const event = (child: ChildProcess, name: string) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGKILL');reject(new Error('CRASH_DRIVER_EVENT_TIMEOUT')); }, 10_000);
    child.on('message', message => { if (message && typeof message === 'object' && 'event' in message && message.event === name) {
      clearTimeout(timer);resolve(message as Record<string, unknown>);
    } });
    child.once('error', () => { clearTimeout(timer);reject(new Error('CRASH_DRIVER_PROCESS_FAILED')); });
    child.once('exit', () => { clearTimeout(timer);reject(new Error('CRASH_DRIVER_PREMATURE_EXIT')); });
  });
  const exit = (child: ChildProcess) => new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
    child.once('exit', (code, signal) => { children.delete(child);resolve({ code, signal }); });
  });
  try {
    const interrupted = launch('crash-after-accept'), stopped = exit(interrupted);
    await event(interrupted, 'SMTP_ACCEPTED');
    expect(accepted).toBe(1);interrupted.kill('SIGKILL');expect(await stopped).toEqual({ code: null, signal: 'SIGKILL' });
    const persisted = await prisma.jobOutbox.findFirstOrThrow({ where: { aggregateType: 'account-invitation' } });
    // A past due lease is exercised by real time, not by rewriting the database.
    const wait = Math.max(0, persisted.leaseExpiresAt!.getTime() - Date.now() + 20);
    await new Promise(resolve => setTimeout(resolve, wait));
    const restarted = launch('restart'), finished = exit(restarted);
    const result = await event(restarted, 'DRAIN_COMPLETED');expect(await finished).toEqual({ code: 0, signal: null });
    expect(result.claimed).toBe(0);expect(accepted).toBe(1);
    expect(await prisma.jobOutbox.findUniqueOrThrow({ where: { id: persisted.id } })).toMatchObject({
      status: 'AMBIGUOUS', attemptCount: 1, completedAt: null, lastError: 'INVITATION_DELIVERY_IN_FLIGHT',
    });
    expect(await prisma.v1AccountInvitationIssuance.findFirstOrThrow({ where: { outboxId: persisted.id } })).toMatchObject({ deliveredAt: null });
  } finally {
    for (const child of children) child.kill('SIGKILL');
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
