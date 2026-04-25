import { buildStmgDefinition } from './stmg-utils';
import compiledDomains from './generated/maths-premiere-stmg-p2.domains.json';

export const MATHS_PREMIERE_STMG_P2 = buildStmgDefinition(
  'maths-premiere-stmg-p2',
  'maths-stmg',
  compiledDomains,
  {
    promptSubject: 'mathématiques STMG',
    ragCollections: ['ressources_pedagogiques_premiere_stmg_maths'],
    riskFactors: ['Automatismes pourcentages', 'Lecture graphique', 'Interprétation économique', 'Usage tableur', 'Gestion du temps'],
    examStructure: 'Exercices contextualisés STMG : automatismes, fonctions, statistiques, probabilités et tableur',
  }
);
