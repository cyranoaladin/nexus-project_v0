# ENV Checklist (Production)

Ce document liste les variables d'environnement nécessaires pour déployer l'application en production.

## Variables critiques (obligatoires)

| Variable | Public/Privé | Obligatoire | Usage |
|---|---|---:|---|
| `NEXTAUTH_URL` | Privé (serveur) | Oui | URL canonique utilisée par NextAuth et metadata (`https://votre-domaine`). |
| `NEXTAUTH_SECRET` | Privé (serveur) | Oui | Secret de signature/chiffrement des sessions NextAuth. |
| `DATABASE_URL` | Privé (serveur) | Oui | Connexion base applicative (Prisma/NextAuth). |
| `NEXT_PUBLIC_SUPABASE_URL` | Public (client) | Oui pour sync Supabase | URL Supabase utilisée côté client (`@supabase/supabase-js`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (client) | Oui pour sync Supabase | Clé anon Supabase (RLS côté DB). |
| `SUPABASE_SERVICE_ROLE_KEY` | Privé (serveur) | Oui pour route API sync sécurisée | Utilisée par `app/api/programme/maths-1ere/progress` pour upsert serveur. Ne jamais exposer au client. |

## Sécurité & anti-abus (fortement recommandées, quasi obligatoires)

| Variable | Public/Privé | Obligatoire | Usage |
|---|---|---:|---|
| `UPSTASH_REDIS_REST_URL` | Privé (serveur) | Recommandé fort | Active le rate limiting middleware/API. |
| `UPSTASH_REDIS_REST_TOKEN` | Privé (serveur) | Recommandé fort | Token Redis Upstash pour rate limiting. |

## Intégrations (selon fonctionnalités activées)

| Variable | Public/Privé | Obligatoire | Usage |
|---|---|---:|---|
| `OPENAI_API_KEY` | Privé (serveur) | Si module IA activé | Appels API OpenAI. |
| `KONNECT_API_KEY` | Privé (serveur) | Si paiement Konnect | API paiement Konnect. |
| `KONNECT_WEBHOOK_SECRET` | Privé (serveur) | Si webhook Konnect | Vérification de signature webhook. |
| `WISE_API_KEY` (ou équivalent) | Privé (serveur) | Si paiement Wise | API paiement Wise. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Privé (serveur) | Si emails activés | Envoi emails transactionnels. |

## Variables test-only (interdites en production)

| Variable | Public/Privé | Statut |
|---|---|---|
| `SKIP_APP_AUTH` | Privé | Test uniquement, doit rester `false`/non défini en prod. |
| `SKIP_MIDDLEWARE` | Privé | Test uniquement, doit rester `false`/non défini en prod. |
| `DISABLE_MIDDLEWARE` | Privé | Test uniquement, doit rester `false`/non défini en prod. |

## Validation avant déploiement

1. Vérifier que toutes les variables "obligatoires" sont présentes dans l'environnement Vercel/Docker.
2. Vérifier que `SUPABASE_SERVICE_ROLE_KEY` n'apparaît dans aucun bundle client.
3. Vérifier que les variables test-only ne sont pas définies en production.
4. Vérifier que le rate limiting n'affiche plus d'alertes "DISABLED" au build/runtime.

## Règle de classification rapide

- Toute variable préfixée `NEXT_PUBLIC_` est exposée au navigateur (publique).
- Toute variable sans préfixe `NEXT_PUBLIC_` est à traiter comme secrète côté serveur.
