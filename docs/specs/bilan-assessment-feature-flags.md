# Matrice des feature flags — bilans canoniques

Tous les flags sont centralisés dans
`lib/bilans/requests/feature-flags.ts`, documentés dans `.env.example` et faux
par défaut. Seules les chaînes `1` et `true` activent un flag.

| Flag | Défaut | Usage v1 | Ne permet jamais |
|---|---:|---|---|
| `BILAN_CANONICAL_INTAKE_ENABLED` | faux | ouvre la frontière HTTP intake et moteur | contourner auth, provenance ou validation humaine |
| `BILAN_MATHS_TERMINALE_PILOT_ENABLED` | faux | prépare un futur ciblage pilote | affecter un module non `PUBLICATION_APPROVED` |
| `BILAN_PROVISIONAL_RESULTS_ENABLED` | faux | autorise un snapshot explicitement provisoire | score/calibrage/bilan final sans correction |
| `BILAN_TEAM_REALTIME_ENABLED` | faux | réservé au temps réel équipe | remplacer PostgreSQL/outbox ou le contrôle d'accès |
| `BILAN_LLM_ENRICHMENT_ENABLED` | faux | hors chemin critique v1 | scorer, calibrer, approuver ou publier |

## Règles

- aucune activation production dans cette branche ;
- une configuration inconnue reste fausse ;
- le flag canonique est évalué avant authentification pour ne pas exposer une
  surface désactivée ;
- l'indisponibilité Redis reste fail-closed en production ;
- les tests couvrent les valeurs par défaut et le flag provisoire ;
- toute future suppression de flag exige une ADR et un plan de migration.
