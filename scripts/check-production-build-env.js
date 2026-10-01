const fs = require('node:fs');
const path = require('node:path');
const { validateVideoDispatch } = require('./release/preview-artifact-builder-guards.js');

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
// Lowest to highest file precedence, matching Next production dotenv loading.
// process.env is applied last below and always wins.
const envFiles = mode === 'e2e'
  ? ['.env', '.env.local']
  : ['.env', '.env.production', '.env.local', '.env.production.local'];

inspect(process.env, 'process');
const fileValues = {};
for (const file of envFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) continue;
  const values = Object.fromEntries(fs.readFileSync(fullPath, 'utf8').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }));
  inspect(values, file);
  Object.assign(fileValues, values);
}
// Next loads dotenv before compiling NEXT_PUBLIC_* constants. Process values
// take precedence; the build guard must validate that same effective input.
const effective = { ...fileValues, ...process.env };
const videoMode = effective.NEXT_PUBLIC_VIDEO_MODE;
const jitsiUrl = effective.NEXT_PUBLIC_JITSI_SERVER_URL;
const disposableE2eFixture = mode === 'e2e'
  && videoMode === 'JITSI'
  && jitsiUrl === 'https://jitsi-ci.nexus-e2e.test';
// The absent mode is the previous production build contract. It still needs
// an URL and is JITSI at runtime, but was not a Preview dispatch choice.
const videoErrors = videoMode === undefined
  ? (jitsiUrl ? [] : ['LEGACY_JITSI_URL_REQUIRED'])
  : disposableE2eFixture ? [] : validateVideoDispatch(videoMode, jitsiUrl);
if (videoErrors.length) throw new Error(`BUILD_VIDEO_CONFIG_INVALID:${videoErrors.join(',')}`);
console.log(`BUILD_ENV_CHECK=PASS (mode=${mode})`);
