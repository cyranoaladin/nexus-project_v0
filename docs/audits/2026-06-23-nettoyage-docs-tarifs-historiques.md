# Nettoyage des documents tarifaires historiques

## Date

2026-06-23

## Contexte

Après la migration de l'assistant devis vers le catalogue canonique, plusieurs documents Markdown conservaient d'anciens exemples tarifaires, mécaniques promotionnelles ou fichiers dérivés supprimés.

## Problèmes observés

- Des documents commerciaux pouvaient être lus comme des grilles actives alors qu'ils étaient historiques.
- Un ancien miroir `docs/pricing.canonical.json` divergeait de `data/pricing.canonical.json`.
- Certains plans internes pointaient encore vers les anciens tests du catalogue dérivé.

## Décisions prises

- Remplacer les documents commerciaux historiques par des pages de retrait qui renvoient aux sources actives.
- Supprimer le miroir documentaire du catalogue canonique.
- Mettre à jour la procédure d'intégration autour du schéma réel actuel.
- Retirer les références aux fichiers dérivés supprimés.

## Fichiers modifiés

- `docs/NEXUS_GRILLE_TARIFAIRE_2026-2027.md`
- `docs/NEXUS_CATALOGUE_PARENTS_2026-2027.md`
- `docs/NEXUS_TUNNEL_VENTE_2026-2027.md`
- `docs/NEXUS_BUSINESS_MODEL_2026-2027.md`
- `docs/REGISTRE-CANONIQUE.md`
- `docs/CDC_Offres_Ponctuelles_Pass_Nexus.md`
- `docs/PROCEDURE_Integration_pricing_canonical.md`
- `docs/audit-reglementaire-bac-candidats-libres-nexus.md`
- `docs/SITE-MAP.md`
- `docs/superpowers/plans/2026-06-14-assistante-devis-pdfkit.md`
- `AGENTS.md`

## Tests exécutés

- `rg` sur `docs/` hors `docs/audits/` pour les anciens libellés et champs.
- `git diff --check`
- `npm run typecheck`

## Résultats

Le grep documentaire hors audits ne retourne plus d'occurrence des anciens libellés ou champs tarifaires historiques ciblés.

## Risques restants

Les audits passés conservent volontairement des mentions historiques pour traçabilité. Ils ne sont pas des sources opérationnelles.

## Rollback

Revenir au commit précédent restaure les documents historiques complets.
