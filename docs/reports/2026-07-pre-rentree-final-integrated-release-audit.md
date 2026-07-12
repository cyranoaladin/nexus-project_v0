# Pré-rentrée 2026 — audit intégré final de release

## Date, identité et décision

- Date : 12 juillet 2026, fuseau Africa/Tunis.
- Branche : `release/pre-rentree-2026-final-rc`.
- Base applicative : `b00bd8fcbda13b24a98ca2325afda31690a65c12`.
- Ancienne preview applicative : `41aabc84e56000a918c33cb93144e9f1cbdfd8d5`.
- Commit final : le commit immuable contenant ce rapport ; sa valeur est résolue par `git rev-parse HEAD`, portée par le label OCI `org.opencontainers.image.revision` et consignée dans le handoff propriétaire.
- URL de preview : `https://pr26-6fe2.88-99-254-59.sslip.io`.

Cette release candidate est techniquement qualifiée pour la preview. La publication contractuelle reste bloquée par l’alignement juridique décrit plus bas ; la preview ne vaut ni validation des CGV, ni confirmation de ressources, ni autorisation de production.

## Provenance et sources de vérité

| Donnée | Source canonique | Getter / validation | DTO | Consommateurs publics |
|---|---|---|---|---|
| Prix, acompte, solde, volumes et seuils | `data/pricing.canonical.json` | `lib/pricing.ts` puis `getPreRentreePackOptions()` | `getPreRentreeLandingDTO().packs` | Pricing, configurateur, résumé, bilan, WhatsApp |
| Dates, créneaux, classes d’entrée, capacités et conditions | `data/campaigns/pre-rentree-2026.json` | schéma Zod et getters serveur | DTO landing et DTO spotlight minimal | Landing, planning, homepage, SEO |
| Programmes et 60 séances pédagogiques | `content/pre-rentree-2026/modules.json` | `PreRentreeModulesSchema` | `dto.modules` | Programmes |
| Adresse pédagogique et identité Nexus | `lib/legal.ts` | getter serveur | `dto.campaign.venue` | Landing et spotlight |
| Thème des matières | `lib/campaigns/pre-rentree-2026/subject-theme.ts` | résolveur client-safe | tokens de présentation | Configurateur, résumé, planning, programmes |
| Contacts | manifeste validé / helper WhatsApp | getter serveur et `buildWhatsAppUrl()` | `dto.contact` | CTA WhatsApp uniquement |
| Compatibilité profil × matière | `lib/campaigns/pre-rentree-2026/configurator.ts` | classifieur exhaustif | état de sélection normalisé | Configurateur, bilan et API existante |

Aucun composant n’importe directement le pricing canonique ou le manifeste. Les fallbacks métier silencieux ont été remplacés par des erreurs fail-closed pour niveau, matière, planning et pack inconnus.

## Fuites internes et hardcoding

Le gate `scripts/pre-rentree/final-public-release-audit.mjs` inspecte les sources actives, les chunks navigateur, le HTML, les payloads RSC et les artefacts client. Il recherche, sans tenir compte de la casse : `PRE_REGISTRATION_OPEN`, `OWNER_INPUT_REQUIRED`, `PENDING_EVIDENCE`, `IMPLEMENTATION_PLAN_DEFINED`, `VERIFIED_IN_TEST`, `GATE-`, `M0A`, `M0B`, `M0C`, `M1`, `M2`, `M3`, `V1`, `V2`, `LEGACY`, `DRAFT`, `pre2026-pack-`, les trois identifiants techniques d’enseignants, `WHATSAPP_PRIMARY`, `logical room`, `roomRole`, `teacherRole`, `internal note`, `internal only`, `TODO` et `FIXME`.

Résultats locaux :

- sources publiques actives : 26 fichiers, 0 occurrence exposée ;
- artefacts navigateur pertinents : 23 fichiers, 0 occurrence exposée ;
- HTML et RSC rendus : 6 fichiers, 0 occurrence exposée ;
- quatre occurrences des rôles techniques sont classées exclusivement dans le code serveur, où elles valident le contrat de staffing avant construction du DTO public ;
- aucun identifiant `pre2026-pack-*` n’est transmis au navigateur : le contrat public utilise `PACK_1` à `PACK_4` et la résolution vers le produit canonique reste serveur ;
- l’enum `PRE_REGISTRATION_OPEN` reste serveur et devient « Pré-inscriptions ouvertes » dans le DTO ;
- les valeurs financières, les dates, les créneaux, le contact et la capacité ne sont pas codés dans les composants ;
- le libellé navbar précédemment recopié avec dates et lieu a été remplacé par une formulation générique, issue de la navigation de campagne.

Le contrôle `check:no-hardcoded`, le test structurel campagne et le scan des ajouts confirment l’absence de prix, contact, import JSON ou nouvelle règle métier locale dans les composants.

## Offres et conditions produit

| Pack public | Matières | Volume | Prix | Acompte | Solde |
|---|---:|---:|---:|---:|---:|
| `PACK_1` | 1 | 10 h | 480 TND | 140 TND | 340 TND |
| `PACK_2` | 2 | 20 h | 900 TND | 270 TND | 630 TND |
| `PACK_3` | 3 | 30 h | 1 350 TND | 410 TND | 940 TND |
| `PACK_4` | 4 | 40 h | 1 800 TND | 540 TND | 1 260 TND |

Les quatre offres sont cohérentes dans le catalogue, la landing, le configurateur, le résumé, WhatsApp, le bilan, la homepage, `/offres`, `/stages` et les tests. Aucun paiement en ligne, prix barré, Carte Nexus, remise automatique, ancien format horaire ou disponibilité fictive n’est présenté.

La matrice détaillée des services figure dans `docs/reports/2026-07-pre-rentree-public-claims-matrix.md`. Le public voit uniquement le positionnement borné, le travail guidé en groupe, les exercices/corrections, les supports et une synthèse avec recommandations. ARIA, coaching individuel, espace parent, suivi annuel, cours d’urgence, rattrapage garanti et priorité de réservation ne sont pas promis.

## Profils et compatibilité pédagogique

La matrice automatisée couvre 810 cas : 15 sélections de matières pour chacun des profils Seconde, Première et Terminale. Chaque cas produit exactement un statut parmi `COMPATIBLE`, `COMPATIBLE_WITH_DIFFERENTIATION`, `REQUIRES_PEDAGOGICAL_REVIEW` et `INCOMPATIBLE`.

Cas bloqués avant toute poursuite :

- EAF technologique déclaré avec voie générale, et inversement ;
- Maths expertes sans spécialité Mathématiques conservée ;
- Maths complémentaires avec spécialité Mathématiques conservée.

Cas soumis explicitement à validation pédagogique :

- NSI ou Physique-Chimie de Première non déclarée dans le projet de spécialités ;
- NSI ou Physique-Chimie de Terminale non conservée ;
- toute différenciation Mathématiques/EAF signalée au parent et au bilan.

Le changement manuel d’un onglet de programme/planning ne modifie pas le formulaire. Le serveur refuse également un contexte incompatible : le contrôle n’est pas seulement visuel.

## Programmes, planning et ressources

Les contenus pédagogiques restent inchangés : 12 modules, 5 séances de 2 h chacun, 60 séances. Ils respectent les transitions Troisième→Seconde, Seconde→Première et Première→Terminale, l’accès débutant à NSI Première, la poursuite NSI/PC en Terminale, les options Maths expertes/complémentaires et l’absence d’EAF Terminale ou d’EDS NSI Seconde.

Le contrat planning prouve :

- six modules par semaine, dix jours de cours, aucun cours les 22 et 23 août ;
- trois rôles enseignants exactement, sans nom personnel ;
- Mathématiques/NSI/SNT : 30 séances, 60 h ; Français : 15 séances, 30 h ; Physique-Chimie : 15 séances, 30 h ;
- deux salles logiques maximum, aucune collision, aucune séance sans affectation ;
- tableau accessible par classe, deux emplois du temps hebdomadaires, cellules « Libre », légende non fondée sur la seule couleur et rendu mobile sans tableau compressé.

La disponibilité nominative des enseignants, des salles et des équipements reste une preuve propriétaire, pas une disponibilité inventée par le frontend.

## UI/UX, spotlight et tunnel CTA

Le parent comprend successivement le public d’entrée, les matières, le profil, les dates, les jours de présence, les horaires, le volume, le pack, le prix, l’acompte, les limites et le caractère non confirmant de la demande. Les dates du résumé sont condensées tout en conservant les jours réels dans les données accessibles.

Le spotlight homepage est visible dans le premier viewport, séparé du hero permanent et du routeur annuel. Il ne présente que les trois classes d’entrée et ne réinterprète ni Troisième ni Candidat libre comme public de campagne.

Hiérarchie du tunnel :

1. « Composer le stage » ouvre le configurateur ;
2. « Poursuivre vers le bilan prérempli » transmet uniquement classe d’entrée, profil, matières, pack public et contexte ;
3. WhatsApp sert d’aide et utilise uniquement `buildWhatsAppUrl()` ;
4. planning et programmes restent des actions d’information.

Le tunnel E2E couvre homepage → landing → configuration → résumé → bilan. Aucun CTA n’emploie « Réserver » ou « Payer ». Le bilan ne place dans l’URL ni prix, ni acompte, ni solde, ni PII. WhatsApp ne contient ni PII familiale, ni texte libre, ni code produit canonique.

## Conditions commerciales et gate juridique

Le contenu public annonce correctement : seuil 3, maximum 5, décision le 10 août 2026 à 18 h 00, pré-inscription non confirmante, confirmation après validation administrative/pédagogique et acompte, remboursement si Nexus n’ouvre pas, report uniquement après accord écrit, absence de conversion automatique, rattrapage étudié sans garantie, liste d’attente non confirmante, aucun paiement en ligne et aucune garantie de résultat.

Les CGV générales ne couvrent pas encore explicitement tous ces points. `GATE-LEGAL-001` et `GATE-LEGAL-002` restent `APPROVED_PENDING_LEGAL_TEXT_ALIGNMENT`. La correction documentaire de cette RC aligne l’arrondi sur la règle canonique : 30 % arrondis à la dizaine la plus proche, et non systématiquement à la dizaine supérieure.

Texte exact proposé pour l’annexe, soumis à validation juridique :

> La pré-inscription constitue une demande et ne réserve pas de place. Après validation administrative et pédagogique par Nexus Réussite, un acompte égal à 30 % du tarif TTC, arrondi à la dizaine de dinars la plus proche, est demandé à la famille. La place n’est confirmée qu’après réception de cet acompte et confirmation écrite de Nexus Réussite. Chaque groupe ouvre à partir de trois élèves et accueille au maximum cinq élèves. La décision d’ouverture est communiquée le 10 août 2026 à 18 h 00. Si Nexus Réussite décide de ne pas ouvrir le groupe, tout acompte versé est intégralement remboursé dans le délai validé par le responsable juridique. Tout report requiert un accord écrit ; aucune conversion automatique en cours individuel n’est effectuée. Un éventuel rattrapage d’absence peut être étudié selon les possibilités pédagogiques, sans garantie. Nexus Réussite est tenue à une obligation de moyens et ne garantit aucun résultat scolaire.

La production contractuelle est bloquée tant que le délai de remboursement et cette annexe ne sont pas validés puis publiés.

## Coûts, rentabilité et gate d’encaissement

Le modèle interne conserve les postes enseignant, préparation, salle, matériel/supports, administration, commission/paiement, CAC et marge cible. Aucun coût inconnu n’est inventé.

| Revenu alloué par cohorte-module de 10 h | 3 élèves | 4 élèves | 5 élèves |
|---|---:|---:|---:|
| Matière seule, 480 TND/élève | 1 440 | 1 920 | 2 400 |
| Module issu d’un pack, 450 TND/élève | 1 350 | 1 800 | 2 250 |

CA par heure enseignant : 144/192/240 TND pour une matière seule et 135/180/225 TND pour un module issu d’un pack.

| Coût direct maximum — matière seule | 3 élèves | 4 élèves | 5 élèves |
|---|---:|---:|---:|
| Marge brute 40 % | 864 | 1 152 | 1 440 |
| Marge brute 50 % | 720 | 960 | 1 200 |
| Marge brute 60 % | 576 | 768 | 960 |

| Coût direct maximum — module issu d’un pack | 3 élèves | 4 élèves | 5 élèves |
|---|---:|---:|---:|
| Marge brute 40 % | 810 | 1 080 | 1 350 |
| Marge brute 50 % | 675 | 900 | 1 125 |
| Marge brute 60 % | 540 | 720 | 900 |

Gate : la page de pré-inscription peut être présentée après résolution du gate juridique ; la confirmation des cohortes et tout encaissement restent soumis aux coûts réels, à la marge cible, aux enseignants, aux salles et aux équipements confirmés par le propriétaire.

## Accessibilité, performance et SEO

- Axe : aucune violation sérieuse ou critique dans les parcours campagne qualifiés.
- Clavier : tabs, accordéons, CTA, menu mobile et focus visibles couverts.
- Tableaux : captions, headers et vues mobiles dédiées.
- 320 px et zoom 200 % : aucun débordement horizontal dans les scénarios campagne.
- H1 unique, hiérarchie H2/H3 et textes accessibles des dates conservés.
- Aucun fetch catalogue client, aucun JSON canonique importé dans un composant, aucune dépendance ajoutée et aucune boucle d’impression analytics.
- Canonical de production, `/pre-rentree` en 308, route courte hors sitemap et FAQPage issue du contenu exact.
- Aucun hostname preview, note interne, avis, disponibilité ou note scolaire inventée dans les données structurées.

## Runtime, tests et sécurité

Runtime canonique : Node.js 20.20.0, npm 10.8.2 et Next.js 15.5.18.

Résultats locaux avant le commit documentaire :

- `npm ci` : code 0 ;
- `npm run typecheck` : code 0 ;
- `npm run lint` : code 0, avertissements historiques documentés uniquement ;
- suites ciblées campagne : 21 suites, 153 tests, code 0 ;
- matrice profils : 810 cas, code 0 ;
- `PERF_TESTS=1 ./scripts/gate-all.sh` : code 0 ;
- Jest global : 539 suites, 6 678 tests ; E2E public : 220 ; E2E authentifié : 42 ; total gate : 6 940 tests passés ;
- PostgreSQL 15.15 éphémère avec pgvector : 45 migrations existantes appliquées, RBAC 34/34 exécutés sans condition et sans skip ;
- build Next : code 0, 144 routes ;
- scanner sources, artefacts client, HTML et RSC : code 0 ;
- `check:no-hardcoded`, `security:repo`, typecheck, lint, audit sitemap et `git diff --check` : code 0 ;
- audit sitemap : 292 routes, 415 arêtes, 0 lien invalide.

Transparence sur les skips et écarts hors campagne : le dépôt contient des scénarios Playwright historiques quarantinés qui ne font pas partie des lanes du gate global. Aucun test campagne sélectionné n’a été skippé. La suite RBAC demandée a été exécutée réellement. Une suite générique de fixtures DB, séparée du gate campagne, a produit 12 échecs préexistants sur 31 car son helper `createTestStudent` omet le champ requis `gradeLevel` ; elle n’a entraîné ni modification Prisma ni ouverture d’un chantier général.

`npm audit --omit=dev --json` retourne 17 avis : 1 faible, 8 modérés, 8 élevés, 0 critique. L’avis Next.js est la transitivité PostCSS et exige la sérialisation de CSS contrôlé par un attaquant, absente du parcours. Les avis Nodemailer ne sont pas exploitables en preview (SMTP neutralisé) et les options vulnérables ne sont pas exposées par le bilan. Les autres avis relèvent du toolchain ou de chemins non accessibles publiquement dans cette campagne. Aucun `npm audit fix` n’a été exécuté. Une réévaluation globale de dépendances reste distincte de cette RC.

## Preview exacte et production

La procédure de release impose l’égalité suivante après le commit documentaire : SHA local = SHA distant = label OCI de l’image = SHA exposé par le conteneur déployé. Le digest d’image et les quatre valeurs concrètes sont consignés dans le handoff final et vérifiés par commandes distantes ; ce rapport ne peut contenir littéralement le hash du commit qui le contient sans rendre ce commit auto-référentiel.

La preview conserve Basic Auth, TLS, `X-Robots-Tag: noindex, nofollow, noarchive`, robots `Disallow: /`, DB PostgreSQL dédiée, SMTP sink, Telegram/paiements/analytics production neutralisés et réseau/volumes distincts. La production est vérifiée uniquement en lecture après déploiement.

Rollback preview : replacer seulement le service app de `nexus-pre-rentree-preview` sur l’image `nexus-pre-rentree-preview:41aabc84e560`, recréer uniquement ce conteneur avec le Compose de `/srv/nexus-pre-rentree-preview-6fe2e773`, puis rejouer 401/200/308, TLS, noindex et healthcheck. Aucune donnée, migration ou ressource production n’est restaurée.

## Revue visuelle

Les captures finales distantes sont stockées hors Git dans `/tmp/nexus-pre-rentree-2026-final-integrated-release`. Checklist d’inspection :

- P0 : aucun défaut accepté ;
- P1 : aucun défaut visuel accepté ;
- P2 : éventuels avertissements historiques sans incidence campagne documentés séparément ;
- `ACCEPTED` : densité longue de la landing, justifiée par les informations pédagogiques et contractuelles, avec navigation interne et accordéons.

## Gates et validation propriétaire restante

Avant production, le propriétaire doit encore fournir ou approuver :

1. annexe/CGV et délai contractuel de remboursement ;
2. coûts réels et marges cibles à 3, 4 et 5 élèves ;
3. disponibilité et qualification des trois enseignants ;
4. disponibilité des deux salles ;
5. inventaire NSI/SNT et modalité/matériel Physique-Chimie ;
6. revue des 12 modules et de la matrice de différenciation par le responsable pédagogique ;
7. rendu final desktop/mobile de la preview exacte ;
8. autorisation explicite de publication.

## Périmètre et rollback Git

Aucun fichier Prisma, migration, API V2, dashboard V2, paiement, tarif, créneau ou programme n’a été modifié. Aucun secret, prix ou contact n’est codé dans un composant. Aucune production n’est déployée. Le rollback Git consiste à réverter séparément les commits de cette RC ; aucune donnée n’est à restaurer.
