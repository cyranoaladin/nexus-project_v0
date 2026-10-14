import net from 'node:net';
import { sendMail, resetTransporter, type SendMailOptions, type SendMailResult } from '@/lib/email/mailer';

test('SMTP deadline destroys the actual socket rather than abandoning an active delivery', async () => {
  const original = { ...process.env };
  const sockets = new Set<net.Socket>();
  let observedClose!: () => void;
  const closed = new Promise<void>(resolve => { observedClose = resolve; });
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => { sockets.delete(socket); observedClose(); });
    socket.on('error', () => undefined);
    socket.on('data', () => undefined);
    socket.write('220 synthetic deadline test\r\n');
    // Deliberately stall after the greeting: no remote command can finish.
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as net.AddressInfo;
  process.env.MAIL_DISABLED = 'false'; process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(address.port); process.env.SMTP_SECURE = 'false';
  process.env.SMTP_SOCKET_TIMEOUT_MS = '1000';
  delete process.env.SMTP_USER; delete process.env.SMTP_PASS; delete process.env.SMTP_PASSWORD;
  resetTransporter();
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const started = Date.now();
    const boundedSend = sendMail as (options: SendMailOptions, control: { deadlineAt: Date }) => Promise<SendMailResult>;
    await expect(boundedSend({ to: 'synthetic@example.test', subject: 'Deadline', html: '<p>Test</p>' },
      { deadlineAt: new Date(started + 200) })).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    await closed;
    expect(Date.now() - started).toBeLessThan(900);
    expect(sockets.size).toBe(0);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
    process.env = original; resetTransporter(); log.mockRestore();
  }
});
