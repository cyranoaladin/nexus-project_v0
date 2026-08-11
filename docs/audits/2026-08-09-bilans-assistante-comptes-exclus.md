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
- Une identité élève sans prénom ni nom pouvait échouer pendant le rendu, après la transition de validation.
- Une publication interrompue après validation ne pouvait être reprise que par l’assistante ayant créé la revue approuvée.

## Décisions prises

- L’alias demeure la seule identité du snapshot, de la FactSheet, de la révision et de l’entrée du moteur.
- Le vrai prénom/nom est construit depuis `reportArtifact.student.user` et injecté uniquement dans l’en-tête HTML/PDF.
- Les PDF de revue sont générés à la demande pour `ELEVE`, `PARENTS` et `NEXUS`, sans persistance, avec `Cache-Control: private, no-store`.
- Les trois matérialisations historiques recensées ne sont pas réécrites.
- Les comptes synthétiques sont seulement exclus de la recherche de saisie papier. Toute suppression exige une décision humaine séparée.
- L’identité humaine est vérifiée avant validation ; une fiche incomplète apparaît comme blocage lisible et ne change aucun état canonique.
- Une matérialisation interrompue peut être relancée par une autre assistante : l’autorisation reste `ASSISTANTE`, tandis que la revue approuvée existante demeure la trace humaine de validation.

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

- Tests ciblés de pseudonymité, matérialisation et PDF Chromium, dont l’extraction contenant exactement `é à è ê ç`.
- Tests de route staff pour les trois audiences, inline et téléchargement, ainsi que le refus parent/élève.
- Tests du filtrage des deux identités du foyer, de la recherche par nom complet et des cinq étapes.
- Suite complète sans filtre : 756 suites, 8 461 tests et 7 snapshots, tous verts.
- `npm run typecheck` : vert.
- `npm run lint` : vert, avec les avertissements préexistants limités au candidat libre non modifié.
- Le contrôle du build de l’artefact final est consigné dans la PR.

## Captures de contrôle

Les captures utilisent exclusivement le seed E2E local (`Ahmed Dupont`) sur une base PostgreSQL éphémère ; elles ne contiennent aucune donnée de production :

- `docs/audits/captures/2026-08-09-bilans-assistante/02-saisie-etape-1.png` ;
- `docs/audits/captures/2026-08-09-bilans-assistante/03-saisie-etape-2-recherche.png` ;
- `docs/audits/captures/2026-08-09-bilans-assistante/04-saisie-etape-3-matiere.png` ;
- `docs/audits/captures/2026-08-09-bilans-assistante/05-saisie-etape-4-reponses.png` ;
- `docs/audits/captures/2026-08-09-bilans-assistante/06-saisie-etape-5-validation.png` ;
- `docs/audits/captures/2026-08-09-bilans-assistante/07-revue-en-attente-pdf.png` ;
- `docs/audits/captures/2026-08-09-bilans-assistante/08-previsualisation-trois-audiences.png`.

Le parcours réel local a vérifié 18 réponses, la création d’un rapport en attente, trois routes PDF `200 application/pdf` avec signature `%PDF`, et une redirection middleware `302` du parent vers son dashboard. La route elle-même renvoie `404` aux rôles parent/élève dans son test d’accès isolé.

Après la saisie locale, la lecture SQL de contrôle a confirmé : provenance `SAISIE_PAPIER`, état `REPORT_PENDING_REVIEW`, même alias `ELEVE_…` dans snapshot et révision, absence du vrai nom dans ces deux JSON, et aucune matérialisation avant validation.

## Résultats

- Aucun compte supprimé.
- Aucune migration créée.
- Aucune écriture ou reprise des matérialisations historiques.
- Le contrôle d’accès staff existant est conservé ; le middleware `ADMIN` n’est pas modifié.
- La contre-revue finale ne relève aucun constat bloquant ou important.

## Risques restants

- Les documents déjà matérialisés avant cette correction gardent leur en-tête historique pseudonyme, conformément à la décision de ne pas réécrire les lignes append-only.
- Les comptes listés restent présents en base et peuvent servir à un audit ultérieur tant qu’une décision humaine de suppression n’est pas prise.
- Le paramètre interne `reviewerId` du service de publication pourrait être renommé `publisherId` lors d’une évolution future ; il n’affecte ni l’autorisation ni la traçabilité de la revue approuvée dans cette PR.

## Rollback

Revenir au commit antérieur suffit : aucun changement de schéma, aucune migration et aucune opération de données ne sont associés à cette PR.
