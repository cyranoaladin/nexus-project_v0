/**
 * NSI Terminale - Architecture et Réseaux
 * TODO: Migrer les 4 questions depuis stage-qcm-structure.ts
 */

import { Subject } from '../../../core/types';
import type { QuestionModule } from '../../types';

const questionModule: QuestionModule = {
  id: 'architecture',
  title: 'Architectures & Réseaux',
  subject: Subject.NSI,
  grade: 'TERMINALE',
  category: 'Architecture',
  questions: [], // TODO: Migrer depuis stage-qcm-structure.ts
};

export default questionModule;
