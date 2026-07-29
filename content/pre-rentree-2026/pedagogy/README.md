# Corpus pédagogique canonique — Pré-rentrée 2026

Ce répertoire contient exclusivement les sources pédagogiques canoniques du
lot 1. Il ne constitue ni une validation disciplinaire humaine, ni une
autorisation de publication.

## Sources

- `positioning/` : spécification, référentiel, ancres de programme et 17 CPS ;
- `session-kits/` : manifeste des 85 séances, 17 index de modules et 340
  fichiers pédagogiques unitaires ;
- `manifest.yaml` : rattachements, empreintes SHA-256, sorties attendues et
  statuts de validation.

Le catalogue des modules demeure
`content/pre-rentree-2026/modules.json`. Il définit exactement 17 modules et
ne contient aucun module Physique-Chimie Seconde.

## Statut éditorial

Toutes les sources restent `HUMAN_VALIDATION_REQUIRED`. Les champs de
validation nominative sont laissés à `null` : aucune relecture humaine n'est
simulée par le pipeline.

## Utilisation

Les validateurs sous `scripts/pre-rentree/pedagogy/` lisent uniquement ce
corpus et le catalogue des modules. Les futures sorties compilées doivent être
écrites exclusivement sous
`.artifacts/pre-rentree-2026/pedagogy/`. Aucun fichier de ce répertoire ne doit
être publié directement sous `public/`.
