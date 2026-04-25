# Roadmap contenus Première STMG

Statut : structure technique scaffoldée en Phase 2. Les skill graphs, définitions diagnostiques et banque initiale Maths STMG existent. Les contenus pédagogiques détaillés restent à enrichir par Shark et l'équipe Nexus.

## Modules créés

- `maths_premiere_stmg` : suites financières, fonctions, évolutions/indices, statistiques à deux variables, probabilités/binomiale, algorithmique tableur.
- `sgn_premiere_stmg` : sciences de gestion et numérique, 8 domaines structurants.
- `management_premiere_stmg` : organisation, pilotage, choix organisationnels, performance.
- `droit_eco_premiere_stmg` : sources/personnes/contrat/responsabilité, marché/prix/financement/régulation.

## À enrichir

- Exercices progressifs par compétence, avec corrections détaillées.
- Mode Survie : Shark doit fournir 30 questions QCM simulées additionnelles, calquées strictement sur les sujets 0 technologiques (`lib/survival/qcm-bank.ts` contient déjà les 24 questions de départ et le placeholder).
- Fiches méthode RAG par domaine et par chapitre.
- Supports coach : cas d'organisation, dossiers documentaires, grilles de correction.
- Barèmes fins par module STMG, à valider pédagogiquement.
- Ingestion RAG dédiée STMG dans les collections `ressources_pedagogiques_premiere_stmg_*`.

## Points de vigilance

- Ne pas réutiliser les barèmes EDS pour STMG.
- Garder les exemples contextualisés gestion/organisation/droit-économie.
- Séparer Français EAF sur `https://eaf.nexusreussite.academy`.
