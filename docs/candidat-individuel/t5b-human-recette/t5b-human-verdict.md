# T5B — Matrice de verdict humain (§15)

Baseline : `ea7a86d88`. **Les colonnes humaines sont initialisées à `PENDING_HUMAN_REVIEW` — seule la
direction peut les remplacer par `PASS` / `PASS_WITH_RESERVATION` / `FAIL` / `NOT_APPLICABLE`.** Ce
document n'engage aucun verdict.

| Scenario | Technical Result | Commercial Clarity | Financial Clarity | Staff UX | PDF | Family View | Warnings | Human Verdict | Comments |
|---|---|---|---|---|---|---|---|---|---|
| R1a (PREMIERE : EAF_ECRIT_ORAL + EAM + Pilotage) | TECHNICAL_PASS | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW (voir T5B_FINDING_1/2) | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | 3 lignes, total 6500 TND/an, réconcilié (150+250+250)×10=6500 |
| R1b (TERMINALE : EDS1+EDS2+Philosophie+Grand Oral+Pilotage) | TECHNICAL_PASS | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW (voir T5B_FINDING_1/2) | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | 5 lignes, total 10440 TND/an, réconcilié (150+250+250+250+144)×10=10440 |
| R2 (headcount LVA=1/LVB=2/spécialité abandonnée=3) | TECHNICAL_PASS | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW (voir T5B_FINDING_1/2) | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | avertissement obligatoire spécialité abandonnée affiché en UI (R2-01) |
| R3 (GROUP_PENDING, philosophie non confirmée) | TECHNICAL_PASS | N/A | N/A | PENDING_HUMAN_REVIEW | N/A (aucun devis créé) | N/A | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | bouton "Créer un brouillon de devis" désactivé, message explicite affiché |
| R4 (P3 dérogation même session, hard block) | TECHNICAL_PASS | N/A | N/A | PENDING_HUMAN_REVIEW | N/A (aucun devis créé) | N/A | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | badge "Arbitrage direction requis", avertissement P3 complet affiché |
| R5 (scope différé, MOD_MATHS_EXPERTES) | TECHNICAL_PASS | N/A | N/A | N/A | N/A | N/A | N/A | PENDING_HUMAN_REVIEW | 10/10 éléments différés restent NO/PASS — voir R5-deferred/R5-deferred-scope.md |
| R6 (cycle du lien famille : émission, copie, renouvellement) | TECHNICAL_PASS | N/A | N/A | PENDING_HUMAN_REVIEW | N/A | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | PENDING_HUMAN_REVIEW | ancien lien refusé après renouvellement (404 réel), nouveau lien fonctionnel (200 réel) |
