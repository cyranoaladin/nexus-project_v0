# Plan d'implémentation — Campagne multicanale Pré-rentrée 2026

## Objectif

Livrer une campagne complète, publiable après validation propriétaire, dérivée du contrat commercial canonique et couvrant la période du 20 juillet au démarrage des stages le 17 août 2026.

## Contraintes retenues

- Aucun montant éditorial dupliqué : les tarifs sont injectés depuis le snapshot du contrat commercial, lui-même dérivé de `data/pricing.canonical.json`.
- Aucun contenu public ne mentionne SNT en Seconde, les manuels, la remise annuelle ou une preuve non approuvée.
- Les créations restent typographiques et vectorielles : logo officiel, polices sous licence et aucun média tiers.
- Chaque objet porte les métadonnées de publication demandées et référence des fichiers existants.
- Les exports sont déterministes et contrôlés en dimensions, contraste, débordement et intégrité SHA-256.

## Étapes

- [x] Ajouter des tests contractuels rouges pour les volumes, les champs obligatoires, les preuves, les matières et les références d'assets.
- [x] Créer la source éditoriale complète : 13 publications, 8 carrousels, 12 séquences Story de 3 frames, 3 Reels et calendrier jusqu'au 17 août.
- [x] Implémenter le générateur déterministe des SVG, PNG, WebP, PDF, SRT, MP4, copies WhatsApp, CSV et manifeste.
- [x] Générer tous les exports et exécuter les tests ciblés.
- [x] Inspecter visuellement les planches de contact et des rendus originaux représentatifs.
- [x] Vérifier la reproductibilité, les références, l'hygiène du dépôt et les suites Pré-rentrée complètes.
- [x] Committer et pousser uniquement sur `integration/canonical-fusion-20260720`.

## Vérification attendue

- 13 visuels de publication avec source SVG, PNG et WebP.
- 8 carrousels complets avec sources, slides PNG/WebP et PDF.
- 12 séquences Story, soit 36 frames avec sources SVG et exports PNG/WebP.
- 3 Reels complets avec voix off, timeline, script, SRT, storyboard PDF, couverture et MP4 motion design.
- Calendrier JSON/CSV/PDF couvrant la campagne jusqu'au 17 août.
- Manifeste sans référence cassée et QA visuelle sans P0.
