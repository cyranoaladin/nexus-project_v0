/**
 * E2E Credentials — Single Source of Truth
 *
 * Reads e2e/.credentials.json written by scripts/seed-e2e-db.ts.
 * NEVER falls back to hardcoded values — if the file is missing,
 * the test suite fails fast with a clear message.
 *
 * Usage:
 *   import { CREDS, getCred } from './helpers/credentials';
 *   await page.fill('#email', CREDS.parent.email);
 *   // or
 *   const { email, password } = getCred('parent');
 */

import * as fs from 'fs';
import * as path from 'path';

/** Roles available in the credentials file */
export type CredRole = 'parent' | 'student' | 'student2' | 'coach' | 'coach2' | 'admin' | 'zenon';

export interface Credential {
  email: string;
  password: string;
}

export type CredentialsMap = Record<CredRole, Credential>;

function loadCredentials(): CredentialsMap {
  const credentialsPath = path.resolve(process.cwd(), 'e2e/.credentials.json');

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `[E2E] e2e/.credentials.json not found.\n` +
      `Run the seed first: DATABASE_URL=... npx tsx scripts/seed-e2e-db.ts\n` +
      `The seed writes this file automatically.`
    );
  }

  const raw = fs.readFileSync(credentialsPath, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, Credential>;

  // Validate required roles exist
  const required: CredRole[] = ['parent', 'student', 'coach', 'admin', 'zenon'];
  for (const role of required) {
    if (!parsed[role]?.email || !parsed[role]?.password) {
      throw new Error(
        `[E2E] e2e/.credentials.json is missing or incomplete for role "${role}".\n` +
        `Re-run the seed: DATABASE_URL=... npx tsx scripts/seed-e2e-db.ts`
      );
    }
  }

  return parsed as CredentialsMap;
}

/** Loaded credentials — singleton, evaluated once at import time */
export const CREDS: CredentialsMap = loadCredentials();

/** Convenience getter */
export function getCred(role: CredRole): Credential {
  const cred = CREDS[role];
  if (!cred) {
    throw new Error(`[E2E] No credentials for role "${role}" in e2e/.credentials.json`);
  }
  return cred;
}
