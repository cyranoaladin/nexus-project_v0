# Carte frontend

## Dashboards existants

| Surface | Existant lié aux bilans | Manque cible |
|---|---|---|
| Élève | dashboard à rubriques, cartes de rapports de stage, EAF/Maths questionnaires, pages Bilan/Diagnostic dédiées | catalogue affecté, tentative générique, autosave/reprise, états de job, rapport `STUDENT` unifié |
| Parent | sélecteur/enfants, dashboard, vue stage et PDF parent | bibliothèque par enfant, uniquement publications `PARENT`, révocation/version |
| Coach | élèves, dossiers, EAF, Maths, NPC, stages, rapports générés | file de revue unifiée, preuve itemisée, publication par audience, polling robuste |
| Assistante | coordination, utilisateurs, stages | état opérationnel minimal des jobs/liens sans données pédagogiques excessives |
| Admin | gestion globale/stages | catalogue de définitions, versions, curriculum, audit et DLQ |

## Chaînes et routes UI

- `/bilan-gratuit/assessment` : `AssessmentRunner` autonome public, traitement et polling toutes les deux secondes, résultat hors dashboard.
- `/bilan-pallier2-maths` : portail Diagnostic spécialisé et page de résultat partageable.
- `/dashboard/eleve` : rubrique `bilans` intitulée principalement « rapports de stage ».
- `/dashboard/eleve/bilans/[publicShareId]` : lecteur Bilan sécurisé existant.
- `/dashboard/parent/stages/[stageSlug]` et vues enfants : assemblage StageBilan/Bilan/PDF.
- surfaces coach EAF, Maths printemps, NPC et stages : formulaires et rapports spécifiques dupliqués.

Le mapping `toBilan` du payload élève dirige actuellement un enregistrement `Bilan` vers `/bilan-pallier2-maths/resultat/{publicShareId}`, page qui lit l'API `Diagnostic`. La route sécurisée `/api/student/bilans/[publicShareId]` et la page dashboard correspondante existent : la navigation est incohérente et peut produire une route morte/faux 404.

## Défauts UX/architecture

- Aucun composant générique n'implémente l'état `STARTED/IN_PROGRESS` avec sauvegarde optimiste et reprise multi-appareil.
- Les composants matière/stage dupliquent disponibilité, complétude, génération et publication.
- `GeneratedReportsPanel` demande un rafraîchissement manuel ; le polling n'est pas centralisé.
- Les erreurs RAG/LLM/PDF ne sont pas distinguées d'un « rapport pas encore prêt ».
- La page résultat Assessment reçoit plusieurs audiences dans le même contrat backend.
- Les corrections des questions Assessment sont exposables au client car la banque est importée par un composant client.
- Le frontend public demande des données identitaires qui devraient venir de la session dans le parcours authentifié.

## Intégration cible : « Mon diagnostic de rentrée »

Ne pas créer un nouveau portail. Ajouter une entrée dans la navigation/rubrique du dashboard élève existant, avec routes sous `/dashboard/eleve/diagnostics` : catalogue serveur, tentative, reprise et résultat. Les composants reçoivent uniquement une projection publique de question sans solution, barème ni explication.

Le dashboard parent réutilise son sélecteur d'enfant puis affiche `/dashboard/parent/enfants/[id]/diagnostics` avec les seules publications parent. Le dossier coach ajoute un onglet diagnostics et une file de revue ; admin/responsable pédagogique gère définitions et questions. Les anciens portails restent derrière des adaptateurs et feature flags pendant la transition.

## Composants génériques à viser

`DiagnosticCatalog`, `AttemptShell`, `QuestionRenderer`, `AutosaveIndicator`, `AttemptProgress`, `DeterministicResult`, `ReportJobStatus`, `AudienceReportViewer`, `ReviewWorkbench`. Ils consomment des contrats serveur versionnés, des statuts explicites et des erreurs typées. Les widgets spécifiques à une matière restent des renderers enregistrés, pas des pipelines.

## Accessibilité

Le parcours doit être clavier complet, compatible lecteur d'écran, sans timer visuel seul, avec reprise après interruption, erreurs associées aux champs, annonces `aria-live` non bavardes, contraste, focus restauré et accommodations snapshotées. Une réponse « non étudié » doit être accessible comme choix sémantique, non comme bouton de correction.
