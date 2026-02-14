/**
 * Maths Terminale - Analyse
 * TODO: Migrer les 8 questions depuis stage-qcm-structure.ts
 */

import { Subject } from '../../../core/types';
import type { QuestionModule } from '../../types';

const module: QuestionModule = {
  id: 'analyse',
  title: 'Analyse - Continuité, Dérivation, Convexité',
  subject: Subject.MATHS,
  grade: 'TERMINALE',
  category: 'Analyse',
  questions: [], // TODO: Migrer depuis stage-qcm-structure.ts
};

export default module;
