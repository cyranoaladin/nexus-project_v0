# Inventaire probatoire du changeset local

Commande : `git status --short --untracked-files=all; git diff --stat; git diff --name-status; git diff --check; git ls-files --others --exclude-standard | sort; git diff -- .gitignore`. Résultat : aucune suppression ; un fichier suivi modifié ; vingt fichiers créés/non suivis ; `git diff --check` sans erreur.

## Fichier suivi modifié

| Fichier | Octets | SHA-256 | Finalité | Risque |
|---|---:|---|---|---|
| `.gitignore` | 4 138 | `6897fbea536adc064f23e3b016750499c2d167866c1e6d706ea7971cf9a9b1c6` | rend `docs/bilans/COMPONENT_DECISIONS.csv` suivable | faible, exception CSV très ciblée |

Diff exact : ajout de `!docs/bilans/COMPONENT_DECISIONS.csv` après les exceptions examples/fixtures.

## Fichiers créés

| Fichier | Octets | SHA-256 | Finalité / exigence | Risque |
|---|---:|---|---|---|
| `__tests__/lib/curriculum/registry.test.ts` | 1 469 | `73a7cd14851662f328194db541ea9aea57dba814bebae9ceacd20622e76fedce` | invariants registre | couverture partielle |
| `__tests__/lib/curriculum/schemas.test.ts` | 1 701 | `69bcb77a76c3e1c797282be5115133ffbe53335d1f6c95c67325f364adde7859` | validation Zod | n'impose pas checksum/archive |
| `__tests__/lib/curriculum/version-resolution.test.ts` | 4 638 | `a72cbbb264c8a0d33970d2ebeb014ac69f1eadedc0eb85c8f0f3802a50ed90ce` | transitions nominales | cas négatifs incomplets |
| `docs/bilans/BASELINE_REPOSITORIES.md` | 2 342 | `01168b104bd125f15fbe8b3d9c1c7ea8eb514977698bcec3ff9447ebbbbc5152` | baseline dépôts | documentaire |
| `docs/bilans/BASELINE_TESTS.md` | 4 025 | `f562cd7ba32b087a1acd875ae64a38da31e4c40f10444459a4ee41c150397b4b` | baseline annoncée | nombres non probants seuls |
| `docs/bilans/CAHIER_DES_CHARGES_READING_REPORT.md` | 7 680 | `13a80397116f1c1543663bbe019c7976f47825e8b591f680d5cb889d00112b76` | synthèse CdC | ne vaut pas implémentation |
| `docs/bilans/COMPONENT_DECISIONS.csv` | 10 313 | `46308d4ea746bbbc91b89fcbccd6433cec14009c20e4b190324b75c19d26780b` | décisions composants | convergence non décidée |
| `docs/bilans/CURRENT_STATE.md` | 4 544 | `810007bdb482d67b3399dddf71f6105229928c1c256ea2829ff296ef5d81edb0` | état courant | omissions de risques actifs |
| `docs/bilans/CURRICULUM_VERSIONING.md` | 3 733 | `9a70f2d44d5e13d5f866a9a0b5619d574532a3cd3670033342aa8bc8e46d4352` | politique de version | non appliquée de bout en bout |
| `docs/bilans/IMPLEMENTATION_PLAN.md` | 15 374 | `cd4f83b95f4d458f23f31db2431c8c585e380c509bf5cd47483283d75ec10221` | plan futur | architecture production incomplète |
| `docs/bilans/IMPLEMENTATION_REPORT.md` | 9 164 | `844a40c17d1d93f82ae9ea0a27963f2e5d2df9319fb69a51a67012cb4dc6cbde` | rapport précédent | assertions à requalifier |
| `docs/bilans/KNOWN_LIMITATIONS.md` | 2 159 | `b45999cc77821d1f7da1040aad80b31b27be0bff4217b5b5055a63442b892df8` | limites | liste non exhaustive |
| `docs/bilans/README.md` | 2 229 | `b828429883e48b5ef509e6dbb0f6bc3a0d3eee64dd91fba548b5b2507774c15e` | index phase 0 | documentaire |
| `docs/bilans/REPOSITORY_INVENTORY.md` | 6 990 | `576131887ea39d2db23fba6df3c4a72fe1711ff63735d2124f8ce4139c821b7b` | inventaire sources | photographie seulement |
| `docs/bilans/TARGET_ARCHITECTURE.md` | 5 140 | `ddf4bc6f2510ad931db11f47a4897189f0dd86c3b128dfee2bae5f8bb8c827b5` | cible | raccord production incomplet |
| `docs/bilans/adr/ADR-001-canonical-repository-and-integration-strategy.md` | 2 581 | `481cef430b5285a4ae90298c52139ea8485671624699a47946e0a64733219c54` | dépôt canonique | ne résout pas convergence métier |
| `lib/curriculum/index.ts` | 131 | `f411e8d2bec9631aecd3758c129b1d6d4e85450ffb410d483f637b57be2b771d` | barrel public | client-safe non garanti |
| `lib/curriculum/registry/index.ts` | 1 932 | `2b309167aacea486ef96e02fd7026022c25f999c851d90e690982dbb83ab8af6` | registre mémoire + overlaps | recompilation, orphelin |
| `lib/curriculum/registry/math.ts` | 5 971 | `2a2db26a269c4189e29c98f8e4275e353a4a70d7cccf2b812e87f5a411b615a5` | huit versions de maths | provenance incomplète |
| `lib/curriculum/schemas/curriculum.ts` | 3 409 | `cfad6a5fc58af4a5bc4bc94d83c8c9f7d1410aa6b38208875005d4d8ca197633` | schémas Zod | checksum/récupération optionnels/absents |
| `lib/curriculum/version-resolution/resolve-curriculum-context.ts` | 4 679 | `a1a647e3456836e4c7ef3ff4fd035f4f2e023932284570a8676cf9d6b7b23123` | résolution prérequis/cible | années futures acceptées |

## Imports, exports, usages et orphelins

`rg -n "curriculum|resolveCurriculumContext|CURRICULUM_REGISTRY" app components lib scripts --glob '!lib/curriculum/**'` ne trouve aucun import runtime du nouveau module. Les trois tests l'importent directement. Donc les cinq fichiers TypeScript curriculum sont **créés et testés mais non branchés**, sans chemin atteignable depuis UI/API/scoring/RAG.

Le barrel `lib/curriculum/index.ts:1-3` réexporte le registre mémoire complet sans `server-only`. Il n'est pas actuellement dans un bundle client ; une importation client future embarquerait les données. Les dépendances sont internes et `zod` existe déjà : aucune nouvelle dépendance npm n'a été introduite.

## Fichiers supprimés / ignorés rendus suivables

- Supprimé : aucun.
- Ignoré rendu suivable : uniquement `docs/bilans/COMPONENT_DECISIONS.csv`.
- Doublon applicatif : le registre n'est pas un doublon direct, mais il n'est relié ni aux définitions diagnostics ni aux banques de questions existantes.
