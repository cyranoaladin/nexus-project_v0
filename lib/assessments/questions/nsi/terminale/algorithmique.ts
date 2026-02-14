/**
 * NSI Terminale - Algorithmique
 * TODO: Migrer les 4 questions depuis stage-qcm-structure.ts
 */

import { Subject } from '../../../core/types';
import type { QuestionModule } from '../../types';

const module: QuestionModule = {
  id: 'algorithmique',
  title: 'Algorithmique & Programmation',
  subject: Subject.NSI,
  grade: 'TERMINALE',
  category: 'Algorithmique',
  questions: [], // TODO: Migrer depuis stage-qcm-structure.ts
};

export default module;
