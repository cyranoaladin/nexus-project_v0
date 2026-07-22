# Pré-rentrée 2026 — contrat commercial et kit semaine 1

## Statut

Architecture approuvée le 20 juillet 2026. Le package reste en revue tant que les validations juridique, pédagogique et de diffusion ne sont pas clôturées.

## Objectif

Créer une façade commerciale compilée, reliée aux identifiants de `data/pricing.canonical.json`, puis produire un kit de campagne de première semaine complet sans exposer SNT en Seconde, les manuels ou la remise annuelle non validée.

## Architecture

La source éditoriale commerciale ne contient aucun montant. Elle référence un `pricingId`; le compilateur charge prix, acompte, durée et capacité depuis `lib/pricing.ts`. Un registre de preuves fermé porte les validations et les décisions. Le filtre public centralisé n'autorise que les offres et claims dont toutes les preuves sont approuvées.

Le kit semaine 1 est une source éditoriale structurée. Un renderer déterministe produit SVG, PNG, WebP, PDF, SRT, MP4 motion design, CSV et manifeste SHA-256 dans un dossier versionné hors de `public/`. Les exports ne sont donc pas servis par le site avant validation de diffusion.

## Contrat commercial

Chaque offre compilée expose : `offerId`, `pricingId`, niveau, matière(s), public, heures, séances, effectifs, prix, acompte, objectifs, inclusions, options, exclusions, supports, suivi, CTA, preuves, statut public, approbateurs et dates.

L'exception 3e à 350 TND pour 10 heures et six élèves maximum est approuvée, datée du 20 juillet 2026 et limitée à l'édition `pre-rentree-2026`. Elle ne modifie pas le plancher global `stage_college`.

## Filtrage public

- SNT est absent des offres et contenus publics de Seconde.
- NSI reste limitée à Première et Terminale.
- Les manuels et la remise annuelle de 10 % sont modélisés mais non publiables.
- Un service ne peut être inclus publiquement que si la preuve applicable est approuvée.
- Le statut technique d'un fichier ne vaut jamais validation pédagogique ou juridique.

## Kit semaine 1

Le kit comprend les cinq déclinaisons du visuel principal, un carrousel de huit slides, trois séquences Story de trois frames, un Reel motion design de 25 à 35 secondes avec voix off et sous-titres, quatre variantes de texte principal, un calendrier de sept jours en JSON/CSV/PDF et les scripts WhatsApp associés.

## Qualité

Les tests contrôlent les prix dérivés, matières, preuves, mots internes, complétude éditoriale, références d'assets, dimensions, formats, SHA-256 et cohérence des CTA. Les rendus sont inspectés sous forme d'images avant le commit du lot 2.

## Rollback

Les nouveaux consommateurs utilisent un adaptateur isolé. Le retrait consiste à revenir les commits des lots sans modifier l'historique tarifaire antérieur ni les pages publiques tant que le lot 7 n'est pas engagé.
