/**
 * Question Bank Module - Main Export
 * 
 * Provides dynamic loading of question modules with code splitting.
 * Questions are loaded on-demand based on subject and grade.
 * 
 * @example
 * ```typescript
 * import { QuestionBank } from '@/lib/assessments/questions';
 * 
 * // Load all modules for NSI Terminale
 * const modules = await QuestionBank.load(Subject.NSI, Grade.TERMINALE);
 * 
 * // Load all questions (flattened)
 * const questions = await QuestionBank.loadAll(Subject.MATHS, Grade.TERMINALE);
 * 
 * // Load a specific module
 * const pooModule = await QuestionBank.loadModule(Subject.NSI, Grade.TERMINALE, 'poo');
 * ```
 */

export { QuestionBank } from './loader';
export type { Question, QuestionOption, QuestionModule, QuestionBankConfig } from './types';
