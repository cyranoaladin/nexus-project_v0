# Rate limiting en production — mode réel, vérifié en lecture seule

Date : 2026-07-29
Méthode : connexion SSH en lecture seule (`nexus-prod`), aucune commande écrivante, aucune valeur de secret affichée — seule la présence/absence de clés d'environnement a été vérifiée.

## Hypothèse de départ (à corriger)

L'hypothèse examinée était : Next.js tourne en PM2 **cluster** (plusieurs processus), et `UPSTASH_REDIS_REST_URL` vide désactive le rate limiting — donc le rate limit de 60 req/min sur `/api/bilan-gratuit` serait fragmenté par processus ou inexistant.

## Ce qui a été vérifié, et comment

**1. Topologie PM2 réelle.**

```
$ ssh nexus-prod "pm2 jlist | ...instances/exec_mode par process..."
nexus-prod | pid: 1764466 | exec_mode: fork_mode | instances déclarées: (aucune, donc 1 par défaut)
TOTAL_PROCESSES sur l'hôte: 8 (dont 7 applications tierces sans rapport avec Nexus Réussite)
```

`ecosystem.config.js` (versionné dans le dépôt) confirme : `instances: 1`, pas de `exec_mode: 'cluster'` déclaré. **Un seul processus Node sert l'application aujourd'hui — pas un cluster.** L'hypothèse de fragmentation inter-processus est infirmée par la mesure directe, pas seulement par la lecture du code.

**2. Redis/Upstash configurés ?**

Le lanceur réel (`/usr/local/libexec/nexus-prod-launcher`, lu en clair — c'est un script d'infrastructure, pas un secret) charge l'environnement via `node --env-file=/etc/nexus/nexus-prod.env` (fichier `640:root:nexusapp`, jamais lu en contenu). Vérification en présence seule :

```
$ ssh nexus-prod "grep -E '^KEY=' /etc/nexus/nexus-prod.env puis présence/absence uniquement, aucune valeur affichée"
REDIS_URL: ABSENT
UPSTASH_REDIS_REST_URL: ABSENT
UPSTASH_REDIS_REST_TOKEN: ABSENT
RATE_LIMIT_DISABLE: ABSENT
NODE_ENV: PRÉSENT (non-vide, valeur jamais affichée)
```

`lib/rate-limit/index.ts::getRateLimitRuntimeMode()` : `'redis'` si `REDIS_URL` ; sinon `'upstash'` si les deux clés Upstash sont présentes ; sinon `'memory'`. Aucune des conditions distribuées n'est remplie.

## Conclusion vérifiée (A1)

**Le rate limiting tourne en mode `memory` en production, aujourd'hui.** Ni Redis ni Upstash ne sont configurés. Ce n'est pas une supposition — c'est une lecture directe et sûre de l'environnement réel.

## Reclassement (A2)

L'hypothèse initiale (fragmentation par processus PM2 cluster) est **infirmée** : un seul processus sert l'application, donc le magasin en mémoire est cohérent pour toutes les requêtes reçues par ce processus — les limites de 60 req/min sur `/api/bilan-gratuit`, `/api/contact`, `/api/newsletter` sont **réellement appliquées aujourd'hui**, pas illusoires.

Mais deux fragilités réelles demeurent, indépendantes de l'hypothèse cluster :
- **Remise à zéro à chaque redémarrage.** `autorestart: true` + `max_memory_restart: '1G'` dans `ecosystem.config.js` : tout redémarrage (crash, dépassement mémoire, déploiement) efface le magasin en mémoire — fenêtre de contournement à chaque redémarrage, sans qu'aucune alerte ne le signale.
- **Hypothèse de scalabilité silencieusement fragile.** Si l'application passe un jour à plusieurs instances (cluster PM2, ou plusieurs hôtes), le rate limiting redeviendrait fragmenté par processus sans qu'aucun gate ne le bloque — parce que ce gate n'existe pas sur `main` (voir A3).

Le Lot A1 doit intégrer, au minimum, la configuration Upstash (déjà présente comme dépendance npm : `@upstash/ratelimit`, `@upstash/redis`) avant toute croissance de trafic ou de nombre d'instances.

## E4 — fréquence réelle des redémarrages (lecture seule)

`pm2 jlist` seul est trompeur ici : `restart_time: 0` et `pm_uptime` ne couvrant que 2h23 min, alors que le processus est enregistré sous PM2 depuis le 14/07 — le compteur `restart_time` ne survit pas à tous les types de redémarrage. Remonté à la source fiable : le propre journal du démon PM2 (`/root/.pm2/pm2.log`, infrastructure, pas un secret), qui log chaque arrêt/démarrage avec horodatage et code de sortie :

```
2026-07-25T06:53:07: Stopping app:nexus-prod id:10 — exited code [0] via signal [SIGINT] — restarting
2026-07-27T03:57:29: Stopping app:nexus-prod id:7  — exited code [0] via signal [SIGINT] — restarting
2026-07-27T05:24:55: Stopping app:nexus-prod id:7  — exited code [0] via signal [SIGINT] — restarting
2026-07-27T23:23:16: Stopping app:nexus-prod id:7  — exited code [0] via signal [SIGINT] — restarting (coïncide avec le merge PR #85)
2026-07-29T06:48:10: Stopping app:nexus-prod id:7  — exited code [0] via signal [SIGINT] — restarting
```

**5 redémarrages en 4 jours (25/07 → 29/07), tous par `exit code 0` / `SIGINT`** — des arrêts propres et volontaires (déploiement ou `pm2 restart` manuel), **aucun crash ni signal d'OOM** dans cette fenêtre (confirmé par grep sur le journal d'erreurs du jour, aucune occurrence de `OOM`/`out of memory`/`SIGKILL`). Le système hôte lui-même n'a pas redémarré depuis le 18/05 (`uptime -s`), donc ces redémarrages sont bien applicatifs, pas des reboots serveur.

**Nuance à apporter à la conclusion « réellement appliqué »** : le magasin en mémoire est remis à zéro à chaque déploiement — environ une fois par jour au rythme actuel, parfois plusieurs fois le même jour. Entre deux redémarrages, la protection est réelle et cohérente (un seul processus). Au moment d'un redémarrage, la fenêtre glissante repart de zéro pour tout le monde — une fenêtre de contournement courte mais réelle, à la cadence des déploiements, pas de l'instabilité. Ce n'est pas un système qui s'effondre, mais ce n'est pas non plus une garantie continue.

## A3 — le gate lui-même : problème réel ou angle mort de mesure ?

Ni l'un ni l'autre exactement : **le problème sous-jacent (mode memory en production) est déjà détecté aujourd'hui** par le health-check existant sur `main` (`app/api/internal/health/route.ts`, protégé ADMIN/ASSISTANTE) : `checks.redis = { ok: rateLimitMode !== 'memory', detail: rateLimitMode }` — reporterait honnêtement `{ ok: false, detail: 'memory' }` s'il était interrogé aujourd'hui.

Ce qui manque réellement (`b03d0c37b`, non fusionné) : `getRateLimitProductionGate()` — une classification formelle transformant ce signal déjà visible en une **décision** explicite (`allowed`/`blocked` pour un « go-live large »), plus une route de sondage dédiée (`/api/internal/rate-limit-probe`). C'est un raffinement de gouvernance sur un signal déjà détecté, pas la découverte d'un point aveugle caché. Il rejoint le Lot A1 à ce titre — formaliser la décision, pas révéler un danger invisible.

## J — conclusion durcie

La formulation précédente (« protection réelle, remise à zéro à chaque redémarrage ») était trop indulgente. Formulation retenue, à charge pour le Lot A1 :

**Le rate limiting en mémoire, sur `/api/bilan-gratuit` (création de comptes + envoi d'emails), `/api/contact` et `/api/newsletter`, protège aujourd'hui contre un usage accidentel ou un script naïf — il ne protège pas contre un acteur déterminé.** Cinq redémarrages propres en quatre jours signifient que le compteur de la fenêtre glissante repart de zéro à un rythme prévisible et fréquent (à peu près quotidien, parfois plusieurs fois par jour). Un abus délibéré n'a besoin que d'observer ce rythme — ou simplement d'accepter d'attendre le prochain déploiement — pour repartir avec un quota neuf. Sur un endpoint public non authentifié qui écrit en base et envoie des emails, ce n'est pas une garantie, c'est un ralentisseur.

**J2 — deux pistes pour le Lot A1, à évaluer, non implémentées :**

1. **Backend distribué (Redis/Upstash).** Déjà en dépendance npm (`@upstash/ratelimit`, `@upstash/redis`), déjà supporté par `lib/rate-limit/index.ts` (`getRateLimitRuntimeMode()` bascule automatiquement dès que `UPSTASH_REDIS_REST_URL`/`TOKEN` sont présents). Le chemin le plus direct — configurer les deux variables sur `/etc/nexus/nexus-prod.env` et redéployer. Avantage : corrige le problème pour TOUS les endpoints rate-limités d'un coup, pas seulement `/api/bilan-gratuit`. Inconvénient : dépendance externe (Upstash), coût, latence réseau additionnelle par requête.
2. **Protection complémentaire persistée en base, spécifique à `/api/bilan-gratuit`.** Puisque cette route écrit déjà dans PostgreSQL (transaction `User`/`ParentProfile`/`Student`), un compteur par email/IP persisté en base (ex. table dédiée ou réutilisation de `ContactLead`) survivrait aux redémarrages sans dépendance externe. Avantage : pas de nouvelle dépendance d'infrastructure, cohérent avec ce que fait déjà cette route précise. Inconvénient : ne protège que cet endpoint — `/api/contact` et `/api/newsletter` resteraient en mémoire, sauf à répliquer la même logique ailleurs ; ajoute une écriture DB par tentative, y compris les tentatives bloquées.

Aucune des deux n'a été implémentée — évaluation pour le Lot A1, la piste 1 réglant le problème plus largement, la piste 2 étant plus rapide à isoler sur l'endpoint le plus sensible (création de comptes).

## K — le commentaire E2 est-il au bon endroit ?

Vérifié en lecture seule, rien modifié côté serveur.

- Le répertoire de release actuellement live (`/var/www/nexus-releases/11e0dce93e9f1d4c79824f9cccd0a467dde4f11b`, cible du symlink `/var/www/nexus-project_v0`) contient sa **propre copie** de `ecosystem.config.js` — comparée octet pour octet à la version du dépôt avant le commentaire E2 : **identique**. Chaque déploiement apporte bien ce fichier depuis le dépôt jusqu'au répertoire de release.
- La configuration réellement enregistrée par PM2 (`pm2 save` → `/root/.pm2/dump.pm2`, lu en lecture seule) montre pour `nexus-prod` : `exec_mode: fork_mode`, une seule entrée de processus dans les 7 apps enregistrées — cohérent avec `instances: 1` du fichier du dépôt.
- Deux scripts de déploiement versionnés (`scripts/deploy-incremental.sh:72`, `scripts/deploy-files-only.sh:63`) invoquent explicitement `pm2 startOrRestart ecosystem.config.js --env production --update-env` suivi de `pm2 save` — **si ce sont ces scripts qui ont produit les déploiements réels, le fichier est relu et re-sauvegardé à chaque fois**, et le commentaire E2 sera vu au prochain déploiement.
- **Réserve honnête** : le journal du démon PM2 (`pm2.log`) enregistre les événements stop/start mais pas la commande shell qui les a déclenchés. Je ne peux donc pas prouver avec certitude absolue que c'est exactement `pm2 startOrRestart ecosystem.config.js` (plutôt qu'un simple `pm2 restart nexus-prod`, documenté séparément dans le README, qui ne relirait pas le fichier) qui a produit les 5 redémarrages observés. Le README documente d'ailleurs une procédure manuelle utilisant `pm2 restart <PROCESS_NAME>` sans référence au fichier ecosystem — un chemin différent des deux scripts versionnés.

**Conclusion** : le commentaire est très vraisemblablement au bon endroit (le fichier est bien celui qui atterrit dans chaque release, et au moins deux scripts de déploiement réels le relisent), mais je ne peux pas garantir à 100 % que la procédure manuelle documentée dans le README (qui, elle, ne le relirait pas) n'est pas celle utilisée en pratique. Recommandation : unifier la procédure de déploiement documentée dans le README sur `pm2 startOrRestart ecosystem.config.js`, pour que ce ne soit plus une question de savoir laquelle des deux procédures a été suivie.
