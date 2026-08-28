# T5B — Checklist globale direction (§16)

Baseline : `ea7a86d88`. **Toutes les lignes sont `PENDING_HUMAN_REVIEW` — seule la direction peut les
remplacer.** Référez-vous aux artefacts nommés pour chaque ligne.

## A — Commercial

| Critère | Statut | Référence |
|---|---|---|
| Offre compréhensible | PENDING_HUMAN_REVIEW | `R1-standard/R1a-pdf-original.pdf`, `R1b-pdf-original.pdf` |
| Aucun produit non V1 proposé | PENDING_HUMAN_REVIEW | `R5-deferred/R5-deferred-scope.md` (10/10 NO/PASS) |
| Prix cohérents | PENDING_HUMAN_REVIEW | `technical/R1a-pdf-original.txt` (réconciliation ligne×10=total annuel) |
| Aucun 0 TND commercial inattendu | PENDING_HUMAN_REVIEW | aucune ligne à 0 TND observée dans les 3 PDF inspectés |
| Volumes compréhensibles | PENDING_HUMAN_REVIEW | "4 h/mois" affiché par ligne GROUPE dans les 3 PDF |
| Modalités SOLO/DUO/GROUPE correctement présentées | PENDING_HUMAN_REVIEW | `R2-headcount/R2-summary.json` (confirmé en base) — note : la modalité effective n'est pas affichée directement dans l'UI staff après saisie de l'effectif (voir `R2-summary.json`, non classé comme défaut) |

## B — Réglementaire

| Critère | Statut | Référence |
|---|---|---|
| EAF correct | PENDING_HUMAN_REVIEW | `R1-standard/R1a-*` (EAF écrit et oral, 250 TND, 4h/mois) |
| EAM correct | PENDING_HUMAN_REVIEW | `R1-standard/R1a-*` (Mathématiques anticipées, 250 TND, 4h/mois) |
| Spécialité abandonnée avec avertissement | PENDING_HUMAN_REVIEW | `R2-headcount/R2-01-headcount-fields.png` ("Avertissement obligatoire : ce module ne prépare aucune épreuve du bac.") |
| Aucune option différée présentée comme validée | PENDING_HUMAN_REVIEW | `R5-deferred/` |

## C — Staff

| Critère | Statut | Référence |
|---|---|---|
| Création de devis utilisable | PENDING_HUMAN_REVIEW | `R1-standard/R1a-03-devis-staff.png`, `R1b-03-devis-staff.png` |
| Blocages compréhensibles | PENDING_HUMAN_REVIEW | `R3-group-pending/R3-02-block-message.png`, `R4-accelere/R4-01-accelerated-warning.png` |
| Publication explicite | PENDING_HUMAN_REVIEW | `R6-family-publication/R6-01-before-publication.png`, `R6-02-published.png` |
| Lien famille générable | PENDING_HUMAN_REVIEW | `R6-family-publication/R6-03-generate-link.png` |
| Rotation compréhensible | PENDING_HUMAN_REVIEW | `R6-family-publication/R6-06-renew-warning.png`, `R6-07-renew-success-redacted.png` |

## D — Famille

| Critère | Statut | Référence |
|---|---|---|
| Devis compréhensible | PENDING_HUMAN_REVIEW | `R1-standard/R1a-06-family-view.png`, `R1b-06-family-view.png` |
| PDF professionnel | PENDING_HUMAN_REVIEW | voir T5B_FINDING_1 (`t5b-findings.md`) — un champ technique visible |
| Prix par ligne | PENDING_HUMAN_REVIEW | confirmé présent dans les 3 PDF inspectés |
| Total clair | PENDING_HUMAN_REVIEW | "TOTAL INDICATIF" affiché en tête de document |
| Échéancier clair | PENDING_HUMAN_REVIEW | acompte 25% + mensualités détaillées, 3 PDF inspectés |
| Aucune information interne | PENDING_HUMAN_REVIEW | aucune donnée de coût/marge observée ; voir T5B_FINDING_1 pour la seule exception (code parcours technique, pas une donnée commerciale) |

## E — Sécurité observable

| Critère | Statut | Référence |
|---|---|---|
| Aucun raw token visible dans les artefacts | PENDING_HUMAN_REVIEW | vérifié automatiquement (grep) — zéro occurrence, voir `README.md` |
| Ancien lien invalidé après rotation | PENDING_HUMAN_REVIEW | `R6-family-publication/R6-summary.json` (`oldLinkStatusAfterRotation: 404`) |
| Vue famille non éditable | PENDING_HUMAN_REVIEW | `R1-standard/R1a-06-family-view.png` (aucun contrôle d'édition visible) |
