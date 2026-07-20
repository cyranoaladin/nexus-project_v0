# Réévaluation des preuves

## Règles de classement

- `VALID` : assertion toujours exacte sur `origin/main` sans changement pertinent.
- `VALID_WITH_RECHECK` : structure toujours utile, mais quelques éléments doivent être vérifiés au nouveau SHA.
- `STALE` : conclusion ou inventaire matériellement dépassé ; refaire avant usage B1.
- `INVALID` : ne décrit pas le commit canonique et ne doit pas guider un correctif.

## Matrice demandée

| Preuve | Classe | Justification | Action B1 |
|---|---|---|---|
| Inventaire des routes | `STALE` | 9 routes du périmètre et une page ont changé après `db04`; generate a désormais un scope ownership | régénérer depuis `c90b142c` |
| Inventaire des modèles | `VALID_WITH_RECHECK` | Prisma est identique entre local et origin ; l'inventaire cible reste exact ; production est plus ancienne | confirmer schéma/migrations dans le nouveau worktree |
| Findings | `VALID_WITH_RECHECK` | majorité inchangée, mais P0 ownership generate est partiellement fermé et curriculum n'est pas commité | rebaseliner chaque finding avec SHA/ligne |
| Preuves/tests | `STALE` | G-SEC ajoute/modifie tests et origin CI est plus récente ; nouveaux tests IDOR sont surtout mockés | exécuter suites ciblées puis PostgreSQL réel |
| Architecture frontend | `VALID_WITH_RECHECK` | aucun parcours Bilans principal n'a changé ; seule page admin tests dans scope | refaire inventaire de routes UI et navigation |
| Architecture backend | `STALE` | contrats, parsers et ownership Bilans ont changé | réaudit complet des routes B1 |
| RAG | `VALID` | aucune différence local→origin dans `lib/rag-client.ts` ; défauts de citations/erreurs restent | conserver findings, vérifier config seulement |
| Production | `VALID` | revalidée le 11/07 : même SHA, branche, worktree propre et PM2 online | conserver avec date, ne pas extrapoler DB |
| Sécurité | `STALE` | G-SEC a 13 rounds et modifie guards/routes/tests ; production ne les contient pas | refaire matrice route/guard/ownership au SHA canonique |

## Findings P0 reconstruits

| Finding de reconstruction | État sur `origin/main` | Classe | Commentaire |
|---|---|---|---|
| création/génération Bilan sans assignment | génération/poll scope ajouté ; création arbitraire subsiste | `STALE` dans sa formulation globale | scinder en « generate à confirmer DB » et « create ouvert » |
| fire-and-forget / jobs non durables | inchangé | `VALID` | Assessment et Bilan générique toujours process-local |
| curriculum 2035 accepté | fichiers absents de tous les commits | `INVALID` comme finding de la base | valide uniquement pour l'overlay curriculum archivé ; reprendre au Lot C |
| audiences mélangées | inchangé | `VALID` | résultat Assessment/Diagnostic et projection Bilan à traiter |
| solutions Assessment dans bundle | aucun diff | `VALID` | doit être vérifié par analyse bundle B1 |
| `__NSP__` devient incorrect | aucun diff | `VALID` | test rouge à refaire sur base canonique |
| scoring Zod invalide seulement loggé | aucun diff | `VALID` | submit inchangé sauf logs |
| identité/ownership email legacy | helper inchangé | `VALID` | compatibilité email toujours présente |

## Documents de reconstruction

| Document | Classe | Note |
|---|---|---|
| `19_CONTEXT_HANDOFF.md` | `VALID_WITH_RECHECK` | métier/cible valides ; baseline et P0 generate à amender mentalement par B0 |
| `02_CURRENT_SYSTEM_MAP.md` | `VALID_WITH_RECHECK` | chaînes inchangées ; détail ownership generate dépassé |
| `13_TARGET_ARCHITECTURE.md` | `VALID` | cible indépendante des trois commits |
| `14_CANONICAL_WORKFLOW.md` | `VALID` | cible non implémentée et inchangée |
| `16_RISKS_AND_BLOCKERS.md` | `VALID_WITH_RECHECK` | risque global valide ; P0-01 à scinder |
| `17_IMPLEMENTATION_SEQUENCE.md` | `VALID` | B1 sécurité reste le prochain lot |
| `18_DECISIONS_REQUIRED.md` | `VALID` | aucune décision structurante n'a été prise par G-SEC/G-PAY |
| Audit executive / GO_NO_GO | `VALID_WITH_RECHECK` | NO-GO produit reste fondé ; la liste exacte des P0 doit être actualisée |

## Tests et reproductibilité

GitHub rapporte 12 checks réussis sur `c90b142c`, dont unit, integration, E2E et build. Cette preuve rend la base sélectionnable, mais ne ferme pas les findings : le nouveau `bilans.generate.idor.test.ts` mocke `buildBilanWriteWhere`, `buildBilanReadWhere` et Prisma. Le gate B1 reste un test PostgreSQL réel coach A/coach B et une inspection du filtre généré.

Les tests curriculum visibles localement ne pourront pas être exécutés dans le futur worktree sans décision distincte, car leurs fichiers ne sont pas dans le commit canonique.
