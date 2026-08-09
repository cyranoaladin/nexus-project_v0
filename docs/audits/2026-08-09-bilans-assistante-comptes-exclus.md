# Bilans assistante — audit du rendu humain et comptes exclus de la recherche

## Date

9 août 2026 (Africa/Tunis).

## Contexte

L’audit porte sur le rendu HTML/PDF des bilans canoniques et sur les écrans staff :

- `/dashboard/assistante/bilans` ;
- `/dashboard/assistante/bilans/saisie-papier` ;
- `/dashboard/assistante/bilans/[revisionId]/document/[audience]`.

Les contrôles de production liés aux comptes ont été effectués en lecture seule. Aucun compte, bilan, snapshot, révision ou artefact historique n’a été modifié ou supprimé.

## Problèmes observés

- L’identité fournie au moteur et réutilisée dans l’en-tête était l’alias `ELEVE_XXXX`. La fiche `student.user` contient le prénom et le nom réels, mais ils n’étaient pas projetés dans le document humain.
- La revue assistante proposait un aperçu HTML, mais aucun PDF réel prévisualisable ou téléchargeable par audience.
- Le moteur PDF est Chromium/Playwright, et non WeasyPrint. Il embarque déjà `Fraunces-Variable.woff2` et `DMSans-Variable.woff2`; un test d’extraction réel restait nécessaire pour les glyphes français.
- La liste de revue affichait le JSON brut et seulement les éléments actionnables. Elle ne donnait pas une lecture immédiate des états diffusé/rejeté.
- Les étapes 2 et 5 du fil de saisie papier n’étaient pas réellement atteignables.
- La recherche de foyer ne filtrait pas les identités synthétiques et une sélection directe par `studentId` pouvait contourner un filtrage purement visuel.

## Décisions prises

- L’alias demeure la seule identité du snapshot, de la FactSheet, de la révision et de l’entrée du moteur.
- Le vrai prénom/nom est construit depuis `reportArtifact.student.user` et injecté uniquement dans l’en-tête HTML/PDF.
- Les PDF de revue sont générés à la demande pour `ELEVE`, `PARENTS` et `NEXUS`, sans persistance, avec `Cache-Control: private, no-store`.
- Les trois matérialisations historiques recensées ne sont pas réécrites.
- Les comptes synthétiques sont seulement exclus de la recherche de saisie papier. Toute suppression exige une décision humaine séparée.

## Comptes proposés pour décision humaine séparée

Onze comptes correspondent aux motifs validés. La liste contient uniquement leur e-mail technique et leur rôle, sans identifiant interne, téléphone ou autre donnée :

1. `eleve.smokegolive.djc0@nexus-student.local` — `ELEVE`
2. `eleve.smokegolive.xmp2@nexus-student.local` — `ELEVE`
3. `eleve.smoke.v7hr@nexus-student.local` — `ELEVE`
4. `parent-technique@nexusreussite.academy` — `PARENT`
5. `prod-smoke-golive-assistante-run2-20260805t201605z@example.test` — `ASSISTANTE`
6. `prod-smoke-golive-run2-20260805t201605z@example.test` — `PARENT`
7. `prod-smoke-golive-smoke-20260805t201515z@example.test` — `PARENT`
8. `smoke-golive-1785916102107@example.test` — `PARENT`
9. `smoke-test-residual-cmsfsdkd70009mgz55gzr57bj@invalid.residual` — `PARENT`
10. `smoke-test-residual-cmsfsdkda000cmgz5ohicobz1@invalid.residual` — `ELEVE`
11. `smoke-test-residual-cmsfsemew0000qszppb6le80j@invalid.residual` — `COACH`

Motifs appliqués, sans distinction de casse, à l’e-mail de l’élève et à celui du parent :

- `@example.test` ;
- `@invalid.residual` ;
- présence de `smoke`, `DO_NOT_USE` ou `residual` ;
- égalité avec `parent-technique@nexusreussite.academy`.

## Fichiers modifiés

- Couche de rendu : `lib/bilans/render/`, `lib/bilans/core/report-materialization.ts`, `lib/bilans/core/report-service.ts`.
- Revue staff : `lib/bilans/staff/review-service.ts`, `app/dashboard/assistante/bilans/`.
- Saisie papier : `app/dashboard/assistante/bilans/saisie-papier/`, `components/bilans/PaperEntry*.tsx`, `lib/bilans/saisie-papier/test-account-filter.ts`.
- Tests : `__tests__/bilans/` et doubles d’intégration concernés par la signature de rendu.

## Tests exécutés

- Tests ciblés de pseudonymité, matérialisation et PDF Chromium.
- Test d’extraction PDF contenant exactement `é à è ê ç`.
- Tests de route staff pour les trois audiences, inline et téléchargement.
- Tests du filtrage des deux identités du foyer et des cinq étapes.
- La suite complète, le lint, le typecheck et le build sont consignés dans la PR après exécution finale.

## Résultats

- Aucun compte supprimé.
- Aucune migration créée.
- Aucune écriture ou reprise des matérialisations historiques.
- Le contrôle d’accès staff existant est conservé ; le middleware `ADMIN` n’est pas modifié.

## Risques restants

- Les documents déjà matérialisés avant cette correction gardent leur en-tête historique pseudonyme, conformément à la décision de ne pas réécrire les lignes append-only.
- Les comptes listés restent présents en base et peuvent servir à un audit ultérieur tant qu’une décision humaine de suppression n’est pas prise.

## Rollback

Revenir au commit antérieur suffit : aucun changement de schéma, aucune migration et aucune opération de données ne sont associés à cette PR.
