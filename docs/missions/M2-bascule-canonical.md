# M2 — Bascule Canonical pack par pack

## Statut

Plan uniquement. Aucune route, migration, configuration ou feature flag n'est activé par ce document.

## Objectif

Basculer progressivement les nouveaux bilans depuis `Assessment` vers les agrégats Canonical, sans supprimer ni réinterpréter les données legacy. Le premier périmètre candidat est le pack `maths-terminale-v1`.

La coexistence est transitoire : Canonical est le successeur documenté, `Assessment` reste lisible pour l'historique puis devient lecture seule pack par pack.

## Préconditions bloquantes

Le premier flag reste désactivé tant que toutes les conditions suivantes ne sont pas réunies :

- le pack réel passe le schéma strict, avec 50 items complets ;
- le responsable pédagogique a relu les items, distracteurs, corrections et prompts, puis signé le pack par l'outil humain prévu ;
- toute modification postérieure du pack ou d'un prompt invalide automatiquement cette signature ;
- le pipeline mock exécuté avec le pack réel validé passe V1 à V7 sur les trois audiences, sans réseau ;
- `buildFactSheet` reste le seul point de composition de `computeScoringV2` et `computeFacts` ;
- aucun domaine évalué n'est absent de la `FactSheet` ou du rendu ;
- `validationFailures[]` bloque `PUBLISHED` en TypeScript, Zod et PostgreSQL ;
- la migration additive de `validationFailures[]` a fait l'objet d'un backup, d'une autorisation `GO DEPLOY` et d'un dry-run sur une copie fidèle ;
- l'ownership `CanonicalAssessmentAttempt → Student → Parent` est vérifié côté serveur, sans rattachement par e-mail ;
- le worker et les outbox sont idempotents, observables et testés en reprise ;
- l'écart RAG est instruit et Nexus choisit explicitement soit un corpus versionné et complet, soit un fonctionnement sans RAG ;
- lint, typecheck, Jest, build et tests d'architecture sont verts sur le SHA candidat ;
- Nexus a validé la population pilote, la fenêtre d'activation et le responsable du rollback.

## Feature flag

Le flag cible est spécifique au pack et désactivé par défaut, par exemple :

```text
BILANS_CANONICAL_MATHS_TERMINALE_V1=false
```

Le nom final et son support de configuration doivent être décidés avant implémentation. Un flag global `CANONICAL_BILANS=true` est interdit : il rendrait impossible une bascule et un retour arrière pack par pack.

Le flag gouverne ensemble :

- la création de la tentative Canonical ;
- la lecture de son état par les rôles autorisés ;
- le lancement du worker ;
- la publication du rapport après revue.

Il ne gouverne jamais les contrôles d'ownership, les validateurs ou la revue humaine : ces protections restent obligatoires dans tous les modes.

## Séquence de bascule

### 1. Déployer inactif

- déployer le code et la migration additive avec le flag à `false` ;
- vérifier les healthchecks, les contraintes de publication et les outbox ;
- confirmer qu'aucune écriture Canonical n'est produite ;
- conserver les 15 assessments legacy archivés, inaccessibles et non rattachés.

### 2. Shadow interne

- exécuter des cas synthétiques et des cas de recette sans publication ;
- comparer domaines, faits, profils et rendu déterministe ;
- vérifier l'absence de PII sortante et de chiffres produits par les agents ;
- faire relire le paquet aveugle par le responsable pédagogique.

Le shadow n'écrit pas un second rapport visible et ne transforme jamais une ligne legacy.

### 3. Pilote staff

- activer uniquement pour le pack Maths Terminale et une cohorte explicitement bornée ;
- garder toutes les audiences famille fermées jusqu'à `COACH_VALIDATED` puis `PUBLISHED` ;
- contrôler chaque transition, chaque reprise et chaque notification ;
- mesurer les violations V1 à V7, les reprises, les temps de traitement et les erreurs d'outbox.

### 4. Ouverture progressive

- élargir seulement après décision humaine documentée ;
- ne jamais activer un second pack par simple analogie ;
- recommencer pour chaque pack la validation pédagogique, le shadow et le pilote ;
- passer `Assessment` en lecture seule pour le pack basculé, sans suppression de table, colonne ou ligne.

## Critères d'arrêt immédiat

Le flag est désactivé et toute nouvelle publication suspendue si l'un des événements suivants survient :

- ownership ambigu ou accès d'une famille à un autre élève ;
- domaine évalué absent de la `FactSheet` ou du rendu ;
- chiffre d'audience écrit par un agent au lieu du rendu déterministe ;
- PII détectée à la frontière du fournisseur ;
- rapport publié avec `validationFailures[]` non vide ;
- second échec de validation marqué comme succès ;
- dérive de checksum du pack ou d'un prompt ;
- doublon, perte ou désordre non récupérable dans les outbox ;
- régression pédagogique constatée par le responsable désigné ;
- indisponibilité du corpus RAG retenu, si le pack exige le RAG.

## Retour arrière

### Avant la première écriture Canonical

Le retour arrière est une désactivation du flag. Le chemin `Assessment` reste inchangé et aucune donnée n'est à réconcilier.

### Après une écriture Canonical

Une simple désactivation ne constitue plus un rollback complet. Elle arrête les nouvelles écritures Canonical, mais les tentatives déjà créées restent la source de vérité de leur propre cycle :

- ne pas recopier automatiquement vers `Assessment` ;
- ne supprimer ni tentative, snapshot, révision, revue ou outbox ;
- laisser le staff terminer, annuler ou archiver les dossiers selon une procédure dédiée ;
- rapprocher les identifiants et états par rapport agrégé avant toute reprise ;
- réactiver seulement après correction, recette ciblée et nouveau `GO DEPLOY`.

Le retour arrière est validé lorsque les nouvelles soumissions suivent le chemin attendu, qu'aucune publication Canonical supplémentaire ne part et que toutes les écritures antérieures restent traçables.

## Observabilité minimale

Les tableaux de bord et alertes doivent exposer uniquement des agrégats sans PII :

- tentatives créées par pack et par état ;
- durée par étape et âge maximal des outbox ;
- nombre de reprises et d'échecs définitifs ;
- violations par validateur V1 à V7 ;
- transitions refusées par la machine à états ;
- notifications en attente, réussies et échouées ;
- divergences de version ou checksum du pack.

## Décisions Nexus requises avant implémentation

1. Le flag est-il porté par l'environnement de release ou par une configuration administrable et auditée ?
2. Quelle cohorte interne constitue le pilote Maths Terminale ?
3. Le premier pack fonctionne-t-il sans RAG tant que le corpus n'est pas qualifié ?
4. Quelle fenêtre autorise la migration additive et son rollback technique ?
5. Qui prononce le go/no-go après la revue pédagogique et la recette shadow ?
6. Quelle durée de coexistence en lecture seule est retenue avant dépréciation définitive d'`Assessment` ?

## Hors périmètre de M2

- suppression ou réécriture des 15 assessments legacy ;
- rattachement par e-mail ;
- activation d'un fournisseur LLM sans décision séparée ;
- publication d'un pack non signé ;
- bascule globale de toutes les matières ;
- suppression de structures legacy.
