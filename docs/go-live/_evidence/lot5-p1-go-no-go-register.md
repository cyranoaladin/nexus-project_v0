# Lot 5 — Registre go/no-go des 6 P1

| Route | Décision | Bêta contrôlée | Bêta élargie | Go-live large | Condition de levée |
|---|---|---:|---:|---:|---|
| `/api/payments/clictopay/webhook` | Reste `501`; ClicToPay désactivé contractuellement | Oui, si paiement manuel uniquement | Non | Non | Intégration complète webhook signée, idempotente, réconciliée et testée E2E |
| `/api/assessments/submit` | Token lead-bound en place ; reste P1 par données pédagogiques mineur et runtime Redis non prouvé | Oui, volume contrôlé | Non | Non | Redis/Upstash prouvé + test 429 réel + décision humaine sur surface publique |
| `/api/bilan-gratuit` | `lead_only`, no-leak, cookie flow ; reste formulaire public mineur | Oui, volume contrôlé | Non | Non | Redis/Upstash prouvé + dry-run ContactLead réel + monitoring leads |
| `/api/lamis/teacher-report` | Public pédagogique minimisé ; reste P1 par nature publique | Oui, volume contrôlé | Non | Non | Redis/Upstash prouvé + arbitrage token/session si usage nominatif |
| `/api/stages/[stageSlug]/inscrire` | Inscription publique assumée ; consentement et anti-abus | Oui, volume contrôlé | Non | Non | Redis/Upstash prouvé + test 429 réel + supervision admissions |
| `/api/student/activate` | Public par token ; lifecycle durci, reste sensible | Oui, avec monitoring | Non | Non | Redis/Upstash prouvé + alerting activation/token abuse |

## Décision transversale

Tant que Redis/Upstash n'est pas prouvé et qu'un `429` réel n'est pas validé sur staging/production, aucune route publique sensible ne peut être validée pour bêta élargie.

Tant que ClicToPay reste `501`, le paiement carte est interdit.

Tant que `ContactLead --apply` n'est pas validé humainement et qu'un dry-run DB réel n'est pas exécuté, le go-live large reste interdit.

