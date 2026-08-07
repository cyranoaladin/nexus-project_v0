import 'server-only';

type StoredModule = {
  moduleKey: string;
  status: string;
  autoScore?: any;
  manualScore?: any;
  submittedAt?: Date | string | null;
};

function percentage(module?: StoredModule) {
  const manual = module?.manualScore?.percentage;
  if (typeof manual === 'number') return manual;
  const automatic = module?.autoScore?.percentage;
  return typeof automatic === 'number' ? automatic : null;
}

function coverage(module?: StoredModule) {
  const value = module?.autoScore?.coveragePercentage;
  return typeof value === 'number' ? value : null;
}

export function buildStaffDiagnosticSynthesis(diagnostic: {
  modules: StoredModule[];
  documents: Array<{ status: string; category: string }>;
  parentSubmittedAt?: Date | string | null;
}) {
  const byKey = new Map(diagnostic.modules.map((module) => [module.moduleKey, module]));
  const moduleScores = Object.fromEntries(
    [...byKey].map(([key, module]) => [key, {
      status: module.status,
      percentage: percentage(module),
      coveragePercentage: coverage(module),
      manualReviewPending: module.autoScore?.manualReviewQuestionIds?.length ?? 0,
    }]),
  );

  const t0 = percentage(byKey.get('potentiel-t0'));
  const t1 = percentage(byKey.get('potentiel-t1'));
  const retention = percentage(byKey.get('retention-transfert'));
  const flags: Array<{ severity: 'INFO' | 'WATCH' | 'BLOCKING'; code: string; message: string }> = [];

  const french = percentage(byKey.get('francais-academique'));
  const frenchCoverage = coverage(byKey.get('francais-academique'));
  if (french !== null && french < 45) flags.push({ severity: 'BLOCKING', code: 'FRENCH_LOW', message: 'Français académique sous le seuil interne de vigilance renforcée.' });
  if (frenchCoverage !== null && frenchCoverage < 60) flags.push({ severity: 'WATCH', code: 'FRENCH_COVERAGE_LOW', message: 'Couverture du test de français insuffisante pour une conclusion stable.' });

  const specialties = ['mathematiques', 'nsi', 'ses'].map((key) => ({ key, score: percentage(byKey.get(key)), coverage: coverage(byKey.get(key)) }));
  const viable = specialties.filter((item) => item.score !== null && item.score >= 50 && (item.coverage ?? 0) >= 65);
  if (viable.length < 2) flags.push({ severity: 'BLOCKING', code: 'SPECIALTIES_NOT_SECURED', message: 'Moins de deux spécialités présentent simultanément un niveau et une couverture internes suffisants.' });

  const autonomy = percentage(byKey.get('autonomie-methodes'));
  if (autonomy !== null && autonomy < 55) flags.push({ severity: 'WATCH', code: 'AUTONOMY_LOW', message: 'Autonomie déclarée ou observée fragile pour un parcours majoritairement hors établissement.' });
  if (!diagnostic.parentSubmittedAt) flags.push({ severity: 'BLOCKING', code: 'PARENT_MISSING', message: 'Questionnaire parent non soumis.' });
  if (diagnostic.documents.some((document) => document.status === 'REJECTED' || document.status === 'NEEDS_REPLACEMENT')) {
    flags.push({ severity: 'BLOCKING', code: 'DOCUMENTS_INVALID', message: 'Au moins un document est rejeté ou doit être remplacé.' });
  }

  if (t0 !== null && t1 !== null) {
    const gain = Math.round((t1 - t0) * 100) / 100;
    flags.push({ severity: gain >= 15 ? 'INFO' : 'WATCH', code: 'LEARNING_GAIN', message: `Gain immédiat T1−T0 : ${gain >= 0 ? '+' : ''}${gain} points.` });
  }
  if (t1 !== null && retention !== null) {
    const loss = Math.round((retention - t1) * 100) / 100;
    flags.push({ severity: loss >= -15 ? 'INFO' : 'WATCH', code: 'RETENTION_CHANGE', message: `Évolution rétention−T1 : ${loss >= 0 ? '+' : ''}${loss} points.` });
  }

  const manualReviewPending = diagnostic.modules.reduce((sum, module) => sum + (module.autoScore?.manualReviewQuestionIds?.length ?? 0), 0);
  return {
    generatedAt: new Date().toISOString(),
    moduleScores,
    specialties,
    learningPotential: { t0, t1, retention, immediateGain: t0 !== null && t1 !== null ? Math.round((t1 - t0) * 100) / 100 : null },
    manualReviewPending,
    flags,
    decisionStatus: manualReviewPending > 0 || flags.some((flag) => flag.severity === 'BLOCKING') ? 'INSUFFICIENT_EVIDENCE_FOR_FINAL_DECISION' : 'READY_FOR_PEDAGOGICAL_COMMITTEE',
    disclaimer: 'Synthèse technique interne, sans valeur prédictive. Ne remplace pas une décision pédagogique définitive.',
  };
}
