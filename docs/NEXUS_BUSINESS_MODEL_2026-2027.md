# Nexus Réussite — Modèle économique 2026/2027

## Statut

Document de cadrage historique retiré le 2026-06-23.

Cette ancienne version mélangeait positionnement, stratégie commerciale et exemples tarifaires. Elle est conservée uniquement comme point d’entrée de migration, sans valeur opérationnelle.

## Sources opérationnelles

- Prix et règles commerciales : `data/pricing.canonical.json`
- Loader : `lib/pricing.ts`
- Catalogue opérationnel interne : `lib/assistante-devis-catalog.ts`
- Pages publiques : `/`, `/offres`, `/stages`, `/plateforme-aria`, `/accompagnement-scolaire`

## Règle de maintenance

Tout nouveau document de modèle économique doit séparer :

- les principes stratégiques, sans montants ;
- les règles tarifaires, toujours lues depuis la source canonique ;
- les supports commerciaux, générés depuis les pages ou le devis actif.
