import { buildStmgDefinition } from './stmg-utils';
import compiledDomains from './generated/sgn-premiere-stmg-p2.domains.json';

export const SGN_PREMIERE_STMG_P2 = buildStmgDefinition(
  'sgn-premiere-stmg-p2',
  'sgn-stmg',
  compiledDomains,
  {
    promptSubject: 'sciences de gestion et numérique',
    ragCollections: ['ressources_pedagogiques_premiere_stmg_sgn'],
    riskFactors: ['Analyse de situation', 'Vocabulaire de gestion', 'Lecture des données', 'Justification des décisions', 'Sécurité numérique'],
    examStructure: 'Étude de situation de gestion : documents, indicateurs, données et justification argumentée',
  }
);
