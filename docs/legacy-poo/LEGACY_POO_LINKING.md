# Rattacher manuellement une trace historique à un élève

## Principe

Aucune association n'est jamais déduite (ni du nom, ni de l'alias, ni du style de code). Le rattachement est une **décision humaine explicite** : l'enseignant désigne une trace ET un élève, lit le plan, puis exécute avec le jeton de confirmation affiché.

L'archive est ouverte **en lecture seule**. Elle n'est jamais modifiée ni supprimée ; son empreinte SHA-256 est relevée avant/après chaque opération.

## État actuel

L'archive contient **0 trace** (voir `LEGACY_POO_INVENTORY.md`). Cette procédure sert si des traces apparaissent (par exemple si des dépôts arrivent sur le service historique, ou si une archive plus ancienne est retrouvée).

## Procédure

Depuis un compte pouvant lire l'archive (le répertoire historique est en `0700 nexus-poo` : root) :

```bash
# 1. Inventaire (lecture seule). --snapshot-out écrit un instantané de métadonnées, sans contenu.
npx tsx scripts/espace/legacy-poo.ts inventory --db /var/lib/nexus-poo/traces.sqlite3 --snapshot-out ""

# 2. Plan (dry-run) : aperçu, aucune écriture. Affiche le jeton de confirmation.
npx tsx scripts/espace/legacy-poo.ts plan --db <archive> --trace <identifiant-de-depot> --student adam.c
#    ou, si l'alias est unique :  --alias POO01

# 3. Rattachement, seulement après décision explicite.
npx tsx scripts/espace/legacy-poo.ts link --db <archive> --trace <identifiant-de-depot> --student adam.c \
    --confirm 'LINK:<identifiant-de-depot>:adam.c' --as alaeddine --execute
```

## Ce que l'outil refuse

| Cas | Refus |
|---|---|
| Ni trace ni alias fournis | `TRACE_NOT_SPECIFIED` |
| Trace introuvable | `TRACE_NOT_FOUND` |
| Alias partagé par plusieurs dépôts | `AMBIGUOUS_ALIAS` (liste les candidats : choisir l'identifiant de dépôt) |
| Trace non conforme / version de leçon incompatible | `INVALID_TRACE` / `INCOMPATIBLE_VERSION` |
| Élève inconnu, non-élève, ou non inscrit en NSI | `STUDENT_NOT_FOUND` / `STUDENT_NOT_ENROLLED` |
| Trace déjà rattachée à un autre élève | `ALREADY_LINKED_ELSEWHERE` (pas de double import) |
| L'élève a déjà du travail sur ce TP | `STUDENT_HAS_WORK` (rien n'est écrasé) |
| Jeton de confirmation absent ou différent | `CONFIRMATION_MISMATCH` |

Relier deux fois la même paire ne fait rien (idempotent).

## Ce qui est enregistré

Un `EspaceWork` (statut « en cours », dates historiques conservées), une version `LEGACY_IMPORT`, et une ligne `espace_legacy_links` : identifiant de dépôt, empreinte du dépôt, alias d'origine, empreinte du fichier source au moment du lien, élève, enseignant à l'origine de l'opération, date.

## Rollback

Un lien est une écriture additive dans l'espace ; la source n'est pas touchée. Pour annuler une erreur de rattachement, demander une décision humaine : ne pas supprimer de lignes (`espace_legacy_links` et `espace_works` sont en `RESTRICT` par conception).
