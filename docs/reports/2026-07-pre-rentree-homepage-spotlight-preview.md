# Pré-rentrée 2026 — Homepage spotlight preview

## Date

12 juillet 2026 — environnement `Africa/Tunis`.

## Décision

L’Option 1 validée est appliquée : le spotlight de campagne est rendu immédiatement après `CorporateNavbar`, avant le hero permanent et avant le routeur « Mon enfant est en… ».

## Défaut initial et cause

La campagne était auparavant présentée dans une carte claire peu différenciée, après le hero. La grande zone bleu nuit observée n’était pas causée par un composant vide, une `min-height`, une erreur d’hydratation ou une animation bloquée. Elle correspondait à la hauteur réelle du `HeroSection` : ordre image/contenu sur mobile, texte, espacements verticaux et dégradé inférieur. Le placement de l’ancienne annonce après ce hero la rendait absente du premier viewport.

La correction ne comprime ni ne supprime le hero : le spotlight SSR occupe désormais la transition sous la navbar, puis le hero conserve son rôle de H1 permanent.

## Source des données

La homepage appelle `getPreRentreeHomepageSpotlightDTO()`, getter serveur dérivé de `getPreRentreeLandingDTO()`.

Le DTO minimal fournit uniquement :

- l’identifiant et les libellés publics de campagne ;
- le cartouche de dates et son texte accessible ;
- les trois classes d’entrée ;
- les quatre familles de matières ;
- la capacité et le volume par matière ;
- le lieu ;
- la phrase éditoriale canonique ;
- la route canonique et l’ancre planning.

Le composant client n’importe ni manifeste JSON ni pricing JSON. Il ne contient aucune date commerciale, aucun prix et aucun contact en littéral. L’année des titres et CTA est dérivée de la période canonique côté serveur.

## Design desktop et tablette

Le composant `PreRentreeCampaignSpotlight` utilise une grille asymétrique en trois zones :

1. cartouche bleu nuit `17–28 / AOÛT / 2026` avec texte accessible « Du 17 au 28 août 2026. » ;
2. statut, titre, classes d’entrée, matières, phrase pédagogique et quatre chips ;
3. CTA doré vers la landing et CTA secondaire vers `#planning`.

Le filet latéral doré, la bordure, l’ombre et le contraste ivoire/bleu nuit créent la rupture avec les cartes permanentes sans gradient multiple, glow, urgence ou disponibilité fictive.

À 1440 × 1000, le spotlight est entièrement compris dans le premier viewport. À 768 × 1024, la date devient une bande supérieure, le contenu reste hiérarchisé et les actions occupent toute la largeur utile.

## Design mobile

À 390 × 844 et 320 × 800 :

- la date, le statut, le titre et les classes d’entrée sont immédiatement lisibles ;
- les matières ne sont pas tronquées ;
- les chips passent sur deux colonnes ;
- les deux CTA sont pleine largeur et le CTA principal reste dans le premier viewport ;
- aucun scroll horizontal n’est présent ;
- les cibles tactiles atteignent 44 px minimum.

## Navbar

Le lien desktop « Pré-rentrée 2026 » reçoit une icône calendrier, un fond doré translucide, une bordure renforcée, un hover et un focus visibles. Il pointe directement vers `/stages/pre-rentree-2026`.

Sur mobile, cette action remplace le bouton Connexion visible dans la barre supérieure. « Connexion » et « Espace Famille » restent accessibles dans le menu mobile. Le logo et les espacements sont resserrés pour éviter tout débordement à 320 px ; le mot « Menu » est masqué sous 370 px, mais son bouton et son nom accessible restent présents.

## Séparation du routeur permanent

Le routeur conserve sa logique et toutes ses entrées, notamment Troisième et Candidat libre. Un fond clair, une bordure supérieure, un eyebrow « Accompagnement à l’année » et un H2 propre le distinguent du spotlight temporaire.

## Analytics

Événements ajoutés au contrat existant :

- `pre_rentree_home_spotlight_view` ;
- `pre_rentree_home_spotlight_clicked` ;
- `pre_rentree_home_planning_clicked` ;
- `pre_rentree_nav_clicked`.

Dimensions autorisées uniquement : `campaign_id`, `cta_location`, `destination`, `viewport_category`. Aucun nom, email, téléphone, établissement, identifiant utilisateur, URL complète ou texte libre n’est envoyé. L’impression est verrouillée par instance avec un `ref` et les tests navigateur prouvent une émission unique.

Sur la preview, le proxy bloque le Google Tag de production par CSP. Le contrôle console dédié confirme exactement ce blocage et aucune autre erreur : la preview n’émet donc pas d’analytics de production.

## Accessibilité

- H2 cohérent et ordre de lecture date → statut → titre → contenu → actions ;
- date visuelle masquée aux technologies d’assistance et libellé complet disponible ;
- icônes décoratives `aria-hidden` ;
- statut compréhensible sans couleur ;
- focus visible et liens explicites ;
- contraste du titre verrouillé sur le token `--color-lux-ink` afin de neutraliser une règle globale trop spécifique ;
- Axe : aucune violation sérieuse ou critique sur le spotlight ;
- navigation clavier, reduced motion, zoom 200 % et 320 px vérifiés.

## Performance et qualification locale

Runtime canonique : Node.js 20.20.0, npm 10.8.2, Next.js 15.5.18.

Résultats sur l’état exact committé :

- `npm ci` : code 0 ;
- tests ciblés homepage/campagne/navbar/pricing : 198/198, code 0 ;
- `npm run typecheck` : code 0 ;
- `npm run lint` : code 0, avertissements historiques hors périmètre uniquement ;
- `PERF_TESTS=1 ./scripts/gate-all.sh` : code 0 ;
- Jest : 6 664/6 664 ;
- E2E publics : 218/218 ;
- E2E authentifiés : 42/42 ;
- total gate : 6 924 ;
- `npm run build` / standalone : code 0, 144 pages ;
- smoke local : 200 sur les pages publiques prioritaires et la landing, 308 sur `/pre-rentree` ;
- `npm run check:no-hardcoded` : code 0 ;
- `npm run security:repo` : code 0 ;
- audit sitemap : 292 routes, 415 arêtes, zéro lien invalide ;
- `git diff --check` et contrôle des ajouts interdits : code 0.

Un passage intermédiaire du gate performance a été perturbé par la contention du serveur standalone utilisé pour les captures. Le serveur concurrent a été arrêté, le test SLA isolé a repassé 4/4, puis le gate complet ci-dessus a été rejoué sans charge concurrente.

## Captures inspectées

Captures distantes, hors Git : `/tmp/nexus-pre-rentree-2026-homepage-spotlight`.

- `homepage-spotlight-1440.png` ;
- `homepage-spotlight-768.png` ;
- `homepage-spotlight-390.png` ;
- `homepage-spotlight-320.png` ;
- `homepage-first-viewport-desktop.png` ;
- `homepage-first-viewport-mobile.png` ;
- `navbar-campaign-desktop.png` ;
- `navbar-campaign-mobile-closed.png` ;
- `navbar-campaign-mobile-open.png`.

Les neuf captures ont été régénérées depuis la vraie preview Basic Auth et inspectées : aucun chevauchement, débordement, texte tronqué ou perte de contraste observé.

## Déploiement preview

- URL : `https://pr26-6fe2.88-99-254-59.sslip.io` ;
- ancien SHA preview : `4b87d78850445ac050c8422e7c28c9f39c6dbeb0` ;
- SHA applicatif déployé : `41aabc84e56000a918c33cb93144e9f1cbdfd8d5` ;
- image : `nexus-pre-rentree-preview:41aabc84e560` ;
- digest local Docker : `sha256:9905f3243722e8dc0ffeb195c1ab3032992384bdd8dd8e5d1bae7580fa4cdb94` ;
- conteneur app : healthy, IP `172.29.26.10` ;
- DB preview : IP `172.29.26.20`, volume `nexus-pre-rentree-preview_preview-db-data` inchangé ;
- MailHog preview inchangé ;
- Basic Auth, TLS, canonical production, robots `Disallow: /` et `X-Robots-Tag: noindex, nofollow, noarchive` conservés ;
- credential propriétaire : `/home/alaeddine/.config/nexus-preview/pre-rentree-2026/owner-credential.txt`, mode `0600` ;
- SMTP dirigé vers MailHog ; email et Telegram désactivés ; ClicToPay désactivé ; DB production non utilisée.

La commande Prisma distante a détecté 45 migrations existantes et aucune migration à appliquer. Aucun schéma ni fichier Prisma n’a été modifié.

## Preuves HTTP et E2E distantes

- accès sans credential : 401 ;
- `/`, `/stages`, `/offres`, `/stages/pre-rentree-2026`, `/bilan-gratuit`, sitemap : 200 avec noindex ;
- `/pre-rentree` : 308 vers la route canonique ;
- `robots.txt` : 200 et `Disallow: /` ;
- CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` et `Permissions-Policy` présents ;
- canonical homepage vers le domaine de production ;
- E2E spotlight distants : 14/14 ;
- contrôle console isolation analytics : Google Tag bloqué par CSP, aucune autre erreur ;
- logs app après tests : 6 lignes, zéro erreur, hydratation, 404/500, notification ou marqueur de secret.

Le scénario historique `premium-home` fondé sur un délai fixe a observé une fois le menu pendant son hydratation distante. Le contrôle déterministe suivant a confirmé `aria-expanded=true`, overlay visible et opacité 1. Le parcours canonique navbar/mobile/Connexion est vert dans les 14 E2E distants.

## Production inchangée

- homepage et `/offres` : 200 ;
- healthcheck local : 200 ;
- spotlight absent de la homepage production ;
- listener production inchangé sur `127.0.0.1:3001`, PID `3723843` ;
- DB production `nexus-postgres-db` inchangée, healthy, démarrée le 18 mai 2026 ;
- empreinte Nginx production inchangée : `2badd87ec6cc157bcb2b07bd72af4023484a203e1030286a1a7711bd328532ef` ;
- empreinte Nginx preview inchangée : `068cbdd8bae02a3aa49f40146649b62dedf74768d23c6fa45e2f29c8ea854d32` ;
- aucun restart, merge ou déploiement production.

## Rollback preview

Le rollback ne touche ni la DB preview ni la production :

1. replacer uniquement les références `app`/`migrate` du Compose preview sur `4b87d78850445ac050c8422e7c28c9f39c6dbeb0` et le tag `4b87d7885044` ;
2. exécuter depuis `/srv/nexus-pre-rentree-preview-6fe2e773` :
   `docker compose --env-file .build.env -p nexus-pre-rentree-preview -f docker-compose.preview.yml up -d --no-deps --force-recreate app` ;
3. attendre le healthcheck `healthy` ;
4. rejouer les contrôles 401/200/308, TLS, Basic Auth et noindex ;
5. vérifier en lecture seule le PID, le healthcheck et l’empreinte Nginx production.

Aucune donnée et aucune migration ne sont à restaurer.

## Éléments à valider par le propriétaire

1. priorité visuelle de la campagne dans le premier viewport ;
2. cartouche dates, statut et titre ;
3. clarté des trois classes d’entrée et des quatre familles de matières ;
4. lisibilité des quatre chips ;
5. CTA principal et CTA planning ;
6. équilibre du spotlight avec le hero permanent ;
7. séparation avec « Mon enfant est en… » ;
8. navbar desktop ;
9. navbar mobile fermée et ouverte ;
10. maintien de Connexion et Espace Famille ;
11. rendu 1440, 768, 390 et 320 px ;
12. autorisation finale de publication — hors périmètre de cette preview.

## Périmètre confirmé

Aucun tarif, planning, programme, dashboard, paiement, fichier Prisma, migration ou API V2 n’a été modifié. Aucun prix ni contact n’a été codé dans le nouveau composant. Aucun secret ni capture n’est committé.
