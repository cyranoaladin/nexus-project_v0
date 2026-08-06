import { spawnSync } from 'node:child_process';

import { chromium } from 'playwright';

const VERSIONED_PDF_CHROMIUM_MAJOR = 145;

type ChromiumInspection = Readonly<{
  status: number | null;
  stdout: string | Buffer | null;
  stderr: string | Buffer | null;
  error?: Error;
}>;

function inspectionText(value: string | Buffer | null): string {
  return value === null ? '' : value.toString().trim();
}

export function assertVersionedPdfChromium(
  inspect: () => ChromiumInspection = () => spawnSync(chromium.executablePath(), ['--version'], { encoding: 'utf8' }),
): void {
  const inspected = inspect();
  const actual = inspectionText(inspected.stdout)
    || inspectionText(inspected.stderr)
    || inspected.error?.message
    || `exit=${inspected.status ?? 'unknown'}`;
  const major = /(?:Chrome|Chromium)[^0-9]*(\d+)\./.exec(actual)?.[1];

  if (inspected.status !== 0 || Number(major) !== VERSIONED_PDF_CHROMIUM_MAJOR) {
    throw new Error(
      `BILAN_PDF_CHROMIUM_VERSION_MISMATCH:expected=${VERSIONED_PDF_CHROMIUM_MAJOR}:actual=${actual}`,
    );
  }
}
