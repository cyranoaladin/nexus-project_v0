# PR #74 Release Candidate Design

## Statut

Conception approuvée par le brief direction du 23 juillet 2026. Le statut public reste `REVIEW`; le meilleur statut atteignable sans GO propriétaire écrit est `READY_FOR_OWNER_GO`.

## Objectif

Transformer la branche `feat/svt-integration-clean` en candidat de release techniquement vérifiable, commercialement prudent et bloqué par défaut tant que les validations humaines ne sont pas acquises.

## Architecture

1. Les données canoniques restent la seule source des offres, capacités, tarifs, modules et planning.
2. La provenance documentaire sépare une ancre métier immuable, le commit effectivement construit et l’empreinte déterministe des sources.
3. Un gate serveur unique contrôle toutes les surfaces Pré-rentrée : page, API, métadonnées, SEO, téléchargements et préinscription.
4. Les générateurs reçoivent leurs valeurs depuis les contrats canoniques ; ils ne dupliquent ni prix ni promesse.
5. Le kit public est produit séparément des sources internes, rapports, preuves et informations d’infrastructure.

## Flux de données

`pricing.canonical.json` et les sources `content/pre-rentree-2026/` alimentent les loaders stricts, le snapshot, le site et les générateurs. Le workflow fournit explicitement `repositoryCommitSha`. Le snapshot calcule `sourceSetSha256` et conserve `sourceAnchorSha`. Les sorties sont régénérées, inventoriées, rasterisées et comparées aux données sources.

## Sécurité et publication

- Next.js est maintenu sur une version corrigée par les avis de sécurité.
- Les actions GitHub sont épinglées à des SHA immuables et utilisent Node 24.
- Les exceptions npm optionnelles sont bornées par plateforme, propriétaire, approbation, revue et expiration ; elles restent interdites dans l’artefact de production.
- `PUBLIC_READY` exige un GO écrit du propriétaire. Toute autre valeur rend les surfaces campagne non publiques.
- Les CTA restent des demandes d’information sans paiement ni réservation.

## Validation

Les changements de comportement suivent RED–GREEN–REFACTOR. La validation finale comprend installation propre, audits, lint, typecheck, unitaires, intégration, documents, build production, E2E, reproductibilité, liens, greps de conformité, revue visuelle et état Git/GitHub.

## Limites

La réconciliation avec un dépôt divergent, le merge, le déploiement, les notifications famille et toute commande de production sont hors périmètre.
