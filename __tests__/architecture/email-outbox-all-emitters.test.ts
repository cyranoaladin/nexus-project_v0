import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PRODUCTION_ROOTS = ['app', 'lib'];
const ALLOWED_SMTP_FILES = new Set([
  'lib/email/mailer.ts',
  'lib/email/outbox-worker.ts',
]);

function productionTypeScriptFiles(): string[] {
  const files: string[] = [];
  const visit = (relativeDirectory: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, relativeDirectory), { withFileTypes: true })) {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) visit(relativePath);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(relativePath);
    }
  };
  for (const root of PRODUCTION_ROOTS) visit(root);
  return files.sort();
}

describe('durable email outbox boundary', () => {
  test('only the canonical mailer owns Nodemailer and SMTP transport creation', () => {
    const offenders = productionTypeScriptFiles().filter((relativePath) => {
      if (ALLOWED_SMTP_FILES.has(relativePath)) return false;
      const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
      return /from ['"]nodemailer9?['"]|require\(['"]nodemailer9?['"]\)|createTransport\s*\(/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  test('controllers and compatibility facades never deliver email directly', () => {
    const offenders = productionTypeScriptFiles().filter((relativePath) => {
      if (ALLOWED_SMTP_FILES.has(relativePath)) return false;
      const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
      return /\.sendMail\s*\(|import\s*\{[^}]*\bsendMail\b[^}]*\}\s*from\s*['"]@\/lib\/email\/mailer['"]/.test(source);
    });

    expect(offenders).toEqual([]);
  });
});
