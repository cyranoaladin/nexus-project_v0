# Rapports ARIA navigateur : contrat producteur/consommateur

## Défaut observé

Le job desktop du run 37170723215 sur 699343b4bb03a5b336d94f0ad3c905bc8bf2420f a exécuté les 42 tests avec succès, puis échoué dans « Prepare private-data-free ARIA browser report » avec PLAYWRIGHT_REPORT_READ_FAILED. La matrice demandait .artifacts/aria/report.json ; le runner canonique produit .artifacts/aria/playwright/aria-desktop/report.json. Les trois autres lanes utilisaient la même ancienne racine.

## Correction

Chaque lane consomme son répertoire exact, issu du projet passé au même runner dans package.json. Le contrat de gouvernance contrôle les quatre chemins ; un test compare indépendamment les scripts producteurs aux chemins consommateurs et quatre tests négatifs refusent la racine obsolète. La publication reste expurgée : aucun upload de traces privées ou de rapport brut.

## Vérification

Avant correction : 1 échec causal attendu, 24 réussites dans le fichier de contrat. Après correction : gouvernance complète, 23 suites et 238 tests réussis. Les preuves locales restent privées sous .artifacts/recovery/browser-report-path-{red,green}.log. Les lanes distantes doivent être renouvelées sur le prochain SHA ; les réussites des tests du run précédent ne prouvent pas cette correction.

## Rollback

Correction limitée aux chemins du workflow et à leur contrat. Aucun schéma, donnée ni infrastructure modifiés. Ne pas rétablir la racine obsolète pour contourner un futur échec du publisher.
