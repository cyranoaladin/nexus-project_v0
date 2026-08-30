import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readAriaEvaluationMode,
  runAriaEvaluation,
} from '@/scripts/aria/evaluate';
import { runAriaTurnRecoveryDrain } from '@/scripts/aria/drain-turn-recovery-outbox';
import { exportAriaResourceRegistrySchema } from '@/scripts/aria/export-resource-registry';
import {
  buildAriaAcademicCoverageArtifact,
  runAriaAcademicCoverage,
} from '@/scripts/aria/generate-academic-coverage';
import {
  ARIA_QUALIFICATION_LANES,
  generateAriaTestEvidence,
} from '@/scripts/aria/generate-test-evidence';

function fixtureRoot(): string {
  return mkdtempSync(join(tmpdir(), 'aria-operational-'));
}

function write(root: string, path: string, value: string): void {
  const absolute = join(root, path);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, value);
}

const evaluationBundle = {
  cases: [{ id: 'case-1' }],
  review: { reviewStatus: 'PENDING' },
  schemaSha256: 'a'.repeat(64),
  corpusSha256: 'b'.repeat(64),
};

describe('ARIA pedagogical evaluation runner', () => {
  it('parses both supported argument forms and rejects missing or invalid modes', () => {
    expect(readAriaEvaluationMode(['--mode=check'])).toBe('check');
    expect(readAriaEvaluationMode(['--mode', 'fixture'])).toBe('fixture');
    expect(readAriaEvaluationMode(['--mode=provider'])).toBe('provider');
    expect(() => readAriaEvaluationMode([])).toThrow('ARIA_EVALUATION_MODE_REQUIRED');
    expect(() => readAriaEvaluationMode(['--mode=invalid'])).toThrow(
      'ARIA_EVALUATION_MODE_REQUIRED',
    );
  });

  it('renders check metadata without invoking fixture scoring', () => {
    const output: string[] = [];
    const evaluateFixtures = jest.fn();
    expect(runAriaEvaluation({
      argv: ['--mode=check'],
      loadBundle: () => evaluationBundle as never,
      evaluateFixtures,
      write: (value) => output.push(value),
    })).toBe(0);
    expect(output.join('')).toContain('ARIA_EVALUATION_CASES=1');
    expect(output.join('')).toContain(`ARIA_EVALUATION_CORPUS_SHA256=${'b'.repeat(64)}`);
    expect(evaluateFixtures).not.toHaveBeenCalled();
  });

  it.each([
    [0, 0],
    [2, 1],
  ])('returns the fixture report failure count as process status (%i failures)', (failed, exitCode) => {
    const output: string[] = [];
    expect(runAriaEvaluation({
      argv: ['--mode', 'fixture'],
      loadBundle: () => evaluationBundle as never,
      evaluateFixtures: (() => ({ total: 2, passed: 2 - failed, failed, results: [] })) as never,
      write: (value) => output.push(value),
    })).toBe(exitCode);
    expect(JSON.parse(output.join(''))).toMatchObject({ failed });
  });

  it('blocks provider evaluation pending approval and still fails closed when approved but unconfigured', () => {
    expect(() => runAriaEvaluation({
      argv: ['--mode=provider'],
      loadBundle: () => evaluationBundle as never,
    })).toThrow('ARIA_EVALUATION_PROVIDER_BLOCKED_PENDING_HUMAN_REVIEW');
    expect(() => runAriaEvaluation({
      argv: ['--mode=provider'],
      loadBundle: () => ({
        ...evaluationBundle,
        review: { reviewStatus: 'APPROVED' },
      }) as never,
    })).toThrow('ARIA_EVALUATION_PROVIDER_RUNNER_NOT_CONFIGURED');
  });
});

describe('ARIA recovery drain runner', () => {
  it('prints a successful bounded drain and disconnects exactly once', async () => {
    const output: string[] = [];
    const disconnect = jest.fn().mockResolvedValue(undefined);
    await expect(runAriaTurnRecoveryDrain({
      drain: jest.fn().mockResolvedValue({ claimed: 1, recovered: 1 }) as never,
      disconnect,
      write: (value) => output.push(value),
    })).resolves.toBe(0);
    expect(JSON.parse(output.join(''))).toEqual({ claimed: 1, recovered: 1 });
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('observes drain and disconnect failures independently without exposing raw errors', async () => {
    const errors: string[] = [];
    await expect(runAriaTurnRecoveryDrain({
      drain: jest.fn().mockRejectedValue(new Error('/private/path user@example.test')) as never,
      disconnect: jest.fn().mockRejectedValue(new Error('secret disconnect')),
      writeError: (value) => errors.push(value),
    })).resolves.toBe(1);
    expect(errors).toEqual([
      'ARIA_TURN_RECOVERY_DRAIN_FAILED\n',
      'ARIA_TURN_RECOVERY_DISCONNECT_FAILED\n',
    ]);
  });

  it('marks a disconnect-only failure as unsuccessful', async () => {
    const errors: string[] = [];
    await expect(runAriaTurnRecoveryDrain({
      drain: jest.fn().mockResolvedValue({ claimed: 0 }) as never,
      disconnect: jest.fn().mockRejectedValue(new Error('unavailable')),
      write: () => undefined,
      writeError: (value) => errors.push(value),
    })).resolves.toBe(1);
    expect(errors).toEqual(['ARIA_TURN_RECOVERY_DISCONNECT_FAILED\n']);
  });
});

describe('ARIA Resource Registry schema export', () => {
  it('writes atomically, verifies exact bytes and rejects missing or drifted artifacts', () => {
    const root = fixtureRoot();
    exportAriaResourceRegistrySchema({ repositoryRoot: root, check: false });
    const path = join(root, 'data/aria/schemas/resource-registry-v1.schema.json');
    expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({
      $id: 'https://nexusreussite.academy/schemas/aria/resource-registry-v1.schema.json',
    });
    expect(() => exportAriaResourceRegistrySchema({ repositoryRoot: root, check: true }))
      .not.toThrow();
    writeFileSync(path, '{}\n');
    expect(() => exportAriaResourceRegistrySchema({ repositoryRoot: root, check: true }))
      .toThrow('ARIA_RESOURCE_REGISTRY_SCHEMA_DRIFT');
    expect(() => exportAriaResourceRegistrySchema({
      repositoryRoot: fixtureRoot(), check: true,
    })).toThrow('ARIA_RESOURCE_REGISTRY_SCHEMA_MISSING');
  });
});

function academicFixture(input: Readonly<{
  dimensions?: readonly { id: string; status: string }[];
  snapshots?: Record<string, readonly string[]>;
  includeSecondCapability?: boolean;
}> = {}): string {
  const root = fixtureRoot();
  const enumValues = {
    GradeLevel: ['PREMIERE'],
    AcademicTrack: ['EDS_GENERALE'],
    StmgPathway: ['GESTION_FINANCE'],
  };
  write(root, 'prisma/schema.prisma', Object.entries(enumValues)
    .map(([name, values]) => `enum ${name} {\n${values.join('\n')}\n}`)
    .join('\n'));
  write(root, 'data/aria/academic-profile-requirements.v1.json', JSON.stringify({
    schemaVersion: 1,
    matrixVersion: 'fixture-v1',
    enumSnapshots: input.snapshots ?? enumValues,
    languageChoiceModel: 'UNDECIDED',
    dimensions: input.dimensions ?? [
      { id: 'GRADE', status: 'REPRESENTED', currentModel: 'Student', evidence: 'schema' },
      { id: 'LANGUAGE_SLOT', status: 'NOT_PROVEN', currentModel: 'none', evidence: 'audit' },
    ],
  }));
  write(root, 'data/curriculum/v1/courses.json', JSON.stringify({
    courses: [{ courseKey: 'course-a' }, { courseKey: 'course-b' }],
  }));
  write(root, 'data/aria/course-capabilities.v1.json', JSON.stringify({
    courses: {
      'course-a': {
        skillGraphRef: 'skills-a', hasAssessmentContext: true,
        chat: { policy: 'GROUNDED_REQUIRED', corpusId: 'corpus-a' },
      },
      ...(input.includeSecondCapability ? {
        'course-b': { skillGraphRef: null, hasAssessmentContext: false, chat: null },
      } : {}),
    },
  }));
  write(root, 'data/aria/resources.v1.json', JSON.stringify({
    resources: [
      { courseKey: 'course-a', status: 'ACTIVE' },
      { courseKey: 'course-b', status: 'RETIRED' },
    ],
  }));
  mkdirSync(join(root, 'docs/_generated'), { recursive: true });
  return root;
}

describe('ARIA academic representation/capability coverage generator', () => {
  it('keeps representation and product capability coverage as separate evidence', () => {
    const root = academicFixture();
    const artifact = buildAriaAcademicCoverageArtifact(root);
    expect(artifact.academicMapRepresentationCoverage).toMatchObject({ status: 'INCOMPLETE' });
    expect(artifact.ariaCapabilityCoverage).toMatchObject({
      status: 'PARTIAL', knownCourseCount: 2, declaredCourseCount: 1,
      chatDeclaredCourseCount: 1, skillGraphDeclaredCourseCount: 1,
      assessmentDeclaredCourseCount: 1, physicallyVerifiedResourceCourseCount: 1,
      runtimeCorpusAvailability: 'NOT_ASSERTED_BY_STATIC_MAPPING',
    });
    expect(artifact.generatedFromSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('writes then verifies a byte-exact artifact and renders its evidence metrics', () => {
    const root = academicFixture({
      dimensions: [{ id: 'GRADE', status: 'REPRESENTED' }],
      includeSecondCapability: true,
    });
    const output: string[] = [];
    runAriaAcademicCoverage({
      repositoryRoot: root, writeArtifact: true, write: (value) => output.push(value),
    });
    runAriaAcademicCoverage({ repositoryRoot: root, writeArtifact: false, write: () => undefined });
    expect(output.join('')).toContain('ACADEMIC_MAP_REPRESENTATION_COVERAGE=COMPLETE');
    expect(output.join('')).toContain('ARIA_CAPABILITY_COVERAGE=COMPLETE');
    writeFileSync(join(root, 'docs/_generated/aria-academic-capability-coverage.v1.json'), '{}\n');
    expect(() => runAriaAcademicCoverage({
      repositoryRoot: root, writeArtifact: false,
    })).toThrow('ARIA_ACADEMIC_COVERAGE_ARTIFACT_STALE');
  });

  it('rejects empty requirements, missing enums, enum drift and unknown course references', () => {
    const invalid = academicFixture({ dimensions: [] });
    expect(() => buildAriaAcademicCoverageArtifact(invalid))
      .toThrow('ARIA_ACADEMIC_REQUIREMENTS_INVALID');

    const missingEnum = academicFixture();
    write(missingEnum, 'prisma/schema.prisma', 'enum GradeLevel { PREMIERE }');
    expect(() => buildAriaAcademicCoverageArtifact(missingEnum))
      .toThrow('ARIA_ACADEMIC_ENUM_MISSING:AcademicTrack');

    const drift = academicFixture({ snapshots: {
      GradeLevel: ['TERMINALE'], AcademicTrack: ['EDS_GENERALE'], StmgPathway: ['GESTION_FINANCE'],
    } });
    expect(() => buildAriaAcademicCoverageArtifact(drift)).toThrow('ARIA_ACADEMIC_ENUM_DRIFT');

    const unknownCapability = academicFixture();
    write(unknownCapability, 'data/aria/course-capabilities.v1.json', JSON.stringify({
      courses: { unknown: { skillGraphRef: null, hasAssessmentContext: false, chat: null } },
    }));
    expect(() => buildAriaAcademicCoverageArtifact(unknownCapability))
      .toThrow('ARIA_CAPABILITY_REFERENCES_UNKNOWN_COURSE');

    const unknownResource = academicFixture();
    write(unknownResource, 'data/aria/resources.v1.json', JSON.stringify({
      resources: [{ courseKey: 'unknown', status: 'ACTIVE' }],
    }));
    expect(() => buildAriaAcademicCoverageArtifact(unknownResource))
      .toThrow('ARIA_CAPABILITY_REFERENCES_UNKNOWN_COURSE');
  });
});

describe('ARIA exact-head Jest evidence generator', () => {
  const laneId: Record<string, string> = {
    unit: 'U001',
    api: 'A001',
    integration: 'I001',
    sse: 'U002',
    architecture: 'H001',
    database: 'D001',
    concurrency: 'D002',
  };

  it('executes every authoritative lane and writes one immutable exact-head artifact', () => {
    const root = fixtureRoot();
    const output: string[] = [];
    const execute = jest.fn((command: string, args: readonly string[]) => {
      const outputArgument = args.find((argument) => argument.startsWith('--outputFile='));
      if (!outputArgument) throw new Error('TEST_OUTPUT_PATH_REQUIRED');
      const outputPath = outputArgument.slice('--outputFile='.length);
      const lane = ARIA_QUALIFICATION_LANES.find((candidate) =>
        candidate.command === command
        && candidate.arguments.every((argument) => args.includes(argument)));
      if (!lane) throw new Error('TEST_LANE_REQUIRED');
      writeFileSync(outputPath, JSON.stringify({
        testResults: [{
          name: join(root, `${lane.name}.test.ts`),
          assertionResults: [{ fullName: `${laneId[lane.name]} qualification`, status: 'passed' }],
        }],
      }));
      return Buffer.alloc(0);
    });
    const git = jest.fn((...args: string[]) => {
      if (args[0] === 'rev-parse') return 'a'.repeat(40);
      return '';
    });
    const result = generateAriaTestEvidence(root, {
      git,
      execute: execute as never,
      write: (value) => output.push(value),
    });
    expect(execute).toHaveBeenCalledTimes(7);
    expect(result).toMatchObject({ headSha: 'a'.repeat(40) });
    expect(result.cases.map(({ id }) => id).sort()).toEqual([
      'A001', 'D001', 'D002', 'H001', 'I001', 'U001', 'U002',
    ]);
    expect(JSON.parse(readFileSync(
      join(root, '.artifacts/aria/qualification/jest-evidence.json'),
      'utf8',
    ))).toMatchObject({ schemaVersion: 1, headSha: 'a'.repeat(40) });
    expect(output.join('')).toContain('ARIA_JEST_EVIDENCE_CASES=7');
  });

  it('refuses dirty worktrees both before execution and after lane completion', () => {
    expect(() => generateAriaTestEvidence(fixtureRoot(), {
      git: () => 'dirty',
      execute: jest.fn() as never,
    })).toThrow('ARIA_TEST_EVIDENCE_DIRTY_WORKTREE:BEFORE');

    const root = fixtureRoot();
    let statusCalls = 0;
    const git = (...args: string[]) => {
      if (args[0] === 'rev-parse') return 'b'.repeat(40);
      statusCalls += 1;
      return statusCalls === 1 ? '' : 'dirty-after';
    };
    const execute = jest.fn((_command: string, args: readonly string[]) => {
      const outputPath = args.find((argument) => argument.startsWith('--outputFile='))
        ?.slice('--outputFile='.length);
      if (!outputPath) throw new Error('TEST_OUTPUT_PATH_REQUIRED');
      writeFileSync(outputPath, JSON.stringify({ testResults: [] }));
      return Buffer.alloc(0);
    });
    expect(() => generateAriaTestEvidence(root, { git, execute: execute as never }))
      .toThrow('ARIA_TEST_EVIDENCE_DIRTY_WORKTREE:AFTER');
  });
});
