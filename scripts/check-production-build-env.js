const fs = require('node:fs');
const path = require('node:path');

const mode = process.argv.includes('--mode=e2e') ? 'e2e' : 'production';

// Rules that apply in ALL modes (including e2e).
const universalForbidden = [
  ['CANONICAL_BILANS_TEST_PACK', (value) => value === 'true'],
  ['CANONICAL_BILANS_E2E_PACK_PATH', (value) => Boolean(value)],
];

// Rules that apply only in production mode.
const productionForbidden = [
  ['APP_ENV', (value) => value === 'e2e'],
  ['DATABASE_URL', (value) => /\/(nexus_e2e)(?:\?|$)/.test(value ?? '')],
];

const forbidden = mode === 'e2e'
  ? universalForbidden
  : [...universalForbidden, ...productionForbidden];

function inspect(values, source) {
  for (const [key, forbiddenValue] of forbidden) {
    if (forbiddenValue(values[key])) throw new Error(`BUILD_ENV_FORBIDDEN:${source}:${key} (mode=${mode})`);
  }
}

// Always check: real .env files must not contain forbidden values.
const envFiles = mode === 'e2e'
  ? ['.env', '.env.local']
  : ['.env', '.env.local', '.env.production', '.env.production.local'];

inspect(process.env, 'process');
for (const file of envFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) continue;
  const values = Object.fromEntries(fs.readFileSync(fullPath, 'utf8').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }));
  inspect(values, file);
}
console.log(`BUILD_ENV_CHECK=PASS (mode=${mode})`);
