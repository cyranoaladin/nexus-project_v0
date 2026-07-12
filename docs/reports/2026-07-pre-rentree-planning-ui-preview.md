# Revue UI du planning Pré-rentrée 2026 et mise à jour de la preview

## Date et verdict

- Qualification et déploiement : 12 juillet 2026, Africa/Tunis.
- Statut : `READY_FOR_OWNER_PLANNING_UI_VALIDATION`.
- Périmètre : présentation du planning, thème des matières, synchronisation des
  vues et libellés publics associés.

La landing conserve les tarifs, dates, créneaux, programmes, capacités et règles
commerciales validés. La nouvelle présentation est déployée uniquement sur la
preview isolée ; la production n'a pas été modifiée.

## Git et artefact

- Branche : `fix/pre-rentree-2026-planning-ui`.
- SHA de base : `38763bd0b133e6785d1c35f8f71b4b1b657a5867`.
- Ancien SHA applicatif de preview :
  `6fe2e77302a17b9806739d014f75530d9ae91280`.
- Nouveau SHA applicatif qualifié et déployé :
  `4b87d78850445ac050c8422e7c28c9f39c6dbeb0`.
- Image applicative :
  `sha256:7a9ff37ec09e4f2ebef899679dc70b3edf041c95e8c8d3be1638df3e7b53a4e8`.
- Manifest de l'image applicative :
  `sha256:38cd70fd61f9199a043c16abfd9cd00f4da0ce3a4a8e3689a77ec3b55ea4a20d`.
- Label de révision de l'image : nouveau SHA applicatif exact.
- Checkout de construction distant : détaché, propre et au nouveau SHA exact.

La branche a été poussée sans force. Aucun merge, auto-merge, déploiement de
production ou pull request vers `main` n'a été effectué.

## Corrections publiques

- Le statut public est `Pré-inscriptions ouvertes` ; l'enum
  `PRE_REGISTRATION_OPEN` n'est jamais rendu comme texte visible.
- L'heure de décision est formatée en français : `18 h 00`.
- Le lieu est dédupliqué : `Nexus Réussite — Mutuelleville, Tunis`.
- La mention `nouvel onglet` reste destinée aux technologies d'assistance et
  n'apparaît plus comme suffixe visuel des boutons.
- Les trois libellés publics restent `Entrée en Seconde`, `Entrée en Première` et
  `Entrée en Terminale`.
- Les présences sont condensées, par exemple `Du lundi 17 au vendredi 21 août`,
  tandis que les dates détaillées restent conservées dans le DTO et les libellés
  accessibles.

## Palette matière centralisée

La source client-safe unique est
`lib/campaigns/pre-rentree-2026/subject-theme.ts`.

| Famille | Repère visuel | Matières couvertes |
|---|---|---|
| Mathématiques | bleu profond, fond bleu clair, monogramme `M` | Mathématiques |
| Français / Expression | bordeaux, fond rose clair, monogramme `F` | Français, EAF, expression et oral |
| NSI / SNT | violet, fond lavande, pictogramme algorithmique | NSI, initiation informatique et SNT |
| Physique-Chimie | sarcelle, fond turquoise clair, monogramme `PC` | Physique-Chimie |

Le même thème alimente les cartes du configurateur, le résumé, les deux vues du
planning, les programmes, la légende et les badges. Le nom et le pictogramme
accompagnent toujours la couleur. Les variantes d'impression restent lisibles en
niveaux de gris ; le doré demeure réservé à la marque et à la sélection.

## Planning par classe de rentrée

- Trois sous-onglets : Seconde, Première et Terminale.
- Tableau HTML accessible à partir de 640 px avec six colonnes : matière,
  semaine, dates, créneau, salle et volume.
- Quatre lignes issues des sessions du DTO pour chaque classe.
- Dates condensées avec mention du lundi au vendredi.
- Volume explicite : `5 séances · 10 h`.
- Sous 640 px, chaque ligne devient une carte compacte sans défilement
  horizontal.

## Emploi du temps par semaine

- Deux sous-onglets : `Semaine 1 · 17–21 août` et
  `Semaine 2 · 24–28 août`.
- Sur écran large : tableau `Créneau / Salle 1 / Salle 2` et quatre blocs A à D.
- Sur mobile : liste par bloc, avec les deux salles empilées.
- Chaque cellule occupée affiche matière, classe d'entrée, bloc et durée.
- Chaque cellule inoccupée affiche explicitement `Libre`.
- La semaine 1 associe Mathématiques en salle 1 et Français en salle 2.
- La semaine 2 associe SNT/NSI en salle 1 et Physique-Chimie en salle 2.

Toutes les dates, heures, salles, matières et affectations proviennent du DTO,
lui-même dérivé du manifeste canonique. Aucun planning parallèle ni créneau codé
dans les nouveaux composants n'a été introduit.

## Synchronisation de l'expérience

Un contexte de campagne partage uniquement la classe réellement choisie dans le
configurateur :

- le choix parent synchronise automatiquement planning et programmes ;
- sans choix parent, les deux vues affichent Seconde sans cocher le formulaire ;
- un changement manuel d'onglet planning ou programme reste local ;
- ces changements ne mutent jamais la configuration du parent ;
- le résumé et les événements analytics conservent l'`entry_level` configuré.

## Organisation pédagogique

Le bloc public présente exactement :

1. Enseignant Mathématiques / NSI / SNT : Mathématiques en semaine 1, SNT et NSI
   en semaine 2, sans simultanéité.
2. Enseignant de Français : Français Seconde, EAF Première, expression et oral
   Terminale en semaine 1.
3. Enseignant de Physique-Chimie : Seconde, Première et Terminale en semaine 2.

Deux salles pédagogiques sont décrites : salle 1 pour Mathématiques/NSI/SNT et
salle 2 pour Français puis Physique-Chimie. Aucun nom personnel ni charge interne
60/30/30 n'est affiché publiquement ; ces charges restent verrouillées par les
tests de contrat.

## TDD et tests unitaires

La preuve rouge initiale a constaté neuf échecs sur sept suites : formatters et
thèmes absents, semaines et rôles non exposés par le DTO, ancienne présentation
du planning et ancien statut public.

Après implémentation :

- suites ciblées planning/présentation : 7 suites, 41 tests passés ;
- agrégat campagne, configurateur, programmes et pricing : 20 suites, 239 tests
  passés ;
- gate global avec `PERF_TESTS=1` : 534 suites Jest et 6 655 tests passés ;
- E2E publics du gate : 211 passés ;
- E2E authentifiés du gate : 42 passés ;
- total gate : 6 908 tests passés, aucun test skipped.

Les contrats continuent de verrouiller les quatre packs, 12 modules, 60 séances,
trois enseignants, charges 60/30/30, deux salles, 45 configurations et absence de
collision.

## Accessibilité, responsive et E2E

- Radix Tabs fournit tablist, tab, tabpanel, `aria-selected`, `aria-controls`,
  flèches, Home et End.
- Les tableaux possèdent caption, headers avec scope et intitulés de ligne.
- Les cibles tactiles font au moins 44 px et le focus reste visible.
- La couleur n'est jamais la seule information.
- Les vues planning, configurateur et programmes ne présentent aucune violation
  Axe sérieuse ou critique.
- Les parcours restent utilisables à 1440, 768, 390 et 320 px ainsi qu'au zoom
  navigateur 200 %, sans débordement horizontal.
- Playwright local ciblé : 12 tests passés.
- Playwright sur la vraie preview avec Basic Auth : 12 tests passés en 1 min 30.

Le parcours distant couvre les trois classes, les quatre volumes de pack,
planning par classe, deux semaines, deux salles, quatre blocs, programmes, FAQ,
bilan prérempli, URL WhatsApp sans envoi, navigation clavier, Axe et responsive.

## Qualification technique locale

| Vérification | Résultat |
|---|---:|
| Runtime de build | Node 20.20.0 / npm 10.8.2 / Next.js 15.5.18 |
| `npm ci` | code 0 |
| `npm run typecheck` | code 0 |
| `npm run lint` | code 0, avertissements historiques hors diff uniquement |
| tests anti-hardcoding | code 0 |
| gate global `PERF_TESTS=1` | code 0 |
| `npm run build` | code 0, 144 pages |
| serveur standalone et smoke HTTP | code 0 |
| audit liens/sitemap | code 0, aucun lien cassé |
| `npm run security:repo` | code 0 |
| `git diff --check` | code 0 |
| contrôle secrets | aucun secret ajouté |

Le standalone a répondu 200 sur les pages publiques et 308 sur `/pre-rentree` ;
aucun 404 d'asset ou 500 n'a été observé.

## Captures distantes et revue visuelle

Répertoire hors Git : `/tmp/nexus-pre-rentree-2026-planning-ui`.

Onze captures ont été régénérées depuis la vraie preview :

- `planning-par-classe-seconde-desktop.png` ;
- `planning-par-classe-premiere-desktop.png` ;
- `planning-par-classe-terminale-desktop.png` ;
- `emploi-du-temps-semaine-1-desktop.png` ;
- `emploi-du-temps-semaine-2-desktop.png` ;
- `planning-tablette.png` ;
- `planning-mobile-390.png` ;
- `planning-mobile-320.png` ;
- `planning-zoom-200.png` ;
- `configurateur-planning-synchronise.png` ;
- `programmes-synchronises.png`.

La revue des onze preuves ne révèle aucun chevauchement, débordement horizontal,
texte tronqué, CTA masqué ou désynchronisation. Les tableaux desktop, les cartes
mobiles, les cellules `Libre`, les quatre familles de couleurs et l'organisation
pédagogique restent lisibles.

## Preview mise à jour

- URL inchangée : `https://pr26-6fe2.88-99-254-59.sslip.io`.
- Protection : Basic Auth Nginx existante.
- Credential propriétaire, hors Git et permissions `0600` :
  `/home/alaeddine/.config/nexus-preview/pre-rentree-2026/owner-credential.txt`.
- TLS : certificat valide, vérification Curl `0`.
- Anti-indexation : `X-Robots-Tag: noindex, nofollow, noarchive` et
  `robots.txt` avec `Disallow: /`.
- Canonical : domaine de production, route campagne canonique.
- Runtime image : Node 20.20.0, npm 10.8.2, Next.js 15.5.18.
- Application : healthy, révision exacte du nouveau SHA.
- Réseau : bridge interne dédié `172.29.26.0/24`, aucun port Docker publié.
- Base : volume dédié conservé
  `nexus-pre-rentree-preview_preview-db-data`, 67 tables, aucune copie de
  production.

Compose a recréé les conteneurs de la seule stack preview afin d'actualiser leurs
labels de révision ; le volume PostgreSQL dédié et son contenu ont été conservés.
Le migrator a appliqué uniquement les migrations existantes et a terminé avec le
code 0. Aucune migration n'a été créée ou modifiée.

## Sécurité et sorties neutralisées

- Accès campagne sans authentification : 401.
- HTTP vers HTTPS : 301.
- Routes authentifiées `/`, `/stages`, `/offres`, campagne, bilan, robots et
  sitemap : 200.
- `/pre-rentree` : 308 vers la route canonique.
- Asset JavaScript extrait : 200 ; aucun 500.
- CSP et HSTS présents ; TLS valide ; noindex présent.
- Base runtime : hostname Docker `db`, distinct de la production.
- Email : désactivé et dirigé vers le sink local, zéro message après E2E.
- Telegram : désactivé.
- Paiement ClicToPay : désactivé ; endpoint de paiement absent en 404.
- Analytics de production : absentes de l'environnement preview.
- Logs applicatifs depuis la mise à jour : 0 erreur, 0 erreur d'hydratation,
  0 réponse 5xx et 0 marqueur de secret.

## Production inchangée

Après la mise à jour de preview :

- SHA : `1b8219b1cfcfe63354d8cb4035645143e27e5a43`, inchangé ;
- processus `nexus-prod` : PID `1518444`, uptime inchangé ;
- master Nginx : PID `1995110`, inchangé ;
- empreinte vhost production :
  `2badd87ec6cc157bcb2b07bd72af4023484a203e1030286a1a7711bd328532ef`,
  inchangée ;
- conteneur PostgreSQL production : ID `840ffa04837e…`, healthy, démarré le
  18 mai 2026, inchangé ;
- les huit pages publiques critiques répondent 200 ;
- la campagne et sa route courte répondent 404 en production.

Aucun service de production n'a été redémarré, aucun port, volume, vhost, DNS,
SHA ou contenu de production n'a été modifié.

## Fichiers applicatifs modifiés

- Présentation et données : `presentation.ts`, `subject-theme.ts`, `getters.ts`,
  `configurator.ts`.
- Expérience : `CampaignExperienceContext.tsx`, `SubjectBadge.tsx`,
  `ScheduleSection.tsx`, `ProgramsSection.tsx`, `StageConfigurator.tsx`,
  `PracticalInformation.tsx`, page campagne.
- Tests : suites Jest campagne/composants, scénario Playwright campagne et
  correction du compte de sections homepage devenu historique.
- Documentation : conception, plan d'implémentation et présent rapport.

## Rollback de la preview

Depuis `/srv/nexus-pre-rentree-preview-6fe2e773`, rétablir hors Git les tags
applicatif et migrator sur `6fe2e77302a1`, puis exécuter uniquement :

```bash
docker compose --env-file .build.env \
  -p nexus-pre-rentree-preview \
  -f docker-compose.preview.yml \
  up -d --no-build app
```

Vérifier ensuite le healthcheck, le label de révision, Basic Auth, TLS, noindex et
les routes HTTP. Cette opération ne touche pas la production et ne nécessite
aucune restauration de données ou migration.

## Nettoyage après validation

La durée de vie reste celle du déploiement initial : conservation jusqu'à
validation propriétaire, au plus tard le 26 juillet 2026 sans renouvellement
explicite. La procédure de suppression documentée dans le rapport de déploiement
initial arrête uniquement le projet Compose `nexus-pre-rentree-preview`, supprime
son volume dédié si autorisé, puis retire uniquement le vhost, le certificat et la
credential de preview. Elle ne doit pas être exécutée avant la validation.

## Éléments à valider par le propriétaire

1. Compréhension immédiate des deux semaines et des quatre blocs horaires.
2. Lisibilité des tableaux desktop et tablette.
3. Lisibilité des cartes à 390 px et 320 px.
4. Palette bleu, bordeaux, violet et sarcelle.
5. Cohérence des couleurs entre configurateur, résumé, planning et programmes.
6. Synchronisation des vues après sélection de chaque classe de rentrée.
7. Présentation des deux salles et des trois rôles enseignants.
8. Formulation des cellules libres et de l'organisation pédagogique.
9. Lisibilité des dates condensées et des horaires.
10. Disponibilité réelle des trois enseignants et des deux salles.
11. Rendu final du bilan prérempli et du lien WhatsApp, sans envoi.
12. Autorisation explicite avant toute fusion ou publication en production.

## Rollback produit

Les trois commits applicatifs peuvent être revert séparément dans l'ordre inverse.
Le manifeste, le pricing canonique, Prisma et les migrations n'ayant pas changé,
aucune donnée ou dépendance n'est à restaurer. Le rollback ne doit jamais être
confondu avec une autorisation de redéployer l'ancien SHA en production.
