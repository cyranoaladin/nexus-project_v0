# Carte des sources de vérité

| Information | Source et champ | Propriétaire métier | Version | Consommateurs | Contrôle |
| --- | --- | --- | --- | --- | --- |
| Dates, pause, lieu, statuts | `data/campaigns/pre-rentree-2026.json` | Campagne | `2.0.2` | site, snapshot, documents | schéma et tests de dates |
| Quatre niveaux et cinq familles de matières | même source, `levels`, `subjects` | Pédagogie | `2.0.2` | site, Guide, planning | compte et intégrité des références |
| Quatorze créneaux, salles et gates | même source, `blocks`, `schedule`, `operationalGates` | Exploitation | `2.0.2` | planning REVIEW | 70 séances, conflits et blocage de publication |
| Capacités Fondations/Premium | même source, `capacityByOffer` | Direction | `2.0.2` | site, documents, économie | 4–6 et 3–5 |
| Demande, qualification, réservation | même source, `content`, `cta` | Direction | `2.0.2` | Guide, FAQ, site | vocabulaire et absence de paiement public |
| Quatorze modules et soixante-dix séances | `content/pre-rentree-2026/modules.json` | Pédagogie | `2026-pre-rentree-v2` | Guide, programmes, artefacts pédagogiques | égalité champ par champ |
| Tests, évaluations et livrables | `pedagogy-framework.fr.json` + modules | Pédagogie | `1.0.0` | artefact de revue | 14 / 70 / 70 et cohérence |
| Tarifs Fondations et Premium | `data/pricing.canonical.json` | Tarification | `2026-2027.3` | calculateur, Guide, XLSX | acompte exact à 30 % |
| Matrice des offres | `content/pre-rentree-2026/offers.json` | Direction | `1.0.0` | site, snapshot, docs | niveaux, matières, services, capacité |
| Capacités opérationnelles | `content/pre-rentree-2026/capabilities.json` | Opérations | `1.0.0` | gates de promesses | engagement public exige six états valides |
| Registre des quatre manuels | `content/pre-rentree-2026/manuals.registry.json` | Édition | `1.0.0` | site et documents | aucune publicité sans impression, accord et stock |
| Structure du Guide | `content/pre-rentree-2026/parent-guide.fr.json` | Éditorial | `2026-parent-guide-fr-v4` | renderer | schéma fermé et evidence refs |
| WhatsApp | `content/pre-rentree-2026/whatsapp.fr.json` | Commercial | `1.0.0` | kit de revue | 24 scripts et gates |
| Facebook/Instagram/Reels | `content/pre-rentree-2026/communication.fr.json` | Communication | `1.0.0` | kit de revue | 13 publications, 8 carrousels, 12 stories, 3 reels |
| CRM, formulaires et hypothèses économiques | `content/pre-rentree-2026/operations.fr.json` | Opérations | `1.0.0` | artefact propriétaire | schéma fermé, aucune ligne nominative, coûts non inventés |
| Identité, adresse, téléphone, email | `lib/legal.ts` | Direction | `LEGAL` | tous les canaux | audit de contact |
| Conditions contractuelles | source approuvée absente | Juridique | absente | aucun paquet contractuel | blocage obligatoire |
| Notice de confidentialité | source approuvée absente | Confidentialité | absente | aucun formulaire public | blocage obligatoire |

Le compilateur calcule `sourceSetSha256` sur l’ensemble des sources. Une divergence entre campagne, modules, tarifs, offres ou planning fait échouer le build. Aucun document ou ancien PDF n’est une source.
