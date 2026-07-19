import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PublicationSnapshotSchema } from '@/scripts/pre-rentree/publication-snapshot-schema';
import { compilePublicationSnapshot } from '@/scripts/pre-rentree/build-publication-snapshot';

const root = process.cwd();
const sourceRepoSha = execFileSync('git', ['rev-parse', 'origin/main'], {
  cwd: root,
  encoding: 'utf8',
}).trim();

describe('Pré-rentrée 2026 canonical publication snapshot', () => {
  it('rejects an incomplete snapshot', () => {
    expect(() => PublicationSnapshotSchema.parse({})).toThrow();
  });

  it('compiles canonical source versions, hashes, and repository provenance', () => {
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect(snapshot.sourceRepoSha).toBe('a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0');
    expect(snapshot.provenance.campaign.version).toBe('1.0.0');
    expect(snapshot.provenance.modules.version).toBe('2026-pre-rentree-v1');
    expect(snapshot.provenance.pricing.version).toBe('2026-2027.2');
    expect(Object.values(snapshot.provenance).every((source) => /^[a-f0-9]{64}$/.test(source.sha256))).toBe(true);
    expect(() => PublicationSnapshotSchema.parse(snapshot)).not.toThrow();
  });

  it('copies all twelve canonical modules and sixty sessions without editorial drift', () => {
    const canonical = JSON.parse(
      readFileSync(join(root, 'content/pre-rentree-2026/modules.json'), 'utf8'),
    );
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect(snapshot.modules).toEqual(canonical.modules);
    expect(snapshot.modules).toHaveLength(12);
    expect(snapshot.modules.flatMap((module) => module.sessions)).toHaveLength(60);
  });

  it('expands the canonical schedule to sixty dated sessions', () => {
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect(snapshot.schedule.sessions).toHaveLength(60);
    expect(snapshot.schedule.sessions[0]).toMatchObject({
      date: '2026-08-17',
      level: 'SECONDE',
      subjectId: 'MATHEMATIQUES',
      blockId: 'A',
      startTime: '08:30',
      endTime: '10:30',
      roomLabel: 'Salle 1',
      sessionNumber: 1,
    });
    expect(snapshot.schedule.sessions.at(-1)).toMatchObject({
      date: '2026-08-28',
      level: 'TERMINALE',
      subjectId: 'PHYSIQUE_CHIMIE',
      blockId: 'D',
      sessionNumber: 5,
    });
  });

  it('selects the four canonical packs with exact amounts and neutral deposit labels', () => {
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect(snapshot.packs.map((pack) => [
      pack.subjectCount,
      pack.price,
      pack.deposit,
      pack.balance,
      pack.pricePerHour,
    ])).toEqual([
      [1, 480, 140, 340, 48],
      [2, 900, 270, 630, 45],
      [3, 1350, 410, 940, 45],
      [4, 1800, 540, 1260, 45],
    ]);
    expect(snapshot.labels.deposit).toBe('Acompte');
    expect(snapshot.labels.deposit).not.toMatch(/30\s*%/);
  });

  it('derives pre-registration-only publication and blocks absent approved terms', () => {
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect(snapshot.campaign.publicationMode).toBe('PRE_REGISTRATION_ONLY');
    expect(snapshot.cta.primary).toBe('Se pré-inscrire ou demander un conseil');
    expect(snapshot.legal.status).toBe('MISSING_APPROVED_COMMERCIAL_TERMS');
    expect(snapshot.legal.contractualDossierPublicationBlocked).toBe(true);
    expect(snapshot.legal.termsVersion).toBeNull();
    expect(snapshot.contact).toEqual(expect.objectContaining({
      phone: '+216 99 19 28 29',
      email: 'contact@nexusreussite.academy',
      canonicalUrl: 'https://nexusreussite.academy/stages/pre-rentree-2026',
    }));
  });

  it('maps every approved public claim to an existing canonical source', () => {
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect(snapshot.approvedPublicClaims.length).toBeGreaterThan(0);
    expect(snapshot.approvedPublicClaims.every((claim) => claim.source.path && claim.source.pointer)).toBe(true);
    expect(new Set(snapshot.approvedPublicClaims.map((claim) => claim.id)).size).toBe(
      snapshot.approvedPublicClaims.length,
    );
    expect(snapshot.approvedPublicClaims.map((claim) => claim.id)).not.toContain('group-not-opened');
    expect(snapshot.approvedPublicClaims.map((claim) => claim.text).join(' ')).not.toMatch(
      /sommes déjà reçues|restituées selon les conditions/i,
    );
  });

  it('carries the exact public and social output names outside the renderer', () => {
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect(Object.values(snapshot.document.outputs.publicPdf)).toEqual([
      'NexusReussite_PreRentree2026_Essentiel_PUBLIC.pdf',
      'NexusReussite_PreRentree2026_Planning_PUBLIC.pdf',
      'NexusReussite_PreRentree2026_Programme_Seconde_PUBLIC.pdf',
      'NexusReussite_PreRentree2026_Programme_Premiere_PUBLIC.pdf',
      'NexusReussite_PreRentree2026_Programme_Terminale_PUBLIC.pdf',
      'NexusReussite_PreRentree2026_Tarifs_PUBLIC.pdf',
    ]);
    expect(Object.values(snapshot.document.outputs.publicHtml).every((name) => name.endsWith('.html'))).toBe(true);
    expect(snapshot.document.outputs.social).toEqual({
      feed: 'NexusReussite_PreRentree2026_Feed_1080x1350_PUBLIC.png',
      story: 'NexusReussite_PreRentree2026_Story_1080x1920_PUBLIC.png',
      monochrome: 'NexusReussite_PreRentree2026_Flyer_NB_1080x1350_PUBLIC.png',
      altText: 'NexusReussite_PreRentree2026_VisuelsSociaux_AltText_PUBLIC.json',
    });
  });

  it('writes a validated snapshot atomically from the explicit CLI root', () => {
    const outputDirectory = mkdtempSync(join(tmpdir(), 'nexus-snapshot-test-'));
    const output = join(outputDirectory, 'nested', 'publication.snapshot.json');

    execFileSync(join(root, 'node_modules/.bin/tsx'), [
      '--conditions=react-server',
      '--tsconfig', join(root, 'tsconfig.json'),
      join(root, 'scripts/pre-rentree/build-publication-snapshot.ts'),
      '--repo-root', root,
      '--source-repo-sha', sourceRepoSha,
      '--output', output,
    ], { cwd: outputDirectory, encoding: 'utf8' });

    const parsed = JSON.parse(readFileSync(output, 'utf8'));
    expect(() => PublicationSnapshotSchema.parse(parsed)).not.toThrow();
    expect(parsed.sourceRepoSha).toBe(sourceRepoSha);
  });
});
