# Lot 3 — Redis/Upstash runtime proof

Date : 2026-07-03 12:27 CET.

## État local

- Commande : `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npx tsx -e "import { getRateLimitProductionGate, getRateLimitRuntimeMode } from './lib/rate-limit/index.ts'; console.log(JSON.stringify({mode:getRateLimitRuntimeMode(), gate:getRateLimitProductionGate()}));"`
- Résultat : `mode=memory`, `gate.ok=false`, `gate.decision=blocked`.
- Interprétation : le poste local ne prouve pas Redis/Upstash.

## État staging

À vérifier. Aucun environnement staging authentifié n'est disponible dans cette session sans secret.

## État production

- Commande sûre exécutée sans afficher de secret : `curl -sS -o /tmp/nexus-internal-health-lot3.txt -w "%{http_code}\n" https://nexusreussite.academy/api/internal/health`
- Résultat HTTP : `401`.
- Interprétation : le healthcheck interne est protégé ; aucun token/cookie n'a été fourni ni affiché. Le mode Redis/Upstash production reste non prouvé.

## Healthcheck authentifié

Attendu : réponse JSON authentifiée avec :

- `runtime.rateLimit.mode = redis` ou `upstash`
- `runtime.rateLimit.distributed = true`
- `runtime.rateLimit.goLiveLarge = allowed`

## Test 429 réel

Non exécuté sur production : le code Lot 3 n'est pas déployé et aucun environnement staging authentifié n'est disponible. Un test 429 production sans fenêtre dédiée risquerait aussi de polluer les quotas publics depuis l'IP de vérification.

## Résultat

Redis/Upstash n'est pas prouvé en staging/production.

## Décision go-live large

INTERDIT.
