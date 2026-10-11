import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Contexte : incident du 2026-09-16 — docs/BILAN_DIAGNOSTIC_CL/instruments/*/banque.json,
// release/diagnostics-v2/02_CORRECTIONS_COACH/**, audit/ITEM_AUDIT.jsonl et
// audit/FINDINGS.jsonl ont été publiquement accessibles depuis nexus-project_v0 (dépôt
// public) du 2026-09-13 au 2026-09-16. Voir
// docs/BILAN_DIAGNOSTIC_CL/audit/PUBLIC_ASSESSMENT_EXPOSURE.json. Ce scanner empêche la
// récidive : contenu de diagnostic vivant (banque, clé, correction coach, solution
// d'audit) désormais interdit dans ce dépôt, où qu'il se trouve et quel que soit son nom.

const scanner = resolve(process.cwd(), 'scripts/security/check-assessment-confidentiality.mjs');
const fixtures = resolve(process.cwd(), '__tests__/scripts/fixtures/assessment-confidentiality');

describe('assessment confidentiality scanner', () => {
  it('rejects a live answer-key bank at its known path', () => {
    const repository = mkdtempSync(join(tmpdir(), 'nexus-confidentiality-scan-path-'));
    try {
      mkdirSync(join(repository, 'instruments/EDS-MATH'), { recursive: true });
      writeFileSync(
        join(repository, 'instruments/EDS-MATH/banque.json'),
        JSON.stringify({ instrument: 'EDS-MATH', items: [{ cle: { reponse: 'A' } }] }),
      );
      execFileSync('git', ['init', '-q'], { cwd: repository });
      execFileSync('git', ['add', '.'], { cwd: repository });

      const result = spawnSync(process.execPath, [scanner], { cwd: repository, encoding: 'utf8' });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('DIAGNOSTIC_INSTRUMENT_BANK_PATH instruments/EDS-MATH/banque.json');
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it('rejects known confidential paths independently of content (coach corrections, compiled release, item audit, findings)', () => {
    const repository = mkdtempSync(join(tmpdir(), 'nexus-confidentiality-scan-paths-'));
    try {
      for (const dir of [
        'release/diagnostics-v2/02_CORRECTIONS_COACH/00_COMMUN',
        'release/diagnostics-v2/01_LIVRETS_CANDIDAT',
        'audit',
        'reference/v2-compromised/banks',
      ]) {
        mkdirSync(join(repository, dir), { recursive: true });
      }
      writeFileSync(join(repository, 'release/diagnostics-v2/02_CORRECTIONS_COACH/00_COMMUN/x.pdf'), 'not a real pdf');
      writeFileSync(join(repository, 'release/diagnostics-v2/01_LIVRETS_CANDIDAT/x.pdf'), 'not a real pdf');
      writeFileSync(join(repository, 'audit/ITEM_AUDIT.jsonl'), '{"item_id":"X-1","my_solution":"..."}\n');
      writeFileSync(join(repository, 'audit/FINDINGS.jsonl'), '{"id":"F1","category":"answer_key"}\n');
      writeFileSync(join(repository, 'reference/v2-compromised/banks/placeholder.json'), '{}');
      execFileSync('git', ['init', '-q'], { cwd: repository });
      execFileSync('git', ['add', '.'], { cwd: repository });

      const result = spawnSync(process.execPath, [scanner], { cwd: repository, encoding: 'utf8' });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('DIAGNOSTIC_COACH_CORRECTIONS_PATH');
      expect(output).toContain('DIAGNOSTIC_COMPILED_RELEASE_PATH');
      expect(output).toContain('DIAGNOSTIC_ITEM_AUDIT_PATH');
      expect(output).toContain('DIAGNOSTIC_FINDINGS_PATH');
      expect(output).toContain('DIAGNOSTIC_REFERENCE_EXTRACTION_PATH');
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it('rejects a live answer-key structure even when relocated to an unrelated path', () => {
    const repository = mkdtempSync(join(tmpdir(), 'nexus-confidentiality-scan-relocated-'));
    try {
      mkdirSync(join(repository, 'data/random-place'), { recursive: true });
      writeFileSync(
        join(repository, 'data/random-place/foo.json'),
        JSON.stringify({ instrument: 'renamed-to-hide', items: [{ cle: { reponse: 'B' } }] }),
      );
      execFileSync('git', ['init', '-q'], { cwd: repository });
      execFileSync('git', ['add', '.'], { cwd: repository });

      const result = spawnSync(process.execPath, [scanner], { cwd: repository, encoding: 'utf8' });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('LIVE_ANSWER_KEY_STRUCTURE data/random-place/foo.json');
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it('rejects an item-audit solution line at an unrelated .jsonl path', () => {
    const repository = mkdtempSync(join(tmpdir(), 'nexus-confidentiality-scan-jsonl-'));
    try {
      mkdirSync(join(repository, 'notes'), { recursive: true });
      writeFileSync(
        join(repository, 'notes/dump.jsonl'),
        '{"foo": "bar"}\n{"item_id": "HGGSP-2-REP-01", "my_solution": "Souverainete = ..."}\n',
      );
      execFileSync('git', ['init', '-q'], { cwd: repository });
      execFileSync('git', ['add', '.'], { cwd: repository });

      const result = spawnSync(process.execPath, [scanner], { cwd: repository, encoding: 'utf8' });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('LIVE_ITEM_SOLUTION_STRUCTURE notes/dump.jsonl:2');
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it('checks an exact ref (pre-push mode) without touching the working tree', () => {
    const repository = mkdtempSync(join(tmpdir(), 'nexus-confidentiality-scan-ref-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: repository });
      execFileSync('git', ['config', 'user.email', 'test@example.test'], { cwd: repository });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repository });
      mkdirSync(join(repository, 'instruments/EDS-MATH'), { recursive: true });
      writeFileSync(
        join(repository, 'instruments/EDS-MATH/banque.json'),
        JSON.stringify({ items: [{ cle: { reponse: 'A' } }] }),
      );
      execFileSync('git', ['add', '.'], { cwd: repository });
      execFileSync('git', ['commit', '-q', '-m', 'add bank'], { cwd: repository });
      const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();

      // Remove it from the working tree/index; --ref must still see it in the commit.
      execFileSync('git', ['rm', '-q', '-r', 'instruments'], { cwd: repository });

      const result = spawnSync(process.execPath, [scanner, '--ref', sha], { cwd: repository, encoding: 'utf8' });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('DIAGNOSTIC_INSTRUMENT_BANK_PATH instruments/EDS-MATH/banque.json');

      const clean = spawnSync(process.execPath, [scanner, '--ref', sha, '--staged'], { cwd: repository, encoding: 'utf8' });
      expect(clean.status).not.toBe(0); // --ref and --staged must refuse to combine
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it('accepts generic JSON/JSONL that only superficially resembles the blocked shapes', () => {
    expect(() => execFileSync(process.execPath, [
      scanner,
      '--root',
      join(fixtures, 'safe'),
    ], { encoding: 'utf8' })).not.toThrow();
  });

  it('rejects a V3 semantic-options item (options[]+correct_option_id) even when relocated', () => {
    const repository = mkdtempSync(join(tmpdir(), 'nexus-confidentiality-scan-v3-'));
    try {
      mkdirSync(join(repository, 'some/random/path'), { recursive: true });
      writeFileSync(
        join(repository, 'some/random/path/sneaky.json'),
        JSON.stringify({
          item_id: 'X-1',
          options: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }],
          correct_option_id: 'o1',
        }),
      );
      execFileSync('git', ['init', '-q'], { cwd: repository });
      execFileSync('git', ['add', '.'], { cwd: repository });

      const result = spawnSync(process.execPath, [scanner], { cwd: repository, encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain('LIVE_ANSWER_KEY_STRUCTURE some/random/path/sneaky.json');
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it('accepts the pinned synthetic engine demo fixture at its known path', () => {
    // --root pointé directement sur le dossier de la fixture change les chemins
    // relatifs (juste "form.json", pas "__tests__/fixtures/diagnostic-demo/form.json")
    // et invaliderait le pin par contenu, qui est adressé par le chemin complet tel
    // qu'il apparaît depuis la racine du dépôt — le mode d'usage réel (hook
    // pre-commit/pre-push, ou ici, la copie tracquée du dépôt réel).
    expect(() => execFileSync(process.execPath, [scanner], { encoding: 'utf8' })).not.toThrow();
  });

  it('rejects the demo fixture path if its content is tampered with (content-addressed, not path-addressed)', () => {
    const repository = mkdtempSync(join(tmpdir(), 'nexus-confidentiality-scan-tamper-'));
    try {
      mkdirSync(join(repository, '__tests__/fixtures/diagnostic-demo'), { recursive: true });
      writeFileSync(
        join(repository, '__tests__/fixtures/diagnostic-demo/form.json'),
        JSON.stringify({ tampered: true, options: [{ id: 'a', text: 'x' }], correct_option_id: 'a' }),
      );
      execFileSync('git', ['init', '-q'], { cwd: repository });
      execFileSync('git', ['add', '.'], { cwd: repository });

      const result = spawnSync(process.execPath, [scanner], { cwd: repository, encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain('__tests__/fixtures/diagnostic-demo/form.json');
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });
});
