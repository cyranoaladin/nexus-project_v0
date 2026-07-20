# Acteurs, capacités et permissions

## État actuel

`UserRole` contient `ADMIN`, `ASSISTANTE`, `COACH`, `PARENT`, `ELEVE`. Enseignant et responsable pédagogique n'existent pas comme rôles distincts. `CoachStudentAssignment` porte les affectations. Le rattachement familial est `ParentProfile 1—N Student`, avec `Student.parentId` obligatoire.

## Matrice cible

| Acteur | Lecture | Mutations autorisées | Interdictions / audience |
|---|---|---|---|
| Élève | ses affectations, tentatives, score autorisé, publications `STUDENT` | démarrer, autosave, reprendre, soumettre une fois, accuser réception | aucun `studentId` arbitraire ; jamais `PARENT`/`NEXUS_INTERNAL` |
| Responsable légal | enfants dont le lien est actif et ses publications `PARENT` | préférences de suivi, téléchargement privé | pas de rapport élève/interne ; pas d'autre enfant |
| Coach | élèves affectés pendant une fenêtre active, preuves nécessaires, versions internes | recommandations, revue selon capacité, demande de génération | pas d'élève non affecté ; pas de publication finale implicite |
| Enseignant | élèves/groupes et matières affectés | annotation de preuves/questions, recommandations disciplinaires | pas d'accès familial/financier par défaut |
| Responsable pédagogique | définitions, banques, versions internes, revues | valider questions, rapports et curriculums ; publier selon délégation | pas de contournement de journal/audience |
| Assistante | coordination et état opérationnel minimal | affectations administratives, relances, gestion du lien sur procédure | pas de verbatims/scores détaillés par défaut |
| Administrateur | administration contrôlée et audit | configuration et délégations | aucune suppression silencieuse ; accès sensible journalisé |
| Système automatisé | définitions/version/snapshots | affecter, émettre événements, scorer déterministement | aucune décision pédagogique libre |
| Worker | job claimé et contexte minimal | transition par CAS, écrire artefacts/version | pas d'identité client, pas de publication |
| Service RAG | requête minimisée et filtres | renvoyer chunks + provenance | aucune mutation de score, aucun document comme instruction |
| Fournisseur LLM | contexte pseudonymisé nécessaire | produire un JSON candidat | pas de score, publication, accès DB ou décision d'autorisation |

## Rattachement familial cible

Créer conceptuellement `GuardianStudentLink` : `guardianUserId`, `studentId`, type de relation, statut (`PENDING`, `VERIFIED`, `REVOKED`, `EXPIRED`), dates, méthode/preuve de vérification, permissions granulaires, auteur, motif de révocation. Toute lecture parent vérifie lien actif et permission au moment de la requête. L'historique est append-only.

La transition doit conserver `Student.parentId` pendant une période de compatibilité, backfiller un lien vérifié pour le parent historique, lire d'abord la nouvelle association sous feature flag, comparer les décisions et ne retirer l'ancien champ qu'après métriques et audit.

## Capacités plutôt que multiplication aveugle des rôles

Décision à prendre : ajouter `ENSEIGNANT`/`RESPONSABLE_PEDAGOGIQUE` à l'enum ou créer des capacités attribuables (`ASSESSMENT_ASSIGN`, `QUESTION_REVIEW`, `REPORT_REVIEW`, `REPORT_PUBLISH`, `CURRICULUM_PUBLISH`). La seconde option limite les rôles combinatoires, mais exige une gouvernance et un écran d'administration. Aucun rôle ne doit être inféré d'un libellé coach.

## Invariants d'accès

1. L'identité vient de la session ou d'un jeton signé à usage borné.
2. Le filtre d'ownership fait partie de la requête DB, pas d'un contrôle après chargement.
3. Coach : profil résolu depuis `session.user.id`, affectation active et matière/cohorte si applicable.
4. Parent : lien actif, permission et publication `PARENT` active.
5. Élève : `Student.userId`, jamais simple égalité d'email en cible.
6. Une ressource est projetée pour une audience avant sérialisation.
7. Les téléchargements utilisent une référence opaque et une autorisation recalculée ; l'URL n'est pas publique.
8. Les mutations sensibles produisent un événement d'audit avec acteur, ressource, ancien/nouvel état et corrélation.

## Risques actuels

Les POST `/api/bilans` et `/api/bilans/generate` ne prouvent pas l'affectation au bilan ciblé. Un helper historique compare parfois `coachId` au User ID plutôt qu'au `CoachProfile.id`, tandis que le helper RBAC récent résout correctement le profil : les deux conventions coexistent. La compatibilité email de l'Assessment augmente le risque d'usurpation et doit être retirée après liaison des données historiques.
