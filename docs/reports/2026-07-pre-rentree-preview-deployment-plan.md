# Plan de déploiement de la preview Pré-rentrée 2026

## Date

12 juillet 2026 — Africa/Tunis

## Périmètre immuable

- Branche applicative : `fix/pre-rentree-2026-finalize-preview`.
- SHA applicatif à construire et déployer : `6fe2e77302a17b9806739d014f75530d9ae91280`.
- Runtime : Node.js 20.20.0, npm 10.8.2 et Next.js 15.5.18.
- Aucun changement de produit, de tarif, de programme, d'horaire, de Prisma ou de migration.
- Aucun merge, auto-merge ou déploiement de production.

## Infrastructure constatée

La production Nexus Réussite est servie par un processus PM2 `nexus-prod` en mode
standalone sur `127.0.0.1:3001`, derrière le Nginx de l'hôte. PostgreSQL de
production reste dans le conteneur `nexus-postgres-db`, exposé uniquement sur
`127.0.0.1:5435`.

Le dépôt ne contient pas de workflow de preview exploitable tel quel. Les fichiers
Compose existants utilisent des noms, ports ou réseaux historiques qui pourraient
entrer en collision avec la production ; ils ne seront donc pas utilisés pour
démarrer la preview.

Le sous-domaine `pre-rentree-preview.nexusreussite.academy` et un nom de sonde
aléatoire sous `nexusreussite.academy` ne résolvent pas : aucun wildcard DNS n'a
été détecté. Le hostname temporaire retenu résout en revanche vers l'IP réelle du
serveur sans modification de la zone DNS Nexus :

`pr26-6fe2.88-99-254-59.sslip.io`

## Mécanisme retenu

Une stack Docker Compose dédiée sera créée hors du dépôt, sous un répertoire
d'exploitation propre à la preview. Elle utilisera le nom de projet
`nexus-pre-rentree-preview` et contiendra :

- une image applicative construite depuis un checkout propre et détaché au SHA
  exact validé, avec `Dockerfile.prod` ;
- une base PostgreSQL éphémère dédiée, initialisée uniquement avec les migrations
  déjà présentes au SHA validé ;
- un sink SMTP local sans port publié, afin de neutraliser aussi les anciens chemins
  d'envoi qui ne consultent pas tous `MAIL_DISABLED` ;
- un service de migration one-shot utilisant la cible `migrator` existante ;
- l'application écoutant sur le port distinct `3107`, à l'adresse statique privée
  `172.29.26.10` du réseau Docker interne, sans publication de port sur l'hôte.

Les conteneurs n'utiliseront ni nom fixe de production, ni réseau externe, ni
volume existant. Les labels de l'image et du conteneur consigneront le SHA Git,
l'environnement, Node, npm, Next.js et la date de construction.

## Isolation

### Conteneurs, réseau et volumes

- Noms préfixés par le projet Compose de preview.
- Réseau bridge privé propre à la preview.
- Volume PostgreSQL propre à la preview.
- Aucun rattachement à un réseau de production.
- Aucun montage de volume de production.
- Aucun port applicatif, PostgreSQL ou SMTP publié sur l'hôte ; seul le Nginx de
  l'hôte peut joindre l'adresse privée statique de l'application.
- Limites CPU et mémoire explicites pour l'application, PostgreSQL et le sink SMTP.

### Base de données

La preview utilisera une base PostgreSQL dédiée nommée pour la preview, avec un
utilisateur et un mot de passe temporaires générés sur le serveur. Son URL interne
pointera vers le service PostgreSQL de la stack, jamais vers `127.0.0.1:5435`,
`nexus-postgres-db` ou un réseau de production. Aucune donnée de production ne sera
copiée. Toute éventuelle soumission fonctionnelle emploiera uniquement une identité
synthétique et sera supprimable avec le volume de preview.

### Secrets et variables

- `NODE_ENV=production`.
- `NEXTAUTH_URL` et `NEXT_PUBLIC_APP_URL` utilisent le hostname de preview.
- `NEXTAUTH_SECRET` et les identifiants PostgreSQL sont temporaires et distincts.
- `MAIL_DISABLED=true`, avec SMTP dirigé en plus vers le sink local.
- `TELEGRAM_DISABLED=true`, sans token ni identifiant de canal.
- ClicToPay et Konnect sans clé, sans webhook et avec le drapeau public désactivé.
- `LLM_MODE=off`, sans accès RAG, Ollama, Sentry ou webhook externe.
- Aucun fichier `.env` de production ne sera lu ou copié.
- Le fichier d'environnement distant sera hors Git et limité à `0600`.

Google Analytics étant actuellement inclus de manière statique dans le layout, le
vhost de preview remplacera la CSP applicative par une CSP dédiée qui interdit les
origines Google Analytics et Google Tag Manager. L'endpoint local d'analytics est
un no-op ; aucun flux de mesure de production ne sera émis.

## Protection d'accès et anti-indexation

Le contrôle d'accès sera une Basic Auth au reverse proxy, jamais dans la landing.
Une credential forte sera générée sans affichage dans les commandes ou les logs :

- copie propriétaire locale :
  `/home/alaeddine/.config/nexus-preview/pre-rentree-2026/owner-credential.txt` ;
- hash distant Nginx : fichier hors Git sous `/etc/nginx/preview-secrets/` ;
- copie propriétaire en `0600` ; hash distant non réversible en `0640`, lisible
  uniquement par `root` et le groupe Nginx `www-data` ;
- suppression prévue après validation.

Le vhost Nginx dédié appliquera sur toutes les réponses :

- `X-Robots-Tag: noindex, nofollow, noarchive` ;
- une réponse `robots.txt` contenant `Disallow: /` ;
- Basic Auth, hors challenge ACME ;
- les headers de sécurité de la preview ;
- le blocage des routes de paiement, réservation et notifications non requises ;
- la réécriture des éventuelles canonical relatives résolues sur le hostname de
  preview vers `https://nexusreussite.academy`.

Aucun lien vers la preview ne sera ajouté au site de production.

## TLS

Un certificat Let's Encrypt dédié au hostname temporaire sera demandé en HTTP-01
avec le webroot ACME déjà présent sur l'hôte et sans adresse email réelle. Le vhost
HTTP temporaire sera testé avec `nginx -t` avant reload. Après émission, le vhost
HTTPS sera testé avant un second reload gracieux. Aucun certificat ou vhost de
production ne sera modifié.

## Healthchecks et qualification

- Healthcheck interne de l'application sur `/api/health` avec Node, sans Basic Auth.
- Healthcheck PostgreSQL avec `pg_isready`.
- Healthcheck SMTP local.
- Vérification distante non authentifiée : `401`.
- Vérification distante authentifiée : pages et assets attendus, redirection 308,
  noindex, robots, canonical production, CSP et TLS.
- Tests contractuels produit et staffing exécutés avant et après déploiement.
- Playwright distant sur les quatre largeurs, les parcours configurateur, bilan et
  WhatsApp sans envoi.
- Captures hors Git dans `/tmp/nexus-pre-rentree-2026-preview-remote`.
- Inspection des logs filtrée, sans copier de contenu sensible dans le rapport.

## Absence d'impact production

Avant et après le déploiement seront comparés : SHA Git de production, PID et uptime
PM2, ports d'écoute, identifiant et date de démarrage du PostgreSQL de production,
réseaux, volumes et réponses HTTP publiques. Le Nginx partagé ne recevra qu'un
vhost de preview distinct ; sa configuration de production sera contrôlée par
empreinte et ne sera pas réécrite. Les reloads Nginx seront gracieux et ne
redémarreront pas `nexus-prod`.

## Durée de vie

La preview sera conservée jusqu'à validation du propriétaire, avec une durée
maximale recommandée de 14 jours à compter du déploiement. Au-delà, elle devra être
explicitement renouvelée ou supprimée.

## Rollback et suppression

Le rollback applicatif consiste à retirer uniquement le vhost preview, arrêter la
stack Compose avec son nom de projet, puis vérifier à nouveau la production. La
suppression complète, à ne pas exécuter avant validation propriétaire, prévoit :

1. `docker compose -p nexus-pre-rentree-preview down --volumes --remove-orphans` à
   partir du répertoire d'exploitation preview ;
2. suppression de l'image et du checkout propres à la preview ;
3. suppression du vhost et du hash Basic Auth de preview, suivie de `nginx -t` et
   d'un reload gracieux ;
4. suppression du certificat Let's Encrypt du seul hostname preview ;
5. suppression de la credential locale propriétaire ;
6. contrôle final de l'absence de modification des services, ports, volumes et de
   la base de production.

Cette procédure ne cible aucun conteneur, réseau, volume, certificat, processus ou
fichier de production.
