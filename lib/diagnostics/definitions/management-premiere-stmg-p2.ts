import { buildStmgDefinition } from './stmg-utils';
import compiledDomains from './generated/management-premiere-stmg-p2.domains.json';

export const MANAGEMENT_PREMIERE_STMG_P2 = buildStmgDefinition(
  'management-premiere-stmg-p2',
  'management-stmg',
  compiledDomains,
  {
    promptSubject: 'management',
    ragCollections: ['ressources_pedagogiques_premiere_stmg_management'],
    riskFactors: ['Caractérisation organisation', 'Analyse des parties prenantes', 'Lien objectif-indicateur', 'Argumentation', 'Exemples contextualisés'],
    examStructure: "Analyse d'organisation : caractérisation, décision, performance et parties prenantes",
  }
);
