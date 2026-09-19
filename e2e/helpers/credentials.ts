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
export type CredRole =
  | 'parent'
  | 'student'
  | 'student2'
  | 'studentSurvival'
  | 'coach'
  | 'coach2'
  | 'admin'
  | 'assistante'
  | 'zenon'
  | 'ariaPersonasParent'
  | 'ariaTerminaleMaths'
  | 'ariaPremiereMaths'
  | 'ariaNsi'
  | 'ariaNsiPeer'
  | 'ariaStmgNoChat'
  | 'ariaIncompleteProfile'
  | 'ariaNotEntitled';

export interface Credential {
  email: string;
  password: string;
}

export type CredentialsMap = Record<CredRole, Credential>;

const REQUIRED_ROLES: readonly CredRole[] = [
  'parent',
  'student',
  'student2',
  'studentSurvival',
  'coach',
  'coach2',
  'admin',
  'assistante',
  'zenon',
  'ariaPersonasParent',
  'ariaTerminaleMaths',
  'ariaPremiereMaths',
  'ariaNsi',
  'ariaNsiPeer',
  'ariaStmgNoChat',
  'ariaIncompleteProfile',
  'ariaNotEntitled',
];

function loadCredentials(): CredentialsMap {
  const credentialsPath = path.resolve(
    process.env.E2E_CREDENTIALS_PATH ?? path.join(process.cwd(), 'e2e/.credentials.json')
  );

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
  for (const role of REQUIRED_ROLES) {
    if (!parsed[role]?.email || !parsed[role]?.password) {
      throw new Error(
        `[E2E] e2e/.credentials.json is missing or incomplete for role "${role}".\n` +
        `Re-run the seed: DATABASE_URL=... npx tsx scripts/seed-e2e-db.ts`
      );
    }
  }

  return parsed as CredentialsMap;
}

let loaded: CredentialsMap | null = null;

function credentials(): CredentialsMap {
  if (loaded === null) loaded = loadCredentials();
  return loaded;
}

/**
 * Loaded credentials — read once, on first access rather than on import.
 *
 * Importing a spec is not the same act as running it: `playwright test --list`
 * imports every spec to enumerate them, and an import-time read made listing
 * impossible without a seeded database. Enumerating the suite is exactly what
 * `scripts/testing/check-ci-test-lane-coverage.mjs` must do to prove no spec
 * sits outside every lane, so listing must not require secrets.
 *
 * The guard itself is unchanged: the first property read still fails closed
 * when the seed has not written `e2e/.credentials.json`.
 */
export const CREDS: CredentialsMap = Object.defineProperties(
  {} as CredentialsMap,
  Object.fromEntries(
    REQUIRED_ROLES.map((role) => [role, { enumerable: true, get: () => credentials()[role] }]),
  ),
);

/** Convenience getter */
export function getCred(role: CredRole): Credential {
  const cred = CREDS[role];
  if (!cred) {
    throw new Error(`[E2E] No credentials for role "${role}" in e2e/.credentials.json`);
  }
  return cred;
}
