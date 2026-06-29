# Standardisation des logs d’erreur serveur avec `serializeError`

## Date

2026-06-29

## Contexte

Après la correction CI récente (rate limit, migration, PDF, e2e), le crash circular JSON a montré que certains logs serveur capturés par Jest peuvent provoquer des erreurs de sérialisation.
Des logs existants utilisent encore `console.error(..., error)` avec des objets potentiellement non sérialisables.
Ce lot doit être traité de façon isolée, sans modifier les correctifs CI déjà validés.

## Problème observé

- Les logs serveur peuvent contenir des `Error`/objets avec références circulaires.
- Ces logs peuvent provoquer des échecs dans les pipelines quand le résultat des tests est transporté entre workers.
- Le traitement doit rester homogène entre API routes, services lib et handlers métiers.

## Décision

Créer une tâche dédiée de refactor de logs côté serveur :
- Utiliser systématiquement `serializeError` pour toute journalisation d’erreur côté serveur.
- Restreindre la tâche à ce périmètre, sans toucher au code CI / workflow ni aux migrations.

## Portée

1. Référentiel:
- Cible serveur uniquement (`app/`, `lib/`, `scripts/` backoffice, API handlers).
- Exclure : tests, clients frontaux, composants purement UI non serveur, et configuration CI.
2. Remplacement ciblé:
- Rechercher les usages de `console.error(..., error|err|e)` où l’objet d’erreur est loggué brut.
- Remplacer par `console.error(..., serializeError(error))`.
3. Cas non trivials:
- Quand le log n’est pas un objet `Error`, utiliser une sérialisation adaptée (valeur primitive ou payload propre).
- Ne pas introduire de logs supplémentaires ni modifier la sémantique métier.

## Plan

1. Faire une passe de détection (script/manual) des `console.error` serveur non sérialisés.
2. Mettre à jour chaque appel en important `serializeError` depuis `lib/utils/serialize-error`.
3. Vérifier qu’aucun fichier hors scope CI n’est modifié dans le même lot de commit.
4. Ajouter un mini-lint manuel de revue pour éviter les nouveaux usages bruts (`console.error` avec objet d’erreur).
5. Exécuter les tests ciblés éventuels pour zone touchée.

## Critères d’acceptation

- Aucun `console.error` serveur n’utilise directement un objet d’erreur brut.
- Les logs conservent leur information utile (`name`, `message`, `stack`) sans référence circulaire.
- Les correctifs CI déjà validés restent inchangés.

## Fichiers de départ recommandés

- `app/`
- `lib/`
- `scripts/` (parties serveurs éventuelles)

## Risques / garde-fous

- Risque: passer par-dessus des logs déjà structurés avec des objets métiers.
  - Mitigation: limiter aux paramètres d’erreur, garder le reste du payload.
- Risque: dépassement de périmètre (dépassement vers d’autres refactors).
  - Mitigation: 2–3 commits maximum par lot, scope checklist clair.

## Prochaine étape

Démarrer ce lot en création d’une branche dédiée `chore/serialize-server-logs` et committer le refactor uniquement après validation de la check-list ci-dessus.
