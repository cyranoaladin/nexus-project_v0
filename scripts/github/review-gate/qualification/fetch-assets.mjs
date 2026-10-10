import { readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadVerified } from './download.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, 'models.json'), 'utf8'));
const candidate = manifest.candidates.find((item) => item.id === process.argv[2]);
const temp = resolve(process.env.REVIEW_GATE_TEMP ?? '.');
const runnerTemp = resolve(process.env.RUNNER_TEMP ?? '.');
if (!candidate || !temp.startsWith(`${runnerTemp}${sep}`) ||
    !Number.isSafeInteger(candidate.sizeBytes) || candidate.sizeBytes < 1) {
  throw new Error('MODEL_ASSET_CONFIG_INVALID');
}
const runtime = await downloadVerified({ url: manifest.runtime.archiveUrl,
  sha256: manifest.runtime.archiveSha256, sizeBytes: manifest.runtime.sizeBytes,
  destination: join(temp, 'runtime.tar.gz') });
const model = await downloadVerified({ url: candidate.url, sha256: candidate.sha256,
  sizeBytes: candidate.sizeBytes, destination: join(temp, 'model.gguf') });
process.stdout.write(`${JSON.stringify({ runtimeSha256: runtime.sha256,
  modelSha256: model.sha256, modelId: candidate.id })}\n`);
