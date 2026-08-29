# Pré-rentrée 2026 — ancre source orpheline (2026-08-29)

## Symptôme

`Unit Tests` (check requis) échoue sur `main` et sur toute PR qui en dérive :

```
__tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts
  › compiles canonical source versions, hashes, and repository provenance
Command failed: git merge-base --is-ancestor a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0 <HEAD>
fatal: Not a valid commit name a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0
```

Constaté d'abord sur la PR #196 (gouvernance GitHub), puis confirmé **indépendant** de
cette PR : le run CI de `main` du 2026-08-29T06:41:06Z (push, run `33239060880`) échoue
avec la même erreur.

## Cause racine

`content/pre-rentree-2026/source-anchor.owner.json` déclare une « ancre métier immuable » :

```json
{
  "sourceAnchorSha": "a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0",
  "declaredByRole": "PROJECT_OWNER",
  "declaredAt": "2026-07-23"
}
```

`scripts/pre-rentree/publication-sources.ts:217` et le test consomment cette valeur et
exigent `git merge-base --is-ancestor <sourceAnchorSha> <HEAD>`.

Preuve, reproductible :

```
$ git merge-base --is-ancestor a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0 origin/main
$ echo $?
1   # NOT an ancestor

$ git log -1 --format='%H %ci %s' a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0
a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0 2026-07-14 12:00:48 +0100 \
  Merge pull request #68 from cyranoaladin/ops/harden-standalone-release-assets
```

Ce commit **existe** dans le dépôt (objet git atteignable depuis de nombreuses branches
`agent/*`, `chore/*`, etc.) mais **n'est l'ancêtre d'aucune de ces branches vers `main`** :
l'historique de `main` a été réécrit (rebase/force-push) à un moment antérieur au
2026-07-23, changeant les hashes des anciens commits sans en changer le contenu.

Preuve que le même commit logique existe toujours dans `main`, sous un hash différent :

```
$ git log origin/main --oneline --grep="harden-standalone-release-assets"
22dd01e69 Merge pull request #68 from cyranoaladin/ops/harden-standalone-release-assets

$ git log -1 --format='%H %ci %an %s' 22dd01e694e7614376911af293a5c1cc036286c4
22dd01e694e7614376911af293a5c1cc036286c4 2026-07-14 12:00:48 +0100 \
  Alaeddine Ben Rhouma  Merge pull request #68 from cyranoaladin/ops/harden-standalone-release-assets

$ git merge-base --is-ancestor 22dd01e694e7614376911af293a5c1cc036286c4 origin/main
$ echo $?
0   # IS an ancestor
```

Même auteur, même horodatage à la seconde près, même sujet, même diffstat (`147` lignes
ajoutées dans `verify-standalone-artifact.test.ts`, mêmes fichiers touchés). C'est le même
commit logique, réécrit avec un nouveau hash.

Le fichier `source-anchor.owner.json` lui-même a subi le même sort : sa première version
(commit `62de23307`) n'est pas non plus un ancêtre de `main` ; sa version rebasée
(`ca5c91135`, même sujet, même horodatage) l'est, et a recopié la valeur `sourceAnchorSha`
telle quelle — sans la corriger pour la nouvelle lignée d'historique.

## Pourquoi CI échoue « en dur » (`fatal:`) et pas juste « faux »

Le job `Unit Tests` utilise l'action `checkout` par défaut (`fetch-depth` non précisé =
clone superficiel), donc l'objet `a1192c8d...` n'est même pas présent dans le clone CI —
d'où `fatal: Not a valid commit name` plutôt qu'un simple retour « non-ancêtre ». En clone
complet local, le même test échouerait quand même (retour `1`, non-ancêtre), juste avec un
message différent.

## Correction

`sourceAnchorSha` mis à jour vers l'équivalent réel dans `main` :
`22dd01e694e7614376911af293a5c1cc036286c4`. Seul ce fichier fait autorité fonctionnellement ;
`docs/superpowers/specs/2026-07-18-pre-rentree-2026-v5-canonical-design.md` et
`docs/superpowers/plans/2026-07-18-pre-rentree-2026-v5-canonical.md` citent l'ancien hash
comme constat historique daté (« état de `main` le 2026-07-18 ») et ne sont pas modifiés —
ce ne sont pas des sources consommées par le code.

## Hors périmètre de cette correction

- Pourquoi/quand l'historique de `main` a été réécrit avant le 2026-07-23 : non élucidé ici,
  n'affecte aucune donnée en production.
- `Pré-rentrée 2026 documents / documents` (échec séparé, non requis par le ruleset) : image
  Docker `tools/pdf-generator/Dockerfile` épingle `python3.12=3.12.3-1ubuntu0.15`, plus
  disponible dans les dépôts Ubuntu (`3.12.3-1ubuntu0.16` désormais servi) — dérive de miroir
  apt, sans rapport avec cette ancre. Non traité ici.
