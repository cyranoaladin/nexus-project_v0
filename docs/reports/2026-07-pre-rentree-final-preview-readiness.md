# Pré-rentrée 2026 — Final preview readiness

## Date

12 juillet 2026, fuseau `Africa/Tunis`.

## Verdict

`READY_FOR_PREVIEW_DEPLOYMENT`

La branche est qualifiée pour un déploiement en environnement de preview. Cela n'autorise ni push, ni fusion, ni déploiement, ni publication publique. La publication reste soumise à la revue propriétaire de la preview et aux disponibilités opérationnelles réelles.

## Baseline Git

- `origin/main` au début de la mission : `c90b142c88d69bdc600f3f848b44ca0317c00242`.
- `origin/main` après le fetch final : `c90b142c88d69bdc600f3f848b44ca0317c00242` ; aucune nouvelle dérive main.
- Branche source : `review/pre-rentree-2026-landing-rc`.
- SHA source attendu et vérifié : `fca5c7f1987474f312edb0dc3d9cbaed74b7c5e4`.
- Trois commits RC présents : `e6311b90e`, `22cd3051b`, `fca5c7f19`.
- Merge-base RC / `origin/main` : `c90b142c88d69bdc600f3f848b44ca0317c00242` ; aucune dérive distante ultérieure à analyser au démarrage.
- Worktree source RC propre, aucune opération Git en cours, aucun changement Prisma ou migration.
- Branche finale : `fix/pre-rentree-2026-finalize-preview`.
- Worktree final : `/home/alaeddine/Bureau/nexus-wt-pre-rentree-finalize-preview`.
- Le worktree final préexistant contenait des changements cohérents de cette même finalisation et deux tests non suivis ; ils ont été audités, conservés, qualifiés et intégrés dans les commits atomiques. Aucun secret ni lien symbolique inattendu n'a été trouvé.

## Approche 2 et invariant de classe d'entrée

L'approche 2 est appliquée sans migration massive d'identifiants :

| Classe actuelle en 2025-2026 | Code stable | Classe d'entrée 2026-2027 | Libellé public |
|---|---|---|---|
| Troisième | `SECONDE` | Seconde | Entrée en Seconde |
| Seconde | `PREMIERE` | Première | Entrée en Première |
| Première | `TERMINALE` | Terminale | Entrée en Terminale |

Le manifeste porte `entryLevelSemantics.kind = ENTRY_LEVEL`, l'année `2026-2027` et la correspondance ci-dessus. Dans les types et DTO conservant `level`, le commentaire contractuel précise qu'il s'agit d'un code de classe d'entrée. Les surfaces publiques emploient « Classe de rentrée » et « Entrée en… ».

## Surfaces corrigées

- Hero : élèves « entrant en Seconde, Première ou Terminale ».
- Configurateur : « Classe de rentrée 2026 », libellés d'entrée, profils et résumés cohérents.
- Cartes, planning par classe/semaine et programmes : titres d'entrée sans supposer la classe cible déjà suivie.
- Résumés desktop/mobile : classe d'entrée, profil, matières, dates, horaires, pack et validation pédagogique.
- Homepage, navbar, `/stages`, `/offres`, SEO, JSON-LD, FAQ et sitemap : route et sémantique cohérentes.
- Informations pratiques : public entrant en Seconde/Première/Terminale, présentiel à Mutuelleville et conditions non confirmantes.

## DTO, bilan et WhatsApp

Le DTO conserve `level` comme code interne stable d'entrée, expose `entryLevelSemantics` et résout les labels depuis le manifeste. Aucune propriété publique concurrente `level`/`entryLevel` n'a été ajoutée.

Le bilan prérempli conserve programme, pack, classe d'entrée, profil et matières. Le formulaire affiche « Classe de rentrée » et le parent peut modifier les informations. Le parseur serveur refuse prix, acompte, solde, PII libre, niveau/matière/pack/profil inconnu, doublons et incohérence pack/matières. Le contexte normalisé utilise l'API existante ; aucune API Pré-rentrée V2 n'a été créée.

Le message WhatsApp est construit depuis le résumé puis passé à `buildWhatsAppUrl()`. Il affiche classe de rentrée, profil, matières, volume, dates, horaires, pack lisible, prix et acompte. Il ne contient ni identifiant technique de pack, ni PII, ni numéro codé dans le composant.

## Analytics

La propriété canonique est `entry_level`, avec `seconde`, `premiere`, `terminale`. Les seules propriétés de campagne autorisées sont : `entry_level`, `normalized_track`, `subject_code`, `subject_count`, `pack_code`, `cta_location`, `schedule_view_type`.

Les événements ne transmettent ni classe actuelle, ni nom, email, téléphone, établissement, identifiant familial ou texte libre. `toPreRentreeEntryLevel()` refuse toute valeur autre que les trois identifiants stables. Le page view est protégé par `useRef` et testé en React Strict Mode pour une émission unique.

## Cohérence pédagogique

### Entrée en Seconde — Troisième vers Seconde

- Mathématiques : calcul, calcul littéral, proportionnalité, fonctions élémentaires, résolution et rédaction, puis introduction progressive des attentes de Seconde.
- Français : compréhension, expression, grammaire, argumentation et méthode du lycée.
- Informatique : intitulé exact « Initiation informatique, algorithmique et SNT », sans EDS ni prérequis NSI.
- Physique-Chimie : acquis de collège, unités, grandeurs, calcul, raisonnement scientifique et méthodes de Seconde.

### Entrée en Première — Seconde vers Première

- Mathématiques : prérequis de Seconde et différenciation Maths EDS/hors EDS.
- Français : EAF à venir, voies générale et technologique distinguées.
- NSI : aucun prérequis NSI obligatoire ; algorithmique, Python et fondamentaux.
- Physique-Chimie : prérequis de Seconde et préparation à l'EDS de Première.

### Entrée en Terminale — Première vers Terminale

- Mathématiques : EDS Mathématiques séparé des options Maths expertes et Maths complémentaires ; jamais trois EDS.
- NSI : EDS conservé, prérequis possibles de Première NSI, validation si profil absent/incompatible.
- Physique-Chimie : EDS PC conservé et prérequis de Première PC.
- Expression : « Expression écrite, argumentation et maîtrise de l'oral », jamais « EAF Terminale ».

Les 12 modules et leurs 60 séances ont été relus après correction. Le test de contenu interdit les formulations et prérequis pédagogiques incompatibles.

## Planning, enseignants et salles

Le planning approuvé est inchangé :

- `MATHS_NSI_SNT_TEACHER` : six modules, 30 séances, 60 heures, six heures par jour sur les deux semaines ;
- `FRENCH_TEACHER` : trois modules, 15 séances, 30 heures, semaine 1 ;
- `PHYSICS_CHEMISTRY_TEACHER` : trois modules, 15 séances, 30 heures, semaine 2 ;
- salle logique 1 : Mathématiques/NSI/SNT ;
- salle logique 2 : Français semaine 1 puis Physique-Chimie semaine 2 ;
- maximum deux salles simultanées ; aucune collision, aucune séance sans rôle et aucun quatrième rôle.

Les rôles sont non nominatifs ; aucun enseignant personnel n'est codé.

## Offres et tarifs

Les quatre packs approuvés sont résolus depuis `data/pricing.canonical.json` via `lib/pricing.ts` :

| Pack | Matières | Volume | Prix | Acompte | Solde |
|---|---:|---:|---:|---:|---:|
| Pack 1 | 1 | 10 h | 480 TND | 140 TND | 340 TND |
| Pack 2 | 2 | 20 h | 900 TND | 270 TND | 630 TND |
| Pack 3 | 3 | 30 h | 1 350 TND | 410 TND | 940 TND |
| Pack 4 | 4 | 40 h | 1 800 TND | 540 TND | 1 260 TND |

Aucune Carte Nexus, remise automatique, ancien volume, prix barré, disponibilité fictive ou activation de paiement n'a été introduit. L'anti-hardcoding confirme zéro prix ou contact codé hors source canonique.

## Conditions commerciales vérifiées

- public : élèves entrant en Seconde, Première ou Terminale ;
- présentiel à Mutuelleville ;
- 17–28 août 2026, aucun cours les 22 et 23 ;
- cinq séances de deux heures par matière ;
- groupe ouvert à partir de trois, maximum cinq ;
- décision le 10 août 2026 à 18:00 ;
- pré-inscription non confirmante et demande sans acompte ne bloquant pas une place ;
- confirmation après validations administrative et pédagogique puis acompte ;
- remboursement intégral si Nexus n'ouvre pas ;
- report après accord écrit seulement ;
- aucune conversion automatique en individuel, aucun paiement landing et aucun résultat garanti.

## Matrice des 45 configurations

Les quatre choix simples, six paires, quatre triplets et le choix des quatre matières sont testés pour chacune des trois classes d'entrée, soit 45 configurations.

Chaque cas vérifie : classe d'entrée, profil, matières, dates, semaines, horaires, séances, volume, pack, prix, acompte, solde, validation pédagogique, URL du bilan, parseur serveur et message WhatsApp.

## Runtime canonique et mise à niveau Next.js

- Runtime canonique qualifié : Node `v20.20.0`, npm `10.8.2`.
- Les Dockerfiles utilisent Node 20 ; aucun `engines`, `.nvmrc` ou `.node-version` contradictoire n'est présent.
- Next.js avant : `15.5.12`.
- Next.js après : `15.5.18` exact.
- Une seule version Next.js est installée, y compris via `next-auth`.
- Seuls `next` et ses entrées lockfile ont changé ; React, React DOM, Prisma et les autres dépendances directes sont inchangés.
- `eslint-config-next` reste inchangé : aucune incompatibilité démontrée n'a nécessité son alignement.

## Audit runtime avant/après

`npm audit --omit=dev --json` retourne le code 1 avant et après, car des avis résiduels hors correction Next subsistent :

| État | Faible | Modérée | Haute | Critique | Total |
|---|---:|---:|---:|---:|---:|
| Next 15.5.12 | 1 | 7 | 9 | 0 | 17 |
| Next 15.5.18 | 1 | 8 | 8 | 0 | 17 |

Après upgrade, les avis directs Next 15.5.12 concernant request smuggling, DoS RSC, cache, App Router et contournement Middleware ont disparu. L'entrée `next` restante est modérée et provient du PostCSS `8.4.31` embarqué ; elle concerne la sérialisation de CSS non fiable pendant la construction, sans entrée CSS contrôlée par une requête publique sur cette preview. Aucun avis App Router ou Middleware ne reste.

### Vulnérabilités résiduelles et exploitabilité

- Hautes, outillage : `prisma`, `@prisma/config`, `effect`, `defu`. Elles sont liées au CLI/config Prisma et ne sont pas exposées par la landing ; Prisma est explicitement hors périmètre.
- Haute, `tar` : dépendance directe sans import applicatif trouvé ; aucun décompactage d'archive provenant d'une requête publique.
- Haute, `ws` : utilisé par jsdom de test et optionnellement par le client OpenAI ; le serveur preview n'accepte pas de WebSocket public via ce paquet.
- Haute, `form-data` : transitif via OpenAI/jsdom ; aucun nom de champ ou fichier multipart de ce paquet n'est construit depuis la landing.
- Haute, `nodemailer` : les services email n'exposent pas aux formulaires de campagne les options `raw`, transport, EHLO, List-* ou chemins/URL visées par les avis. Aucun chemin public Pré-rentrée exploitable identifié.
- Modérées : `@auth/core`, `@auth/prisma-adapter`, `next-auth` héritent surtout de Nodemailer/PostCSS ; `js-yaml`, `yaml`, `uuid` ne traitent aucune entrée de la landing ; PostCSS est build-time.
- Faible : `esbuild`, serveur de développement Windows, non utilisé par la preview Linux standalone.

Aucune vulnérabilité critique, haute directement accessible depuis une requête publique de la landing, ni vulnérabilité App Router/Middleware n'a été identifiée. Aucun `npm audit fix` n'a été exécuté. Les mises à jour résiduelles doivent faire l'objet d'un lot de maintenance distinct.

## Tests et codes de sortie

| Vérification | Résultat |
|---|---|
| `git fetch origin --prune` | 0 |
| `npm ci` sous Node 20 (baseline et final) | 0 ; avertissements moteurs/peers préexistants documentés |
| `npm ls next --all` | 0 ; une seule version `15.5.18` |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 ; warnings préexistants sous seuil, aucune erreur |
| `PERF_TESTS=1 npm test -- --runInBand` | 0 ; 533 suites, 6 643 tests, 7 snapshots, aucun test Jest skippé |
| contrats campagne | 0 ; 13 suites, 109 tests |
| contrats pricing/synchronisation client | 0 ; 5 suites, 106 tests |
| SEO/analytics/WhatsApp/sécurité ciblés | 0 ; 5 suites, 92 tests |
| RBAC + validation Prisma sur PostgreSQL 15 éphémère | 0 ; 2 suites, 53 tests réellement exécutés, conteneur arrêté après preuve |
| `npm run check:e2e-syntax` | 0 |
| `npm run check:no-hardcoded` | 0 |
| `npm run security:repo` | 0 |
| `npm run audit:site-map -- --out-dir /tmp/.../site-map` | 0 ; 292 routes, 417 arêtes, 0 lien en anomalie |
| `npm run check:docs-archive` | 0 |
| `npm run build` | 0 ; Next 15.5.18, 144 pages statiques, assets standalone copiés |
| E2E Pré-rentrée Chromium | premier lancement interrompu car le secret NextAuth de test manquait ; relance avec valeur locale éphémère : 0, 11/11 |
| standalone + smokes HTTP | 0 ; 11 routes en 200, redirection `/pre-rentree` en 308 |
| `git diff --check` | 0 |
| `npm audit --omit=dev --json` | 1 attendu et documenté ; aucun avis bloquant selon l'analyse ci-dessus |

Le serveur standalone a signalé l'absence de PostgreSQL local sur son URL E2E dédiée lors d'un rafraîchissement passif de configuration, mais est resté prêt et a servi toutes les routes publiques vérifiées. Une lane PostgreSQL 15 éphémère séparée a ensuite rejoué les 53 tests qui se terminent conditionnellement sans DB dans la lane unitaire ; les migrations existantes ont été appliquées à cette base temporaire, sans créer ou modifier de migration, puis le conteneur a été arrêté. Aucune base n'est nécessaire à la landing statique elle-même.

## E2E, accessibilité et revue visuelle

Les 11 E2E couvrent route canonique, redirection 308, SEO, accès en un clic depuis quatre surfaces, barre mobile, trois classes d'entrée, quatre matières, pack 40 h, bilan sans prix URL, clavier, focus, axe, zoom 200 %, 390 px et 320 px.

Les captures hors Git sont dans `/tmp/nexus-pre-rentree-2026-final-preview` :

- desktop 1440×1000, tablette 768×1024, mobile 390×844 et 320×800 ;
- hero et configurateur vide ;
- entrée en Seconde, Première et Terminale ;
- deux et quatre matières ;
- trois plannings ;
- programme ouvert, FAQ et CTA final.

Elles ont été inspectées individuellement et en planches contact. Aucun chevauchement, débordement horizontal, texte ambigu, CTA masqué ou régression Next.js n'a été observé. La page reste longue sur mobile mais lisible et actionnable.

## Fichiers modifiés

- Sources produit : manifeste campagne, 12 modules, schémas/getters/configurateur, analytics, bilan et composants publics concernés.
- Tests : contrats entrée/staffing/configurations, composants, bilan, analytics et E2E.
- Dépendances : `package.json` et `package-lock.json` pour Next.js 15.5.18 uniquement.
- Documentation active : contrats analytics/DTO/contenu, gates, rapport RC, design/plan et présent rapport.

La liste exhaustive est obtenue par `git diff --name-status fca5c7f1987474f312edb0dc3d9cbaed74b7c5e4..HEAD`.

## Contrôles de périmètre

- Aucun fichier Prisma ou migration modifié.
- Aucune API Pré-rentrée V2 créée.
- Aucun paiement activé.
- Aucun dashboard V2 modifié.
- Aucun tarif approuvé modifié.
- Aucun planning validé modifié hors clarification sémantique ; les créneaux restent identiques.
- Aucun enseignant personnel codé.
- Aucun prix ou contact codé dans les composants.
- Aucun TODO, FIXME, test skipped, `any`, `ts-ignore` ou `eslint-disable` nouveau.
- Aucun push, merge ou déploiement.

## Conditions de preview et validations propriétaire restantes

Avant déploiement preview, fournir par variables d'environnement les secrets et URL NextAuth de l'environnement, ainsi qu'une connexion DB valide pour supprimer le warning de rafraîchissement passif. Ne réutiliser aucune valeur éphémère de qualification.

L'approche 2, les tarifs et le planning sont déjà approuvés dans la mission. Restent à valider par le propriétaire pendant/après la preview :

- rendu visuel final ;
- texte contractuel/CGV avant confirmation commerciale ;
- disponibilité nominative et qualification des trois enseignants ;
- disponibilité réelle des deux salles et équipements NSI/PC ;
- décision explicite de publication publique.

Ces points n'empêchent pas une preview strictement non transactionnelle et non confirmante.

## Rollback

### Next.js

1. Revenir séparément sur le commit `fix(deps): upgrade Next.js to 15.5.18`.
2. Exécuter `npm ci` sous Node 20.
3. Ne pas redéployer publiquement Next.js 15.5.12 : cette version reste bloquée par les avis runtime constatés.

### Classe d'entrée

Le correctif métier est désormais obligatoire pour toute surface publique. Son commit peut être reverté séparément uniquement dans un environnement non public à des fins de diagnostic. Un tel revert ne nécessite aucune restauration de donnée ou migration.

### Général

Aucune donnée, migration, API V2, activation de paiement ou état distant n'est à restaurer. Le rollback consiste uniquement à ne pas intégrer les commits concernés ou à les reverter séparément.

## Commits

1. `4158790d0` — `fix(pre-rentree): define all campaign levels as 2026 entry classes`
2. `838f0b907` — `test(pre-rentree): lock entry-level staffing and configuration invariants`
3. `b3d77a784` — `fix(deps): upgrade Next.js to 15.5.18`
4. `docs(pre-rentree): record final preview readiness evidence` — commit portant le présent rapport.
