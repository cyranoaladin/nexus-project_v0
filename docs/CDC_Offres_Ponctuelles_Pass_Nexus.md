# CDC — Offres ponctuelles, Pass et Carte Nexus

## Statut

CDC historique retiré le 2026-06-23.

Cette ancienne spécification recopiait des montants, échéanciers et règles promotionnelles. Elle ne doit plus servir de référence opérationnelle.

## Référence actuelle

- Données : `data/pricing.canonical.json`
- Loader : `lib/pricing.ts`
- Pages publiques : `/offres` et `/stages`
- Devis assistante : `lib/assistante-devis-catalog.ts`

## Règle

Toute évolution des offres ponctuelles, Pass ou Carte Nexus doit être modélisée dans la source canonique, puis vérifiée par les tests. Ne pas ajouter de nouveau tableau de prix manuel dans `docs/`.
