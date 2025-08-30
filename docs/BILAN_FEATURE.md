# Bilan Gratuit — Spécification & Intégration

Ce document décrit la fonctionnalité « Bilan gratuit » livrée, les endpoints, la structure des données et les variables d’environnement.

## Parcours

1) Élève > Dashboard > Bilan gratuit → `/dashboard/eleve/bilan/start`
2) QCM 40 questions → `/dashboard/eleve/bilan/[bilanId]/qcm`
3) Questionnaire pédagogique → `/dashboard/eleve/bilan/[bilanId]/profil`
4) Rapport complet → `/dashboard/eleve/bilan/[bilanId]`
   - Synthèse 1‑page (radar + points clés)
   - Liens PDF (standard/parent/élève)
   - Envoi par e‑mail (PDF en PJ) + historique (MailLog)

## Modèles Prisma

- Bilan (table `bilans`):
  - studentId, subject, level, statut
  - qcmAnswers Json, qcmScores Json, pedagoProfile Json
  - synthesis Json ({forces, faiblesses, feuilleDeRoute, text?})
  - offers Json ({primary, alternatives[], reasoning})
  - status, createdAt, updatedAt

- MailLog (table `mail_logs`):
  - bilanId, userId, variant, recipients, subject, status, messageId?, error?, createdAt

## Endpoints API

- POST `/api/bilan/start`
  - Body: `{ subject:"MATHEMATIQUES", level:"premiere|terminale", statut:"scolarise_fr|candidat_libre" }`
  - Res: `{ bilanId }`

- POST `/api/bilan/[bilanId]/qcm`
  - Body: `{ answers: Record<questionId, selectedIndex> }`
  - Res: `{ ok: true, scores }`

- POST `/api/bilan/[bilanId]/profil`
  - Body: `{ style?, organisation?, rythme?, motivation?, difficultes?, attentes?, objectif? }`
  - Effets: met à jour pedagoProfile, calcule une synthèse heuristique, applique la matrice d’offres.

- POST `/api/bilan/[bilanId]/report`
  - Appel LLM avec prompt premium (ADN Nexus + structure 6 sections + matrice); persiste `synthesis.text`.

- GET `/api/bilan/[bilanId]`
  - Retourne l’agrégat Bilan (accès: élève propriétaire, parent, staff).

- GET `/api/bilan/pdf/[bilanId]?variant=standard|parent|eleve`
  - Génère PDF avec `@react-pdf/renderer`, renvoie `application/pdf` inline. Rate‑limit 5/min.

- POST `/api/bilan/email/[bilanId]`
  - Body: `{ variant, toStudent:bool, toParent:bool, extraRecipients:string[] }`
  - Génère PDF, envoie email (SMTP) et log dans `mail_logs`. Rate‑limit 5/min.

## Données QCM

- 40 questions (programme Seconde) avec pondérations par domaine (6 axes):
  - Calcul littéral & équations (11 pts), Fonctions & graphes (9), Géométrie (11), Trigonométrie (7), Proba & stats (12), Algorithmique & logique (8).

## Matrice d’offres (règles)

- Candidat Libre → Odyssée Candidat Libre
- Score ≥70, ≤1 domaine faible, autonomie OK → Cortex (alt. Académies)
- Score 55–70, ≤2 domaines faibles → Studio Flex (alt. Cortex + Académies)
- Score 40–65, ≥2 domaines faibles → Académies (alt. Odyssée si mention/Parcoursup)
- Score <55 ou motivation/autonomie faible → Odyssée (alt. Flex)

## Variables d’environnement

- SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
- LLM_SERVICE_URL (service LLM pour la génération du rapport)
- PDF_GENERATOR_SERVICE_URL (optionnel pour autres usages ARIA)
- RATE_LIMIT_* (optionnel):
  - RATE_LIMIT_BILAN_PDF_MAX, RATE_LIMIT_BILAN_PDF_WINDOW_MS
  - RATE_LIMIT_BILAN_EMAIL_MAX, RATE_LIMIT_BILAN_EMAIL_WINDOW_MS

## Installation & migrations

- `npm i @react-pdf/renderer`
- `npx prisma generate`
- `npx prisma migrate dev -n "add_bilan_and_maillog"`

## Tests

- Unitaires: `__tests__/lib/bilan/*.test.ts`
- E2E (à ajouter): `e2e/bilan-flow.spec.ts` (connexion élève, start → qcm → profil → rapport → pdf)

## Sécurité & conformité

- AuthZ stricte (élève propriétaire, parent, staff); aucune clé hardcodée, SMTP via env.
- Rate‑limit sur PDF/email; RGPD: données confidentielles, textes rassurants/premium, pas d’excès marketing.

