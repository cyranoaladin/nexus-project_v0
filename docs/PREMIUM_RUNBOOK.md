# Runbook Premium (Local)

Objectif: démarrer un environnement local premium (infra + seed + app), valider la santé et exécuter une vérification rapide.

Prérequis

- Docker / Docker Compose
- Node.js >= 18, npm
- Playwright browsers (optionnel): npm run browsers:install

Commandes principales

- Démarrage premium (arrière‑plan + checks):
  - npm run dev:premium
  - Enchaîne: infra -> reset DB -> seed -> disponibilités -> serveur dev (bg) -> health check -> smoke
- Démarrage interactif au premier plan:
  - npm run dev:full
- Vérifier la santé:
  - npm run health:check
- Vérification rapide:
  - npm run smoke
- Vérification complète multi‑navigateurs:
  - npm run smoke:all
- Rapport E2E complet (mode stable):
  - npm run e2e:report

Gestion de la base

- Reset + seed: npm run db:reset:full
- Seed sans reset: npm run seed:full
- Seed disponibilités (app en cours): npm run seed:avail

Arrêt et logs

- Arrêter le serveur dev BG: npm run dev:stop
- Logs du serveur dev: npm run dev:logs

Comptes de test

- Voir docs/TEST_ACCOUNTS.md (mot de passe: password123)

Notes

- Les scripts utilisent .env.local si présent. Adaptez au besoin depuis env.local.template.
- Les microservices RAG/PDF/LLM doivent être UP pour un parcours complet; dev:premium les démarre automatiquement.
