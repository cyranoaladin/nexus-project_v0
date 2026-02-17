/**
 * Question Bank Loader
 * 
 * Implements dynamic loading of question modules based on subject and grade.
 * Uses code splitting to load only the necessary questions.
 */

import type { Subject, Grade } from '../core/types';
import type { Question, QuestionModule } from './types';

/** Known versioned datasets — maps assessmentVersion to loader */
const VERSIONED_DATASETS: Record<string, () => Promise<QuestionModule[]>> = {
  maths_terminale_spe_v1: async () => {
    const { loadModules } = await import('@/lib/data/assessments/maths_terminale_spe_v1');
    return loadModules();
  },
};

/**
 * Question Bank Loader
 * 
 * Provides dynamic loading of question modules to optimize bundle size.
 * Questions are loaded on-demand based on subject and grade.
 */
export class QuestionBank {
  /**
   * Load all question modules for a specific subject and grade
   * 
   * @param subject - Subject (MATHS or NSI)
   * @param grade - Grade level (PREMIERE or TERMINALE)
   * @returns Array of question modules
   * 
   * @example
   * ```typescript
   * const modules = await QuestionBank.load(Subject.NSI, Grade.TERMINALE);
   * const allQuestions = modules.flatMap(m => m.questions);
   * ```
   */
  static async load(subject: Subject, grade: Grade): Promise<QuestionModule[]> {
    const key = `${subject}:${grade}`;

    switch (key) {
      case 'MATHS:TERMINALE':
        return this.loadMathsTerminale();
      
      case 'MATHS:PREMIERE':
        return this.loadMathsPremiere();
      
      case 'NSI:TERMINALE':
        return this.loadNsiTerminale();
      
      case 'NSI:PREMIERE':
        return this.loadNsiPremiere();
      
      case 'GENERAL:TERMINALE':
      case 'GENERAL:PREMIERE':
        return this.loadGeneral();
      
      default:
        throw new Error(`Unsupported combination: ${subject} / ${grade}`);
    }
  }

  /**
   * Load all questions for a specific subject and grade (flattened)
   * 
   * @param subject - Subject
   * @param grade - Grade level
   * @returns Flat array of all questions
   */
  static async loadAll(subject: Subject, grade: Grade): Promise<Question[]> {
    const modules = await this.load(subject, grade);
    return modules.flatMap((module) => module.questions);
  }

  /**
   * Load questions by explicit assessmentVersion identifier.
   * Falls back to default subject/grade loader if version is unknown.
   *
   * @param version - Assessment version string (e.g. 'maths_terminale_spe_v1')
   * @param subject - Fallback subject
   * @param grade - Fallback grade
   * @returns { questions, resolvedVersion }
   */
  static async loadByVersion(
    version: string | undefined,
    subject: Subject,
    grade: Grade
  ): Promise<{ questions: Question[]; resolvedVersion: string }> {
    if (version && VERSIONED_DATASETS[version]) {
      const modules = await VERSIONED_DATASETS[version]();
      return {
        questions: modules.flatMap((m) => m.questions),
        resolvedVersion: version,
      };
    }

    // Fallback: resolve default version from subject+grade
    const defaultVersion = this.getDefaultVersion(subject, grade);
    const questions = await this.loadAll(subject, grade);
    return { questions, resolvedVersion: defaultVersion };
  }

  /**
   * Get the default assessmentVersion for a subject/grade combination.
   */
  static getDefaultVersion(subject: Subject, grade: Grade): string {
    const key = `${subject}:${grade}`;
    const defaults: Record<string, string> = {
      'MATHS:TERMINALE': 'maths_terminale_spe_v1',
    };
    return defaults[key] ?? `${subject.toLowerCase()}_${grade.toLowerCase()}_default`;
  }

  /**
   * Check if a version identifier is a known versioned dataset.
   */
  static isKnownVersion(version: string): boolean {
    return version in VERSIONED_DATASETS;
  }

  /**
   * Load a specific module by ID
   * 
   * @param subject - Subject
   * @param grade - Grade level
   * @param moduleId - Module identifier
   * @returns Question module or null if not found
   */
  static async loadModule(
    subject: Subject,
    grade: Grade,
    moduleId: string
  ): Promise<QuestionModule | null> {
    const modules = await this.load(subject, grade);
    return modules.find((m) => m.id === moduleId) || null;
  }

  // ─── Private Loaders ─────────────────────────────────────────────────────

  /**
   * Load Maths Terminale modules
   */
  private static async loadMathsTerminale(): Promise<QuestionModule[]> {
    const [combinatoire, geometrie, analyse, logExp, probabilites] = await Promise.all([
      import('./maths/terminale/combinatoire').then((m) => m.default),
      import('./maths/terminale/geometrie').then((m) => m.default),
      import('./maths/terminale/analyse').then((m) => m.default),
      import('./maths/terminale/log-exp').then((m) => m.default),
      import('./maths/terminale/probabilites').then((m) => m.default),
    ]);

    return [combinatoire, geometrie, analyse, logExp, probabilites];
  }

  /**
   * Load Maths Première modules
   */
  private static async loadMathsPremiere(): Promise<QuestionModule[]> {
    // TODO: Implement when Première content is ready
    const [algebre] = await Promise.all([
      import('./maths/premiere/algebre').then((m) => m.default),
    ]);

    return [algebre];
  }

  /**
   * Load NSI Terminale modules
   */
  private static async loadNsiTerminale(): Promise<QuestionModule[]> {
    const [poo, structures, sql, algorithmique, architecture] = await Promise.all([
      import('./nsi/terminale/poo').then((m) => m.default),
      import('./nsi/terminale/structures').then((m) => m.default),
      import('./nsi/terminale/sql').then((m) => m.default),
      import('./nsi/terminale/algorithmique').then((m) => m.default),
      import('./nsi/terminale/architecture').then((m) => m.default),
    ]);

    return [poo, structures, sql, algorithmique, architecture];
  }

  /**
   * Load NSI Première modules
   */
  private static async loadNsiPremiere(): Promise<QuestionModule[]> {
    // TODO: Implement when Première content is ready
    const [python] = await Promise.all([
      import('./nsi/premiere/python').then((m) => m.default),
    ]);

    return [python];
  }

  /**
   * Load General diagnostic modules (cross-curricular)
   */
  private static async loadGeneral(): Promise<QuestionModule[]> {
    const [diagnostic] = await Promise.all([
      import('./general/diagnostic').then((m) => m.default),
    ]);

    return [diagnostic];
  }

  /**
   * Get list of available modules for a subject/grade combination
   * 
   * @param subject - Subject
   * @param grade - Grade level
   * @returns Array of module IDs
   */
  static getAvailableModules(subject: Subject, grade: Grade): string[] {
    const key = `${subject}:${grade}`;

    const moduleMap: Record<string, string[]> = {
      'MATHS:TERMINALE': ['combinatoire', 'geometrie', 'analyse', 'log-exp', 'probabilites'],
      'MATHS:PREMIERE': ['algebre'],
      'NSI:TERMINALE': ['poo', 'structures', 'sql', 'algorithmique', 'architecture'],
      'NSI:PREMIERE': ['python'],
      'GENERAL:TERMINALE': ['diagnostic-general'],
      'GENERAL:PREMIERE': ['diagnostic-general'],
    };

    return moduleMap[key] || [];
  }
}
