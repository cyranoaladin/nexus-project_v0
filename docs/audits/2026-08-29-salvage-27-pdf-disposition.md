# Audit de Disposition des 27 Fichiers Salvage PDF

## Date
2026-08-29T20:02:00Z

## Contexte
Lors de la purge de remédiation des données non-conformes et de sécurisation des identifiants (`pre-purge-20260829T011808Z`), 27 fichiers PDF résiduels ont été mis sous séquestre temporaire dans `/var/backups/nexus/protected-runtime-data/pre-purge-20260829T011808Z/files/`.
Conformément à la Phase 8 du mandat maître, une qualification 27/27 a été exécutée pour classer chaque fichier sans aucun angle mort, interdire toute exposition publique de données personnelles, déplacer les pièces légitimes dans leurs stockages canoniques respectifs et programmer la destruction de la copie de séquestre.

## Inventaire et Classification 27/27

| Fichier SHA-1 (Salvage) | Taille (octets) | Type identifié | Destination canonique | Justification / Statut |
|---|---|---|---|---|
| `3c20d4c9e175f9c636c4390ce6e16d4be44fa020.pdf` | 69 299 | Facture légale 202606-0001 | `/var/www/nexus-shared/storage/documents/invoices/facture-202606-0001.pdf` & `/var/www/nexus-shared/storage/documents/facture-202606-0001.pdf` | Pièce comptable officielle (1 page, émise par Nexus Réussite). Conservée sous restrictions `nexusapp:nexusapp` (mode 0660). |
| `6089659d9d286a91c73a692f3143169716660918.pdf` | 3 | Artefact corrompu (stub 'pdf') | `DELETED` / Purgé | 3 octets ASCII (`pdf`). Fichier tronqué non lisible sans valeur juridique ni pédagogique. |
| `d59ea8c8938e44fb8571a151e1368ae54e8bc955.pdf` | 447 605 | Guide pédagogique NSI (63 pages) | `/var/www/nexus-shared/storage/documents/pedagogie/guide-revision-nsi-2026.pdf` | Support pédagogique interne officiel Nexus Réussite. |
| `10e9e32f8ee7d95af6081175cab8acffd20a8f8a.pdf` | 357 743 | Préparation express épreuve pratique NSI (28 pages) | `/var/www/nexus-shared/storage/documents/pedagogie/guide-epreuve-pratique-nsi-2026.pdf` | Support pédagogique interne officiel Nexus Réussite. |
| `69bd5edac22d1621a888ca1f281db2a6493b7a0e.pdf` | 40 205 | Épreuve pratique Bac NSI 2026 — Sujet 01 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-01.pdf` | Épreuve officielle MEN domaine public. |
| `5fa63473b35716526ef9f0f40c08eb9655ac4fef.pdf` | 29 546 | Épreuve pratique Bac NSI 2026 — Sujet 02 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-02.pdf` | Épreuve officielle MEN domaine public. |
| `6110c3b3bfb74f372c7d33d91e39d10b7bf85d08.pdf` | 45 664 | Épreuve pratique Bac NSI 2026 — Sujet 03 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-03.pdf` | Épreuve officielle MEN domaine public. |
| `addf305a0f0ee6612cac0f9eab82f39f3cd3f68c.pdf` | 26 373 | Épreuve pratique Bac NSI 2026 — Sujet 04 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-04.pdf` | Épreuve officielle MEN domaine public. |
| `7739a641f4fd6f9233c7d7c873d6373c37221c8b.pdf` | 27 753 | Épreuve pratique Bac NSI 2026 — Sujet 05 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-05.pdf` | Épreuve officielle MEN domaine public. |
| `4dab42919334ce94778466613956465793cc5873.pdf` | 29 599 | Épreuve pratique Bac NSI 2026 — Sujet 06 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-06.pdf` | Épreuve officielle MEN domaine public. |
| `735d403e38411c4e5e31964361be073a075d3898.pdf` | 25 560 | Épreuve pratique Bac NSI 2026 — Sujet 07 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-07.pdf` | Épreuve officielle MEN domaine public. |
| `0e2e90de80252ccb62a7fdb4b48c6764ad3adab8.pdf` | 32 552 | Épreuve pratique Bac NSI 2026 — Sujet 08 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-08.pdf` | Épreuve officielle MEN domaine public. |
| `20c5bbe827d8efdd581bf7636e1c30e123e9a48d.pdf` | 40 066 | Épreuve pratique Bac NSI 2026 — Sujet 09 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-09.pdf` | Épreuve officielle MEN domaine public. |
| `5c89427603f49393bd09e32d1478e0b5a1a06863.pdf` | 28 325 | Épreuve pratique Bac NSI 2026 — Sujet 10 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-10.pdf` | Épreuve officielle MEN domaine public. |
| `3a94ff87869459b8bba617533c6b855c6a59e40e.pdf` | 37 172 | Épreuve pratique Bac NSI 2026 — Sujet 11 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-11.pdf` | Épreuve officielle MEN domaine public. |
| `dd530c58d8647db4c1e499a9038ad823bf15a93e.pdf` | 26 906 | Épreuve pratique Bac NSI 2026 — Sujet 12 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-12.pdf` | Épreuve officielle MEN domaine public. |
| `8c57860983f464f55884a714bb9f7dfa0e41c0e8.pdf` | 99 652 | Épreuve pratique Bac NSI 2026 — Sujet 13 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-13.pdf` | Épreuve officielle MEN domaine public. |
| `e26db1f3c65f201ebdd37a25a2369bb9124d7ed7.pdf` | 28 470 | Épreuve pratique Bac NSI 2026 — Sujet 14 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-14.pdf` | Épreuve officielle MEN domaine public. |
| `3146b24204e297c35578cc38b930702e6823abf2.pdf` | 163 564 | Épreuve pratique Bac NSI 2026 — Sujet 15 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-15.pdf` | Épreuve officielle MEN domaine public. |
| `a0ddc7a6b19d2b9a6a21f2ee6263c7b7ac7ab434.pdf` | 45 648 | Épreuve pratique Bac NSI 2026 — Sujet 16 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-16.pdf` | Épreuve officielle MEN domaine public. |
| `f3302255d5c3f123e673bd2324a3453bf66a2108.pdf` | 26 660 | Épreuve pratique Bac NSI 2026 — Sujet 17 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-17.pdf` | Épreuve officielle MEN domaine public. |
| `2795f96f9208c3f23bcfcc6e6a154b219af224fe.pdf` | 27 980 | Épreuve pratique Bac NSI 2026 — Sujet 18 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-18.pdf` | Épreuve officielle MEN domaine public. |
| `3fa98527a6537cb64c99befc8da1da18ed466736.pdf` | 26 456 | Épreuve pratique Bac NSI 2026 — Sujet 19 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-19.pdf` | Épreuve officielle MEN domaine public. |
| `5eced7bf96f8dc2b696a5e977d0835804677a620.pdf` | 32 886 | Épreuve pratique Bac NSI 2026 — Sujet 20 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-20.pdf` | Épreuve officielle MEN domaine public. |
| `612a04321e2189312de8b71b412ed17d948a364f.pdf` | 30 426 | Épreuve pratique Bac NSI 2026 — Sujet 21 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-21.pdf` | Épreuve officielle MEN domaine public. |
| `6fbdf4ee6fc4f4127983293484e24203d8ce2efe.pdf` | 127 745 | Épreuve pratique Bac NSI 2026 — Sujet 22 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-22.pdf` | Épreuve officielle MEN domaine public. |
| `53d2a39793c13ca8428bb07b4e4fb30d328a476b.pdf` | 30 379 | Épreuve pratique Bac NSI 2026 — Sujet 23 | `/var/www/nexus-shared/storage/documents/pedagogie/bac-nsi-2026/epreuve-pratique-nsi-2026-sujet-23.pdf` | Épreuve officielle MEN domaine public. |

## Sécurité et Confidentialité
- **PII / Données Personnelles** : Aucun document personnel d'élève, de parent ou d'enseignant ne figure dans ce lot (0 fuite).
- **Permissions de stockage canonique** :
  - Propriétaire : `nexusapp:nexusapp`
  - Fichiers : `0660` (`rw-rw----`)
  - Répertoires : `0770` (`rwxrwx---`)
  - Stockage hors du webroot public Nginx (`/var/www/nexus-shared/storage/documents/`).

## Automatisation de Purge Définitive (Timer 7 Jours)
Un timer systemd a été installé et activé sur `nexus-prod` pour supprimer définitivement le répertoire temporaire `/var/backups/nexus/protected-runtime-data/pre-purge-20260829T011808Z` :
- Unité : `nexus-salvage-purge.service`
- Timer : `nexus-salvage-purge.timer`
- Déclenchement programmé : `2026-09-05 20:00:00 UTC` (J+7 post-disposition).
- Statut vérifié : `ACTIVATES: Sat 2026-09-05 22:00:00 CEST` (actif).
