// Garde du banc de validation des bilans : exécution UNIQUEMENT contre le harnais
// local jetable (scripts/espace/bilan-validation-local.sh). Déplacé ici depuis la
// config pour que `playwright test --list` fonctionne sans harnais (garde de
// couverture des lanes), à l'image de playwright.prod-smoke.config.ts.
export default function assertLocalBilanHarness() {
  const origin = process.env.BILAN_VALIDATION_BASE_URL ?? 'http://127.0.0.1:3017';
  const url = new URL(origin);
  if (
    process.env.BILAN_VALIDATION_LOCAL !== '1' ||
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.port !== '3017'
  ) {
    throw new Error('BILAN_VALIDATION_LOCAL_HARNESS_REQUIRED');
  }
}
