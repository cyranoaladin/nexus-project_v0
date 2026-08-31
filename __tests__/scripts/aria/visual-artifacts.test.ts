import { deflateSync } from 'node:zlib';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  qualifyAriaVisualArtifacts,
  type AriaVisualEvidence,
} from '@/scripts/aria/check-visual-artifacts';

const HEAD_SHA = 'a'.repeat(40);
const VIEWPORTS = [
  { id: '390x844', width: 390, height: 844, qualificationId: 'E018' },
  { id: '768x1024', width: 768, height: 1024, qualificationId: 'E019' },
  { id: '1366x768', width: 1366, height: 768, qualificationId: 'E020' },
  { id: '1440x900', width: 1440, height: 900, qualificationId: 'E021' },
] as const;
const STATES = [
  'ready',
  'streaming',
  'citations-visible',
  'history-loaded',
  'feedback-submitted',
  'rag-unavailable',
  'timeout-error',
  'course-unavailable',
] as const;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

interface AttachmentFixture {
  name: string;
  contentType: string;
  body: string;
}

interface Fixture {
  root: string;
  artifactRoot: string;
  attachments: Map<string, AttachmentFixture[]>;
}

interface MutableReport {
  stats: { expected: number; skipped: number; unexpected: number; flaky: number };
  suites: Array<{
    suites: Array<{
      specs: Array<{
        title: string;
        file: string;
        ok: boolean;
        tests: Array<{
          expectedStatus: string;
          projectName: string;
          status: string;
          results: Array<{
            status: string;
            retry: number;
            attachments: readonly AttachmentFixture[];
          }>;
        }>;
      }>;
    }>;
  }>;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) !== 0
    ? 0xedb88320 ^ (crc >>> 1)
    : crc >>> 1;
  return crc >>> 0;
});

function crc32(value: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of value) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const value = Buffer.alloc(12 + data.length);
  value.writeUInt32BE(data.length, 0);
  typeBuffer.copy(value, 4);
  data.copy(value, 8);
  value.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return value;
}

const PNG_CACHE = new Map<string, Buffer>();
function png(width: number, height: number): Buffer {
  const key = `${width}x${height}`;
  const cached = PNG_CACHE.get(key);
  if (cached) return cached;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  const value = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  PNG_CACHE.set(key, value);
  return value;
}

function write(root: string, path: string, value: string | Buffer): void {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value);
}

function report(attachments: ReadonlyMap<string, readonly AttachmentFixture[]>): MutableReport {
  return {
    stats: { expected: 4, skipped: 0, unexpected: 0, flaky: 0 },
    suites: [{
      suites: [{
        specs: VIEWPORTS.map((viewport) => ({
          title: `${viewport.qualificationId} ARIA_VISUAL_VIEWPORT_MATRIX @visual — ${viewport.id}`,
          file: 'visual-a11y.spec.ts',
          ok: true,
          tests: [{
            expectedStatus: 'passed',
            projectName: 'aria-mobile',
            status: 'expected',
            results: [{
              status: 'passed',
              retry: 0,
              attachments: attachments.get(viewport.qualificationId) ?? [],
            }],
          }],
        })),
      }],
    }],
  };
}

function fixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'aria-visual-evidence-'));
  const artifactRoot = join(root, '.artifacts/aria/playwright/aria-mobile');
  const attachments = new Map(VIEWPORTS.map((viewport) => [
    viewport.qualificationId,
    STATES.map((state) => ({
      name: `aria-${viewport.id}-${state}`,
      contentType: 'image/png',
      body: png(viewport.width, viewport.height).toString('base64'),
    })),
  ]));
  write(artifactRoot, 'head.sha', `${HEAD_SHA}\n`);
  write(artifactRoot, 'report.json', JSON.stringify(report(attachments)));
  return { root, artifactRoot, attachments };
}

function writeReport(setup: Fixture): void {
  write(setup.artifactRoot, 'report.json', JSON.stringify(report(setup.attachments)));
}

function writeMalformedReport(setup: Fixture, document: unknown): void {
  write(setup.artifactRoot, 'report.json', JSON.stringify(document));
}

function replaceFirstBody(setup: Fixture, value: Buffer | string): void {
  setup.attachments.get('E018')![0]!.body = typeof value === 'string'
    ? value
    : value.toString('base64');
  writeReport(setup);
}

function pngFromChunks(...chunks: readonly Buffer[]): Buffer {
  return Buffer.concat([PNG_SIGNATURE, ...chunks]);
}

describe('ARIA visual artifact qualification', () => {
  it('ARIA_VISUAL_ARTIFACT_MANIFEST_IS_EXACT_HEAD_BOUND_32_STATE_MATRIX', () => {
    const setup = fixture();
    const result = qualifyAriaVisualArtifacts({
      repositoryRoot: setup.root,
      expectedHeadSha: HEAD_SHA,
      mode: 'write',
    });

    expect(result).toMatchObject({
      schemaVersion: 1,
      headSha: HEAD_SHA,
      project: 'aria-mobile',
      evidenceCount: 32,
      viewports: VIEWPORTS.map(({ id, width, height }) => ({ id, width, height })),
      states: STATES,
    });
    expect(result.evidence).toHaveLength(32);
    expect(new Set(result.evidence.map(({ name }) => name)).size).toBe(32);
    expect(result.reportSha256).toMatch(/^[0-9a-f]{64}$/);
    const persisted = JSON.parse(
      readFileSync(join(setup.artifactRoot, 'visual-evidence.json'), 'utf8'),
    ) as AriaVisualEvidence;
    expect(persisted).toEqual(result);
    expect(qualifyAriaVisualArtifacts({
      repositoryRoot: setup.root,
      expectedHeadSha: HEAD_SHA,
      mode: 'check',
    })).toEqual(result);
  });

  it.each([
    ['stale head', (setup: Fixture) => {
      write(setup.artifactRoot, 'head.sha', `${'0'.repeat(40)}\n`);
    }, 'STALE_HEAD'],
    ['missing state', (setup: Fixture) => {
      setup.attachments.get('E018')!.shift();
      writeReport(setup);
    }, 'MISSING'],
    ['duplicate state', (setup: Fixture) => {
      setup.attachments.get('E018')!.push(setup.attachments.get('E018')![0]!);
      writeReport(setup);
    }, 'DUPLICATE'],
    ['unknown state', (setup: Fixture) => {
      setup.attachments.get('E018')!.push({
        ...setup.attachments.get('E018')![0]!, name: 'aria-390x844-unreviewed',
      });
      writeReport(setup);
    }, 'UNEXPECTED'],
    ['wrong MIME', (setup: Fixture) => {
      setup.attachments.get('E018')![0]!.contentType = 'application/octet-stream';
      writeReport(setup);
    }, 'CONTENT_TYPE'],
  ])('fails closed on %s', (_label, mutate, reason) => {
    const setup = fixture();
    mutate(setup);
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: setup.root,
      expectedHeadSha: HEAD_SHA,
      mode: 'write',
    })).toThrow(`ARIA_VISUAL_EVIDENCE_INVALID:${reason}`);
  });

  it.each([
    ['wrong project', (document: MutableReport) => { document.suites[0]!.suites[0]!.specs[0]!.tests[0]!.projectName = 'aria-desktop'; }, 'PROJECT'],
    ['flaky retry', (document: MutableReport) => { document.suites[0]!.suites[0]!.specs[0]!.tests[0]!.results[0]!.retry = 1; }, 'RETRY'],
    ['failed result', (document: MutableReport) => { document.suites[0]!.suites[0]!.specs[0]!.tests[0]!.results[0]!.status = 'failed'; }, 'RESULT_STATUS'],
    ['unexpected outcome', (document: MutableReport) => { document.suites[0]!.suites[0]!.specs[0]!.tests[0]!.status = 'unexpected'; }, 'TEST_STATUS'],
    ['wrong statistics', (document: MutableReport) => { document.stats.flaky = 1; }, 'REPORT_STATS'],
    ['wrong viewport binding', (document: MutableReport) => {
      const specs = document.suites[0].suites[0].specs;
      specs[0].tests[0].results[0].attachments = specs[1].tests[0].results[0].attachments;
    }, 'ATTACHMENT_BINDING'],
  ])('rejects non-qualified Playwright topology: %s', (_label, mutate, reason) => {
    const setup = fixture();
    const document = report(setup.attachments);
    mutate(document);
    write(setup.artifactRoot, 'report.json', JSON.stringify(document));
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: setup.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    })).toThrow(`ARIA_VISUAL_EVIDENCE_INVALID:${reason}`);
  });

  it('rejects malformed base64, truncated PNG, invalid CRC and wrong dimensions', () => {
    const malformedBase64 = fixture();
    malformedBase64.attachments.get('E018')![0]!.body = '**not-base64**';
    writeReport(malformedBase64);
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: malformedBase64.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    })).toThrow('ARIA_VISUAL_EVIDENCE_INVALID:ATTACHMENT_BODY');

    const truncated = fixture();
    truncated.attachments.get('E018')![0]!.body = png(390, 844).subarray(0, 33).toString('base64');
    writeReport(truncated);
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: truncated.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    })).toThrow('ARIA_VISUAL_EVIDENCE_INVALID:PNG_TRUNCATED');

    const invalidCrc = fixture();
    const corrupted = Buffer.from(png(390, 844));
    corrupted[29] = corrupted[29]! ^ 1;
    invalidCrc.attachments.get('E018')![0]!.body = corrupted.toString('base64');
    writeReport(invalidCrc);
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: invalidCrc.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    })).toThrow('ARIA_VISUAL_EVIDENCE_INVALID:PNG_CRC');

    const wrongSize = fixture();
    wrongSize.attachments.get('E018')![0]!.body = png(391, 844).toString('base64');
    writeReport(wrongSize);
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: wrongSize.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    })).toThrow('ARIA_VISUAL_EVIDENCE_INVALID:DIMENSIONS');
  });

  it.each([
    ['missing artifact root', (setup: Fixture) => {
      unlinkSync(join(setup.artifactRoot, 'head.sha'));
      unlinkSync(join(setup.artifactRoot, 'report.json'));
      rmdirSync(setup.artifactRoot);
    }, 'ARTIFACT_ROOT_MISSING'],
    ['symlinked artifact root', (setup: Fixture) => {
      const target = mkdtempSync(join(tmpdir(), 'aria-visual-target-'));
      unlinkSync(join(setup.artifactRoot, 'head.sha'));
      unlinkSync(join(setup.artifactRoot, 'report.json'));
      rmdirSync(setup.artifactRoot);
      symlinkSync(target, setup.artifactRoot, 'dir');
    }, 'ARTIFACT_ROOT_SYMLINK'],
    ['artifact root escaped through a parent symlink', (setup: Fixture) => {
      const target = mkdtempSync(join(tmpdir(), 'aria-visual-outside-'));
      const artifacts = join(setup.root, '.artifacts');
      rmSync(artifacts, { recursive: true });
      mkdirSync(join(target, 'aria/playwright/aria-mobile'), { recursive: true });
      symlinkSync(target, artifacts, 'dir');
    }, 'ARTIFACT_ROOT_PATH'],
  ])('rejects an unsafe artifact location: %s', (_label, mutate, reason) => {
    const setup = fixture();
    mutate(setup);
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: setup.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    })).toThrow(`ARIA_VISUAL_EVIDENCE_INVALID:${reason}`);
  });

  it.each([
    ['head is not a regular file', (setup: Fixture) => {
      unlinkSync(join(setup.artifactRoot, 'head.sha'));
      mkdirSync(join(setup.artifactRoot, 'head.sha'));
    }, 'HEAD_FILE'],
    ['report is missing', (setup: Fixture) => {
      unlinkSync(join(setup.artifactRoot, 'report.json'));
    }, 'REPORT_MISSING'],
    ['report is a symlink', (setup: Fixture) => {
      const path = join(setup.artifactRoot, 'report.json');
      const target = join(setup.root, 'outside-report.json');
      write(setup.root, 'outside-report.json', '{}');
      unlinkSync(path);
      symlinkSync(target, path);
    }, 'REPORT_SYMLINK'],
    ['report is not a regular file', (setup: Fixture) => {
      const path = join(setup.artifactRoot, 'report.json');
      unlinkSync(path);
      mkdirSync(path);
    }, 'REPORT_FILE'],
    ['report is invalid JSON', (setup: Fixture) => {
      write(setup.artifactRoot, 'report.json', '{');
    }, 'REPORT_JSON'],
  ])('rejects an invalid control file: %s', (_label, mutate, reason) => {
    const setup = fixture();
    mutate(setup);
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: setup.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    })).toThrow(`ARIA_VISUAL_EVIDENCE_INVALID:${reason}`);
  });

  it.each([
    ['null report', () => null, 'REPORT_SCHEMA'],
    ['missing stats', (document: MutableReport) => ({ suites: document.suites }), 'REPORT_STATS'],
    ['non-array root suites', (document: MutableReport) => ({ ...document, suites: null }), 'REPORT_SUITES'],
    ['null suite', (document: MutableReport) => ({ ...document, suites: [null] }), 'REPORT_SUITE'],
    ['non-array specs', (document: MutableReport) => ({
      ...document,
      suites: [{ ...document.suites[0], specs: null }],
    }), 'REPORT_SPECS'],
    ['null spec', (document: MutableReport) => ({
      ...document,
      suites: [{ suites: [{ specs: [null] }] }],
    }), 'REPORT_SPEC'],
    ['non-array nested suites', (document: MutableReport) => ({
      ...document,
      suites: [{ suites: null }],
    }), 'REPORT_SUITES'],
  ])('rejects a malformed Playwright report schema: %s', (_label, mutate, reason) => {
    const setup = fixture();
    writeMalformedReport(setup, mutate(report(setup.attachments)));
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: setup.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    })).toThrow(`ARIA_VISUAL_EVIDENCE_INVALID:${reason}`);
  });

  it.each([
    ['non-string title', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[0]!.title = 42 as unknown as string;
    }, 'SPEC_TITLE'],
    ['missing qualification id', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[0]!.title = 'ARIA visual matrix';
    }, 'SPEC_QUALIFICATION_ID'],
    ['multiple qualification ids', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[0]!.title = 'E018 and E019';
    }, 'SPEC_QUALIFICATION_ID'],
    ['unknown qualification id', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[0]!.title = 'E999 ARIA visual matrix';
    }, 'UNEXPECTED_SPEC'],
    ['duplicate qualification id', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[1]!.title = 'E018 duplicate';
    }, 'DUPLICATE_SPEC'],
    ['missing qualification spec', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs.pop();
    }, 'MISSING_SPEC'],
    ['invalid spec topology', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[0]!.ok = false;
    }, 'SPEC'],
    ['invalid test count', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[0]!.tests = [];
    }, 'TEST_COUNT'],
    ['invalid test item', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[0]!.tests = [null as never];
    }, 'TEST'],
    ['invalid result count', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[0]!.tests[0]!.results = [];
    }, 'RESULT_COUNT'],
    ['invalid result item', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[0]!.tests[0]!.results = [null as never];
    }, 'RESULT'],
    ['invalid attachments container', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[0]!.tests[0]!.results[0]!.attachments = null as never;
    }, 'ATTACHMENTS'],
    ['invalid attachment item', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[0]!.tests[0]!.results[0]!.attachments = [null as never];
    }, 'ATTACHMENT'],
    ['non-string attachment name', (document: MutableReport) => {
      document.suites[0]!.suites[0]!.specs[0]!.tests[0]!.results[0]!.attachments[0]!.name = 42 as unknown as string;
    }, 'UNEXPECTED'],
  ])('rejects an invalid visual test topology: %s', (_label, mutate, reason) => {
    const setup = fixture();
    const document = report(setup.attachments);
    mutate(document);
    writeMalformedReport(setup, document);
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: setup.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    })).toThrow(`ARIA_VISUAL_EVIDENCE_INVALID:${reason}`);
  });

  it.each([
    ['non-canonical base64', 'AB==', 'ATTACHMENT_BODY'],
    ['short signature', Buffer.from([137, 80, 78]), 'PNG_TRUNCATED'],
    ['invalid signature', Buffer.alloc(8), 'PNG_SIGNATURE'],
    ['truncated chunk header', Buffer.concat([PNG_SIGNATURE, Buffer.alloc(4)]), 'PNG_TRUNCATED'],
    ['oversized chunk', (() => {
      const value = Buffer.alloc(12);
      value.writeUInt32BE(100, 0);
      return Buffer.concat([PNG_SIGNATURE, value]);
    })(), 'PNG_TRUNCATED'],
    ['first chunk is not IHDR', pngFromChunks(chunk('IDAT', Buffer.alloc(13))), 'PNG_IHDR'],
    ['zero dimensions', pngFromChunks(
      chunk('IHDR', Buffer.alloc(13)), chunk('IDAT', Buffer.alloc(0)), chunk('IEND', Buffer.alloc(0)),
    ), 'PNG_DIMENSIONS'],
    ['duplicate IHDR', (() => {
      const header = Buffer.alloc(13);
      header.writeUInt32BE(390, 0);
      header.writeUInt32BE(844, 4);
      return pngFromChunks(chunk('IHDR', header), chunk('IHDR', header));
    })(), 'PNG_IHDR'],
    ['IEND without IDAT', (() => {
      const header = Buffer.alloc(13);
      header.writeUInt32BE(390, 0);
      header.writeUInt32BE(844, 4);
      return pngFromChunks(chunk('IHDR', header), chunk('IEND', Buffer.alloc(0)));
    })(), 'PNG_IEND'],
    ['non-empty IEND', (() => {
      const header = Buffer.alloc(13);
      header.writeUInt32BE(390, 0);
      header.writeUInt32BE(844, 4);
      return pngFromChunks(chunk('IHDR', header), chunk('IDAT', Buffer.alloc(0)), chunk('IEND', Buffer.from([0])));
    })(), 'PNG_IEND'],
    ['missing IEND', (() => {
      const header = Buffer.alloc(13);
      header.writeUInt32BE(390, 0);
      header.writeUInt32BE(844, 4);
      return pngFromChunks(chunk('IHDR', header), chunk('IDAT', Buffer.alloc(0)));
    })(), 'PNG_TRUNCATED'],
  ])('rejects malformed image evidence: %s', (_label, body, reason) => {
    const setup = fixture();
    replaceFirstBody(setup, body);
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: setup.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    })).toThrow(`ARIA_VISUAL_EVIDENCE_INVALID:${reason}`);
  });

  it('rejects an invalid expected head and a symlinked sealed manifest', () => {
    const invalidHead = fixture();
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: invalidHead.root, expectedHeadSha: 'not-a-sha', mode: 'write',
    })).toThrow('ARIA_VISUAL_EVIDENCE_INVALID:EXPECTED_HEAD');

    const symlink = fixture();
    const manifestPath = join(symlink.artifactRoot, 'visual-evidence.json');
    const target = join(symlink.root, 'outside-manifest.json');
    write(symlink.root, 'outside-manifest.json', '{}');
    symlinkSync(target, manifestPath);
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: symlink.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    })).toThrow('ARIA_VISUAL_EVIDENCE_INVALID:SEALED_MANIFEST_SYMLINK');
  });

  it('rejects symlinked control files and a missing or modified sealed manifest', () => {
    const symlink = fixture();
    const realHead = join(symlink.root, 'real-head.sha');
    write(symlink.root, 'real-head.sha', `${HEAD_SHA}\n`);
    const headPath = join(symlink.artifactRoot, 'head.sha');
    writeFileSync(headPath, '');
    unlinkSync(headPath);
    symlinkSync(realHead, headPath);
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: symlink.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    })).toThrow('ARIA_VISUAL_EVIDENCE_INVALID:HEAD_SYMLINK');

    const missing = fixture();
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: missing.root, expectedHeadSha: HEAD_SHA, mode: 'check',
    })).toThrow('ARIA_VISUAL_EVIDENCE_INVALID:SEALED_MANIFEST_MISSING');

    const modified = fixture();
    qualifyAriaVisualArtifacts({
      repositoryRoot: modified.root, expectedHeadSha: HEAD_SHA, mode: 'write',
    });
    const path = join(modified.artifactRoot, 'visual-evidence.json');
    const evidence = JSON.parse(readFileSync(path, 'utf8')) as AriaVisualEvidence;
    write(modified.artifactRoot, 'visual-evidence.json', JSON.stringify({
      ...evidence,
      evidence: evidence.evidence.slice(1),
    }));
    expect(() => qualifyAriaVisualArtifacts({
      repositoryRoot: modified.root, expectedHeadSha: HEAD_SHA, mode: 'check',
    })).toThrow('ARIA_VISUAL_EVIDENCE_INVALID:SEALED_MANIFEST_MISMATCH');
  });
});
