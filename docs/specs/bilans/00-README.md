# Kit d'implémentation — Tests de positionnement & Bilans

Paquet de passation destiné à **Codex**, pour implémenter le système de tests de positionnement
et la production des bilans dans `cyranoaladin/nexus-project_v0` (branche `main`).

Ce kit est **auto-portant** : specs, contrats, modèle de données, implémentation de référence
du moteur de scoring, fixtures dorées et plan de tests. Il ne contient aucune commande destructive
et ne touche pas à la production.

## Ordre de lecture obligatoire

| # | Fichier | Rôle |
|---|---------|------|
| 0 | `AGENTS.positionnement.md` | Contrat de travail. À lire **avant toute modification**. Complète `AGENTS.md`, ne le remplace pas. |
| 1 | `docs/specs/positionnement/01-domaine-et-modele-de-donnees.md` | Vocabulaire, entités, cycle de vie |
| 2 | `docs/specs/positionnement/02-moteur-de-scoring.md` | Algorithme déterministe, source de vérité du calcul |
| 3 | `docs/specs/positionnement/03-banque-d-items.md` | Format YAML des items, règles de validation |
| 4 | `docs/specs/positionnement/04-contrats-api.md` | Routes, schémas Zod, matrice RBAC |
| 5 | `docs/specs/positionnement/05-restitution-bilans.md` | Modèle 3 audiences, pipeline PDF |
| 6 | `docs/specs/positionnement/06-plan-de-tests.md` | Tests unitaires / intégration / e2e, critères de sortie |
| 7 | `docs/specs/positionnement/07-securite-rgpd.md` | Surface publique, énumération de comptes, rétention |
| 8 | `docs/specs/positionnement/BACKLOG.md` | Lots L0→L5, découpage en tickets, dépendances |
| — | `docs/adr/ADR-0012-moteur-positionnement-deterministe.md` | Décision d'architecture à committer telle quelle |

## Artefacts directement réutilisables

| Fichier | Statut |
|---------|--------|
| `prisma/schema.positionnement.prisma` | Fragment à fusionner dans `prisma/schema.prisma` |
| `lib/positionnement/types.ts` | Types TS stricts — à copier tel quel |
| `lib/positionnement/constants.ts` | Barèmes, seuils, bandes — **seule source des constantes** |
| `lib/positionnement/scoring.ts` | Implémentation de référence, pure, sans I/O, sans LLM |
| `lib/positionnement/restitution.ts` | Sélection déterministe des contenus par audience |
| `data/positionnement/item.schema.json` | JSON Schema de validation des items |
| `data/positionnement/seconde.maths.v1.yaml` | Banque d'items exemple (gabarit à dupliquer) |
| `data/positionnement/lexique-interdit.json` | Termes marketing prohibés (AGENTS.md) |
| `tests/positionnement/fixtures/golden-cases.json` | 6 cas dorés entrée→sortie |
| `__tests__/bilans/compute-facts.test.ts` | Suite unitaire du moteur |
| `__tests__/bilans/lexique-interdit.test.ts` | Garde-fou éditorial sur les bilans générés |

## Hypothèses à arbitrer (Nexus)

Ces points sont tranchés par défaut dans le kit. Ils sont réversibles, mais tout changement
invalide des fixtures — à confirmer **avant** le lot L1.

1. **Échelle de confiance à 4 niveaux sans valeur médiane** (1 à 4), seuil « haute confiance » ≥ 3.
2. **Aucun score brut affiché aux parents**, ni à l'élève. L'élève voit des couleurs par nœud + micro-plan.
3. **Aucun LLM sur le chemin de scoring ni sur la rédaction du bilan** ; ARIA reste une option
   d'enrichissement post-hoc, désactivée par défaut, sous revue humaine.
4. **Passation sans compte** : rattachement à un `Lead`, création de compte seulement après.
5. **Accès à une passation par jeton opaque**, jamais par identifiant séquentiel.
6. La recommandation de groupe est **indicative**, jamais présentée comme un engagement de résultat.
