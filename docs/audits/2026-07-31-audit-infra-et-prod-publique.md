# Audit infrastructure et production publique

## Date

31 juillet 2026, fuseau `Africa/Tunis`.

## Contexte et périmètre

Mission de clôture de l'ambiguïté entre le conteneur local historique
`nexus-app-prod` et la production publique `https://nexusreussite.academy`, puis
audit read-only de onze pages publiques critiques.

Les requêtes publiques ont été limitées à des méthodes GET séquentielles,
espacées d'au moins une seconde. Aucun test d'authentification, formulaire,
écriture API, scan de vulnérabilité ou accès SSH n'a été effectué.

Les termes employés ci-dessous ont un sens strict :

- **Observé** : produit directement par Docker local, DNS, HTTP, TLS, HTML/CSS
  servi ou Git local.
- **Déduit** : conclusion compatible avec les observations, mais non prouvable
  sans métadonnée de build ou accès au serveur distant.

## Verdict

**Le conteneur local `nexus-app-prod` n'est pas la production** : le DNS public
pointe vers une autre IP, les pages d'accueil locale et publique ont des H1 et
des tailles différents, et aucun proxy local observé ne route le domaine ou le
port 3001 vers ce conteneur.

La production publique est disponible sur toutes les routes auditées et expose
les principales signatures publiques du dernier `origin/main` connu au 27
juillet 2026. Son SHA de déploiement exact reste indéterminable sans SSH ni
métadonnée de build publique.

## Étape 1 — Preuve d'infrastructure

### Conteneurs et publication locale

**Observé :**

- `nexus-app-prod`, image `nexus-project_v0-nexus-app`, publie
  `0.0.0.0:3001 -> 3000/tcp`.
- Le conteneur a été créé le 15 juin 2026 et était `Up (healthy)` pendant
  l'audit.
- La base associée observée est
  `ce16462cc4b8_nexus-postgres-prod`, image `pgvector/pgvector:pg15`, sans port
  hôte publié.
- Le seul processus Nginx actif observé appartient au cgroup du conteneur
  `docker-nginx-1`, publié sur le port hôte 8088.
- Les configurations Nginx hôte lisibles exposent un site par défaut sur 80 et
  `maths_local` sur `127.0.0.1:8080` vers `127.0.0.1:8001`. Aucune directive
  observée ne pointe vers `127.0.0.1:3001`.

### Comparaison des surfaces

| Surface | HTTP | Taille | H1 | `buildId` observable |
|---|---:|---:|---|---|
| `http://127.0.0.1:3001/` | 200 | 227 677 octets | « Un cadre premium pour préparer le bac français. » | absent |
| `https://nexusreussite.academy/` | 200 | 95 814 octets | « Préparer le bac français avec méthode, suivi et exigence. » | absent |

**Observé :** les deux réponses App Router ne contiennent ni `__NEXT_DATA__`
avec `buildId`, ni segment `/_next/static/<buildId>/`. Le build ID demandé n'est
donc pas publiquement extractible. Les H1, titres, tailles et contenus constituent
néanmoins des signatures distinctes.

### DNS et IP

| Élément | IPv4 observée |
|---|---|
| `nexusreussite.academy` | `88.99.254.59` |
| IP publique de la machine locale | `102.156.214.105` |

**Déduction :** la production est hébergée ailleurs que sur la machine qui porte
le conteneur local. Cette déduction concorde avec l'architecture distante
acceptée, mais ne prouve pas à elle seule le gestionnaire de processus PM2.

## Étape 2 — Sauvegarde locale et options non exécutées

### Sauvegarde effectuée

**Observé :**

- Fichier hors dépôt :
  `/home/alaeddine/backups/nexus_local_2026-07-31.sql`.
- Taille : 191 470 octets.
- En-tête `PostgreSQL database dump` présent.
- Instruction `COPY public.users` présente.
- Aucun contenu utilisateur ni aucune PII n'a été affiché.

### Options d'avenir proposées, non exécutées

1. **Arrêt réversible de l'environnement historique**

   ```bash
   docker stop nexus-app-prod ce16462cc4b8_nexus-postgres-prod
   ```

   Conséquence : libère l'exécution locale de l'application et de sa base sans
   supprimer les conteneurs, volumes, images ni la sauvegarde.

2. **Conservation documentée en fonctionnement**

   ```bash
   docker ps --filter name=nexus-app-prod --filter name=nexus-postgres-prod --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.CreatedAt}}\t{{.Status}}' > ~/backups/nexus_local_inventory_2026-07-31.txt
   ```

   Conséquence : ne change aucun état Docker et conserve un inventaire non
   sensible à côté de la sauvegarde.

3. **Suppression des deux conteneurs après arbitrage explicite**

   ```bash
   docker rm -f nexus-app-prod ce16462cc4b8_nexus-postgres-prod
   ```

   Conséquence : supprime les conteneurs applicatif et PostgreSQL actuels. Cette
   commande ne comporte pas `-v` et ne supprime donc pas explicitement les
   volumes nommés, mais elle reste destructive et exige une validation préalable.

## Étape 3 — Audit de la production publique

### Disponibilité HTTP

| Page | Statut | Redirections | Temps | Taille |
|---|---:|---:|---:|---:|
| `/` | 200 | 0 | 0,389 s | 95 814 o |
| `/offres` | 200 | 0 | 0,548 s | 666 894 o |
| `/recommandation` | 200 | 0 | 0,385 s | 80 508 o |
| `/bilan-gratuit` | 200 | 0 | 0,518 s | 85 905 o |
| `/stages` | 200 | 0 | 0,541 s | 87 295 o |
| `/stages/pre-rentree-2026` | 200 | 0 | 0,496 s | 340 919 o |
| `/plateforme-aria` | 200 | 0 | 0,519 s | 81 636 o |
| `/accompagnement-scolaire` | 200 | 0 | 0,519 s | 68 062 o |
| `/contact` | 200 | 0 | 0,520 s | 68 467 o |
| `/conditions-generales` | 200 | 0 | 0,411 s | 101 780 o |
| `/mentions-legales` | 200 | 0 | 0,524 s | 71 500 o |

**Observé :** aucun 404, 500 ou redirect inattendu sur ce périmètre.

### H1, viewport et CTA

| Page | H1 unique | Texte du H1 | CTA principal observé | Secondaire bilan/WhatsApp |
|---|---|---|---|---|
| `/` | oui | Préparer le bac français avec méthode, suivi et exigence. | oui | oui / oui |
| `/offres` | oui | Offres & tarifs | oui | oui / oui |
| `/recommandation` | oui | Trouver ma formule | oui | oui / oui |
| `/bilan-gratuit` | oui | Bilan stratégique gratuit | oui | oui / oui |
| `/stages` | oui | Viser. Atteindre. Dépasser. | oui | oui / oui |
| `/stages/pre-rentree-2026` | oui | Préparez la rentrée avec des bases solides | oui | oui / oui |
| `/plateforme-aria` | oui | Rencontrez ARIA | oui | oui / oui |
| `/accompagnement-scolaire` | oui | Trouver un cadre adapté au besoin réel | oui | oui / oui |
| `/contact` | oui | Une question claire mérite une réponse claire | oui | oui / oui |
| `/conditions-generales` | oui | Conditions Générales | oui | oui / oui |
| `/mentions-legales` | oui | Mentions Légales | oui | oui / oui |

**Observé :** les onze pages possèdent une meta viewport. La présence CTA est
constatée dans le document rendu, y compris quand elle provient du chrome global.
Le fonctionnement interactif du wizard de recommandation n'a pas été exercé,
la mission limitant les interactions publiques aux GET/HEAD.

### Liens et coordonnées

**Observé :**

- Aucun `href="#"`, href vide ou ancre interne absente n'a été trouvé dans les
  onze HTML.
- Tous les liens WhatsApp observés commencent par
  `https://wa.me/21699192829`.
- Les mailto génériques utilisent `contact@nexusreussite.academy`. Les adresses
  `dpo@` et `admin@` n'apparaissent que dans les documents juridiques.
- Le téléphone canonique `+216 99 19 28 29` et l'email
  `contact@nexusreussite.academy` sont présents sur chaque document via le
  chrome partagé.
- Les deux liens Google Maps de `/contact` ciblent
  `https://www.google.com/maps?q=Mutuelleville%2C%20Tunis`.

### Adresses

**Observé :** `/contact` distingue correctement « Siège social administratif »
à l'Immeuble VENUS/Centre Urbain Nord et « Centre d'accompagnement pédagogique »
à Mutuelleville. Les rendez-vous y sont annoncés sur confirmation et les liens
Maps ciblent Mutuelleville.

**Écart :** le chrome partagé affiche aussi `Immeuble VENUS` et
`Centre Urbain Nord` sur toutes les pages commerciales auditées : `/`,
`/offres`, `/recommandation`, `/bilan-gratuit`, `/stages`,
`/stages/pre-rentree-2026`, `/plateforme-aria` et
`/accompagnement-scolaire`. Mutuelleville y est également présent, mais cette
présence administrative généralisée contredit la règle qui la réserve au légal,
aux CGV, à la facturation et au bloc administratif explicite de `/contact`.

### Expressions marketing recherchées

Les correspondances exactes observées sont :

- `/` : « Acompte intégralement remboursé. » et « Si le seuil n'est pas atteint,
  l'acompte est intégralement remboursé. »
- `/offres` : les mêmes mentions de remboursement d'acompte, ainsi que
  « Scolarisés, candidats libres ou 100 % en ligne » et « Terminale Libre Online
  100 % en ligne ».
- `/conditions-generales` : « Aucun remboursement prorata », « Remboursement
  intégral si la demande est formulée dans les 14 jours », « un remboursement ou
  un avoir est accordé », « Les demandes de remboursement » et « Le Vendeur ne
  garantit pas l'obtention de résultats scolaires spécifiques. »

**Observation :** ces occurrences décrivent une modalité en ligne, le traitement
d'un acompte ou une clause juridique. Aucune ne promet un résultat scolaire. Les
autres pages ne contiennent aucune des expressions recherchées. Aucun nombre
d'élèves suivis ni de mentions obtenues n'est présenté comme preuve de réussite;
les nombres d'élèves trouvés correspondent aux capacités de groupes.

### Cohérence tarifaire

Référence Git locale utilisée : `origin/main` au commit
`11e0dce93e9f1d4c79824f9cccd0a467dde4f11b`, daté du 27 juillet 2026.

Montants TND uniques observés dans le DOM :

- `/offres` : 40, 100, 105, 120, 126, 130, 144, 150, 160, 170, 186, 190,
  192, 200, 210, 220, 225, 230, 233, 236, 245, 250, 260, 270, 280, 290,
  294, 300, 330, 336, 340, 350, 373, 376, 380, 390, 400, 405, 410, 420,
  435, 440, 450, 460, 480, 490, 500, 525, 540, 545, 550, 560, 570, 580,
  590, 614, 618, 630, 650, 660, 714, 720, 750, 770, 810, 850, 870, 900,
  945, 950, 1 010, 1 170, 1 260, 1 290, 1 350, 1 390, 1 440, 1 450,
  1 470, 1 490, 1 620, 1 690, 1 770, 1 800, 1 900, 1 990, 2 150,
  2 370, 2 390, 2 400, 2 490, 2 700, 2 880, 2 900, 2 970, 3 000,
  3 900, 4 800, 4 900, 5 400, 5 900, 7 175, 7 900, 9 594 et 9 900.
- `/stages` : 420, 720, 1 450, 1 990 et 2 490.
- `/stages/pre-rentree-2026` : 105, 120, 144, 245, 270, 280, 336, 350,
  400, 405, 480, 540, 630, 900, 945, 1 260, 1 350 et 1 800.

**Observé :** tous ces montants correspondent à un champ monétaire ou à un
échéancier de `data/pricing.canonical.json` sur `origin/main`. Aucun écart P0 de
prix n'a été trouvé.

Pour la pré-rentrée, la vérification contextuelle confirme :

- Fondations entrée en 4e : 350 TND, acompte 105 TND, solde 245 TND.
- Fondations entrée en 3e : 350 TND, acompte 105 TND, solde 245 TND.
- Fondations entrée en Seconde : 400 TND, acompte 120 TND, solde 280 TND.
- Premium 1/2/3/4 matières : 480/900/1 350/1 800 TND.
- Acomptes Premium : 144/270/405/540 TND, soit 30 %.
- Soldes Premium : 336/630/945/1 260 TND.

**Déduction limitée :** cette parité est compatible avec un build utilisant la
source canonique actuelle, mais le HTML ne permet pas de prouver quel fichier ou
getter a été utilisé au moment du build. Aucun prix ne permet d'identifier un
build plus ancien.

### Pré-rentrée 2026

**Observé :**

- Les cinq niveaux sont présents : entrée en 4e, 3e, Seconde, Première et
  Terminale.
- La Philosophie est proposée en Terminale.
- Un dossier PDF 4e et un dossier PDF Terminale sont liés publiquement; la page
  décrit la Philosophie dans le programme Terminale.
- Le texte indique explicitement : « Le site permet uniquement de demander une
  information », « aucune réservation ni collecte de paiement n'est activée en
  ligne », « La demande d'information est transmise sans paiement » et « Elle ne
  réserve pas une place et ne forme pas un contrat ».
- Aucun lien de paiement, aucune promesse de place bloquée, aucun mot
  « enseignant »/« professeur » et aucun nom d'enseignant n'a été observé dans le
  corps public de cette page.

**Point de gouvernance :** le HTML et `pricing.canonical.json` exposent des
capacités Fondations allant jusqu'à 6 élèves, alors que `AGENTS.md` formule une
règle générale de 5 maximum. Les prix sont cohérents, mais cette exception de
capacité doit être explicitement arbitrée et documentée.

### Hygiène technique et sécurité

| Contrôle | Résultat observé |
|---|---|
| `sitemap.xml` | 200, 23 URL, les onze pages auditées sont présentes |
| `robots.txt` | 200, autorise `/`, exclut notamment `/dashboard/`, `/api/`, `/auth/`, `/session/`, `/test/` |
| Endpoint santé public | GET `/api/health` = 200, JSON limité aux clés `status` et `timestamp` |
| HSTS | présent, `max-age=31536000; includeSubDomains; preload` |
| `X-Frame-Options` | présent, `DENY` |
| `X-Content-Type-Options` | présent, `nosniff` |
| CSP | présente, `frame-ancestors 'none'`, `object-src 'none'`, mais autorise `unsafe-inline` et `unsafe-eval` pour les scripts |
| Certificat TLS | Let's Encrypt, valide du 27 juin au 25 septembre 2026 |

### Indices de rendu mobile

**Observé :**

- Meta viewport présente sur les onze pages.
- Deux CSS Next.js servis avec succès.
- Aucune propriété `width` ou `min-width` fixe d'au moins 768 px n'a été trouvée;
  seules des contraintes `max-width` à 768/1200 px apparaissent.
- Les cinq tableaux de `/stages/pre-rentree-2026` sont dans des conteneurs
  `hidden ... sm:block`; ils ne sont donc pas rendus sous le breakpoint mobile.
- Le CSS contient des règles `overflow-x:auto` pour les composants qui en ont
  besoin.

**Limite :** aucun navigateur graphique n'a été lancé afin de respecter le
profil réseau séquentiel imposé. L'absence de débordement est donc une conclusion
statique, pas une validation visuelle pixel par pixel.

## Étape 4 — Delta production / `origin/main`

| Fonction récente de `origin/main` | État public | Preuve ou limite |
|---|---|---|
| Page `/stages/pre-rentree-2026` | présente en prod | HTTP 200, H1 dédié |
| Entrée en 4e | présente en prod | niveau, tarifs, planning et lien du dossier 4e visibles |
| Philosophie Terminale | présente en prod | matière et planning visibles dans le parcours Terminale |
| Hero/spotlight pré-rentrée sur `/` | présent en prod | CTA « Découvrir la Pré-rentrée 2026 » et repères tarifaires visibles |
| Dossiers publics par niveau | présents en prod | liens PDF 4e, 3e, Seconde, Première et Terminale visibles |
| Grille Fondations/Premium du 20 juillet | présente en prod | tous les prix et échéanciers publics correspondent |
| Migration technique vers `pricing.canonical.json` | indéterminable | parité de sortie, mais aucune provenance de source dans l'HTML |
| Ajouts SVT Première/Terminale | présents en prod | SVT visible dans les matières pré-rentrée et les offres |
| Fondation canonique des bilans | indéterminable | `/bilan-gratuit` répond 200, persistance interne non testée |
| Durcissement des gardes API/auth | indéterminable | aucun test d'authentification ou d'API protégée autorisé |
| Gates de release standalone | indéterminable | aucune métadonnée de build ni accès SSH |

**Observation Git :** le dernier `origin/main` local est le merge
`11e0dce93` du 27 juillet 2026, « Pré-rentrée 2026 — Entrée en 4e et Philosophie
Terminale ».

**Déduction :** la production paraît **à jour sur le périmètre public
observable**, car elle contient les signatures du commit le plus récent. Aucun
retard public mesurable n'est démontré, soit approximativement zéro livraison
publique identifiable de retard. Le SHA exact et les changements purement
internes restent indéterminables.

## Références Docker dans la CI

**Observé :** aucun fichier sous `.github/workflows/` ne référence
`Dockerfile.prod` ou `docker-compose.prod.yml`. Cela ne prouve pas l'absence de
tout usage manuel ou externe à GitHub Actions.

## Constats classés

### P0

- L'adresse administrative Centre Urbain Nord/Immeuble VENUS est injectée sur
  toutes les pages commerciales auditées, contrairement à la séparation
  d'adresse demandée. Correction proposée : retirer l'adresse administrative du
  chrome commercial et la conserver sur le légal, les CGV, la facturation et le
  bloc administratif distinct de `/contact`.

### P1

- La capacité publique Fondations atteint 6 élèves alors que la règle générale
  du dépôt annonce 5 maximum. Correction proposée : arbitrer l'exception, puis
  aligner `AGENTS.md`, la source canonique et les copies publiques.
- La CSP autorise `unsafe-inline` et `unsafe-eval` pour les scripts. Correction
  proposée : inventorier les dépendances concernées et migrer vers nonce/hash
  avant de durcir la directive; ne pas retirer ces valeurs sans test.
- La contradiction README entre PM2 et Docker était un risque opérationnel.
  Correction appliquée dans cette mission : §16 canonique, §18 explicitement
  local/vestigial.

### P2

- Aucun identifiant de build ou SHA n'est exposé publiquement. Correction
  proposée : exposer un identifiant non sensible dans un header ou dans
  `/api/health`.
- L'expiration TLS intervient le 25 septembre 2026. Correction proposée :
  confirmer la supervision du renouvellement automatique avant l'échéance.

## Décisions documentaires prises

- Le §16 de `README.md` reste l'unique description de la production.
- Le §18 est renommé « Environnement Docker local (vestigial — NON utilisé en
  production) » et porte un avertissement explicite.
- L'ADR 006 acte PM2 standalone comme cible et conserve les fichiers Docker en
  non-production.

## Questions ouvertes

- Quel est le SHA actuellement déployé sur le serveur distant et à quelle date
  le processus PM2 a-t-il été redémarré ?
- L'exception de capacité à 6 élèves pour Fondations 4e/3e/Seconde est-elle
  validée au niveau produit et juridique ?
- L'adresse administrative doit-elle disparaître entièrement du footer
  commercial, `/contact` restant l'exception à deux blocs ?
- Quelle option retenir pour l'environnement Docker historique : arrêt,
  conservation documentée ou suppression ?
- Un accès SSH read-only ou une métadonnée de release peut-il être fourni pour
  relier la surface publique à un commit exact ?

## Fichiers modifiés

- `README.md`
- `docs/adr/006-pm2-standalone-production-target.md`
- `docs/audits/2026-07-31-audit-infra-et-prod-publique.md`

## Risques restants

- Le code applicatif n'est volontairement pas corrigé dans cette mission.
- Les constats de contenu client dynamique reposent sur le HTML/DOM servi, sans
  soumission de formulaire.
- L'état interne PM2, Nginx distant, PostgreSQL distant et filesystem de release
  reste hors de portée sans SSH.

## Rollback documentaire

Le rollback consiste à restaurer l'ancien intitulé et le bloc Docker du §18 du
README, puis à retirer l'ADR 006 et ce rapport. Aucun rollback applicatif ou
infrastructure n'est nécessaire.
