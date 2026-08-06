# A90.2 — Rendu HTML/PDF déterministe des bilans

## Date

2026-08-03

## Contexte

Le rendu Canonical s'arrêtait à un artefact JSON. Le bilan parent historique utilisait en parallèle PDFKit dans la route publique et React-PDF dans deux scripts locaux, avec une identité visuelle distincte.

## Décisions prises

- Le HTML A4 est une fonction pure de la FactSheet, de l'audience et de `RenderIdentity`. Le parcours qu'il affiche est celui calculé par A90.1ter.
- La palette, les polices et les deux logos proviennent de la politique versionnée `nexus-lux-print.v1`, alignée sur les tokens `lux-*` de `app/globals.css`.
- Un seul moteur PDF subsiste pour les bilans : Chromium reçoit le HTML et incorpore les assets locaux versionnés.
- `lib/pdf/bilan-parent-pdfkit.ts` conserve son nom pour compatibilité d'import, mais devient un pont vers ce moteur partagé. Il ne contient plus de code PDFKit.
- Un échec du moteur Canonical conserve le HTML et produit explicitement `BILAN_PDF_RENDER_FAILED`. Aucun buffer partiel n'est présenté comme un PDF valide.
- La comparaison déterministe neutralise uniquement les dates de création/modification et l'identifiant documentaire ajoutés par Chromium.

## Sécurité

Les HTML et les textes extraits des PDF ELEVE/PARENTS sont inspectés avec des sentinelles injectées en amont. Les scores, clés de correction, rationales et slugs techniques sont bloqués par test.

## Risques restants

- Le binaire Chromium doit être présent ou déclaré par `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Son absence rend uniquement le PDF indisponible ; le HTML reste utilisable.
- Aucune nouvelle route publique ni aucun feature flag n'est activé dans A90.2.

## Rollback

Revenir aux commits précédant A90.2. Le retour à PDFKit n'est pas un rollback acceptable isolément, car il réintroduirait deux moteurs divergents pour le bilan parent.
