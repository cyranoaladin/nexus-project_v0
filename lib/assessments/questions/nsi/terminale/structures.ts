/**
 * NSI Terminale - Structures de données
 * TODO: Migrer les 4 questions depuis stage-qcm-structure.ts
 */

import { Subject } from '../../../core/types';
import type { QuestionModule } from '../../types';

const module: QuestionModule = {
  id: 'structures',
  title: 'Structures de données',
  subject: Subject.NSI,
  grade: 'TERMINALE',
  category: 'Structures de données',
  questions: [], // TODO: Migrer depuis stage-qcm-structure.ts
};

export default module;
