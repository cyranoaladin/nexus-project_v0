# Topologie Git

## État initial

- branche : `fix/bilans-p0-curriculum` ;
- HEAD : `db04d23f3e645a2052e41e5a679a8b9443cf8dc9` ;
- branche locale `main` : même SHA ;
- remote local : `https://github.com/cyranoaladin/nexus-project_v0.git` ;
- worktree sale préexistant : `.gitignore`, documents d'audit et registre curriculum non suivi.

Le snapshot `_snapshots/bilans-context-20260711-210503` existe. Ses cinq sommes SHA256 (`branch.txt`, `head.txt`, `status.txt`, patch suivi et archive des non-suivis) ont été vérifiées avec succès depuis `nexus-project_v0`.

## Fetch

`git fetch --all --prune --tags` a terminé avec succès. Il a :

- supprimé trois références distantes devenues absentes ;
- ajouté `origin/chore/post-merge-docs` ;
- avancé `origin/main` de `db04d23f` à `c90b142c` ;
- laissé branche et worktree inchangés.

## Commits

| Candidat | SHA | Date commit | Sujet | Tree |
|---|---|---|---|---|
| Production | `1b8219b1cfcfe63354d8cb4035645143e27e5a43` | 2026-06-27 08:14:59 +01 | `perf(offres): widen hero intro to become LCP element` | `071787d3...` |
| HEAD local | `db04d23f3e645a2052e41e5a679a8b9443cf8dc9` | 2026-07-07 14:09:42 +01 | merge PR #60 API guards | `1b90a21e...` |
| origin/main | `c90b142c88d69bdc600f3f848b44ca0317c00242` | 2026-07-11 20:53:14 +01 | post-merge matrix/chores | `c455215a...` |

Les trois objets répondent `commit` à `git cat-file -t`.

## Ascendances

| Comparaison A ↔ B | Merge-base | Commits seulement A | Commits seulement B | Relation |
|---|---|---:|---:|---|
| local ↔ origin/main | `db04d23f` | 0 | 3 | local est ancêtre d'origin/main |
| local ↔ production | `1b8219b1` | 38 | 0 | production est ancêtre du local |
| origin/main ↔ production | `1b8219b1` | 41 | 0 | production est ancêtre d'origin/main |

Résultats des commandes imposées :

- local ancêtre de production : non, code retour 1 ;
- production ancêtre du local : oui, code retour 0 ;
- local ancêtre d'origin/main : oui ;
- production ancêtre d'origin/main : oui.

Le commit de production est contenu dans `origin/fix/perf-offres-lcp-hero`, `origin/main` et de nombreuses branches descendantes. Il existe donc bien sur GitHub : il n'est ni orphelin ni fabriqué localement.

## Les trois commits après le local

1. `b2ea32f0` — G-SEC, 60 fichiers, 2306 insertions/400 suppressions, guards, téléchargements, Bilans, tests sécurité et scripts de gate.
2. `ac02f548` — G-PAY fail-closed, 11 fichiers, 190 insertions/93 suppressions.
3. `c90b142c` — documentation post-merge, 3 fichiers.

## Preuves CI GitHub

| Commit | Checks observés | Résultat |
|---|---:|---|
| `origin/main@c90b142c` | 12 | tous réussis : lint, TypeScript, unit, integration, E2E, production build, security scan, invariants et CodeQL |
| local `db04d23f` | 15 | tous réussis dans les runs observés |
| production `1b8219b1` | 12 | CI Success, lint, typecheck, security et CodeQL en échec ; unit/integration/E2E/build sautés |

Les checks GitHub prouvent l'exécution de la CI configurée à ces commits. Ils ne prouvent pas à eux seuls les invariants Bilans sur PostgreSQL réel ni la correction de tous les P0.
