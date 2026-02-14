/**
 * Maths Terminale - Géométrie dans l'espace
 * TODO: Migrer les 6 questions depuis stage-qcm-structure.ts
 */

import { Subject } from '../../../core/types';
import type { QuestionModule } from '../../types';

const module: QuestionModule = {
  id: 'geometrie',
  title: 'Géométrie dans l\'espace',
  subject: Subject.MATHS,
  grade: 'TERMINALE',
  category: 'Géométrie',
  questions: [], // TODO: Migrer depuis stage-qcm-structure.ts
};

export default module;
