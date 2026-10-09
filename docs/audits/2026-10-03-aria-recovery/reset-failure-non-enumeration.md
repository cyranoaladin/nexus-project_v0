# Non-énumération du reset en cas de panne

## Défaut et critères

La route publique `/api/v2/auth/password-reset` renvoyait une erreur HTTP si un
compte éligible rencontrait une panne de HMAC/outbox ou un conflit après lookup,
mais 202 pour un compte absent. Un opérateur doit voir l'échec sans qu'un client
puisse en déduire l'existence du compte ou lire une cause contenant un secret.

Quatre reproductions causales avec PostgreSQL réel : comptes actifs versus absents,
HMAC absent en HYBRID/V2_ONLY, outbox rejetée et erreur de conflit. Les paires de
statuts observées avant correction sont 500/202 ou 409/202. Les essais précédents
avaient une namespace de rate-limit de 33 caractères (maximum 32), donnant 503
avant traitement ; ils sont conservés mais ne prouvent pas le défaut produit.

## Correction

La frontière après validation, CSRF et rate-limit répond toujours 202 `accepted`.
Ce statut atteste uniquement la réception de la demande, jamais l'envoi ou la
livraison d'un message. Les erreurs de validation/CSRF/rate-limit restent explicites.
Une exception de traitement émet `PASSWORD_RESET_PROCESSING_FAILED` avec le seul
correlationId et un message statique. Aucun email, identifiant de compte, token,
message d'exception, détail ou stack trace n'est enregistré par cette frontière.
L'autorité HYBRID/V2_ONLY ne change pas et aucun fallback V1 n'est ajouté.

## Vérification

Configuration canonique `jest.core-v2.config.js`, deux suites request/confirm et
pannes : 10 tests verts après correction. Les nouveaux tests vérifient status,
corps, absence de cache, absence d'invitation après échec HMAC et absence de raw
token/email/message privé dans les événements opérateur. La clé de rate-limit est
éphémère et générée par CSPRNG pour ce seul processus synthétique.
Logs privés `.artifacts/recovery/reset-failure-enumeration-*`.

## Limites et exploitation

Les préflights de démarrage/readiness et alertes doivent continuer à empêcher une
configuration invalide d'être ouverte au public. Cette correction de frontière
HTTP ne prétend pas uniformiser les temps de réponse. L'outbox est mockée dans le
test causal afin de reproduire précisément les pannes après éligibilité ; ce test
ne prouve pas l'envoi réel, le retry ni l'atomicité entre les deux bases.

Une interruption entre émission Core et enqueue V1 reste un contrôle distinct :
le token n'est pas déclaré livré, reste soumis au TTL, et une nouvelle demande
révoque le précédent. La qualification du handoff durable et sa supervision reste
à terminer. Aucune migration ni écriture production effectuée.
