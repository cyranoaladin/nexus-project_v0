import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DOCUMENTS_FINAL = join(process.cwd(), 'assets/campaigns/pre-rentree-2026/documents-final');
const REQUIRED_PDFS = [
  'NexusReussite_PreRentree2026_Planning_InfosPratiques.pdf',
  'NexusReussite_PreRentree2026_Programme_4e.pdf',
  'NexusReussite_PreRentree2026_Programme_3e.pdf',
  'NexusReussite_PreRentree2026_Programme_Seconde.pdf',
  'NexusReussite_PreRentree2026_Programme_Premiere.pdf',
  'NexusReussite_PreRentree2026_Programme_Terminale.pdf',
].map((name) => join(DOCUMENTS_FINAL, name));
const LOCK_DIR = join(tmpdir(), 'nexus-pre-rentree-pdf-fixtures.lock');
const WAIT_TIMEOUT_MS = 180_000;
const generatedArtifacts = new Set<string>();
let cleanupRegistered = false;

function fixturesExist(): boolean {
  return REQUIRED_PDFS.every((path) => existsSync(path));
}

function sleep(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function assertPdfSignature(path: string): void {
  expect(readFileSync(path).subarray(0, 5).toString('ascii')).toBe('%PDF-');
}

function registerArtifactCleanup(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  process.once('exit', () => {
    cleanupPreRentreePdfFixtures();
  });
}

export function cleanupPreRentreePdfFixtures(): void {
  for (const path of generatedArtifacts) {
    if (existsSync(path)) unlinkSync(path);
  }
  generatedArtifacts.clear();
}

export function ensurePreRentreePdfFixtures(): void {
  if (fixturesExist()) {
    REQUIRED_PDFS.forEach(assertPdfSignature);
    return;
  }

  const existingFiles = new Set(
    existsSync(DOCUMENTS_FINAL) ? readdirSync(DOCUMENTS_FINAL) : [],
  );

  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (true) {
    try {
      mkdirSync(LOCK_DIR);
      try {
        if (!fixturesExist()) {
          execFileSync('npm', ['run', 'pre-rentree:public-pdfs'], {
            cwd: process.cwd(),
            env: { ...process.env, SOURCE_DATE_EPOCH: '1784505600' },
            stdio: 'pipe',
            timeout: WAIT_TIMEOUT_MS,
          });
        }
      } finally {
        rmdirSync(LOCK_DIR);
      }
      break;
    } catch (error) {
      if (existsSync(LOCK_DIR) && Date.now() < deadline) {
        sleep(250);
        continue;
      }
      throw error;
    }
  }

  const missing = REQUIRED_PDFS.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(`La génération canonique n'a pas produit ${missing.length} fixture(s) PDF requise(s).`);
  }

  for (const path of REQUIRED_PDFS) {
    assertPdfSignature(path);
    const name = path.slice(DOCUMENTS_FINAL.length + 1);
    if (!existingFiles.has(name)) generatedArtifacts.add(path);
  }
  registerArtifactCleanup();
}
