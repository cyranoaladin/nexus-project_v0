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

  it('exports a closed JSON Schema from the runtime snapshot contract', () => {
    const schema = JSON.parse(
      readFileSync(join(root, 'scripts/pre-rentree/schemas/publication-snapshot.schema.json'), 'utf8'),
    );
    const openObjectPaths: string[] = [];
    const visit = (value: unknown, path: string) => {
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;
      if (record.type === 'object' && record.properties && record.additionalProperties !== false) {
        openObjectPaths.push(path);
      }
      Object.entries(record).forEach(([key, child]) => visit(child, `${path}/${key}`));
    };
    visit(schema, '');

    expect(openObjectPaths).toEqual([]);
    expect(JSON.stringify(schema)).toContain('documentPackageVersion');
    expect(JSON.stringify(schema)).not.toContain('generatedAt');
  });

  it('compiles canonical source versions, hashes, and repository provenance', () => {
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect((snapshot as unknown as { sourceSetSha256?: string }).sourceSetSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.sourceRepoSha).toBe('a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0');
    expect(snapshot.provenance.campaign.version).toBe('2.0.2');
    expect(snapshot.provenance.modules.version).toBe('2026-pre-rentree-v2');
    expect(snapshot.provenance.pricing.version).toBe('2026-2027.4');
    expect(snapshot.provenance.parentGuide.version).toBe('2026-parent-guide-fr-v4');
    expect(Object.values(snapshot.provenance).every((source) => /^[a-f0-9]{64}$/.test(source.sha256))).toBe(true);
    expect(Object.keys(snapshot.provenance)).toEqual(expect.arrayContaining([
      'offers',
      'capabilities',
      'manuals',
      'pedagogyFramework',
    ]));
    expect(() => PublicationSnapshotSchema.parse(snapshot)).not.toThrow();
  });

  it('loads a closed, versioned French parent-guide contract with valid evidence references', () => {
    const schema = JSON.parse(
      readFileSync(join(root, 'content/pre-rentree-2026/parent-guide.schema.json'), 'utf8'),
    );
    const source = JSON.parse(
      readFileSync(join(root, 'content/pre-rentree-2026/parent-guide.fr.json'), 'utf8'),
    );
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.sections.items.$ref).toBe('#/$defs/section');
    expect(schema.$defs.section.additionalProperties).toBe(false);
    expect(source).toMatchObject({
      schemaVersion: '1.0.0',
      contentVersion: '2026-parent-guide-fr-v4',
      locale: 'fr-TN',
      status: 'DRAFT_FOR_OWNER_REVIEW',
      documentPackageVersion: '6.0.0-rc.3',
    });
    expect(snapshot.parentGuide.sections.map((section) => section.id)).toEqual([
      'essentiel',
      'offres',
      'pourquoi',
      'fonctionnement',
      'parcours-fondations',
      'parcours-premium',
      'catalogue',
      'planning',
      'tarifs',
      'reservation',
      'manuels',
      'pratique',
      'faq',
      'contact',
    ]);
    expect(snapshot.parentGuide.sections.flatMap((section) => section.blocks)
      .filter((block) => block.kind === 'EVIDENCED_TEXT')
      .every((block) => block.evidenceRefs.length > 0)).toBe(true);
  });

  it('separates source, snapshot, edition, build, and review dates', () => {
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect(snapshot.sourceCommitDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(snapshot.snapshotBuiltAt).toBe('2026-07-20T18:00:00+01:00');
    expect(snapshot.document.documentEditionDate).toBe('2026-07-20');
    expect(snapshot.document.documentPackageVersion).toBe('6.0.0-rc.3');

    const why = snapshot.parentGuide.sections.find((section) => section.id === 'pourquoi');
    expect(why?.blocks).toHaveLength(3);
    expect(snapshot.reviews).toEqual({
      ownerReviewedAt: null,
      legalReviewedAt: null,
      privacyReviewedAt: null,
    });
    expect(snapshot).not.toHaveProperty('generatedAt');
  });

  it('exposes only publicly committed Parcours 360 labels to the renderer', () => {
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });
    const committed = snapshot.capabilities.capabilities.filter((item) => item.publiclyCommitted);
    const unavailable = snapshot.capabilities.capabilities.filter((item) => !item.publiclyCommitted);

    expect(committed).toEqual([]);
    expect(unavailable.map((item) => item.id)).toEqual(expect.arrayContaining([
      'bilan-parents',
      'bilan-eleve',
      'plan-action-premieres-semaines',
      'test-positionnement-matiere',
    ]));
    expect(unavailable.every((item) => item.publiclyCommitted === false)).toBe(true);
  });

  it('copies all fourteen canonical modules and seventy sessions without editorial drift', () => {
    const canonical = JSON.parse(
      readFileSync(join(root, 'content/pre-rentree-2026/modules.json'), 'utf8'),
    );
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect(snapshot.modules).toEqual(canonical.modules);
    expect(snapshot.modules).toHaveLength(14);
    expect(snapshot.modules.flatMap((module) => module.sessions)).toHaveLength(70);
  });

  it('materializes fourteen positioning tests, seventy quick assessments and seventy deliverables', () => {
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha }) as unknown as {
      pedagogy?: {
        positioningTests: Array<{
          id: string;
          questions: Array<{ prompt: string; correction: string; points: number }>;
          rubric: Record<string, string>;
          anonymousSample: { sampleId: string; response: string; assessment: string };
        }>;
        quickAssessments: Array<{ sessionRef: string; prompt: string; correction: string; successCriterion: string }>;
        sessionDeliverables: Array<{ sessionRef: string; instructions: string[]; expectedEvidence: string[]; selfCheck: string[] }>;
      };
    };

    expect(snapshot.pedagogy?.positioningTests).toHaveLength(14);
    expect(snapshot.pedagogy?.positioningTests.flatMap((test) => test.questions)).toHaveLength(70);
    expect(snapshot.pedagogy?.positioningTests.every((test) => (
      test.questions.every((question) => question.prompt && question.correction && question.points > 0) &&
      Object.keys(test.rubric).length === 3 &&
      /^SAMPLE-ANON-/.test(test.anonymousSample.sampleId)
    ))).toBe(true);
    expect(snapshot.pedagogy?.quickAssessments).toHaveLength(70);
    expect(snapshot.pedagogy?.sessionDeliverables).toHaveLength(70);
    expect(new Set(snapshot.pedagogy?.quickAssessments.map((item) => item.sessionRef)).size).toBe(70);
    expect(new Set(snapshot.pedagogy?.sessionDeliverables.map((item) => item.sessionRef)).size).toBe(70);
    expect(snapshot.pedagogy?.sessionDeliverables.every((item) => (
      item.instructions.length >= 3 && item.expectedEvidence.length >= 2 && item.selfCheck.length >= 3
    ))).toBe(true);
  });

  it('expands the canonical schedule to seventy dated sessions', () => {
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect(snapshot.schedule.sessions).toHaveLength(70);
    expect(snapshot.schedule.sessions[0]).toMatchObject({
      date: '2026-08-17',
      level: 'TROISIEME',
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
      [1, 480, 144, 336, 48],
      [2, 900, 270, 630, 45],
      [3, 1350, 405, 945, 45],
      [4, 1800, 540, 1260, 45],
    ]);
    expect(snapshot.labels.deposit).toBe('Acompte');
    expect(snapshot.labels.deposit).not.toMatch(/30\s*%/);
    expect(snapshot.offerPricing.filter((item) => item.range === 'FONDATIONS').map((item) => [
      item.level, item.subjectCount, item.price, item.deposit, item.balance,
    ])).toEqual([
      ['TROISIEME', 1, 350, 105, 245],
      ['TROISIEME', 2, 700, 210, 490],
      ['SECONDE', 1, 400, 120, 280],
      ['SECONDE', 2, 800, 240, 560],
      ['SECONDE', 3, 1200, 360, 840],
      ['SECONDE', 4, 1600, 480, 1120],
    ]);
    expect(snapshot.offerPricing.every((item) => item.deposit === item.price * 0.3)).toBe(true);
  });

  it('derives REVIEW publication and blocks absent approved terms', () => {
    const snapshot = compilePublicationSnapshot({ repoRoot: root, sourceRepoSha });

    expect(snapshot.campaign.publicationMode).toBe('REVIEW');
    expect(snapshot.cta.primary).toBe('Demander un parcours ou un conseil');
    expect(snapshot.legal.status).toBe('MISSING_APPROVED_COMMERCIAL_TERMS');
    expect(snapshot.legal.contractualDossierPublicationBlocked).toBe(true);
    expect(snapshot.legal.termsVersion).toBeNull();
    expect(snapshot.contact).toEqual(expect.objectContaining({
      phone: '+216 99 19 28 29',
      email: 'contact@nexusreussite.academy',
      address: 'Mutuelleville, Tunis',
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
      'NexusReussite_PreRentree2026_GuideParents_COMPLET.pdf',
      'NexusReussite_PreRentree2026_BrochureParents.pdf',
      'NexusReussite_PreRentree2026_Essentiel.pdf',
      'NexusReussite_PreRentree2026_Fondations_vs_Premium.pdf',
      'NexusReussite_PreRentree2026_Tarifs_Reservation.pdf',
      'Programme_Entree_3e.pdf',
      'Programme_Entree_Seconde.pdf',
      'Programme_Entree_Premiere.pdf',
      'Programme_Entree_Terminale.pdf',
      'Planning_PreRentree2026.pdf',
      'FAQ_Parents_PreRentree2026.pdf',
    ]);
    expect(Object.values(snapshot.document.outputs.publicHtml)).toContain(
      'NexusReussite_PreRentree2026_GuideParents_COMPLET.html',
    );
    expect(snapshot.document.outputs.social).toEqual({
      feed: 'NexusReussite_PreRentree2026_Feed_1080x1350.png',
      story: 'NexusReussite_PreRentree2026_Story_1080x1920.png',
      monochrome: 'NexusReussite_PreRentree2026_Flyer_NB_1080x1350.png',
      altText: 'NexusReussite_PreRentree2026_VisuelsSociaux_AltText.json',
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
