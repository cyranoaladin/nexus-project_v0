import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');
const smtpModules = [
  'lib/email/mailer.ts',
];
const queuedCompatibilityModules = [
  'lib/email-service.ts',
  'lib/email.ts',
  'lib/invoice/send-email.ts',
];

describe('SMTP transport dependency boundary', () => {
  it('keeps Auth.js optional Nodemailer peer absent and uses the internal SMTP alias', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      overrides?: Record<string, string>;
    };

    expect(pkg.dependencies?.nodemailer).toBeUndefined();
    expect(pkg.devDependencies?.nodemailer).toBeUndefined();
    // Keep the historical internal alias to avoid satisfying next-auth's
    // optional nodemailer@6 peer, but make the actual runtime major explicit.
    // GHSA-6vj9-mwq6-2f5v is fixed in nodemailer >=10.0.2.
    expect(pkg.dependencies?.nodemailer9).toBe('npm:nodemailer@10.0.2');
    expect(pkg.overrides?.['ip-address']).toBe('10.5.1');
    expect(pkg.dependencies?.['next-auth']).toBe('5.0.0-beta.32');
    expect(pkg.dependencies?.['@auth/prisma-adapter']).toBe('2.11.3');

    for (const modulePath of smtpModules) {
      const source = fs.readFileSync(path.join(projectRoot, modulePath), 'utf8');
      expect(source).toContain("from 'nodemailer9'");
      expect(source).not.toContain("from 'nodemailer'");
    }

    for (const modulePath of queuedCompatibilityModules) {
      const source = fs.readFileSync(path.join(projectRoot, modulePath), 'utf8');
      expect(source).toContain("email/queue");
      expect(source).not.toContain("from 'nodemailer9'");
      expect(source).not.toContain("from 'nodemailer'");
      expect(source).not.toContain('createTransport(');
      expect(source).not.toContain('.sendMail(');
    }

    const lockfile = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'),
    ) as { packages?: Record<string, unknown> };
    expect(lockfile.packages?.['node_modules/nodemailer']).toBeUndefined();
    expect(lockfile.packages?.['node_modules/ip-address']).toMatchObject({ version: '10.5.1' });
    expect(lockfile.packages?.['node_modules/nodemailer9']).toMatchObject({
      name: 'nodemailer',
      version: '10.0.2',
    });
  });

  it('verifies nodemailer9 runtime exports: createTransport, createTestAccount', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nm = require('nodemailer9');
    expect(typeof nm.createTransport).toBe('function');
    expect(typeof nm.createTestAccount).toBe('function');

    // Verify createTransport returns an object with sendMail, verify, close
    const transporter = nm.createTransport({ jsonTransport: true });
    expect(typeof transporter.sendMail).toBe('function');
    expect(typeof transporter.verify).toBe('function');
    expect(typeof transporter.close).toBe('function');
    transporter.close();
  });
});
