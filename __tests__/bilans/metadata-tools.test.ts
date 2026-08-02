import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TEMP_DIRECTORY = path.join(ROOT, '.tmp-bilan-metadata-tools');
const PACK_PATH = path.join(ROOT, 'data/bilans/banks/maths-terminale-bilan-v1.json');
const YAML_PATH = path.join(ROOT, 'data/bilans/banks/maths-terminale-bilan-v1.draft-metadata.yaml');
const CHECK_SCRIPT = 'scripts/bilans/check-pack-completeness.ts';
const MERGE_SCRIPT = 'scripts/bilans/merge-metadata.ts';
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');

type MetadataOption = {
  key: string;
  correct: boolean;
  distractorRationale?: string;
};

type MetadataItem = {
  id: string;
  domainId: string;
  nodeCpsId: string | null;
  difficulty: number | null;
  targetTimeSec: number | null;
  shortCorrection: string;
  options: MetadataOption[];
};

type MetadataDocument = {
  pack: string;
  version: number;
  items: MetadataItem[];
};

function run(script: string, args: string[]) {
  return spawnSync(TSX, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

function yamlToJson(source: string): unknown {
  const result = spawnSync(process.execPath, ['-e', "const YAML=require('yaml'); process.stdout.write(JSON.stringify(YAML.parse(require('fs').readFileSync(0,'utf8'))))"], {
    cwd: ROOT,
    encoding: 'utf8',
    input: source,
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout) as unknown;
}

function jsonToYaml(value: unknown): string {
  const result = spawnSync(process.execPath, ['-e', "const YAML=require('yaml'); process.stdout.write(YAML.stringify(JSON.parse(require('fs').readFileSync(0,'utf8'))))"], {
    cwd: ROOT,
    encoding: 'utf8',
    input: JSON.stringify(value),
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
}

function readMetadata(): MetadataDocument {
  return yamlToJson(fs.readFileSync(YAML_PATH, 'utf8')) as MetadataDocument;
}

function completeMetadata(): MetadataDocument {
  const metadata = readMetadata();
  metadata.items.forEach((item, index) => {
    item.nodeCpsId = `tle.maths.${item.domainId}.fixture-${String(index + 1).padStart(2, '0')}`;
    item.difficulty = 1;
    item.targetTimeSec = 60;
    item.shortCorrection = `TEST ONLY - correction ${item.id}`;
    item.options.forEach((option) => {
      if (!option.correct) option.distractorRationale = `TEST ONLY - erreur ${item.id}-${option.key}`;
    });
  });
  return metadata;
}

function writeTemp(name: string, content: string): string {
  fs.mkdirSync(TEMP_DIRECTORY, { recursive: true });
  const target = path.join(TEMP_DIRECTORY, name);
  fs.writeFileSync(target, content, 'utf8');
  return path.relative(ROOT, target);
}

afterAll(() => fs.rmSync(TEMP_DIRECTORY, { recursive: true, force: true }));

describe('pedagogical metadata tools', () => {
  it('measures progress directly from the frozen YAML source', () => {
    const result = run(CHECK_SCRIPT, ['--source', 'yaml', path.relative(ROOT, YAML_PATH)]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('PACK_COMPLETENESS=0/38');
    expect(result.stdout).toContain('MATH-ANA-02: nodeCpsId, difficulty, targetTimeSec, shortCorrection');
  });

  it('supports the complete entry pack and the incomplete probability transfer source', () => {
    const entry = run(CHECK_SCRIPT, ['data/bilans/banks/entree-terminale-maths-v1.json']);
    const transfer = run(CHECK_SCRIPT, [
      '--source', 'yaml', 'data/bilans/banks/entree-terminale-maths-probabilites.draft-metadata.yaml',
    ]);

    expect(entry.status).toBe(0);
    expect(entry.stdout).toContain('PACK_COMPLETENESS=18/18');
    expect(transfer.status).toBe(1);
    expect(transfer.stdout).toContain('PACK_COMPLETENESS=0/8');
  });
  it('keeps A REMPLACER incomplete in YAML progress', () => {
    const metadata = completeMetadata();
    const firstDistractor = metadata.items[0].options.find((option) => !option.correct);
    if (!firstDistractor) throw new Error('TEST_FIXTURE_HAS_NO_DISTRACTOR');
    firstDistractor.distractorRationale = 'A REMPLACER';
    const yamlPath = writeTemp('with-replacement.yaml', jsonToYaml(metadata));

    const result = run(CHECK_SCRIPT, ['--source', 'yaml', yamlPath]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('PACK_COMPLETENESS=37/38');
    expect(result.stdout).toContain(`MATH-ANA-02: options.${firstDistractor.key}.distractorRationale`);
  });

  it('refuses incomplete metadata without changing the pack copy', () => {
    const originalPack = fs.readFileSync(PACK_PATH, 'utf8');
    const packPath = writeTemp('incomplete-pack.json', originalPack);

    const result = run(MERGE_SCRIPT, [
      '--metadata', path.relative(ROOT, YAML_PATH),
      '--pack', packPath,
    ]);

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('MATH-ANA-02.nodeCpsId');
    expect(fs.readFileSync(path.join(ROOT, packPath), 'utf8')).toBe(originalPack);
  });

  it('merges complete metadata while preserving review and questionnaire content', () => {
    const originalPack = JSON.parse(fs.readFileSync(PACK_PATH, 'utf8')) as Record<string, any>;
    const packPath = writeTemp('complete-pack.json', `${JSON.stringify(originalPack, null, 2)}\n`);
    const metadataPath = writeTemp('complete-metadata.yaml', jsonToYaml(completeMetadata()));

    const result = run(MERGE_SCRIPT, ['--metadata', metadataPath, '--pack', packPath]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('PACK_MERGED=38/38');
    const merged = JSON.parse(fs.readFileSync(path.join(ROOT, packPath), 'utf8')) as Record<string, any>;
    expect(merged.review).toStrictEqual(originalPack.review);
    expect(merged.status).toBe(originalPack.status);
    expect(merged.version).toBe(originalPack.version);
    expect(merged.questionnaire.items[0].questionText).toBe(originalPack.questionnaire.items[0].questionText);
    expect(merged.questionnaire.items[0].options).toEqual(originalPack.questionnaire.items[0].options.map(
      (option: Record<string, unknown>) => option.isCorrect
        ? option
        : { ...option, distractorRationale: expect.stringMatching(/^TEST ONLY/) },
    ));
    expect(merged.questionnaire.items.every((item: Record<string, unknown>) => item.nodeCpsId)).toBe(true);
  });

  it('refuses to merge A REMPLACER and leaves the pack copy unchanged', () => {
    const originalPack = fs.readFileSync(PACK_PATH, 'utf8');
    const metadata = completeMetadata();
    const firstDistractor = metadata.items[0].options.find((option) => !option.correct);
    if (!firstDistractor) throw new Error('TEST_FIXTURE_HAS_NO_DISTRACTOR');
    firstDistractor.distractorRationale = 'A REMPLACER';
    const packPath = writeTemp('replacement-pack.json', originalPack);
    const metadataPath = writeTemp('replacement-metadata.yaml', jsonToYaml(metadata));

    const result = run(MERGE_SCRIPT, ['--metadata', metadataPath, '--pack', packPath]);

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      `MATH-ANA-02.options.${firstDistractor.key}.distractorRationale`,
    );
    expect(fs.readFileSync(path.join(ROOT, packPath), 'utf8')).toBe(originalPack);
  });
});
