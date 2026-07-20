# Carte des sources de vérité

| Information publiée | Source et champ | Propriétaire métier | Version | Consommateur | Contrôle |
| --- | --- | --- | --- | --- | --- |
| Dates, statut, lieu, capacité | `data/campaigns/pre-rentree-2026.json` | Campagne | `1.0.1` | compilateur TS | tests snapshot et planning |
| Niveaux et matières | même source, `levels`, `subjects` | Pédagogie | `1.0.1` | snapshot, guide | tests 3 niveaux / 4 matières |
| Planning | même source, `blocks`, `schedule` | Pédagogie | `1.0.1` | snapshot, guide, annexe | expansion 60 séances et audit |
| Modalités publiques et FAQ | même source, `content` | Campagne | `1.0.1` | guide, annexes | provenance et vocabulaire |
| 12 modules et 60 séances | `content/pre-rentree-2026/modules.json` | Pédagogie | `2026-pre-rentree-v1` | guide et programmes | comparaison exacte des champs |
| Prix, acompte, solde, heures | `data/pricing.canonical.json`, `pre_rentree_packs` | Tarification | `2026-2027.2` | snapshot et tarifs | arithmétique et valeurs exactes |
| Identité, adresse, contact | `lib/legal.ts`, `LEGAL` | Direction | `LEGAL` | snapshot, documents | audit contact |
| Structure et transitions | `content/pre-rentree-2026/parent-guide.fr.json` | Éditorial | `2026-parent-guide-fr-v1` | Guide Parents | schéma fermé et evidence refs |
| Conditions contractuelles | source approuvée absente | Juridique | absente | aucun document public | package privé bloqué |
| Notice de confidentialité | source approuvée absente | Responsable de traitement | absente | aucun formulaire | package privé bloqué |

En cas de divergence, la compilation échoue. Aucun document généré n’est une source de vérité.
