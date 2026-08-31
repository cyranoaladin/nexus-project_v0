# Candidat individuel - addendum avant freeze final

## Date

2026-08-31

## Statut

Le HEAD courant reste un RC intermédiaire. Cet addendum ne constitue ni une
qualification finale, ni une autorisation de build, de tag ou de cutover.

## Gate prioritaire

`P1_A` reste `OPEN`. Les deux traces live sur la production `ca2b86` sont une
précondition à tous les travaux listés ci-dessous.

Aucun `FINAL_SOURCE_SHA`, tag final, artefact final ou déploiement ne doit être
créé avant la réception et la classification de ces deux traces.

## Backlog de fermeture obligatoire

### FINDING_1 - Handoff watchdog

Après un échec de navigation prouvé, le workflow doit purger le handoff staged,
déverrouiller l'interface et proposer un retry utilisant le même `Student.id`
autoritatif sans recréer de compte ni répéter le POST de création.

Un simple délai écoulé ne doit pas supprimer silencieusement un handoff pendant
qu'une navigation lente reste active. La correction devra soit annuler
explicitement la navigation avant purge, soit effectuer la purge au moment du
retry après constat d'échec.

Tests obligatoires : élève existant, élève créé, échec synchrone, watchdog,
retry, absence de second POST et consommation unique à destination.

Gate attendu : `HANDOFF_FAILURE_PURGE = PASS`.

### FINDING_2 - Sémantique clavier

La décision retenue pour les élèves existants est la sémantique lien :

- élément HTML `a` avec destination same-tab fermée par rôle ;
- activation clavier par `Tab` puis `Enter` ;
- `Space` n'active pas un lien et ne doit pas être simulé artificiellement ;
- `Space` reste testé sur les vrais boutons, notamment la confirmation de
  création ;
- les clics modifiés ou auxiliaires ne doivent jamais stage un handoff.

Tout changement futur vers une sémantique action devra employer un vrai bouton
et garantir une navigation same-tab dure, avec `Enter` et `Space`.

Gate attendu : `KEYBOARD_SEMANTICS = PASS/DOCUMENTED`.

Fermeture : `PASS/DOCUMENTED`. Un scanner d'architecture impose l'ancre native,
le `href` fermé par rôle et l'absence de synthèse de `Space` dans tout scénario
qui manipule cette ancre. `Space` est exercé uniquement sur les vrais boutons
de confirmation, retry et rechargement.

### FINDING_3 - Anciens contrats GET de recherche

Les routes suivantes restent fermées en `405` :

- `GET /api/assistante/students?search=` ;
- `GET /api/quotes/leads/search?q=`.

Avant freeze, un scanner bloquant doit prouver qu'aucun composant, route,
script, test runtime, documentation exécutable ou bundle produit ne consomme
encore ces formes GET. Les usages de compatibilité externe éventuels doivent
être explicitement inventoriés et traités ; aucun fallback silencieux n'est
autorisé.

Gate attendu : `LEGACY_GET_SEARCH_CONSUMERS = 0`.

### FINDING_4 - Contrat de limite responsables

La borne acceptée par le schéma POST et la borne réellement appliquée par
`searchContactLeads()` doivent être identiques. Le test doit couvrir la borne,
la borne plus un, la pagination ou troncature attendue et l'absence de réponse
partielle non documentée.

Gate attendu : `LEAD_SEARCH_LIMIT_CONTRACT = CONSISTENT`.

### FINDING_5 - CI distante sur SHA exact

La lignée candidat individuel doit disposer d'un déclencheur CI gouverné qui
qualifie directement le SHA de release, sans merge ou rebase artificiel sur
`main`. Le run doit être lié au SHA exact, exécuter les checks canoniques et
être revérifié par la gouvernance distante avant toute attestation finale.

Gate attendu : `REMOTE_CI_EXACT_SHA = PASS`.

## Ordre de fermeture

1. Recevoir et classifier les deux traces P1-A sur `ca2b86`.
2. Corriger P1-A uniquement si la cause applicative est prouvée.
3. Fermer les findings 1 a 5 en TDD.
4. Rejouer toutes les qualifications sur un unique SHA candidat final.
5. Obtenir la CI distante sur ce SHA exact.
6. Créer ensuite seulement le manifeste, le build unique, l'artefact et le tag
   immuable.
7. Arrêter avant cutover pour revue des preuves.

## Production

`RUNTIME_CHANGED = NO`

`PRODUCTION_DEPLOYED = NO`

`ACTIVE_PUBLIC = NO`
