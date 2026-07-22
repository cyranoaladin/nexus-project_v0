import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const resourcePath = join(root, 'content/pre-rentree-2026/priority-resources.fr.json');
const matrixPath = join(root, 'content/pre-rentree-2026/official-programme-matrix.fr.json');
const modulesPath = join(root, 'content/pre-rentree-2026/modules.json');

const priorityIds = [
  'troisieme-mathematiques',
  'troisieme-francais',
  'seconde-mathematiques',
  'seconde-physique-chimie',
  'premiere-mathematiques',
  'terminale-mathematiques',
];

describe('Pré-rentrée 2026 priority pedagogical resources', () => {
  it('provides the six priority modules and the official-programme matrix', () => {
    expect(existsSync(resourcePath)).toBe(true);
    expect(existsSync(matrixPath)).toBe(true);
    const source = JSON.parse(readFileSync(resourcePath, 'utf8'));
    expect(source.modules.map((module: { moduleId: string }) => module.moduleId)).toEqual(priorityIds);
  });

  it('keeps generated generic resources in DRAFT by policy', () => {
    const modules = JSON.parse(readFileSync(modulesPath, 'utf8'));
    expect(modules.resourcePolicy.generatedDefaultStatus).toBe('DRAFT');
    expect(modules.resourcePolicy.classroomReadyRequiresHumanValidation).toBe(true);
  });

  it('contains real student and teacher material for every priority module', () => {
    const source = JSON.parse(readFileSync(resourcePath, 'utf8'));
    for (const module of source.modules) {
      expect(module.status).toBe('READY_FOR_PEDAGOGICAL_REVIEW');
      expect(module.positioning.student.instructions.length).toBeGreaterThan(40);
      expect(module.positioning.questions.length).toBeGreaterThanOrEqual(6);
      expect(module.positioning.questions.every((question: Record<string, unknown>) => (
        typeof question.prompt === 'string'
        && typeof question.answer === 'string'
        && typeof question.points === 'number'
        && typeof question.difficulty === 'string'
      ))).toBe(true);
      expect(module.activities.length).toBeGreaterThanOrEqual(2);
      expect(module.activities.every((activity: Record<string, unknown>) => (
        typeof activity.resourceContent === 'string'
        && activity.resourceContent.length > 60
      ))).toBe(true);
      expect(module.exercises.length).toBeGreaterThanOrEqual(4);
      expect(module.exercises.every((exercise: Record<string, unknown>) => (
        typeof exercise.prompt === 'string'
        && typeof exercise.correction === 'string'
        && typeof exercise.points === 'number'
        && typeof exercise.durationMinutes === 'number'
      ))).toBe(true);
      expect(module.finalProduction.criteria.length).toBeGreaterThanOrEqual(3);
      expect(module.bilan.studentPrompts.length).toBeGreaterThanOrEqual(3);
      expect(module.validation.status).toBe('PENDING_HUMAN_VALIDATION');
    }
  });

  it('maps all existing Nexus modules to an applicable official programme', () => {
    const modules = JSON.parse(readFileSync(modulesPath, 'utf8'));
    const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
    expect(matrix.rows).toHaveLength(modules.modules.length);
    expect(new Set(matrix.rows.map((row: { moduleId: string }) => row.moduleId))).toEqual(
      new Set(modules.modules.map((module: { id: string }) => module.id)),
    );
    expect(matrix.rows.every((row: Record<string, unknown>) => (
      typeof row.officialProgrammeId === 'string'
      && typeof row.applicationSchoolYear === 'string'
      && typeof row.alignmentSummary === 'string'
      && Array.isArray(row.nexusSessionNumbers)
    ))).toBe(true);
  });

  it('uses the correct implementation calendar for 2026-2027', () => {
    const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
    const row = (id: string) => matrix.rows.find((item: { moduleId: string }) => item.moduleId === id);

    expect(row('troisieme-mathematiques').officialProgrammeId).toBe('BO2020-CYCLE4-MATHS');
    expect(row('troisieme-francais').officialProgrammeId).toBe('BO2020-CYCLE4-FRANCAIS');
    expect(row('seconde-mathematiques').officialProgrammeId).toBe('BO2026-LYCEE-MATHS-SECONDE');
    expect(row('premiere-mathematiques').officialProgrammeId).toBe('BO2026-LYCEE-MATHS-PREMIERE');
    expect(row('terminale-mathematiques').officialProgrammeId).toBe('BO2019-LYCEE-MATHS-TERMINALE');
    expect(row('seconde-informatique-snt').publicOfferEligible).toBe(false);
  });
});
