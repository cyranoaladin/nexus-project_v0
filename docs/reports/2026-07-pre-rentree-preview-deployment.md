# Déploiement isolé de la preview Pré-rentrée 2026

## Date et verdict

- Déploiement : 12 juillet 2026, Africa/Tunis.
- Statut : `READY_FOR_OWNER_PREVIEW_VALIDATION`.
- Durée de vie recommandée : jusqu'à validation propriétaire, au plus tard le
  26 juillet 2026 sans renouvellement explicite.

La preview distante est accessible, authentifiée, non indexable, non
transactionnelle et isolée de la production. Aucun merge ou déploiement de
production n'a été effectué.

## Git et artefact

- Branche applicative locale et distante :
  `fix/pre-rentree-2026-finalize-preview`.
- SHA applicatif local qualifié :
  `6fe2e77302a17b9806739d014f75530d9ae91280`.
- SHA de la branche distante au moment du déploiement :
  `6fe2e77302a17b9806739d014f75530d9ae91280`.
- Checkout de construction distant : propre, détaché de toute modification et au
  SHA exact ci-dessus.
- Image applicative :
  `sha256:d55e3aaa4dd242e49983a11d21534c92a96da7760df66dc90063b83897222601`.
- Image migrator :
  `sha256:266da49f0d80cbba9c182d5aa5dddc6009547e020152af27a1bbf04adc9935c1`.
- Label de construction : `2026-07-12T18:15:21Z`.
- Label de révision de chaque image : SHA Git exact.
- Aucun secret détecté par Gitleaks sur les 40 commits de la branche par rapport à
  `origin/main`.

La branche distante a été créée sans force. Aucune pull request, règle d'auto-merge
ou fusion n'a été créée.

## URL, accès et TLS

- URL : `https://pr26-6fe2.88-99-254-59.sslip.io`.
- Hostname temporaire : DNS `sslip.io` résolvant vers `88.99.254.59` ; aucune
  modification de la zone DNS `nexusreussite.academy`.
- Protection : Basic Auth au vhost Nginx, avant l'application.
- Récupération de la credential propriétaire :
  `/home/alaeddine/.config/nexus-preview/pre-rentree-2026/owner-credential.txt`.
- Permissions de la credential locale : `0600`.
- Hash Basic Auth distant : hors Git, `root:www-data`, permissions `0640`.
- Certificat : Let's Encrypt, CN/SAN limité au hostname preview.
- Validité TLS : du 12 juillet au 10 octobre 2026 ; la preview doit être supprimée
  bien avant l'expiration selon la durée de vie ci-dessus.
- L'ACME et `robots.txt` sont les seules ressources publiques ; toute surface
  applicative exige l'authentification.

La credential n'est présente ni dans Git, ni dans ce rapport, ni dans les sorties
de test. Aucun email réel n'a été utilisé pour l'émission du certificat.

## Anti-indexation et canonical

- Header global : `X-Robots-Tag: noindex, nofollow, noarchive`.
- `robots.txt` public : `User-agent: *` puis `Disallow: /`.
- Sitemap protégé par Basic Auth.
- Canonical de la campagne :
  `https://nexusreussite.academy/stages/pre-rentree-2026`.
- Les réponses HTML, JSON-LD et XML réécrivent les éventuelles URL générées depuis
  le hostname runtime vers le domaine canonique de production.
- Aucun hostname preview trouvé dans les corps HTML ou XML qualifiés.
- Aucun lien vers la preview n'a été ajouté au site de production.

## Runtime et build

| Élément | Valeur vérifiée dans l'image |
|---|---:|
| Node.js | 20.20.0 |
| npm | 10.8.2 |
| Next.js | 15.5.18 |
| Taille image applicative | 220 517 171 octets |
| Mémoire maximale app | 2 Gio |
| CPU maximal app | 2 vCPU |

Le `Dockerfile.prod` du SHA utilise un tag mobile `node:20-alpine`, qui résolvait
vers Node 20.20.2 au moment de la première tentative. La construction a été
interrompue avant export de l'image applicative. Un Dockerfile preview hors Git,
identique à la variante approuvée sauf pour les trois lignes `FROM` épinglées à
`node:20.20.0-alpine`, a ensuite produit l'artefact final. Le checkout applicatif
est resté propre et inchangé au SHA validé.

`npm ci` a réussi sous Node 20.20.0/npm 10.8.2. `npm ls next` expose une seule
version, 15.5.18. Le build Next.js a compilé 144 pages et terminé avec un code 0.
Les avertissements `EBADENGINE` de dépendances générales déjà présents dans la RC
ont été consignés sans correction hors périmètre ; aucun ne s'est manifesté dans
la landing ou les logs runtime de la preview.

## Architecture d'isolation

Projet Compose : `nexus-pre-rentree-preview`.

| Ressource | Isolation vérifiée |
|---|---|
| Application | conteneur distinct, rootfs read-only, UID non-root, 2 Gio/2 vCPU |
| Réseau | bridge interne dédié `172.29.26.0/24`, sans gateway externe |
| Adresse app | `172.29.26.10:3107`, uniquement joignable par l'hôte |
| Ports hôte | aucun port Docker publié |
| PostgreSQL | conteneur et base dédiés, adresse `172.29.26.20`, aucun port publié |
| SMTP sink | MailHog mémoire, adresse `172.29.26.30`, aucun port publié |
| Volume DB | `nexus-pre-rentree-preview_preview-db-data` |
| Volumes app | tmpfs propres pour `/tmp`, uploads, logs et cache Next |

L'application n'est connectée qu'au réseau preview. Une tentative de connexion
HTTPS sortante depuis le conteneur échoue, conformément au réseau `internal`.
Aucun réseau ou volume de production n'est monté ou attaché.

## Base de données

- Cible runtime vérifiée sans exposer la credential :
  `db/nexus_pre_rentree_preview`.
- Le hostname ne désigne ni `nexus-postgres-db`, ni `127.0.0.1:5435`, ni la base
  `nexus_prod`.
- Seules les migrations existantes au SHA ont été appliquées par `prisma migrate
  deploy` ; code de sortie 0.
- Aucune migration n'a été créée ou modifiée.
- Aucune donnée de production n'a été copiée.
- Comptages après les tests : `users=0`, `contact_leads=0`,
  `stage_reservations=0`.
- Aucun bilan n'a été soumis ; le contrôle est resté au préremplissage.

Le volume dédié constitue l'unique persistance de la preview et sera supprimé par
la procédure de nettoyage.

## Neutralisation des sorties et transactions

- Email : `MAIL_DISABLED=true` et tous les anciens chemins SMTP dirigés vers le
  sink local ; zéro message présent dans le sink après les tests.
- Telegram : `TELEGRAM_DISABLED=true`, token et chat ID absents.
- ClicToPay : drapeau public faux, clés et secret webhook absents ; routes de
  paiement bloquées en `403` au vhost preview.
- Konnect : clés, wallet et webhook absents.
- Réservations, contact, newsletter et envoi d'email admin : routes mutantes
  bloquées au vhost lorsqu'elles ne sont pas nécessaires au contrôle du bilan.
- LLM, RAG et Sentry : neutralisés ; aucune connexion sortante possible.
- Analytics : Google Analytics et Google Tag Manager exclus de la CSP preview ;
  l'endpoint analytics interne reste un no-op.
- Aucun webhook réel, paiement ou notification externe n'a été émis.

## Invariants produit et organisationnels

Les 19 suites contractuelles ont été exécutées avant puis après le déploiement sous
Node 20.20.0 : 227 tests passés, 0 échec, 0 skipped à chaque exécution.

Une vérification unitaire élargie finale a également terminé avec un code 0 : 532
suites et 6 639 tests passés. Une suite générique RBAC a conditionnellement ignoré
4 tests parce que sa base de test locale facultative n'était pas démarrée. Ce skip
préexistant ne concerne ni les 227 contrats campagne, ni la base PostgreSQL de
preview, ni les 11 E2E distants ; ces trois preuves ont été entièrement exécutées.

Elles verrouillent notamment :

- les trois classes d'entrée : Seconde, Première et Terminale ;
- les correspondances Troisième→Seconde, Seconde→Première et
  Première→Terminale ;
- les 12 modules et 60 séances ;
- exactement trois rôles enseignants ;
- les charges 60 h / 30 h / 30 h et la répartition 30 / 15 / 15 séances ;
- deux salles logiques maximum, aucune collision et aucun nom personnel ;
- les 45 configurations : 15 combinaisons de matières pour chacun des trois
  niveaux d'entrée ;
- les quatre packs canoniques :
  - 10 h, 480 TND, acompte 140 TND, solde 340 TND ;
  - 20 h, 900 TND, acompte 270 TND, solde 630 TND ;
  - 30 h, 1 350 TND, acompte 410 TND, solde 940 TND ;
  - 40 h, 1 800 TND, acompte 540 TND, solde 1 260 TND ;
- les dates du 17 au 28 août, dix jours de cours, sans cours les 22 et 23 août ;
- le seuil de trois élèves, le maximum de cinq et la décision du 10 août à 18:00 ;
- l'absence de paiement en ligne et de disponibilité fictive.

## Tests HTTP distants

| Contrôle | Résultat |
|---|---:|
| Campagne sans auth | 401 |
| HTTP vers HTTPS | 301 |
| `/` authentifié | 200 |
| `/stages` authentifié | 200 |
| `/offres` authentifié | 200 |
| `/stages/pre-rentree-2026` authentifié | 200 |
| `/bilan-gratuit` authentifié | 200 |
| `/sitemap.xml` authentifié | 200 |
| `/pre-rentree` authentifié | 308 vers la route canonique |
| Asset JavaScript extrait de la page | 200 |
| Image OpenGraph | 200 |
| Route ClicToPay via preview | 403 |
| Réponses 500 dans le log d'accès | 0 |
| Assets/réponses 404 dans le log d'accès | 0 |

Les headers CSP, HSTS applicatif, frame protection, nosniff, no-referrer,
Permissions-Policy, no-store et noindex sont présents. Aucun cookie avec un domaine
de production n'a été observé.

## Tests fonctionnels et E2E

Playwright a été exécuté contre la vraie URL avec Basic Auth au contexte navigateur :

- 11 tests passés sur Chromium en 1 min 36 ;
- route, SEO et redirection ;
- liens campagne depuis homepage, `/stages` et `/offres` ;
- profils Seconde, Première et Terminale ;
- parcours un, deux, trois et quatre matières ;
- pack 40 h et bilan prérempli ;
- planning par niveau et par semaine ;
- programmes et FAQ au clavier ;
- axe : aucune violation sérieuse ou critique ;
- zoom navigateur 200 % ;
- largeurs 1440, 768, 390 et 320 px ;
- absence de débordement horizontal ;
- absence de paiement et de disponibilité inventée.

### Bilan prérempli

Le CTA transmet la classe d'entrée, le profil, les matières, le pack et le contexte
Pré-rentrée 2026. L'URL ne contient aucun prix, acompte, solde ou PII. Le formulaire
affiche `Classe de rentrée`, conserve `Entrée en Terminale` dans le parcours de
preuve, préremplit les trois matières choisies et reste modifiable. Aucune
soumission n'a été effectuée.

### WhatsApp

L'URL générée vise `+216 99 19 28 29`. Le message contient classe de rentrée,
profil, matières, volume, période, horaires, pack lisible, tarif et acompte. Il ne
contient ni code pack technique, ni nom, email, téléphone familial, établissement
ou texte libre. Le lien a été inspecté sans ouverture vers l'envoi et aucun message
n'a été expédié.

## Captures et revue visuelle

Répertoire hors Git : `/tmp/nexus-pre-rentree-2026-preview-remote`.

20 captures ont été générées depuis la preview distante :

- `desktop-1440x1000.png` ;
- `tablet-768x1024.png` ;
- `mobile-390x844.png` ;
- `mobile-320x800.png` ;
- `hero.png` ;
- `configurator-empty.png` ;
- `entry-seconde.png`, `entry-premiere.png`, `entry-terminale.png` ;
- `configurator-two-subjects.png`, `configurator-three-subjects.png`,
  `configurator-four-subjects.png` ;
- `planning-seconde.png`, `planning-première.png`, `planning-terminale.png`,
  `planning-by-week.png` ;
- `program-open.png` ;
- `faq.png` ;
- `final-cta.png` ;
- `bilan-prefilled.png`.

La revue visuelle des preuves desktop, mobile 320 px, résumé quatre matières et
bilan prérempli ne montre aucun chevauchement, débordement ou CTA masqué. Les
libellés `Classe de rentrée` et `Entrée en…`, tarifs, acomptes, soldes, plannings et
adresses restent lisibles. Le responsive, la safe area et le résumé mobile sont
couverts par les assertions E2E.

## Logs

- Logs applicatifs : 0 erreur, 0 warning, 0 erreur d'hydratation, 0 marqueur de
  connexion production, 0 secret, 0 adresse email.
- Nginx : 0 réponse 500, 0 réponse 404, aucune URL contenant token, mot de passe,
  secret ou email.
- Les 113 warnings initiaux étaient exclusivement `buffered to a temporary file`
  pour de grandes réponses de preuve. `proxy_buffering off` a été appliqué au seul
  vhost preview ; les requêtes suivantes n'ont ajouté aucune ligne.
- Aucun échec auth, TLS, upstream, timeout, message `crit`, `alert` ou `emerg`.
- Les logs permettent de rapprocher le conteneur et ses labels du SHA déployé.

Les logs complets ne sont pas copiés dans Git ou dans ce rapport.

## Vérification de la production

Avant et après le déploiement :

- SHA production inchangé :
  `1b8219b1cfcfe63354d8cb4035645143e27e5a43` ;
- processus `nexus-prod` inchangé : PID `1518444`, démarré le 27 juin 2026 ;
- master Nginx inchangé : PID `1995110` ; seuls des reloads gracieux ont eu lieu ;
- empreinte du vhost de production inchangée :
  `2badd87ec6cc157bcb2b07bd72af4023484a203e1030286a1a7711bd328532ef` ;
- conteneur PostgreSQL production inchangé : ID
  `840ffa04837ef669d30861ccf02867cf26ceb29c9d9dca4db301844b23568786`,
  démarré le 18 mai 2026, healthy ;
- empreintes des réseaux, volumes et ports de production inchangées ;
- DNS principal inchangé : `nexusreussite.academy` résout vers `88.99.254.59` ;
- les huit pages publiques critiques répondent 200 ;
- la route campagne reste 404 en production.

Aucun service de production n'a été redémarré, aucune base ou donnée de production
n'a été lue par l'application preview et aucun port/volume de production n'a été
modifié. Le seul ajout sur l'hôte partagé est le vhost et le certificat strictement
dédiés à la preview.

## Risques restants et conditions de preview

- Le hostname temporaire dépend de `sslip.io` ; il convient à une validation
  privée de courte durée, pas à une publication.
- La Basic Auth utilise une credential propriétaire unique à supprimer ou renouveler
  après la revue.
- Le disque hôte est passé de 80 % à 81 % pendant la construction, avec 169 Gio
  encore disponibles. Les images et artefacts preview doivent être supprimés après
  validation.
- Les avertissements d'engine npm de dépendances hors landing restent une dette
  générale déjà connue ; aucun symptôme runtime n'a été observé ici.
- La validation propriétaire, la disponibilité réelle des enseignants et salles,
  le matériel et l'accord juridique restent nécessaires avant toute publication.

## Rollback immédiat

En cas de problème avant la validation, sans supprimer les preuves ou la base :

```bash
cd /srv/nexus-pre-rentree-preview-6fe2e773
docker compose --env-file .build.env -p nexus-pre-rentree-preview \
  -f docker-compose.preview.yml down --remove-orphans
rm /etc/nginx/sites-enabled/pr26-6fe2.88-99-254-59.sslip.io
nginx -t && nginx -s reload
```

Puis revérifier le SHA, le PID, les ports et les healthchecks de production. Cette
procédure ne cible aucun service ou volume de production.

## Suppression complète après validation

Ne pas exécuter avant la décision du propriétaire :

```bash
cd /srv/nexus-pre-rentree-preview-6fe2e773
docker compose --env-file .build.env -p nexus-pre-rentree-preview \
  -f docker-compose.preview.yml down --volumes --remove-orphans
rm /etc/nginx/sites-enabled/pr26-6fe2.88-99-254-59.sslip.io
rm /etc/nginx/preview-secrets/pre-rentree-2026.htpasswd
nginx -t && nginx -s reload
certbot delete --cert-name pr26-6fe2.88-99-254-59.sslip.io --non-interactive
docker image rm nexus-pre-rentree-preview:6fe2e77302a1 \
  nexus-pre-rentree-preview-migrator:6fe2e77302a1
rm -rf /srv/nexus-pre-rentree-preview-6fe2e773
```

Sur le poste propriétaire :

```bash
rm /home/alaeddine/.config/nexus-preview/pre-rentree-2026/owner-credential.txt
```

Le hostname `sslip.io` ne nécessite aucune suppression DNS. Les images de base
partagées PostgreSQL/MailHog ne sont pas supprimées automatiquement. Après
nettoyage, contrôler de nouveau la production en lecture seule.

## Checklist propriétaire

- [ ] 1. Hero et message principal.
- [ ] 2. Entrée en Seconde.
- [ ] 3. Entrée en Première.
- [ ] 4. Entrée en Terminale.
- [ ] 5. Programmes des douze modules.
- [ ] 6. Planning des deux semaines.
- [ ] 7. Créneaux quotidiens.
- [ ] 8. Tarifs 480 / 900 / 1 350 / 1 800 TND.
- [ ] 9. Acomptes et soldes.
- [ ] 10. Adresse de Mutuelleville.
- [ ] 11. Numéro WhatsApp.
- [ ] 12. Formulaire de bilan.
- [ ] 13. Conditions commerciales.
- [ ] 14. Rendu desktop.
- [ ] 15. Rendu mobile.
- [ ] 16. Disponibilité réelle des trois enseignants.
- [ ] 17. Disponibilité des deux salles.
- [ ] 18. Matériel Physique-Chimie et NSI/SNT.
- [ ] 19. Accord juridique sur remboursement et report.
- [ ] 20. Autorisation finale de publication.

## Confirmations de périmètre

- Aucun Prisma modifié et aucune migration créée.
- Aucune API V2 créée.
- Aucun tarif, programme, contenu ou horaire approuvé modifié.
- Aucune base ou donnée de production utilisée par la preview.
- Aucun email, Telegram, paiement, webhook ou analytics de production émis.
- Aucun secret committé ou écrit dans le rapport.
- Aucune indexation autorisée.
- Aucun merge ou déploiement de production.
