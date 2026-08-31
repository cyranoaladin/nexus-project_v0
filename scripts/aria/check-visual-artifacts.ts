import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const PROJECT = 'aria-mobile';
const VIEWPORTS = Object.freeze([
  { id: '390x844', width: 390, height: 844, qualificationId: 'E018' },
  { id: '768x1024', width: 768, height: 1024, qualificationId: 'E019' },
  { id: '1366x768', width: 1366, height: 768, qualificationId: 'E020' },
  { id: '1440x900', width: 1440, height: 900, qualificationId: 'E021' },
] as const);
const STATES = Object.freeze([
  'ready',
  'streaming',
  'citations-visible',
  'history-loaded',
  'feedback-submitted',
  'rag-unavailable',
  'timeout-error',
  'course-unavailable',
] as const);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const CRC_TABLE = Object.freeze(Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) !== 0
    ? 0xedb88320 ^ (crc >>> 1)
    : crc >>> 1;
  return crc >>> 0;
}));

type VisualState = (typeof STATES)[number];

export interface AriaVisualEvidenceItem {
  readonly name: string;
  readonly qualificationId: string;
  readonly viewportId: string;
  readonly state: VisualState;
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface AriaVisualEvidence {
  readonly schemaVersion: 1;
  readonly headSha: string;
  readonly project: typeof PROJECT;
  readonly reportSha256: string;
  readonly viewports: readonly Readonly<{ id: string; width: number; height: number }>[];
  readonly states: readonly VisualState[];
  readonly evidenceCount: 32;
  readonly evidence: readonly AriaVisualEvidenceItem[];
}

interface QualifyOptions {
  readonly repositoryRoot?: string;
  readonly expectedHeadSha?: string;
  readonly mode: 'write' | 'check';
}

interface PlaywrightAttachment {
  readonly name?: unknown;
  readonly contentType?: unknown;
  readonly body?: unknown;
}

interface PlaywrightSpec {
  readonly title?: unknown;
  readonly file?: unknown;
  readonly ok?: unknown;
  readonly tests?: unknown;
}

function fail(reason: string): never {
  throw new Error(`ARIA_VISUAL_EVIDENCE_INVALID:${reason}`);
}

function crc32(value: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of value) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function currentHead(repositoryRoot: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim();
}

function assertContainedArtifactRoot(repositoryRoot: string, artifactRoot: string): void {
  if (!existsSync(artifactRoot)) fail('ARTIFACT_ROOT_MISSING');
  if (lstatSync(artifactRoot).isSymbolicLink()) fail('ARTIFACT_ROOT_SYMLINK');
  const repositoryRealPath = realpathSync(repositoryRoot);
  const artifactRealPath = realpathSync(artifactRoot);
  const location = relative(repositoryRealPath, artifactRealPath);
  if (location === '..' || location.startsWith(`..${sep}`) || isAbsolute(location)) {
    fail('ARTIFACT_ROOT_PATH');
  }
}

function readRegularFile(path: string, label: string): Buffer {
  if (!existsSync(path)) fail(`${label}_MISSING`);
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink()) fail(`${label}_SYMLINK`);
  if (!metadata.isFile()) fail(`${label}_FILE`);
  return readFileSync(path);
}

function parseJson(value: Buffer, label: string): unknown {
  try {
    return JSON.parse(value.toString('utf8')) as unknown;
  } catch {
    return fail(`${label}_JSON`);
  }
}

function collectSpecs(document: unknown): readonly PlaywrightSpec[] {
  if (typeof document !== 'object' || document === null) fail('REPORT_SCHEMA');
  const report = document as { readonly stats?: unknown; readonly suites?: unknown };
  if (typeof report.stats !== 'object' || report.stats === null) fail('REPORT_STATS');
  const stats = report.stats as Record<string, unknown>;
  if (stats.expected !== 4 || stats.skipped !== 0 || stats.unexpected !== 0 || stats.flaky !== 0) {
    fail('REPORT_STATS');
  }
  if (!Array.isArray(report.suites)) fail('REPORT_SUITES');
  const specs: PlaywrightSpec[] = [];
  const visit = (value: unknown): void => {
    if (typeof value !== 'object' || value === null) fail('REPORT_SUITE');
    const suite = value as { readonly specs?: unknown; readonly suites?: unknown };
    if (suite.specs !== undefined && !Array.isArray(suite.specs)) fail('REPORT_SPECS');
    for (const spec of suite.specs ?? []) {
      if (typeof spec !== 'object' || spec === null) fail('REPORT_SPEC');
      specs.push(spec as PlaywrightSpec);
    }
    if (suite.suites !== undefined && !Array.isArray(suite.suites)) fail('REPORT_SUITES');
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites) visit(suite);
  return Object.freeze(specs);
}

function qualificationId(spec: PlaywrightSpec): string {
  if (typeof spec.title !== 'string') fail('SPEC_TITLE');
  const ids = spec.title.match(/\bE\d{3}\b/g) ?? [];
  if (ids.length !== 1) fail('SPEC_QUALIFICATION_ID');
  return ids[0]!;
}

function strictAttachments(spec: PlaywrightSpec, id: string): readonly PlaywrightAttachment[] {
  if (spec.ok !== true || typeof spec.file !== 'string'
    || !spec.file.endsWith('visual-a11y.spec.ts')) fail(`SPEC:${id}`);
  if (!Array.isArray(spec.tests) || spec.tests.length !== 1) fail(`TEST_COUNT:${id}`);
  const test = spec.tests[0];
  if (typeof test !== 'object' || test === null) fail(`TEST:${id}`);
  const item = test as {
    readonly projectName?: unknown;
    readonly expectedStatus?: unknown;
    readonly status?: unknown;
    readonly results?: unknown;
  };
  if (item.projectName !== PROJECT) fail(`PROJECT:${id}`);
  if (item.expectedStatus !== 'passed' || item.status !== 'expected') fail(`TEST_STATUS:${id}`);
  if (!Array.isArray(item.results) || item.results.length !== 1) fail(`RESULT_COUNT:${id}`);
  const result = item.results[0];
  if (typeof result !== 'object' || result === null) fail(`RESULT:${id}`);
  const execution = result as {
    readonly status?: unknown;
    readonly retry?: unknown;
    readonly attachments?: unknown;
  };
  if (execution.retry !== 0) fail(`RETRY:${id}`);
  if (execution.status !== 'passed') fail(`RESULT_STATUS:${id}`);
  if (!Array.isArray(execution.attachments)) fail(`ATTACHMENTS:${id}`);
  return execution.attachments.map((attachment) => {
    if (typeof attachment !== 'object' || attachment === null) fail(`ATTACHMENT:${id}`);
    return attachment as PlaywrightAttachment;
  });
}

function decodeBody(attachment: PlaywrightAttachment, name: string): Buffer {
  if (attachment.contentType !== 'image/png') fail(`CONTENT_TYPE:${name}`);
  if (typeof attachment.body !== 'string' || attachment.body.length === 0
    || attachment.body.length % 4 !== 0 || !BASE64.test(attachment.body)) {
    fail(`ATTACHMENT_BODY:${name}`);
  }
  const value = Buffer.from(attachment.body, 'base64');
  if (value.toString('base64') !== attachment.body) fail(`ATTACHMENT_BODY:${name}`);
  return value;
}

function pngDimensions(value: Buffer): Readonly<{ width: number; height: number }> {
  if (value.length < PNG_SIGNATURE.length || !value.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail(value.length < PNG_SIGNATURE.length ? 'PNG_TRUNCATED' : 'PNG_SIGNATURE');
  }
  let offset = PNG_SIGNATURE.length;
  let chunkIndex = 0;
  let width = 0;
  let height = 0;
  let sawData = false;
  let sawEnd = false;
  while (offset < value.length) {
    if (value.length - offset < 12) fail('PNG_TRUNCATED');
    const length = value.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > value.length) fail('PNG_TRUNCATED');
    const type = value.toString('ascii', offset + 4, offset + 8);
    const data = value.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = value.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(value.subarray(offset + 4, offset + 8 + length));
    if (actualCrc !== expectedCrc) fail('PNG_CRC');
    if (chunkIndex === 0) {
      if (type !== 'IHDR' || length !== 13) fail('PNG_IHDR');
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (width === 0 || height === 0) fail('PNG_DIMENSIONS');
    } else if (type === 'IHDR') {
      fail('PNG_IHDR');
    }
    if (type === 'IDAT') sawData = true;
    if (type === 'IEND') {
      if (length !== 0 || !sawData || end !== value.length) fail('PNG_IEND');
      sawEnd = true;
    } else if (sawEnd) {
      fail('PNG_IEND');
    }
    offset = end;
    chunkIndex += 1;
  }
  if (!sawEnd) fail('PNG_TRUNCATED');
  return Object.freeze({ width, height });
}

function buildEvidence(
  headSha: string,
  reportSha256: string,
  specs: readonly PlaywrightSpec[],
): AriaVisualEvidence {
  const expectedIds = VIEWPORTS.map(({ qualificationId: id }) => id);
  const byId = new Map<string, PlaywrightSpec>();
  for (const spec of specs) {
    const id = qualificationId(spec);
    if (!expectedIds.includes(id as (typeof expectedIds)[number])) fail(`UNEXPECTED_SPEC:${id}`);
    if (byId.has(id)) fail(`DUPLICATE_SPEC:${id}`);
    byId.set(id, spec);
  }
  const missingSpecs = expectedIds.filter((id) => !byId.has(id));
  if (missingSpecs.length > 0) fail(`MISSING_SPEC:${missingSpecs.join(',')}`);
  if (byId.size !== VIEWPORTS.length) fail('SPEC_COUNT');

  const evidence: AriaVisualEvidenceItem[] = [];
  for (const viewport of VIEWPORTS) {
    const attachments = strictAttachments(byId.get(viewport.qualificationId)!, viewport.qualificationId);
    const expectedNames = STATES.map((state) => `aria-${viewport.id}-${state}`);
    const names = attachments.map(({ name }) => typeof name === 'string' ? name : '');
    const unexpected = names.filter((name) => !expectedNames.includes(name));
    if (unexpected.length > 0) {
      const crossViewport = unexpected.some((name) =>
        VIEWPORTS.some(({ id }) => id !== viewport.id && name.startsWith(`aria-${id}-`)));
      fail(`${crossViewport ? 'ATTACHMENT_BINDING' : 'UNEXPECTED'}:${viewport.qualificationId}`);
    }
    const duplicate = expectedNames.find((name) => names.filter((candidate) => candidate === name).length > 1);
    if (duplicate) fail(`DUPLICATE:${duplicate}`);
    const missing = expectedNames.find((name) => !names.includes(name));
    if (missing) fail(`MISSING:${missing}`);
    const byName = new Map(attachments.map((attachment) => [String(attachment.name), attachment]));
    for (const state of STATES) {
      const name = `aria-${viewport.id}-${state}`;
      const value = decodeBody(byName.get(name)!, name);
      const dimensions = pngDimensions(value);
      if (dimensions.width !== viewport.width || dimensions.height !== viewport.height) {
        fail(`DIMENSIONS:${name}:${dimensions.width}x${dimensions.height}`);
      }
      evidence.push(Object.freeze({
        name,
        qualificationId: viewport.qualificationId,
        viewportId: viewport.id,
        state,
        width: dimensions.width,
        height: dimensions.height,
        byteLength: value.length,
        sha256: createHash('sha256').update(value).digest('hex'),
      }));
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    headSha,
    project: PROJECT,
    reportSha256,
    viewports: Object.freeze(VIEWPORTS.map(({ id, width, height }) => Object.freeze({ id, width, height }))),
    states: STATES,
    evidenceCount: 32,
    evidence: Object.freeze(evidence),
  });
}

export function qualifyAriaVisualArtifacts(options: QualifyOptions): AriaVisualEvidence {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const expectedHeadSha = options.expectedHeadSha ?? currentHead(repositoryRoot);
  if (!/^[0-9a-f]{40}$/.test(expectedHeadSha)) fail('EXPECTED_HEAD');
  const artifactRoot = resolve(repositoryRoot, `.artifacts/aria/playwright/${PROJECT}`);
  assertContainedArtifactRoot(repositoryRoot, artifactRoot);
  const artifactHead = readRegularFile(resolve(artifactRoot, 'head.sha'), 'HEAD').toString('utf8').trim();
  if (artifactHead !== expectedHeadSha) fail('STALE_HEAD');
  const reportValue = readRegularFile(resolve(artifactRoot, 'report.json'), 'REPORT');
  const manifest = buildEvidence(
    expectedHeadSha,
    createHash('sha256').update(reportValue).digest('hex'),
    collectSpecs(parseJson(reportValue, 'REPORT')),
  );
  const manifestPath = resolve(artifactRoot, 'visual-evidence.json');
  if (options.mode === 'check') {
    const sealed = parseJson(readRegularFile(manifestPath, 'SEALED_MANIFEST'), 'SEALED_MANIFEST');
    if (!isDeepStrictEqual(sealed, manifest)) fail('SEALED_MANIFEST_MISMATCH');
    return manifest;
  }
  if (existsSync(manifestPath) && lstatSync(manifestPath).isSymbolicLink()) {
    fail('SEALED_MANIFEST_SYMLINK');
  }
  const temporaryPath = `${manifestPath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  renameSync(temporaryPath, manifestPath);
  return manifest;
}

if (require.main === module) {
  const mode = process.argv.slice(2).includes('--check') ? 'check' : 'write';
  const result = qualifyAriaVisualArtifacts({ mode });
  process.stdout.write('ARIA_CHAT_VISUAL_QA=PASS\n');
  process.stdout.write(`ARIA_VISUAL_EVIDENCE_HEAD=${result.headSha}\n`);
  process.stdout.write(`ARIA_VISUAL_EVIDENCE_COUNT=${result.evidenceCount}\n`);
}
