# Validation des montants calculés à la création de facture

Date : 4 octobre 2026. Base locale : dd3cd95dd. Statut global : NOT_READY.

## Défaut et critères

L’API acceptait une remise supérieure au sous-total (montant final négatif), des prix unitaires au-delà de PostgreSQL int4, un dépassement par multiplication et un dépassement par agrégation. Les quatre tests rouges recevaient 201 au lieu de 400. Prisma stocke ces montants en Int, donc la limite technique est 2 147 483 647 millimes ; aucune règle tarifaire n’est changée.

## Correction

Avant allocation du numéro, transaction et PDF : contrôler les totaux de ligne et le sous-total comme entiers sûrs dans la capacité int4, puis refuser une remise dépassant le sous-total. L’erreur reste sobre et privée. Aucune migration, modification de prix ou attribution financière.

## Preuves

- Rouge : 4 échecs / 2 réussites, API 201 pour les quatre cas invalides.
- Vert élargi : 29 suites, 392 tests réussis, dont les limites remise égale au sous-total et int4 maximal.
- Les refus prouvent absence d’allocation de numéro, de transaction et de génération PDF.
- Lint ciblé et git diff --check réussis.
- Rapports privés dans .artifacts/recovery/invoice-money-*-private.log ; aucun secret ni document client.

## Limites

La suite route utilise des doubles Prisma. Une campagne supplémentaire sur PostgreSQL 16 isolé passe 4 suites / 21 tests après 131 migrations et replay : les quatre refus ne créent ni facture, ni ligne, ni audit ; zéro et int4 maximal sont persistés exactement. Les preuves privées sont dans `.artifacts/recovery/invoice-status-green-1791137736/` ; l’instance tmpfs a été arrêtée. Cette preuve ne constitue pas une qualification navigateur. La CI du prochain SHA doit renouveler ces preuves. Les gaps payeur manuel, idempotence et reprise PDF restent ouverts. Aucun déploiement effectué.
