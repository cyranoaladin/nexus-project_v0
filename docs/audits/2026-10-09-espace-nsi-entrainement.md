# Espace — module « Préparation de l'évaluation » NSI (sujets d'entraînement corrigés)

## Date

2026-10-09.

## Contexte

Les élèves de Terminale NSI préparent une évaluation sur les TAD, la POO et la programmation
récursive. Deux sujets d'entraînement complets (format de l'évaluation du 10/11/2025 : QCM 8 pts,
récursivité 7 pts, TAD 7 pts, POO 6 pts), leurs corrigés détaillés (méthode, pièges, barème) et
une fiche de préparation ont été rédigés et relus le 2026-10-09. Ils étaient déjà diffusés via
`/ateliers/poo` (code de séance) ; le propriétaire a demandé leur intégration dans `/espace`.

## Décisions prises

- Nouvelle activité `nsi-entrainement-evaluation` (module `entrainement-evaluation`), de kind
  `UPLOAD_EXERCISE` sur le modèle de `maths-suites-synthese` : téléchargement des PDF et dépôt
  de copie (corrigeable ensuite dans `/espace/enseignant/a-corriger`).
- **Choix pédagogique assumé** : les cinq documents, corrigés détaillés compris, sont d'audience
  `STUDENT` (auto-correction en autonomie). C'est une exception à la convention « corrigés =
  TEACHER », motivée par la nature d'entraînement du module et cohérente avec la diffusion déjà
  faite sur `/ateliers/poo`. Pour restreindre un corrigé : passer son `audience` à `'TEACHER'`
  dans `lib/espace/catalog.ts`.
- Thème d'affichage distinct « Préparation de l'évaluation » dans la matière NSI.
- `contentVersion: '2026-10.1'`.

## Fichiers modifiés

- `lib/espace/lesson-routes.ts` — slug `NSI_ENTRAINEMENT_ACTIVITY_SLUG` + route
  `/espace/nsi/entrainement-evaluation`.
- `lib/espace/catalog.ts` — entrée `ActivityDef` (5 ressources STUDENT).
- `app/espace/nsi/entrainement-evaluation/page.tsx` — page élève (modèle de la page suites).
- `scripts/espace/install-resources.ts` — module `entrainement-evaluation` dans `MODULES`.
- `__tests__/lib/espace/entrainement-catalog.test.ts` — nouveau (catalogue, ressources, route,
  unicité).
- `__tests__/scripts/espace-switch-release-preflight.test.ts` — le catalogue passe de 9 à
  10 activités (mise à jour consciente du garde-fou).
- `e2e/bilan-validation/entrainement-nsi.spec.ts` — nouveau (parcours élève NSI complet +
  refus d'un élève non inscrit).

Sources des PDF (hors dépôt) : `~/Téléchargements/TP_POO_PAGE_WEB/nexus_tp_poo/ressources_privees/nsi/`
(`sujet-1.pdf`, `corrige-1.pdf`, `sujet-2.pdf`, `corrige-2.pdf`, `fiche-preparation.pdf` +
`MANIFEST.json` avec les SHA-256). Sources LaTeX :
`~/Téléchargements/TP_POO_PAGE_WEB/entrainements/`.

## Tests exécutés

Sur le banc local jetable `bilan-validation-local` (base dédiée, serveur :3017), worktree
`origin/main` (2990a586d) + cette branche :

1. `jest.unit.config.js` scope espace + scripts : **2217/2217 verts** (165 suites), dont le
   nouveau test et le préflight mis à jour.
2. Suite complète `playwright.bilan-validation.config.ts` (avant modification du catalogue) :
   34/39 verts. Les 5 échecs sont environnementaux ou flake, pas des régressions :
   - 4 × `espace-bilan.spec.ts` : exigent `BILAN_TEST_CREDENTIALS` (credentials de banc hors
     Git, cf. `docs/qa/manual-e2e-registry.md`), non fournis sur ce poste ;
   - 1 × `enrichment.spec.ts` (3e) : formulaire de connexion resté désactivé sous charge ;
     repasse en isolation (voir Résultats).
3. `entrainement-nsi.spec.ts` : **2/2 verts** (téléchargement des 5 PDF vérifié par signature
   `%PDF` et content-type ; dépôt de copie ; refus page + API pour un élève non NSI).
4. `install-resources.ts --execute` : 5 fichiers installés, empreintes vérifiées après copie.
5. `provision.ts sync-activities --execute` : 10 activités synchronisées,
   `nsi-entrainement-evaluation` créée.
6. Lint, typecheck, build : voir rapport de la branche (typecheck porte 5 erreurs préexistantes
   dans `scripts/core-v2/migration/apply.ts`, hors périmètre).

## Résultats

Voir ci-dessus. Aucune régression détectée sur le périmètre espace.

## Risques restants

- Les corrigés sont téléchargeables dès l'inscription NSI : un élève peut lire le corrigé avant
  de chercher. Risque pédagogique accepté par le propriétaire ; réversible par activité.
- Le déploiement exige, comme pour tout module : installation des PDF sur le serveur dans
  `$DOCUMENT_STORAGE_ROOT/espace/resources/entrainement-evaluation/` puis
  `provision.ts sync-activities --execute`, sinon `switch-release.sh` bloque
  (`DEPLOYMENT_BLOCKED`, code 17) — c'est voulu.

## Rollback

Revert du commit de cette branche, puis `provision.ts sync-activities --execute` (l'activité
retirée du code devient `EXTRA_IN_DB`, simple avertissement non bloquant). Les PDF installés
peuvent rester en place (plus servis) ou être supprimés du stockage privé.
