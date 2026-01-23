# Environment Reference

**Dernière mise à jour :** 21 janvier 2026

Ce document consolide les variables d’environnement effectivement utilisées par le code.

## Core
- `NODE_ENV` (development|production)
- `NEXTAUTH_URL` (ex: http://localhost:3000)
- `NEXTAUTH_SECRET` (obligatoire en production)

## Database
- `DATABASE_URL` (SQLite par défaut : `file:./dev.db`)

## Email (SMTP)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE` ("true"|"false")
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

## OpenAI (ARIA)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (par défaut `gpt-4o-mini` si absent)

## Jitsi
- `NEXT_PUBLIC_JITSI_SERVER_URL` (utilisé par l’API session vidéo)

Note : le composant UI `components/ui/video-conference.tsx` utilise actuellement `meet.jit.si` en dur côté client.

## Payments (Konnect)
- `KONNECT_API_KEY`
- `KONNECT_WALLET_ID`
- `KONNECT_BASE_URL`
- `KONNECT_WEBHOOK_SECRET`

## Wise (affichage virement)
- `NEXT_PUBLIC_WISE_BENEFICIARY_NAME`
- `NEXT_PUBLIC_WISE_IBAN`
- `NEXT_PUBLIC_WISE_BIC`
- `NEXT_PUBLIC_WISE_ADDRESS`
- `NEXT_PUBLIC_WISE_BANK_NAME`

## Docker Compose (si utilisé)
- `POSTGRES_USER`
- `POSTGRES_PASSWORD` (ou `DATABASE_PASSWORD` selon compose)
- `POSTGRES_DB`

