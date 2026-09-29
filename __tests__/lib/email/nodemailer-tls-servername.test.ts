import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import tls from 'node:tls';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const nodemailer = require('nodemailer9') as typeof import('nodemailer9');
const shared = require('nodemailer9/lib/shared') as { dnsCache: Map<string, unknown> };

describe('Nodemailer direct-TLS servername isolation', () => {
  let fixtureDir: string;
  let server: tls.Server;

  beforeEach(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'nexus-smtp-tls-fixture-'));
  });

  afterEach(async () => {
    shared.dnsCache.clear();
    if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it('does not reuse another transport servername or send credentials to its certificate identity', async () => {
    const keyPath = join(fixtureDir, 'key.pem');
    const certPath = join(fixtureDir, 'cert.pem');
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=attacker.test', '-addext', 'subjectAltName=DNS:attacker.test',
      '-keyout', keyPath, '-out', certPath,
    ], { stdio: 'ignore' });

    const [key, cert] = await Promise.all([readFile(keyPath), readFile(certPath)]);
    const observedServernames: Array<string | undefined> = [];
    const observedAuthLines: string[] = [];
    const certificateContext = tls.createSecureContext({ key, cert });
    server = tls.createServer({
      key,
      cert,
      SNICallback: (servername, callback) => {
        observedServernames.push(servername);
        callback(null, certificateContext);
      },
    }, (socket) => {
      socket.write('220 synthetic.smtp.test ESMTP\r\n');
      let pending = '';
      socket.on('data', (chunk) => {
        pending += chunk.toString('utf8');
        while (pending.includes('\r\n')) {
          const end = pending.indexOf('\r\n');
          const line = pending.slice(0, end);
          pending = pending.slice(end + 2);
          if (/^EHLO\s/i.test(line)) socket.write('250-synthetic.smtp.test\r\n250 AUTH PLAIN\r\n');
          else if (/^AUTH\s/i.test(line)) {
            observedAuthLines.push(line);
            socket.write('235 2.7.0 synthetic authentication accepted\r\n');
          } else if (/^QUIT/i.test(line)) socket.end('221 2.0.0 goodbye\r\n');
          else socket.write('250 2.0.0 ok\r\n');
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Synthetic SMTP TLS server did not bind a TCP port.');

    shared.dnsCache.clear();
    const attackerTransport = nodemailer.createTransport({
      host: 'localhost',
      port: address.port,
      secure: true,
      auth: { user: 'synthetic-attacker-user', pass: 'synthetic-attacker-pass' },
      tls: { ca: cert, servername: 'attacker.test', rejectUnauthorized: true },
    });
    await expect(attackerTransport.verify()).resolves.toBe(true);
    attackerTransport.close();

    const victimTransport = nodemailer.createTransport({
      host: 'localhost',
      port: address.port,
      secure: true,
      auth: { user: 'synthetic-victim-user', pass: 'synthetic-victim-pass' },
      tls: { ca: cert, servername: 'victim.test', rejectUnauthorized: true },
    });
    await expect(victimTransport.verify()).rejects.toBeDefined();
    victimTransport.close();

    expect(observedServernames).toEqual(['attacker.test', 'victim.test']);
    expect(observedAuthLines).toHaveLength(1);
    expect(observedAuthLines.join('\n')).not.toContain('synthetic-victim-user');
    expect(observedAuthLines.join('\n')).not.toContain('synthetic-victim-pass');
  });
});
