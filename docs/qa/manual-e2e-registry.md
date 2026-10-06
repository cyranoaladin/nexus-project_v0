# Registre des specs E2E à exécution manuelle

Source unique de la liste : `DOCUMENTED_EXCLUSIONS` dans `scripts/testing/e2e-ownership.mjs`,
lue aussi par `scripts/testing/e2e-execution-evidence.mjs`. Une spec exclue de la CI **n'est pas
qualifiée pour autant** : elle doit être exécutée et sa preuve rattachée au SHA de la release.

Règle de release, pour le SHA final :

```text
ALL_AUTOMATED_E2E_EXECUTED=YES
ALL_REGISTERED_MANUAL_E2E_EXECUTED=YES
MANUAL_EVIDENCE_BOUND_TO_SHA=YES
```

| Spec | Motif d'exclusion de la CI | Workflow / commande | Environnement | Propriétaire | Fréquence | Preuve requise | Révision |
|---|---|---|---|---|---|---|---|
| `e2e/prod/espace-prod-credentials.spec.ts` | Vise la production ; identifiants opérateur hors dépôt | Poste opérateur : `npx playwright test -c playwright.prod-smoke.config.ts` (`manual-rehearsals.yml`, lane `prod-smoke`, refuse de tourner sans identifiants) | Production, comptes techniques de validation | Propriétaire produit | Après chaque déploiement touchant l'Espace ou l'authentification, avant ouverture | Rapport Playwright assaini + SHA servi (`RELEASE_SOURCE_SHA`) | 2026-10-20 |
| `e2e/prod/espace-prod-recursivite.spec.ts` | Idem | Idem | Idem | Propriétaire produit | Idem | Idem | 2026-10-20 |
| `e2e/prod/espace-prod-smoke.spec.ts` | Idem | Idem | Idem | Propriétaire produit | Idem | Idem | 2026-10-20 |
| `e2e/prod/espace-prod-teacher.spec.ts` | Idem | Idem | Production, compte enseignant, lecture seule | Propriétaire produit | Idem | Idem | 2026-10-20 |
| `e2e/fallback/fallback-offline.spec.ts` | Télécharge Pyodide pendant la construction du paquet | `manual-rehearsals.yml`, lane `fallback-offline`, ou `npx playwright test -c playwright.fallback.config.ts` | Local / runner hébergé, sans base ni serveur applicatif, tout trafic externe bloqué | Responsable technique | Avant chaque release qui touche l'Espace ou son paquet de secours | Rapport Playwright + SHA testé | 2026-10-20 |

## Écarts connus (à arbitrer, non corrigés ici)

- **Écritures en production.** Trois fumées sur quatre écrivent en production, sur des comptes
  techniques de validation : réinitialisation d'un code élève (`espace-prod-credentials`), remise
  de travaux, définitive, et annotations (`espace-prod-recursivite`, `espace-prod-smoke`). Seule
  `espace-prod-teacher` est en lecture seule. L'exigence « non destructive » n'est donc pas
  satisfaite au sens strict. Options : accepter des écritures bornées aux comptes techniques, qui
  sont exclus des vues ADMIN, ou isoler un sous-ensemble en lecture seule pour la qualification.
- **Secrets d'environnement GitHub.** Le workflow hébergé ne reçoit aucun identifiant : la lane
  `prod-smoke` s'exécute depuis le poste opérateur. Une exécution hébergée exigerait un
  environnement GitHub protégé (reviewers requis) portant ces secrets.
- **Fallback en CI.** Le téléchargement de Pyodide ne justifie pas durablement l'absence de CI.
  `scripts/espace/fetch-pyodide.ts` épingle la version (`0.27.7`), mais ses sha256 sont calculés au
  premier téléchargement puis réutilisés comme référence (confiance au premier usage) : aucune
  empreinte attendue n'est versionnée. Piste : versionner `PYODIDE_SHA256.json`, vérifier le
  téléchargement contre ce fichier, puis utiliser un cache GitHub Actions dont la clé est son
  digest. En attendant, rehearsal manuel obligatoire avant release.
