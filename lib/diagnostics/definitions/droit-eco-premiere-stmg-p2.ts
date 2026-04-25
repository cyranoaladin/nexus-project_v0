import { buildStmgDefinition } from './stmg-utils';
import compiledDomains from './generated/droit-eco-premiere-stmg-p2.domains.json';

export const DROIT_ECO_PREMIERE_STMG_P2 = buildStmgDefinition(
  'droit-eco-premiere-stmg-p2',
  'droit-eco-stmg',
  compiledDomains,
  {
    promptSubject: 'droit-économie',
    ragCollections: ['ressources_pedagogiques_premiere_stmg_droit_eco'],
    riskFactors: ['Qualification juridique', 'Lecture de documents', 'Raisonnement économique', 'Argumentation', 'Mobilisation du vocabulaire'],
    examStructure: 'Droit-économie STMG : qualification, analyse de documents et réponse argumentée',
  }
);
