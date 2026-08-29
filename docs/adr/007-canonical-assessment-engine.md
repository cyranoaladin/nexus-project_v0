# ADR 007 — Moteur canonique de tests et bilans

## Date et statut

30 juillet 2026. Accepté pour implémentation, activation production interdite.

## Contexte

L'ADR 006 a établi `lib/pre-rentree/pedagogy/` comme frontière serveur unique
du corpus. Le produit doit maintenant gérer une affectation, une tentative
reprenable, des réponses, une correction humaine, un score, un bilan et une
publication sans copier les définitions pédagogiques dans Prisma.

Les 17 modules réels sont `HUMAN_VALIDATION_REQUIRED`. Le moteur doit donc être
complet et testable tout en refusant toute affectation réelle actuelle.

## Décision

Le domaine v1 réside sous `lib/bilans/engine/`. Il reçoit un
`AssessmentEngineContext` composé de Prisma et d'un `PedagogyCatalog`. Les
routes HTTP et services ne lisent aucun YAML ou JSON de contenu.

Prisma conserve :

- la demande et l'enfant concernés ;
- l'affectation et sa référence pédagogique immuable ;
- la tentative, les réponses et leur scellement ;
- les décisions de correction append-only ;
- les snapshots de score versionnés ;
- les artefacts, révisions, revues et publications par audience ;
- l'idempotence, l'audit et les outbox.

Le corpus conserve les items, corrigés, critères, nœuds, séances et CPS. Une
réponse stocke l'ID stable de l'item, jamais sa définition ou son corrigé.

## Workflow

```text
affectation
  -> tentative IN_PROGRESS
  -> soumission scellée
  -> PENDING_MANUAL_REVIEW si nécessaire
  -> score FINAL déterministe
  -> génération par audience
  -> revue nominative
  -> publication explicite
  -> révocation éventuelle sans suppression
```

Une soumission et toutes ses réponses sont scellées dans une transaction. Les
verrous de ligne, versions optimistes, contraintes uniques et empreintes de
payload soutiennent la concurrence et l'idempotence.

Une décision manuelle révisée crée une nouvelle ligne. Si un bilan est
publié pour une audience quelconque, toutes les publications actives doivent
d'abord être révoquées. Après révision : nouveau score, nouvelle génération,
nouvelle revue et nouvelle publication.

## Sécurité

- les ressources famille non possédées répondent 404 ;
- les routes équipe contrôlent rôle et rattachement coach ;
- tous les endpoints mutants utilisent CSRF, limite de taille, schéma strict,
  clé d'idempotence et rate limiting distribué fail-closed ;
- la projection famille exclut corrigés, rationales, critères et exemples ;
- le corpus n'est ni sous `public/`, ni hydraté dans le navigateur ;
- le flag canonique reste faux par défaut.

## Validation pédagogique

`createAssessmentAssignment` résout la définition avec l'usage `ASSIGNMENT`.
Une définition différente de `PUBLICATION_APPROVED` est refusée. Les tests
positifs injectent leur propre catalogue synthétique directement au service ;
aucune route, variable ou fixture runtime ne permet cette substitution.

Physique-Chimie Seconde reste absente et inconnue.

## Conséquences

Le moteur est testable de bout en bout au niveau domaine avec PostgreSQL réel,
sans rendre le corpus actuel affectable. Le navigateur peut être testé avec
des contrats HTTP interceptés, mais aucun E2E positif sur le catalogue réel ne
sera autorisé avant les validations humaines liées aux hashes.

Le rollback applicatif désactive le flag et les workers. Les tables additives
restent en place ; après écriture de données, un rollback SQL destructif est
interdit et doit être remplacé par une migration compensatoire.
