# Changelog

## 0.2.3
- SEO: robots.txt + sitemap; headers sécurité (Permissions-Policy) et CSP d’exemple.

## 0.2.2
- Ajustement release tag.

## 0.2.1
- Correctifs post-intégration tests et E2E, Sentry opt-in, workflow release.

## 0.2.0
- Paiements: suppression de Wise, Konnect finalisé (init + webhook HMAC signé + idempotence).
- Sécurité: rate limit + CSRF double-submit sur endpoints sensibles.
- Accès: gardes SSR via middleware withAuth.
- Infra: Docker Node 20, Nginx prod config dédiée, CI Node 20, invariants DB (payments).
- Perf: optimisation Next Image, polices locales (next/font/local) avec fallback système.
- ARIA: modèle piloté par OPENAI_MODEL.
