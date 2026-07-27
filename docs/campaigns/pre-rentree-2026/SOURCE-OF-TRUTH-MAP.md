# Carte des sources de vérité

| Information | Source et champ | Propriétaire métier | Version | Consommateurs | Contrôle |
| --- | --- | --- | --- | --- | --- |
| Dates, lieu, statuts | `data/campaigns/pre-rentree-2026.json` | Campagne | `2.1.0` | site, snapshot, documents, campagne sociale | schéma et tests de dates |
| Cinq niveaux et sept familles de matières | même source, `levels`, `subjects` | Pédagogie | `2.1.0` | site, Guide, planning, copies sociales | 17 couples niveau/matière et intégrité des références |
| Quatre blocs, trois fenêtres, cohortes et gates | même source, `blocks`, `schedule`, `operationalGates` | Exploitation | `2.1.0` | planning public sanitizé et exports internes | 20 cohortes, 100 occurrences, conflits et blocage de publication |
| Capacités Fondations/Premium (enveloppe de plage ; la 4e ouvre à 4, exception documentée) | même source, `capacityByOffer` | Direction | `2.1.0` | site, documents, économie | 3–6 et 3–5 ; disponibilité à confirmer |
| Demande d'information et vérification des disponibilités | même source, `content`, `cta` | Direction | `2.1.0` | Guide, FAQ, site | aucun paiement ni réservation publique |
| Dix-sept modules et quatre-vingt-cinq séances modèles | `content/pre-rentree-2026/modules.json` | Pédagogie | `2026-pre-rentree-v5-planning-windows` | Guide, programmes, artefacts pédagogiques | 17 modules, 85 modèles, 5 séances et 10 h par matière |
| Vingt cohortes et cent occurrences | `data/campaigns/pre-rentree-2026.json#/schedule` | Exploitation | `2.1.0` | planning, sélecteur, PDF | 20 × 5 occurrences sans double comptage pédagogique |
| Tests, évaluations et livrables | `pedagogy-framework.fr.json` + modules | Pédagogie | `1.0.0` | artefact de revue | 17 / 85 / 85 et cohérence |
| Tarifs Fondations et Premium | `data/pricing.canonical.json` | Tarification | `2026-2027.3` | calculateur, Guide, XLSX | acompte exact à 30 % |
| Matrice des offres | `content/pre-rentree-2026/offers.json` | Direction | `1.0.0` | site, snapshot, docs | niveaux, matières, services, capacité |
| Capacités opérationnelles | `content/pre-rentree-2026/capabilities.json` | Opérations | `1.0.0` | gates de promesses | engagement public exige six états valides |
| Registre des quatre manuels | `content/pre-rentree-2026/manuals.registry.json` | Édition | `1.0.0` | site et documents | aucune publicité sans impression, accord et stock |
| Structure du Guide | `content/pre-rentree-2026/parent-guide.fr.json` | Éditorial | `2026-parent-guide-fr-v4` | renderer | schéma fermé et evidence refs |
| WhatsApp | `content/pre-rentree-2026/whatsapp.fr.json` | Commercial | `1.0.0` | kit de revue | 24 scripts et gates |
| Facebook/Instagram/Reels | contrat campagne + jetons de matières résolus depuis la campagne canonique | Communication | `2.1.0` | `assets/campaigns/pre-rentree-2026/social/PUBLIC` et `REVIEW` | dates, CTA, WhatsApp, dimensions, filigrane et checksums |
| CRM, formulaires et hypothèses économiques | `content/pre-rentree-2026/operations.fr.json` | Opérations | `1.0.0` | artefact propriétaire | schéma fermé, aucune ligne nominative, coûts non inventés |
| Identité, adresse, téléphone, email | `lib/legal.ts` | Direction | `LEGAL` | tous les canaux | audit de contact |
| Conditions contractuelles | source approuvée absente | Juridique | absente | aucun paquet contractuel | blocage obligatoire |
| Notice de confidentialité | source approuvée absente | Confidentialité | absente | aucun formulaire public | blocage obligatoire |

Le compilateur calcule `sourceSetSha256` sur l’ensemble des sources. Une divergence entre campagne, modules, tarifs, offres ou planning fait échouer le build. Aucun document ou ancien PDF n’est une source.
