# ADR 008 — Scoring versionné et provenance historique

## Date et statut

30 juillet 2026. Accepté techniquement. Seuils de calibrage non validés.

## Problème

Une évolution ultérieure du corpus ou des règles ne doit pas réinterpréter un
bilan historique. Inversement, persister une copie éditable du corpus
créerait une seconde source de vérité.

## Décision

L'affectation scelle :

- `definitionId`, `moduleId`, version et SHA-256 de la définition ;
- version et SHA-256 du manifeste ;
- version et SHA-256 du catalogue de modules ;
- instant de résolution.

La tentative recopie cette preuve immuable pour satisfaire les garanties
historiques existantes. Les réponses ne stockent que la valeur utilisateur et
l'identifiant stable d'item.

Le score scelle :

- l'empreinte de la tentative soumise et des décisions manuelles ;
- l'identifiant, la version et le hash de la politique ;
- `PROVISIONAL` ou `FINAL` ;
- score obtenu, maximum et issues par item ;
- état de calibrage.

La politique technique v1 est `canonical-raw-item-score` `1.0.0` :

- QCM correct : 1 ;
- QCM faux : 0 ;
- absence : 0 avec issue `UNANSWERED`, distincte de `INCORRECT` ;
- réponse manuelle : valeur bornée 0–1 décidée humainement ;
- réponse techniquement invalide : issue explicite, jamais assimilée
  silencieusement à faux.

Le calcul est déterministe, sans LLM. Aucun seuil de groupe réel n'étant
validé, `calibrationStatus` reste `PENDING_POLICY_VALIDATION`. Les fixtures
peuvent tester un contrat de calibrage, mais aucune fixture n'est disponible
dans le runtime.

## Correction manuelle

Tant qu'une tâche requise n'est pas `COMPLETED` :

- un snapshot `FINAL` est interdit ;
- un calibrage définitif est interdit ;
- un bilan final est interdit ;
- une publication finale est interdite.

Un résultat `PROVISIONAL` n'est possible que si
`BILAN_PROVISIONAL_RESULTS_ENABLED=true`. Sa nature provisoire est persistée et
affichée ; elle ne peut pas être promue implicitement.

## Bilan et LLM

Le template `canonical-bilan-template-v1` produit un JSON déterministe par
audience à partir d'un snapshot final. `BILAN_REPORT_GENERATION_MODE` reste
`DISABLED` tant que le transport OpenRouter, le worker et la revue ne sont pas
livrés et qualifiés. Il n'est pas consommé par le chemin critique de ce lot.
Une future narration ne pourra ni scorer, ni inventer une compétence, ni
approuver, ni publier.

## Historique et rollback

Scores, décisions, audits et publications sont append-only ou versionnés. Une
révocation conserve les versions publiées. Après une correction révisée, les
publications actives doivent être révoquées puis régénérées.

Le rollback applicatif conserve les preuves. Une migration compensatoire est
requise si un schéma doit évoluer ; aucune migration déjà appliquée ne doit
être réécrite.
