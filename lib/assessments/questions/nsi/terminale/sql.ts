/**
 * NSI Terminale - SQL et Bases de données
 * TODO: Migrer les 5 questions depuis stage-qcm-structure.ts
 */

import { Subject } from '../../../core/types';
import type { QuestionModule } from '../../types';

const questionModule: QuestionModule = {
  id: 'sql',
  title: 'Bases de données - SQL',
  subject: Subject.NSI,
  grade: 'TERMINALE',
  category: 'SQL',
  questions: [], // TODO: Migrer depuis stage-qcm-structure.ts
};

export default questionModule;
