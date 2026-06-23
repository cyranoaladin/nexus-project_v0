# Registre canonique — Nexus Réussite

## Statut

Registre manuel historique retiré le 2026-06-23.

Le registre ne doit plus recopier les prix dans un tableau Markdown. Les montants recopiés deviennent rapidement divergents et contredisent la règle de source unique.

## Source canonique

- Fichier de données : `data/pricing.canonical.json`
- Loader typé : `lib/pricing.ts`
- Loader opérationnel devis : `lib/assistante-devis-catalog.ts`
- Tests de cohérence : `__tests__/assistante-devis-catalog.test.ts`

## Règle

Pour auditer le catalogue, lire la source canonique ou exécuter les tests. Ne pas recréer de registre tarifaire manuel.
