# Validation locale des bilans de septembre

Cette suite crée ses propres personnes fictives, groupes et séances pour **chaque test**, puis les supprime. Elle ne lit aucun fichier de codes d'élèves ou d'enseignants réels. Les origines distantes et les bases non jetables sont refusées avant toute création.

Prérequis : Docker, Node 22.23.1, dépendances du dépôt et navigateur Playwright Chromium installés. Aucun build complet requis.

```bash
export BILAN_VALIDATION_STATE="$HOME/.local/state/nexus-bilan-validation"
bash scripts/espace/bilan-validation-local.sh up
bash scripts/espace/bilan-validation-local.sh test
bash scripts/espace/bilan-validation-local.sh down
```

`up` crée PostgreSQL et Redis dédiés, applique les migrations uniquement sur cette base jetable et démarre Next en développement sur `http://127.0.0.1:3017`. Le port doit être libre. État privé : dossier 0700, environnement 0600, secrets générés aléatoirement. Aucun appel en production.

Pour une seule partie : `bash scripts/espace/bilan-validation-local.sh test student.spec.ts` ou `teacher.spec.ts`. Les deux fichiers partagent `fixtures.ts`, jamais leurs données. Un seul worker facilite le diagnostic. Une suite peut être relancée : chaque test repart avec de nouveaux identifiants.

Firefox et WebKit sont optionnels, avec leurs binaires et dépendances système installés. Activer `BILAN_VALIDATION_CROSS_BROWSER=1` ajoute ces projets pour les parcours élève, mobile/compte et préhydratation ; les exports PDF enseignant restent sous Chromium :

```bash
BILAN_VALIDATION_CROSS_BROWSER=1 bash scripts/espace/bilan-validation-local.sh test --project=firefox --project=webkit
```

Les captures et traces d'échecs contiennent uniquement les réponses des personnes fictives et sont dans `test-results/bilan-validation/`. Les journaux du serveur et des migrations restent dans le dossier d'état. `down` arrête uniquement le processus créé et supprime les deux conteneurs portant les noms vérifiés ; il conserve les journaux.

Pour les tests d'intégration du même chantier, sourcer le fichier `runtime.env` privé avec `set -a` / `set +a` sans l'afficher. Il définit `DATABASE_URL`, `TEST_DATABASE_URL` et `NEXUS_DISPOSABLE_POSTGRES=1`. Ne pas modifier le garde pour utiliser une base existante.

Helpers : `login(page, account)`, `goStep(page, index)` (0 à 7), `waitSaved(page)`, `bilanPath('3e'|'2nde')`, `makeCredentialTemporary(account)`. La fixture `cohort` fournit `teacher`, `otherTeacher`, `third`, `second`, `peer`, `unassigned`, les deux identifiants de séances publiées et les groupes de ce test.

Le parcours intégral affiche chaque carte de choix entièrement au centre de la fenêtre, attend que sa géométrie soit stable, puis effectue **un seul clic** et vérifie la sélection. Le diagnostic WebKit a montré qu’un clic automatisé sur un bouton radio de 16 px au bord supérieur pouvait déplacer le focus et le défilement entre `pointerdown` et `pointerup` : aucune activation `click/change` n’était émise. Aucun clic n’est répété, aucune réponse n’est injectée et le comportement du produit reste natif. Les contrôles de sauvegarde et de transmission sont conservés.
