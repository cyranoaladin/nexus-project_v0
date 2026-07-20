# Audit du registre curriculum

## Verdict

**NO-GO.** Le registre est minimal (Mathématiques seulement, 8 entrées) et ses transitions nominales sont cohérentes, mais il est orphelin, sa provenance n'est pas auditable en production et son resolver accepte des années futures inconnues.

## Modélisation

Le schéma distingue prérequis et cible dans la requête (`resolve-curriculum-context.ts:14-24`) avec année, niveaux, voies et variantes. La version contient sujet, niveau, voie, variante, période d'effet, session d'examen optionnelle et sources (`curriculum.ts:52-64`). Lacunes : pas de date civile d'entrée/fin d'effet, pas de date de récupération/archive, checksum optionnel, pas de NOR obligatoire, pas de distinction statut officiel vs statut de revue Nexus. `examSession` est parsé et renvoyé mais n'entre jamais dans le filtre (`resolve...:76-108,141-151`).

## Contenu et couverture

`registry/math.ts` contient uniquement :

- cycle 4 maths 2020 et 2026 ;
- Seconde maths 2019 et 2026 ;
- Première spécialité maths 2019 et 2026 ;
- Terminale spécialité maths 2019 et 2026.

Il n'existe aucune entrée Physique-Chimie, Français, NSI, SNT ni détail complet du cycle 4. Le registre est donc réellement **minimal**, sans les couvertures ci-dessus.

## Résolution reproduite

Commande : `npm test -- --runInBand __tests__/lib/curriculum` → 3 suites, 15/15 tests passés. Les transitions nominales testées passent :

| Transition | Résultat |
|---|---|
| 3e 2025-26 → 2de 2026-27 | PASS |
| 2de 2025-26 → 1re 2026-27 | PASS |
| 1re 2025-26 → Terminale 2026-27 | PASS |
| 1re 2026-27 → Terminale 2027-28 | PASS |
| absence cible (variante) | `NO_MATCH` PASS |
| cible ambiguë injectée | `AMBIGUOUS_MATCH` PASS |

Tests directs additionnels : mauvaise voie → `NO_MATCH TARGET`; mauvaise variante → `NO_MATCH TARGET`; année `2035-2036` → **retourne** `fr-maths-premiere-speciality-2026` et `fr-maths-terminale-speciality-2026`. La logique `effectiveToAcademicYear === undefined || >= year` (`resolve...:65-73`) traite une version ouverte comme valable indéfiniment. Pour une année inconnue, le comportement exigé n'est donc pas respecté.

Cas non couverts par les tests du lot : mauvaise voie/variante prérequis, ambiguïté prérequis, chevauchement réel des périodes importées, session d'examen incompatible, transition de niveau invalide, année future inconnue.

## Sources officielles

Vérification sur les sources MEN :

- [MENE2602914A](https://www.education.gouv.fr/bo/2026/Hebdo14/MENE2602914A) est bien le programme de mathématiques de **Seconde**, applicable en 2026-2027.
- [MENE2602917A](https://www.education.gouv.fr/bo/2026/Hebdo14/MENE2602917A) correspond à la **Première spécialité**.
- [MENE2602919A](https://www.education.gouv.fr/bo/2026/Hebdo14/MENE2602919A) correspond à la **Terminale spécialité**, applicable en 2027-2028.
- Le cycle 4 relève de `MENE2602912A`, avec application progressive 5e/4e/3e en 2026/2027/2028.

Le code n'utilise `MENE2602914A` que pour Seconde (`registry/math.ts:6-13,73-82`) : il n'en fait pas un identifiant générique. En revanche, les entrées Première/Terminale utilisent des identifiants locaux génériques et des PDF sans NOR exact obligatoire. Aucun document officiel n'est archivé dans le lot ; aucun `checksumSha256` n'est fourni ; aucune date de récupération n'est modélisée. Une URL seule ne satisfait pas l'auditabilité.

## Architecture et non-régression

`rg` ne trouve aucun import runtime hors `lib/curriculum` et ses tests. Il n'est donc utilisé ni par diagnostics, scoring, RAG, routes ni rapports. Le registre TypeScript impose recompilation et le barrel n'est pas `server-only`. Aucun Assessment/Bilan ne conserve un snapshot du curriculum ; une mise à jour pourrait changer l'interprétation historique.

## Conditions de levée

Bornes explicites ou politique `UNKNOWN`, archive immuable + checksum + retrievedAt + NOR, filtre session, tests négatifs complets, module serveur, branchement sur definition/scoring/RAG, snapshot par tentative/rapport et stratégie de stockage/version sans recompilation si exigée en production.
