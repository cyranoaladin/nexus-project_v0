/**
 * NSI Terminale - POO (Programmation Orientée Objet)
 * TODO: Migrer les 3 questions depuis stage-qcm-structure.ts
 */

import { Subject } from '../../../core/types';
import type { QuestionModule } from '../../types';

const questionModule: QuestionModule = {
  id: 'poo',
  title: 'Programmation Orientée Objet',
  subject: Subject.NSI,
  grade: 'TERMINALE',
  category: 'POO',
  questions: [], // TODO: Migrer depuis stage-qcm-structure.ts
};

export default questionModule;
