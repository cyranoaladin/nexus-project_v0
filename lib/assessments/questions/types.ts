/**
 * Question Types for Assessment Platform
 * 
 * Defines the structure for questions across all subjects and grades.
 * Extends QuestionMetadata from core/types.ts with display content.
 */

import type { QuestionMetadata, Subject } from '../core/types';

/**
 * Answer option for a question
 */
export interface QuestionOption {
  /** Unique option identifier (e.g., "a", "b", "c", "d") */
  id: string;
  /** Display text for this option */
  text: string;
  /** Whether this option is the correct answer */
  isCorrect: boolean;
}

/**
 * Complete question with content for rendering
 * 
 * Extends QuestionMetadata with display fields needed by the UI.
 */
export interface Question extends QuestionMetadata {
  /** The question text displayed to the student */
  questionText: string;
  
  /** Answer options (NSP is added automatically by UI) */
  options: QuestionOption[];
  
  /** Explanation shown after answering (for learning) */
  explanation: string;
  
  /** Optional image URL for the question */
  imageUrl?: string;
  
  /** Optional hint text (shown on demand) */
  hint?: string;
  
  /** Optional code snippet (for NSI questions) */
  codeSnippet?: string;
  
  /** Optional LaTeX formula (for Maths questions) */
  latexFormula?: string;
}

/**
 * Question module (group of questions by topic)
 */
export interface QuestionModule {
  /** Module identifier (e.g., "analyse", "poo") */
  id: string;
  
  /** Module title (e.g., "Analyse - Fonctions") */
  title: string;
  
  /** Subject */
  subject: Subject;
  
  /** Grade level */
  grade: 'PREMIERE' | 'TERMINALE';
  
  /** Category/domain */
  category: string;
  
  /** Questions in this module */
  questions: Question[];
}

/**
 * Question bank configuration
 */
export interface QuestionBankConfig {
  subject: Subject;
  grade: 'PREMIERE' | 'TERMINALE';
  modules: string[]; // Module IDs to load
}
