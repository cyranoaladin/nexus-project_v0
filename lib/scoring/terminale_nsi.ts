// Ce module ne doit plus être importé côté client/SSR pour éviter le chargement direct de JSON.
// Les questions NSI Terminale sont désormais servies par /api/bilan/questionnaire-structure.
// On conserve uniquement l'ordre des domaines pour l'adapter PDF.
export const NSI_ORDER = [
  'TypesBase', 'TypesConstruits', 'Algo', 'LangagePython', 'TablesDonnees', 'IHMWeb', 'Reseaux', 'ArchOS', 'HistoireEthique'
] as const;
