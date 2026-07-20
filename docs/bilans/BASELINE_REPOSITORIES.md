# État initial des dépôts

## Capture

- Date : `2026-07-10T22:28:50+01:00` (Africa/Tunis)
- Workspace : `/home/alaeddine/Projets/nexus-bilans-workspace`
- Les six dépôts étaient propres (`git status --short` vide) à la capture initiale.
- Aucun nettoyage, reset, restore, checkout ou suppression n'a été exécuté.

| Dépôt | Chemin | Branche | HEAD | État initial | Rôle | Écriture |
|---|---|---|---|---|---|---|
| `nexus-project_v0` | `/home/alaeddine/Projets/nexus-bilans-workspace/nexus-project_v0` | `main` | `db04d23f3e645a2052e41e5a679a8b9443cf8dc9` | propre | application de production canonique | autorisée |
| `Interface_Maths_2025_2026` | `/home/alaeddine/Projets/nexus-bilans-workspace/Interface_Maths_2025_2026` | `main` | `50690efc5df180cb99731fbb82b9e75bea597cb8` | propre | portail Maths historique et chaîne `opt/math-correction` | lecture seule |
| `Interface_NSI_Bilan_Support_Suivi` | `/home/alaeddine/Projets/nexus-bilans-workspace/Interface_NSI_Bilan_Support_Suivi` | `main` | `1b6c749f232043997c79cb990b9f47609848c954` | propre | questionnaire NSI, worker BullMQ, stockage objet et scripts RAG | lecture seule |
| `Interface_Maths_2025_2026_Fixed` | `/home/alaeddine/Projets/nexus-bilans-workspace/Interface_Maths_2025_2026_Fixed` | `main` | `ef70bcc849c98c91df8b1f6ab1f51a2d41003dae` | propre | schémas de bilans statiques et rendu legacy | lecture seule |
| `nexus-reussite-app` | `/home/alaeddine/Projets/nexus-bilans-workspace/nexus-reussite-app` | `main` | `8f029664e4fcfcca1fa86031de169f71d7701e04` | propre | spécifications produit/RBAC/design, prototype non canonique | lecture seule |
| `NSI_cours_accompagnement` | `/home/alaeddine/Projets/nexus-bilans-workspace/NSI_cours_accompagnement` | `main` | `4b76c350badc8a192f4c57cb776644d464dbc395` | propre | contenus NSI, prototype quiz et prompts historiques | lecture seule |

## Modifications préexistantes

Aucune modification suivie par Git n'était présente dans les six dépôts au début de la mission. Les installations et sorties de build locales de `nexus-project_v0` sont ignorées par Git et ne constituent pas des changements de source.

## Contrôle d'intégrité

Les cinq dépôts sources ont de nouveau été contrôlés après l'installation, les tests et le build du dépôt principal : leur statut Git est resté vide.
