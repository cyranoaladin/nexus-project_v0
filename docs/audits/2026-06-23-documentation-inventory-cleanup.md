# Investigation et nettoyage documentaire

## Date

2026-06-23

## Contexte

Le dépôt contenait plusieurs familles documentaires : guides opérationnels actifs, audits datés, plans d'implémentation, archives pédagogiques, prototypes historiques et supports tarifaires retirés. La demande était d'investiguer toute la documentation du projet et de nettoyer les fichiers obsolètes sans masquer les décisions métier actives.

## Périmètre audité

- Documentation suivie par Git : Markdown, MDX, README, `AGENTS.md`, règles agent, dossiers `docs/`, `feuille_route/`, `ops/`, `nginx/README.md`, `scripts/README_TEST_PIPELINE.md`.
- Inventaire `docs/` avant nettoyage : 224 chemins suivis par Git.
- Inventaire documentaire large avant nettoyage : 284 chemins suivis par Git.
- Recherche de références croisées avec `rg` avant suppression.

## Problèmes observés

1. `docs/nexus_dnb_derniere_ligne_droite/` était un prototype statique complet, pas une documentation opérationnelle.
2. Ce prototype n'était référencé par aucune surface active du dépôt hors lui-même.
3. Le même dossier contenait localement des artefacts ignorés sous `docs/` : `node_modules/`, `test-results/` et rapport Playwright.
4. Six documents tarifaires avaient déjà le statut "retiré" et ne portaient plus de valeur opérationnelle.
5. Les rapports d'audit historiques restent nombreux, mais ils servent de traçabilité datée et ne doivent pas être confondus avec des consignes actives.

## Décisions prises

- Supprimer le prototype DNB statique de `docs/` : il relève d'une campagne/prototype déployé séparément, pas d'une documentation maintenable.
- Supprimer les artefacts locaux ignorés associés au prototype DNB.
- Supprimer les tombstones tarifaires remplacés par la procédure canonique.
- Conserver `docs/PROCEDURE_Integration_pricing_canonical.md`, car c'est la procédure active pour le catalogue.
- Conserver les audits datés et rapports sécurité pour preuve historique.
- Ne pas supprimer `src/static-pages/assistante-devis-v3/`, car des routes applicatives actives le servent encore.
- Ne pas supprimer `Nexus_Reussite_Accueil.html`, car `next.config.mjs` le référence encore.

## Fichiers supprimés

- `docs/nexus_dnb_derniere_ligne_droite/`
- `docs/NEXUS_BUSINESS_MODEL_2026-2027.md`
- `docs/NEXUS_CATALOGUE_PARENTS_2026-2027.md`
- `docs/NEXUS_GRILLE_TARIFAIRE_2026-2027.md`
- `docs/NEXUS_TUNNEL_VENTE_2026-2027.md`
- `docs/CDC_Offres_Ponctuelles_Pass_Nexus.md`
- `docs/REGISTRE-CANONIQUE.md`

## Fichiers modifiés

- `docs/00_INDEX.md`
- `docs/README.md`

## Résultat

- Inventaire `docs/` après nettoyage : 198 chemins suivis par Git.
- Inventaire documentaire large après nettoyage : 258 chemins suivis par Git.
- Réduction nette suivie par Git : 26 chemins, après ajout du présent rapport.
- Les artefacts ignorés du prototype DNB ont été supprimés du workspace local.
- La documentation active pointe vers `data/pricing.canonical.json` et `lib/pricing.ts` pour le catalogue.

## Risques restants

- Plusieurs audits anciens restent dans `docs/`, `docs/security/` et `docs/AUDIT_SENIOR_2026-04-19/`. Ils sont conservés pour traçabilité, mais une passe future peut les regrouper en `docs/archive/` avec un index.
- `academic-luxury-design/`, `src/static-pages/` et `Nexus_Reussite_Accueil.html` sont des prototypes ou surfaces historiques hors documentation pure. Ils n'ont pas été supprimés pendant cette passe car certains sont exclus du build TypeScript ou encore référencés par l'application.

## Rollback

Restaurer les suppressions depuis Git si un fichier supprimé s'avère encore nécessaire :

```bash
git restore --source=HEAD~1 -- docs/nexus_dnb_derniere_ligne_droite
```
