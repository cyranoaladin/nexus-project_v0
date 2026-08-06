# Rate limiting distribue

## Statut

Redis est l'unique backend distribue supporte en production. Le mode `memory` est reserve aux tests et au developpement lorsqu'il est choisi explicitement. Il n'existe aucun fallback automatique en production.

Configuration obligatoire :

- `RATE_LIMIT_BACKEND=redis`
- `REDIS_URL`
- `RATE_LIMIT_KEY_SECRET`, secret HMAC dedie d'au moins 32 caracteres
- `RATE_LIMIT_KEY_NAMESPACE`, espace stable propre a l'environnement
- `RATE_LIMIT_TRUST_PROXY_HOPS`, nombre exact de proxies de confiance

Les delais de connexion et de commande ainsi que le nombre de reconnexions sont bornes. Une configuration invalide echoue au preflight. Une indisponibilite Redis renvoie `503` fail-closed sur les routes protegees, sans bascule memoire.

## Algorithme Redis

Le store applique une fenetre fixe par script Lua atomique :

1. `INCR` de la cle ;
2. `PEXPIRE` uniquement lorsque le compteur devient `1` ;
3. `PTTL` dans la meme decision atomique ;
4. refus fail-closed si le TTL vaut `-1`, `-2` ou est invalide.

Le TTL n'est pas renouvele aux appels suivants. `Retry-After` est l'arrondi superieur du TTL restant en secondes, avec un minimum de 1. Redis Cluster n'est pas annonce comme supporte ; le deploiement canonique utilise Redis standalone. Les cles du script sont neanmoins uniques et ne contiennent aucune PII.

## Cles et confidentialite

Format :

```text
rl:v1:<environment>:<scope>:<dimension>:<hmac-sha256>
```

Le HMAC porte sur la version, l'environnement, le scope, la dimension et la valeur normalisee. Les emails, identifiants et adresses IP ne sont jamais stockes en clair. Les dimensions sont separees (`ip`, `identity`, `resource`).

La rotation de `RATE_LIMIT_KEY_SECRET` remet les compteurs a zero. Elle n'est pas transparente : elle doit etre planifiee dans une fenetre operationnelle, avec surveillance renforcee et validation explicite. Une double lecture ne sera ajoutee que si une rotation sans remise a zero devient une exigence operationnelle.

## Reverse proxy

Nginx doit ecraser/transmettre les informations client de facon canonique :

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

L'application selectionne l'element correspondant exactement a `RATE_LIMIT_TRUST_PROXY_HOPS`. Sans nombre de proxies valide ou sans adresse IP valide, elle refuse la decision de limitation. Le listener applicatif ne doit pas etre expose directement au public.

## Matrice centrale

Les valeurs sont definies uniquement dans `lib/rate-limit/index.ts` et l'association des routes dans `lib/rate-limit/sensitive.ts`.

| Scope | Dimensions | Limites principales |
|---|---|---|
| parent-signup, parent-activation, student-activation, credentials-login | IP + identite | IP 30/15 min, identite 5/15 min |
| activation-resend, password-reset-request, child-activation, test-email | IP + identite | IP 30/h, identite 3 a 5/h |
| password-reset-confirm, sessions-revoke | IP + identite | IP 30/15 min, identite 5/15 min |
| child-create, contact-submit, newsletter-subscribe | IP + identite | IP 60/15 min, identite 5 a 10/h |
| stage-registration, reservation-submit | IP + identite + ressource | IP 60/15 min, identite 10/h, ressource 100/h |
| assessment-submit, bilan-pallier2 | IP + identite + ressource | IP 60/h, identite 10/h, ressource 100/h |
| notification-email | IP + identite | IP 30/h, identite 5/h |
| quotes-pdf, admin-recompute, session-book, session-cancel, admin-users-create | IP + identite | IP 60/h, identite 10/h |
| admin-stats, admin-users-read, student-credits, student-sessions | IP + identite | IP 300/min, identite 120/min |
| session-video-ip | IP | IP 300/min |
| session-video-user | identite | identite 120/min |

Toutes les reponses `429` et `503` sont privees, `no-store`, sans stack, cle Redis, email, IP ni token.

## Cycle de vie

Un client Redis est reutilise par processus. Les reconnexions, connexions et commandes sont bornees. Les signaux `SIGTERM` et `SIGINT` ferment le client. Les tests multi-instance doivent prouver que deux processus partagent les compteurs et qu'un redemarrage applicatif ne les remet pas a zero.

## Rollback

Le rollback applicatif conserve Redis et ses cles jusqu'a expiration. Ne pas activer un fallback memoire. Une panne Redis doit rester fail-closed pendant le diagnostic.
