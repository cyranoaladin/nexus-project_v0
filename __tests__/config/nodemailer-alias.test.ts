import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');
const smtpModules = [
  'lib/email-service.ts',
  'lib/email/mailer.ts',
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
    };

    expect(pkg.dependencies?.nodemailer).toBeUndefined();
    expect(pkg.devDependencies?.nodemailer).toBeUndefined();
    expect(pkg.dependencies?.nodemailer9).toBe('npm:nodemailer@9.0.3');
    expect(pkg.dependencies?.['next-auth']).toBe('5.0.0-beta.31');
    expect(pkg.dependencies?.['@auth/prisma-adapter']).toBe('2.11.2');

    for (const modulePath of smtpModules) {
      const source = fs.readFileSync(path.join(projectRoot, modulePath), 'utf8');
      expect(source).toContain("from 'nodemailer9'");
      expect(source).not.toContain("from 'nodemailer'");
    }

    const lockfile = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'),
    ) as { packages?: Record<string, unknown> };
    expect(lockfile.packages?.['node_modules/nodemailer']).toBeUndefined();
  });

  it('verifies nodemailer9 exports createTransport at runtime', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nm = require('nodemailer9');
    expect(typeof nm.createTransport).toBe('function');
  });
});
