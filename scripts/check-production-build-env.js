const fs = require('node:fs');
const path = require('node:path');

const forbidden = [
  ['APP_ENV', (value) => value === 'e2e'],
  ['CANONICAL_BILANS_TEST_PACK', (value) => value === 'true'],
  ['CANONICAL_BILANS_E2E_PACK_PATH', (value) => Boolean(value)],
  ['DATABASE_URL', (value) => /\/(nexus_e2e)(?:\?|$)/.test(value ?? '')],
];

function inspect(values, source) {
  for (const [key, forbiddenValue] of forbidden) {
    if (forbiddenValue(values[key])) throw new Error(`PRODUCTION_BUILD_E2E_ENV_FORBIDDEN:${source}:${key}`);
  }
}

inspect(process.env, 'process');
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) continue;
  const values = Object.fromEntries(fs.readFileSync(fullPath, 'utf8').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }));
  inspect(values, file);
}
console.log('PRODUCTION_BUILD_ENV=PASS');
