# P1-A — Anti-abus public et rate limiting distribué

## Résumé
- Objectif : renforcer les routes publiques qui écrivent en base, envoient des notifications ou déclenchent du calcul, avec une garde compatible production distribuée.
- Routes couvertes :
  - `/api/bilan-gratuit`
  - `/api/stages/[stageSlug]/inscrire`
  - `/api/stages/submit-diagnostic`
  - `/api/assessments/submit`
  - `/api/contact`
  - `/api/auth/reset-password`
- Routes restantes : ARIA/chat authentifié, autres routes IA coûteuses et endpoints publics futurs à auditer en P1 suivi.
- Stratégie dev/test/prod :
  - dev/test : `MemoryStore`, avec bypass possible via `RATE_LIMIT_DISABLE=1`;
  - prod avec Upstash : backend distribué via REST;
  - prod sans Upstash : fallback mémoire fonctionnel mais non suffisant pour go-live large;
  - prod : `RATE_LIMIT_DISABLE=1` est ignoré.

## État avant
| Route | Risque | Rate limit avant |
|---|---|---|
| `/api/bilan-gratuit` | Spam création compte/enfant + email | `guardRateLimit` mémoire |
| `/api/stages/[stageSlug]/inscrire` | Spam inscription + email/Telegram | `guardRateLimit` mémoire |
| `/api/stages/submit-diagnostic` | Spam diagnostic + email | `guardRateLimit` mémoire |
| `/api/assessments/submit` | Pollution DB + coût calcul/IA selon mode | `guardRateLimit` mémoire |
| `/api/contact` | Spam futur + PII en logs | Pas de rate limit observé |
| `/api/auth/reset-password` | Email abuse | `guardRateLimit` mémoire |

## Corrections
- Ajout d'un backend optionnel `UpstashStore` dans `lib/rate-limit/upstash-store.ts`.
- Ajout de `guardRateLimitAsync` et `checkRateLimitAsync` pour utiliser Upstash quand les variables sont configurées.
- Conservation du `MemoryStore` pour dev/test et fallback contrôlé.
- Blocage de la désactivation en production : `RATE_LIMIT_DISABLE=1` ne bypass plus les limites en `NODE_ENV=production`.
- Passage des routes publiques prioritaires vers `guardRateLimitAsync`.
- Ajout d'un rate limit à `/api/contact`.
- Réduction du log contact : aucun nom, email, téléphone ou message n'est loggé.

## Variables d'environnement
| Variable | Usage | Obligatoire |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | URL REST Upstash pour le rate limit distribué | Oui pour production product-ready |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST Upstash | Oui pour production product-ready |
| `RATE_LIMIT_DISABLE` | Bypass dev/test uniquement | Non, ignoré en production |

## Tests
- `__tests__/lib/rate-limit.distributed.test.ts`
- `__tests__/api/public-rate-limit.coverage.test.ts`
- `__tests__/api/contact.rate-limit.test.ts`
- `__tests__/api/auth.reset-password.rate-limit.test.ts`
- Régressions publiques :
  - `__tests__/api/stages.inscrire.security.test.ts`
  - `__tests__/api/assessments-submit.test.ts`
  - `__tests__/api/stages.submit-diagnostic.route.test.ts`
  - `__tests__/api/auth.reset-password.route.test.ts`
  - `__tests__/api/bilan-gratuit.test.ts`

## Limites
- Le code supporte le backend distribué, mais la production doit être configurée avec les variables Upstash avant bêta élargie non conditionnelle.
- CAPTCHA/Turnstile reste à décider en P1 suivi pour les formulaires publics les plus exposés.
- Le fallback mémoire reste acceptable pour développement, test et bêta contrôlée, mais pas comme preuve de go-live large.

## Déploiement
- Non déployé production.
- Déploiement séparé après CI verte.
- Validation production attendue : variables Upstash présentes ou décision humaine explicite d'une bêta limitée avec fallback mémoire.
