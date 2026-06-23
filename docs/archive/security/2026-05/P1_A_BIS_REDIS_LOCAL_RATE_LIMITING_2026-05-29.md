# P1-A-bis — Redis local VPS rate limiting

## Résumé
- Objectif : rendre le rate limiting P1-A réellement distribué entre workers PM2 sans dépendance payante à Upstash.
- Stratégie runtime :
  1. `REDIS_URL` présent : Redis local VPS.
  2. Sinon `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` présents : Upstash REST.
  3. Sinon : fallback mémoire.
- Upstash reste disponible comme option future.
- `RATE_LIMIT_DISABLE=1` reste ignoré en production.
- Déploiement production : non effectué dans ce lot.

## État avant
| Sujet | État |
|---|---|
| P1-A code | Déployé production |
| Mode production actuel | fallback mémoire |
| Upstash | absent, non souhaité pour l'instant |
| Redis local | non installé/configuré dans ce lot |
| Bêta élargie | non prête côté anti-abus distribué |

## Corrections
- Ajout de la dépendance `redis`.
- Ajout de `lib/rate-limit/redis-store.ts`.
- Ajout du mode runtime `redis`.
- Priorité `REDIS_URL` sur Upstash si les deux sont configurés.
- Fallback mémoire contrôlé si Redis est indisponible.
- Conservation de `UpstashStore`.

## Variables d'environnement
| Variable | Usage | Statut |
|---|---|---|
| `REDIS_URL` | Redis local VPS, recommandé gratuit | à configurer ultérieurement |
| `UPSTASH_REDIS_REST_URL` | Upstash REST optionnel | conservé |
| `UPSTASH_REDIS_REST_TOKEN` | Token Upstash REST optionnel | conservé |
| `RATE_LIMIT_DISABLE` | Bypass dev/test uniquement | ignoré en production |

## Installation serveur à planifier séparément
Ce lot ne configure pas le VPS. Le déploiement opérationnel Redis local devra être un lot séparé :

1. Installer Redis sur le VPS ou activer le service déjà disponible.
2. Binder Redis à `127.0.0.1`.
3. Restreindre l'accès réseau.
4. Ajouter `REDIS_URL=redis://127.0.0.1:6379` dans `.env` sans afficher de secret.
5. Reload PM2 contrôlé avec `--update-env`.
6. Vérifier `api_health=200`.
7. Vérifier que le mode attendu est `redis`.
8. Smoke `/api/contact` et payloads invalides publics.
9. Optionnel : test contrôlé de 429 avec IP de test.

## Tests
- `REDIS_URL` présent -> mode `redis`.
- `REDIS_URL` prioritaire sur Upstash.
- Redis disponible -> `checkRateLimitAsync` utilise Redis.
- Redis indisponible -> fallback mémoire contrôlé.
- `RATE_LIMIT_DISABLE=1` ignoré en production.

## Limites
- Redis local n'est pas installé/configuré en production dans ce lot.
- La bêta élargie non conditionnelle reste bloquée tant que Redis local n'est pas installé, configuré et validé sur le VPS.
- CAPTCHA/Turnstile reste une décision P1 selon le trafic réel.

## Déploiement
- Statut : non déployé production.
- Déploiement à planifier séparément après CI verte.
- Validation opérationnelle Redis locale à faire dans un lot distinct.
