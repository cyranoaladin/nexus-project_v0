# 09 — Amélioration différée : purge des PDF des générations remplacées

> **Statut : DIFFÉRÉ (arbitrage responsable, 14/08/2026).** L'idée est bonne,
> le moment est mauvais. À reprendre à froid si le volume le justifie.

## Le besoin

Après régénération d'un bilan **publié**, l'ancienne matérialisation subsiste
(append-only) : révision + matérialisation + 3 artefacts d'audience, dont le
**PDF en `bytea` (~563 Ko/audience, ≈ 1,7 Mo par bilan publié régénéré)**.
Ces octets ne peuvent pas être libérés : la table
`canonical_report_audience_artifacts` porte le trigger
`canonical_report_audience_artifacts_immutable` (`BEFORE UPDATE OR DELETE →
insert-only`), garant de l'inaltérabilité du diagnostic. Un `UPDATE pdf=NULL`
ou un `DELETE` est rejeté.

Les 12 attempts en attente ne matérialisent qu'à la publication → **0 octet**
échoué en les régénérant. Seul un bilan **déjà publié** paie la taxe.

## Le principe : séparer la PREUVE du RENDU

Ce qui doit rester inaltérable, c'est la **preuve du diagnostic** : le HTML de
chaque audience + son checksum. Le **PDF est un rendu dérivé** du HTML — un
cache, pas une preuve.

- Déplacer la colonne `pdf` `bytea` vers une **nouvelle table mutable**
  `canonical_report_pdf_cache` (clé = artefact d'audience), **sans trigger
  append-only**.
- La table immuable garde HTML + checksum → **inaltérabilité intacte**.
- À la re-publication d'une génération, **purger le cache PDF des générations
  remplacées** → libère les ~1,7 Mo. Seul le PDF de la génération courante
  reste ; seule elle est jamais servie (toutes les surfaces lisent
  `currentPublishedRevisionId`).

## Coût

- Migration **déplaçant des données existantes** hors de la table la plus
  protégée du système (6,76 Mo de `bytea` aujourd'hui).
- Adaptation de **trois points de lecture** : lien signé
  (`verifyAndConsumeShareToken`), `get-report`, écriture de matérialisation.
- Tests de non-régression sur le service PDF servi.

## Gain

- Récupère ~1,7 Mo par bilan **publié** régénéré. Négligeable au volume actuel
  (1 bilan publié concerné, serveur à ~181 Go libres) ; devient pertinent si
  les régénérations de bilans diffusés se multiplient.

## Décision

Différé. La demande initiale (« une seule version visible, ni encombrement ni
confusion ») est **intégralement satisfaite par le filtre `listRecent`** (une
ligne par bilan sur le dashboard) : voir `lib/bilans/staff/review-service.ts`
(`onlyCurrentGeneration`) et les tests de surface. Cette purge ne concerne que
l'espace disque, jugé non prioritaire à ce jour.
