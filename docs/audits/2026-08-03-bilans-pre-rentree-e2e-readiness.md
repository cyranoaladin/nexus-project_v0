# Audit de readiness E2E des bilans de pré-rentrée

## 1. Résumé exécutif

**Verdict : `WORKFLOW_PRE_RENTREE_FINALISE=NO`.**

Le SHA audité est `6e3aedaac89c7383a8a4505f102e871e19f44e60`, sur la branche `audit/bilans-pre-rentree-e2e-readiness-20260803`, dans le worktree `/home/alaeddine/Bureau/nexus-bilans-e2e-readiness`. La production n'a pas été interrogée ni modifiée dans ce lot.

Le socle éditorial et déterministe est robuste : 17 packs actifs, 306 identifiants d'items uniques, 153 identifiants CPS uniques, validations V1-V14 vertes, checksums des 85 prompts actifs cohérents, 1 020 rapports mock reproductibles et rendu HTML/PDF testé. Le workflow complet n'est toutefois pas prêt : zéro pack dispose d'une preuve E2E complète, seize packs sont encore DRAFT, l'enfant initial du tunnel public n'a pas de moyen d'activation, le niveau de l'élève n'est pas comparé au niveau du pack, l'interface parent ne peut pas découvrir puis suivre un rapport, le draineur reste manuel et le temps par item est fabriqué par répartition uniforme.

| Indicateur | Valeur observée |
| --- | ---: |
| Packs actifs | 17 |
| Niveaux | 5 |
| Matières | 7 |
| Items / ids uniques | 306 / 306 |
| Références CPS / ids CPS uniques | 153 / 153 |
| Packs techniquement valides | 17 |
| Packs avec checksums prompts valides | 17 |
| Packs VALIDATED / DRAFT | 1 / 16 |
| Packs avec registre valide / sans registre | 1 / 16 |
| Packs statiquement activables | 1 |
| Packs activés dans l'environnement d'audit | 0 |
| Packs E2E prouvés | 0 |
| Tests exécutés dans cet audit | 59 suites / 497 tests verts |

## 2. Périmètre et méthode

La source de vérité est `data/bilans/banks/wave1.manifest.json`. Aucune liste de slugs n'a été recopiée pour construire l'inventaire JSON. Les fichiers YAML, CPS, prompts, JSON et registres ont été lus, leurs relations ont été recalculées, puis les tests ciblés ont été exécutés avec un `node_modules` physique installé par `npm ci`.

Les statuts sont strictement : `PROUVE`, `PARTIEL`, `ABSENT`, `BLOQUE_TECHNIQUE`, `BLOQUE_HUMAIN`, `NON_APPLICABLE`. `PROUVE` signifie code observé, assertion pertinente exécutée et résultat vert. L'existence d'un test PostgreSQL ou Playwright non exécuté est indiquée séparément.

La suite unitaire complète annoncée avant cet audit, 664 suites / 7 650 tests / 4 ignorés, est un fait déclaré par le demandeur. Elle n'est pas recomptée comme preuve du présent audit. Les tests PostgreSQL et navigateur exigeant migrations ou écritures métier n'ont pas été exécutés.

## 3. Inventaire piloté par le manifeste

| Slug | Niveau | Matière | Version | Items | CPS | Prompts | Statut | Registre | validatedBy | validatedAt | Qualification | Checksums prompts | Checksum source registre | RAG | Flag audit | E2E |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| entree-premiere-francais-v1 | PREMIERE | FRANCAIS | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-premiere-maths-v1 | PREMIERE | MATHS | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-premiere-nsi-v1 | PREMIERE | NSI | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-premiere-physique-chimie-v1 | PREMIERE | PHYSIQUE_CHIMIE | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-premiere-svt-v1 | PREMIERE | SVT | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-quatrieme-francais-v1 | QUATRIEME | FRANCAIS | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-quatrieme-maths-v1 | QUATRIEME | MATHS | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-seconde-francais-v1 | SECONDE | FRANCAIS | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-seconde-maths-v1 | SECONDE | MATHS | v1 | 18 | 9 | 5/5 | VALIDATED | oui | PRESENT | 2026-08-03T13:22:42.750Z | Professeur agrégé de mathématiques | oui | oui | false | OFF | `ABSENT` |
| entree-terminale-maths-expertes-v1 | TERMINALE | MATHS_EXPERTES | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-terminale-maths-v1 | TERMINALE | MATHS | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-terminale-nsi-v1 | TERMINALE | NSI | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-terminale-philosophie-v1 | TERMINALE | PHILOSOPHIE | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-terminale-physique-chimie-v1 | TERMINALE | PHYSIQUE_CHIMIE | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-terminale-svt-v1 | TERMINALE | SVT | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-troisieme-francais-v1 | TROISIEME | FRANCAIS | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |
| entree-troisieme-maths-v1 | TROISIEME | MATHS | v1 | 18 | 9 | 5/5 | DRAFT | non | null | null | — | oui | N/A | false | OFF | `ABSENT` |

Tous les YAML sources, catalogues CPS, répertoires de prompts et JSON de ce tableau existent. Chaque pack comporte exactement 18 items, 9 nœuds, 54 rationales de distracteurs et une distribution A=5, B=5, C=4, D=4. Les 17 packs sont résolvables depuis le manifeste par `lib/bilans/api/pack-access.ts`. Aucun flag n'est actif par défaut.

La seule validation pédagogique versionnée est `entree-seconde-maths-v1`. Son registre, sa qualification, son checksum source et ses cinq checksums de prompts sont cohérents. La valeur de `validatedBy` n'est pas reproduite dans cet audit ; sa présence est constatée. La résolution locale du reviewer n'a pas été tentée sans base. La résolution de production de ce CoachProfile est un fait déjà prouvé lors de l'audit précédent et fourni par le demandeur.

## 4. Matrice pédagogique et documentaire

- V1 : identifiants canoniques et unicité locale/globale.
- V2 : CPS existant, catalogues sans collision, `sequenceOrder` contigu et niveau cible cohérent ; la relation Philosophie vers Français est acceptée génériquement.
- V3 : difficulté 1 à 3.
- V4 : 2 à 6 items par nœud.
- V5 : QCM simple à quatre options et une seule correcte.
- V6 : QCM multiple à quatre ou cinq options et deux ou trois correctes.
- V7 : numérique avec cible et tolérance non négative.
- V8 : réponses texte distinctes après normalisation.
- V9 : correction courte présente et bornée à 320 caractères.
- V10 : lexique interdit.
- V11 : somme des durées compatible avec la durée cible.
- V12 : noms d'enseignants et marques tierces interdits.
- V13 : rationale obligatoire pour chaque distracteur.
- V14 : aucune position correcte au-delà de 40 %.

Les 85 prompts actifs possèdent les cinq rôles attendus et deux exemples remplis. Ils conservent 85 titres rédactionnels obsolètes « Exemples à compléter par le responsable pédagogique », mais aucun exemple actif n'est vide. Le répertoire historique `content/bilans/prompts/maths-terminale-bilan-v1`, hors manifeste, contient dix véritables placeholders. Le mot « brouillon » du prompt Français Seconde appartient à une mauvaise formulation volontaire.

La signature dite pédagogique est un registre de validation lié par SHA-256 ; ce n'est pas une signature cryptographique asymétrique. Le pack signé reste en version 1 parce que sa source et ses prompts signés sont inchangés.

## 5. Cartographie identité et authentification

| Rôle / capacité | Statut | Chemin réel | Preuve et limite |
| --- | --- | --- | --- |
| Parent : création | `PARTIEL` | `POST /api/bilan-gratuit` | Transaction User + ParentProfile + Student + lien PENDING. L'échec SMTP est absorbé. |
| Parent : activation | `PARTIEL` | `/auth/activate` puis `POST /api/student/activate` | Le service générique active aussi le Parent, malgré un nom et des textes orientés Élève. Pas d'E2E email/session. |
| Parent : auth/session/logout | `PARTIEL` | NextAuth Credentials, JWT, bcrypt 12 | Tests unitaires verts, aucun navigateur exécuté ici. |
| Parent : mot de passe oublié | `PARTIEL` | `/auth/mot-de-passe-oublie`, `/api/auth/reset-password` | Anti-énumération et tests unitaires ; réception SMTP réelle non prouvée ici. |
| Parent : enfant ultérieur | `PARTIEL` | `POST /api/parent/children` | Produit un token élève et un lien PENDING ; aucune recette navigateur. |
| Parent : consentement | `PROUVE` | carte enfant + route canonical-consent | Case non précochée, transaction, idempotence, PENDING -> VERIFIED, tests verts. |
| Élève initial du tunnel | `BLOQUE_TECHNIQUE` | créé dans `POST /api/bilan-gratuit` | Aucun token ni mot de passe ; impossible de créer une tentative sans session ELEVE. |
| Élève : activation après ajout | `PARTIEL` | lien retourné au Parent, `/auth/activate` | Tests unitaires verts ; adresse locale et transmission du lien non prouvées en E2E. |
| Coach | `PARTIEL` | assignment ACTIVE, revue et rapport NEXUS | Garde stricte COACH et tests unitaires ; pas de preuve DB/browser actuelle. |
| Assistante | `ABSENT` | aucun rôle Canonical dans revue/rapport | Le périmètre doit être arbitré. |
| Administrateur | `PARTIEL` | GET report NEXUS | Lecture autorisée par source ; publication reste Coach seulement. |

Le middleware exclut toutes les routes API de son matcher ; chaque API doit donc conserver ses gardes propres. Le chemin Canonical résout le Student exclusivement par `session.user.id` et ne reprend pas le fallback email de `lib/security/ownership.ts`.

Le tableau de bord enfant existant affiche à proximité du consentement des valeurs statiques « Top 15% » et des scores de comparaison codés en dur. Elles ne viennent pas du bilan Canonical et constituent un risque de confusion pour une famille.

## 6. Cartographie du pipeline

| Capacité | Statut | Existe | Test unitaire | Intégration exécutée | E2E exécuté | Recette | Production | Preuve |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inventaire, schéma, CPS et checksums | `PROUVE` | oui | oui | non | non | oui | non | wave1-banks.test.ts vert ; check-pack-completeness exit 0 ; 17 packs, 306 ids items, 153 ids CPS |
| Inscription et authentification Parent | `PARTIEL` | oui | oui | non | non | non | non | Route publique transactionnelle et activation générique présentes ; Échec SMTP absorbé ; Aucun E2E exécuté |
| Création, activation et authentification Élève | `BLOQUE_TECHNIQUE` | oui | oui | non | non | non | non | Ajout d’enfant ultérieur produit un token ; Enfant initial de bilan-gratuit sans token |
| Consentement ParentStudentLink | `PROUVE` | oui | oui | non | non | non | non | Service transactionnel idempotent ; Carte non précochée ; 9 tests UI verts |
| Sélection niveau-matière et éligibilité | `ABSENT` | oui | oui | non | non | non | non | Liste manifest-driven des packs activés ; Aucun contrôle du niveau Student |
| Passation, autosave, reprise, confiance et soumission | `PARTIEL` | oui | oui | non | non | non | non | Runner et routes unitaires verts ; Intégrations PostgreSQL existantes mais non exécutées ici ; Aucun E2E pack réel |
| Scoring déterministe et FactSheet | `PROUVE` | oui | oui | non | non | oui | non | compute-facts et domain-scores verts ; ENGINE_VERSION 1.0.1 ; worker recipe sur entree-premiere-maths-v1 |
| Outbox et worker | `PARTIEL` | oui | oui | non | non | oui | non | Worker déterministe sans réseau ; Draineur manuel et verrous présents ; Pas de preuve DB actuelle ni d’ordonnanceur |
| Cinq agents et gateway LLM | `NON_APPLICABLE` | oui | oui | non | non | oui | non | Allowlist modèles vide ; RAG false sur 17 packs ; Worker Canonical n’importe aucun agent/LLM/RAG |
| Restitution Élève | `PROUVE` | oui | oui | non | non | oui | non | 17 recettes déterministes ; HTML/PDF sans score ni sentinelle |
| Restitution Parents | `PROUVE` | oui | oui | non | non | oui | non | 17 recettes déterministes ; HTML/PDF sans score ni sentinelle ; Consultation web parent non fonctionnelle |
| Restitution Nexus | `PROUVE` | oui | oui | non | non | oui | non | 17 recettes déterministes ; internalFacts réservés à NEXUS |
| Revue humaine et publication immuable | `PARTIEL` | oui | oui | non | non | oui | non | Prévisualisation non stockée ; Publication matérialisée courte ; Pas de correction/régénération raccordée ; Intégration DB non exécutée |
| Consultation par audience et étanchéité | `PARTIEL` | oui | oui | non | non | non | non | GET report possède les gardes ; Tests DB existent mais non exécutés ; UI parent bloquée ; Assistante non définie |

La création de tentative est transactionnelle, idempotente sur `(userId, route, key)`, génère un seed serveur et scelle provenance, version et checksum. Le pack doit être VALIDATED, avec review non nul, et son flag exact doit être vrai. Le resolver est piloté par le manifeste ; l'activation d'un pack n'en active aucun autre.

Le questionnaire expose un DTO expurgé et permute uniquement les options à partir de `seed + itemId`. Les questions conservent l'ordre du pack. Les réponses sont sauvegardées partiellement avec révision optimiste, idempotence et confiance 1 à 4. La soumission exige toutes les réponses et confiances, verrouille l'attempt par `SELECT ... FOR UPDATE`, passe à SUBMITTED et insère le job dans la même transaction.

Le scoring est une fonction pure : bonnes réponses du pack, difficulté comme poids, agrégation item -> nodeCpsId -> domainId, profils maîtrise × confiance, couverture de passation, calibration et groupBand. `ENGINE_VERSION=1.0.1`. La FactSheet est pseudonymisée et n'importe pas ScoringV2 ni un LLM. En revanche, le worker attribue à chaque item une durée égale calculée à partir de la durée murale totale : cette granularité n'est pas réellement collectée.

Le draineur revendique PENDING/FAILED/lease expirée par `FOR UPDATE SKIP LOCKED`. Le worker verrouille le job, vérifie le checksum de tentative, calcule, persiste ScoreSnapshot/EvidenceItem, crée une révision PENDING_REVIEW et marque le job COMPLETED. En cas d'erreur, la transaction principale est annulée et le job devient FAILED. Le service est manuel ; aucun ordonnanceur, backoff ou plafond de tentatives n'est actif.

Le worker d'août n'importe aucun agent, LLM, RAG ou client réseau. Les cinq agents et la gateway existent séparément, chargent leurs prompts et schémas depuis le pack et font au plus une correction ciblée. L'allowlist de modèles est vide et RAG est false sur les 17 packs. Les modes d'échec fournisseur sont donc `NON_APPLICABLE` au chemin déterministe actuel.

La publication rend les trois audiences et Chromium hors transaction, puis revérifie l'éligibilité et insère ReportMaterialization + trois ReportAudienceArtifact dans une transaction courte avant PUBLISHED. GET /report lit l'artefact immuable et ne régénère jamais. ELEVE/PARENTS sont contrôlés sans score, clé ou sentinelle ; NEXUS conserve internalFacts. La prévisualisation Coach n'écrit rien.

## 7. Branchements et configurations codés en dur

| Fichier / symbole | Liste ou logique | Légitimité | Coût / risque |
| --- | --- | --- | --- |
| `lib/bilans/api/create-attempt.ts` / `SUBJECTS`, `LEVELS` | mappings vers enums Prisma | Légitime à la frontière DB, mais dupliqué | Coût faible à moyen ; oubli = pack impossible à créer. |
| `lib/bilans/api/get-attempt.ts` / `LEVEL_LABELS` | niveaux affichés | Devrait être centralisé | Coût faible ; oubli = erreur explicite. |
| `lib/bilans/catalog/subjects.ts` | allowlist et libellés | Configuration centrale légitime | Coût faible ; doit rester exhaustive. |
| `lib/bilans/render/stage-label.ts` | allowlist et libellés niveau | Duplique le modèle de niveau | Coût faible ; risque de divergence. |
| `lib/bilans/render/subject-display.ts` | politiques de regroupement par matière | Configuration pédagogique légitime | Coût moyen à chaque matière ; test exhaustif requis. |
| `prisma/schema.prisma` | enums Subject et GradeLevel | Nécessaire à la persistance | Migration additive requise pour toute nouvelle valeur. |
| scripts d'exemples | slugs Première Maths | Légitime comme fixture, pas comme runtime | La recette worker ne couvre qu'un pack. |

Aucun branchement métier runtime `if slug === ...` n'a été trouvé dans le resolver, les six routes, le worker ou la publication. Le manifeste fixe toutefois encore `expectedActiveBanks=17` et `expectedItems=306` : la dix-huitième banque exige une mise à jour explicite du manifeste, ce qui est une garde utile.

## 8. Matrice des tests

| Étape | Test | Type | Exécuté | Vert | Ce qu'il prouve | Ce qu'il ne prouve pas |
| --- | --- | --- | --- | --- | --- | --- |
| Données vague 1 | `__tests__/bilans/wave1-banks.test.ts` | UNITAIRE + ARTEFACT | oui | oui | 17 banques, 306 ids, 153 CPS, V1-V14, recettes 1 020 rapports, Unicode, atomicité | Ne traverse ni authentification ni base ni publication |
| Chargement fail-closed | `__tests__/bilans/pack-loader.test.ts` | UNITAIRE | oui | oui | DRAFT refusé, checksum prompt et métadonnées invalides refusés | Ne résout pas le CoachProfile en base |
| Prompts | `__tests__/bilans/prompt-contract.test.ts` | UNITAIRE | oui | oui | Rôles, rubriques, exemples actifs remplis et checksums | N’évalue pas la qualité humaine et exclut la dette historique |
| Passation API | `__tests__/api/bilans-canonical-*.route.test.ts` | UNITAIRE MOCK DB | oui | oui | Création, DTO expurgé, autosave, confiance, conflits, flags, statut | Ne prouve pas concurrence PostgreSQL ni navigateur |
| Runner | `__tests__/components/canonical-assessment-runner.test.tsx` | UNITAIRE DOM | oui | oui | Confiance requise, reprise, conflit sans perte, pas de sentinelle | Ne contacte pas une application réelle |
| Scoring | `__tests__/bilans/compute-facts.test.ts` | UNITAIRE | oui | oui | Cas dorés, branches défensives, déterminisme, monotonie, ENGINE_VERSION | Ne prouve pas la persistance |
| Scores domaines | `__tests__/bilans/domain-scores.test.ts` | UNITAIRE | oui | oui | Pondération difficulté, partiel, nœud non rattaché fail-closed | Un seul jeu synthétique |
| Chaîne worker recette | `__tests__/bilans/worker-recipe.test.ts` | RECETTE DÉTERMINISTE | oui | oui | Réponses brutes -> facts -> domaines -> FactSheet -> trois rendus | Un seul pack et aucune base/outbox |
| Worker boundary | `__tests__/bilans/canonical-worker-contract.test.ts` | ARCHITECTURE | oui | oui | Aucun agent, LLM, RAG, HTTP, réseau ou ScoringV2 | Ne traite pas un JobOutbox réel |
| PDF | `__tests__/bilans/render-pdf.test.ts` | UNITAIRE CHROMIUM | oui | oui | PDF réel, texte extrait, non-divulgation, stabilité normalisée, fallback | FactSheet synthétique |
| Exemples versionnés | `__tests__/bilans/rendered-examples.test.ts` | RECETTE VISUELLE | oui | oui | Six artefacts HTML/PDF byte-for-byte | Pas de données de passation ni revue humaine prouvée |
| Publication | `__tests__/bilans/report-publication.test.ts` | UNITAIRE MOCK DB | oui | oui | Rendu avant transaction, HTML fail-closed, course concurrente | Pas de contrainte PostgreSQL réelle |
| Staff | `__tests__/bilans/staff-review-surface.test.ts` | UNITAIRE | oui | oui | Coach assigné, motif, refus, prévisualisation, blocage validationFailures | Pas de navigateur ni rôle Assistante |
| Plan groupe | `__tests__/bilans/staff-group-plan.test.ts` | UNITAIRE | oui | oui | 3 à 5 attempts scorées, même pack, assignment Coach | Pas de base ni navigateur |
| Consentement service/UI | `__tests__/bilans/parent-student-consent.test.ts + parent-canonical-consent-card.test.tsx` | UNITAIRE | oui | oui | PENDING -> VERIFIED explicite, idempotence, ownership, carte non précochée | Concurrence PostgreSQL et parcours auth non exécutés |
| Auth et onboarding | `__tests__/api/bilan-gratuit.test.ts + tests auth/activation/RBAC` | UNITAIRE MOCK DB | oui | oui | Validation, bcrypt, activation, rate limits et rôles | Réception email, sessions navigateur et enfant initial non prouvés |
| Chaîne August | `__tests__/integration/bilans-canonical-august-chain.test.ts` | INTEGRATION POSTGRES | non | N/A | Existe : backend complet avec fixture et sessions injectées | Non exécuté ici ; pas d’inscription, auth navigateur, pack réel ni Chromium |
| Concurrence submit/outbox | `__tests__/integration/bilans-canonical-submit.test.ts + bilans-canonical-outbox-drainer.test.ts` | INTEGRATION POSTGRES | non | N/A | Existe : double submit, SKIP LOCKED, replay | Non exécuté dans cet audit |
| Accès rapports | `__tests__/integration/bilans-canonical-report.test.ts + bilans-parent-link-report-access.test.ts` | INTEGRATION POSTGRES | non | N/A | Existe : audiences, lien VERIFIED, PDF stocké, flag off | Non exécuté ; ne couvre pas la page parent |
| Playwright Canonical | `e2e/canonical-bilan-pilot.spec.ts` | E2E NAVIGATEUR | non | N/A | Existe : flags OFF et refus parent inconnu | Aucun chemin complet, aucun pack activé |

Les commandes réellement exécutées sont :

`npm ci` : succès, `node_modules` physique, Node v22.21.0, npm 10.9.8 ; 5 vulnérabilités signalées.

`npm run test -- --runInBand <36 suites ciblées>` : 36 suites, 309 tests, tous verts.

`npm run test -- --runInBand <10 suites rendu/recette/signature>` : 10 suites, 36 tests, tous verts ; Chromium/PDF réel inclus.

`npm run test -- --runInBand <12 suites auth/RBAC>` : 12 suites, 143 tests, tous verts.

`npm run test -- --runInBand __tests__/bilans/parent-canonical-consent-card.test.tsx` : 1 suite, 9 tests, tous verts.

`./node_modules/.bin/tsx scripts/bilans/check-pack-completeness.ts --all --manifest data/bilans/banks/wave1.manifest.json` : exit 0, `BANK_DASHBOARD=17:ACTIVE:0:BLOCKING`.

`./node_modules/.bin/tsx scripts/bilans/convert-bank-batch.ts --manifest data/bilans/banks/wave1.manifest.json` : exit 1, résolution CoachProfile impossible car `DATABASE_URL` absent. Aucun fichier n'a été écrit. Ce résultat ne révoque pas la signature de production.

La CI configure trois niveaux distincts : Jest unitaire, Jest intégration avec PostgreSQL migré, et Playwright avec une base E2E. Le job Playwright exécute bien `e2e/canonical-bilan-pilot.spec.ts`, mais ce fichier ne teste que les flags OFF. Le job A94 `bilan-runtime-real-db` existe séparément. Aucun résultat GitHub courant n'a été consulté dans ce lot.

## 9. Matrice E2E par pack

Les colonnes Élève, Parents et Nexus signifient ici « rendu de cette audience prouvé par recette », pas consultation E2E. `entree-premiere-maths-v1` est le seul pack dont la recette part de réponses brutes ; les autres recettes partent de FactSheets synthétiques.

| Slug | Niveau | Matière | Chargeable | Signé | Activable | Tentative | Scoring | Worker | Élève | Parents | Nexus | Vérificateur | E2E |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| entree-premiere-francais-v1 | PREMIERE | FRANCAIS | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-premiere-maths-v1 | PREMIERE | MATHS | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PROUVE` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-premiere-nsi-v1 | PREMIERE | NSI | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-premiere-physique-chimie-v1 | PREMIERE | PHYSIQUE_CHIMIE | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-premiere-svt-v1 | PREMIERE | SVT | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-quatrieme-francais-v1 | QUATRIEME | FRANCAIS | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-quatrieme-maths-v1 | QUATRIEME | MATHS | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-seconde-francais-v1 | SECONDE | FRANCAIS | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-seconde-maths-v1 | SECONDE | MATHS | `PROUVE` | `PROUVE` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-terminale-maths-expertes-v1 | TERMINALE | MATHS_EXPERTES | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-terminale-maths-v1 | TERMINALE | MATHS | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-terminale-nsi-v1 | TERMINALE | NSI | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-terminale-philosophie-v1 | TERMINALE | PHILOSOPHIE | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-terminale-physique-chimie-v1 | TERMINALE | PHYSIQUE_CHIMIE | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-terminale-svt-v1 | TERMINALE | SVT | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-troisieme-francais-v1 | TROISIEME | FRANCAIS | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |
| entree-troisieme-maths-v1 | TROISIEME | MATHS | `PROUVE` | `BLOQUE_HUMAIN` | `BLOQUE_HUMAIN` | `PARTIEL` | `PARTIEL` | `PARTIEL` | `PROUVE` | `PROUVE` | `PROUVE` | `PARTIEL` | `ABSENT` |

## 10. Modes d'échec

| Scénario | Statut | Preuve / limite |
| --- | --- | --- |
| pack inconnu | `PROUVE` | __tests__/bilans/canonical-api-foundations.test.ts |
| pack DRAFT | `PROUVE` | __tests__/bilans/pack-loader.test.ts |
| registre manquant | `PROUVE` | __tests__/bilans/review-registry.test.ts |
| reviewer inexistant | `PROUVE` | __tests__/bilans/sign-pack.test.ts |
| checksum source divergent | `PROUVE` | __tests__/bilans/review-registry.test.ts |
| checksum prompt divergent | `PROUVE` | __tests__/bilans/pack-loader.test.ts et review-registry.test.ts |
| feature flag désactivé | `PROUVE` | tests API + bilan-canonical-pack-flag-boundary.test.ts |
| tentative concurrente | `PARTIEL` | idempotence unitaire ; intégration DB non exécutée |
| double soumission | `PARTIEL` | bilans-canonical-submit.test.ts existe, non exécuté |
| interruption après scoring | `PARTIEL` | transaction worker observée ; scénario DB non exécuté |
| événement outbox dupliqué | `PARTIEL` | contrainte et test intégration existent, non exécutés |
| worker interrompu | `PARTIEL` | lease expirante présente ; aucune exécution actuelle |
| timeout fournisseur | `NON_APPLICABLE` | chemin août déterministe sans fournisseur ; gateway dormant sans timeout propre |
| fournisseur indisponible | `NON_APPLICABLE` | chemin août déterministe ; transport LLM non actif |
| JSON LLM invalide | `NON_APPLICABLE` | gateway dormant testé unitairement |
| schéma de rendu invalide | `PROUVE` | structural-validation et worker fail-closed unitaires |
| RAG absent | `NON_APPLICABLE` | rag.enabled=false sur 17 packs |
| RAG non vérifié | `NON_APPLICABLE` | RAG inactif ; gateway futur n’exige qu’une liste non vide |
| échec vérificateur | `PARTIEL` | gateway mock retourne pending avec failures ; non connecté au worker |
| rapport non publié | `PARTIEL` | garde source présente ; test DB non exécuté |
| accès inter-familles | `PARTIEL` | services unitaires verts ; tests DB non exécutés |
| élève accédant à un autre rapport | `PARTIEL` | ownership routes unitaires ; GET report DB non exécuté |
| rôle insuffisant | `PROUVE` | staff-review-surface, RBAC et routes unitaires |
| rollback worker | `PARTIEL` | transaction et FAILED observés ; intégration non exécutée |
| révocation après modification | `PROUVE` | review-registry et sign-pack unitaires |

## 11. Écarts P0, P1 et P2

### BILAN-RDY-P0-001 — Aucun pack ne possède une preuve E2E complète

- Statut : `ABSENT`
- Sévérité : `P0`
- Preuves : e2e/canonical-bilan-pilot.spec.ts:5-19 ne teste que les flags OFF et un rapport inconnu. __tests__/integration/bilans-canonical-august-chain.test.ts:32-37 remplace le PDF par un buffer factice, injecte les sessions et utilise une fixture. Aucun test navigateur ne parcourt inscription, consentement, 18 réponses, reprise, outbox, revue, publication et accès par audience sur un pack du manifeste.
- Fichiers : `e2e/canonical-bilan-pilot.spec.ts`, `__tests__/integration/bilans-canonical-august-chain.test.ts`
- Tests : `e2e/canonical-bilan-pilot.spec.ts`, `__tests__/integration/bilans-canonical-august-chain.test.ts`
- Blocage : Le workflow ne peut pas être déclaré terminé et PACKS_E2E_PROVEN reste à 0.
- Recommandation : Créer une recette navigateur isolée, pilotée par le manifeste, d’abord sur le pack Maths Seconde puis sur les 17 entrées.

### BILAN-RDY-P0-002 — L’élève créé par le tunnel public initial ne peut pas activer son compte

- Statut : `BLOQUE_TECHNIQUE`
- Sévérité : `P0`
- Preuves : app/api/bilan-gratuit/route.ts:110-118 crée le User ELEVE sans mot de passe, sans activationToken et sans activationExpiry. Le seul token créé par cette route est porté par le User PARENT à app/api/bilan-gratuit/route.ts:65-68 et 85-96. POST /api/bilans/attempts exige une session ELEVE résolue depuis userId.
- Fichiers : `app/api/bilan-gratuit/route.ts`, `lib/bilans/api/access.ts`, `lib/bilans/api/create-attempt.ts`
- Tests : `__tests__/api/bilan-gratuit.test.ts`, `__tests__/api/student.activate.route.test.ts`
- Blocage : Le parcours demandé parent -> enfant initial -> passation s’arrête avant l’authentification de l’enfant.
- Recommandation : Définir un flux d’activation explicite pour l’enfant initial, sans créer de second Student, puis le prouver en navigateur.

### BILAN-RDY-P0-003 — Aucun contrôle serveur ne relie le niveau de l’élève au niveau du pack

- Statut : `ABSENT`
- Sévérité : `P0`
- Preuves : lib/bilans/api/create-attempt.ts:123-177 résout le Student et le pack mais ne compare pas Student.gradeLevel au pack.level. app/bilan-gratuit/assessment/page.tsx:23-26 liste tous les packs activés sans filtrage par niveau de l’élève.
- Fichiers : `lib/bilans/api/create-attempt.ts`, `app/bilan-gratuit/assessment/page.tsx`
- Tests : `__tests__/api/bilans-canonical-create.route.test.ts`, `__tests__/bilans/canonical-pilot-surfaces.test.tsx`
- Blocage : Un élève authentifié peut demander tout pack activé, quel que soit son niveau.
- Recommandation : Dériver l’éligibilité niveau-matière du manifeste et la vérifier côté serveur avant toute tentative.

### BILAN-RDY-P0-004 — La consultation parent n’est pas un parcours web fonctionnel

- Statut : `BLOQUE_TECHNIQUE`
- Sévérité : `P0`
- Preuves : components/bilans/CanonicalReportViewer.tsx:22 interroge toujours GET /status. lib/bilans/api/get-status.ts résout exclusivement un Student depuis une session ELEVE. app/bilan-gratuit/assessment/[id]/report/page.tsx:8 autorise pourtant PARENT. Le seul lien vers cette page est affiché au runner élève à components/bilans/CanonicalAssessmentRunner.tsx:133 ; aucun inventaire de rapports Canonical n’est exposé au parent.
- Fichiers : `components/bilans/CanonicalReportViewer.tsx`, `lib/bilans/api/get-status.ts`, `app/bilan-gratuit/assessment/[id]/report/page.tsx`, `components/bilans/CanonicalAssessmentRunner.tsx`
- Tests : `__tests__/bilans/canonical-pilot-surfaces.test.tsx`, `e2e/canonical-bilan-pilot.spec.ts`
- Blocage : L’API directe GET /report sait autoriser un parent vérifié, mais l’interface parent ne peut ni découvrir ni suivre ce rapport.
- Recommandation : Ajouter une surface parent de découverte et un statut compatible avec l’audience autorisée, sans élargir la donnée retournée.

### BILAN-RDY-P0-005 — Seul un pack sur dix-sept est pédagogiquement signé

- Statut : `BLOQUE_HUMAIN`
- Sévérité : `P0`
- Preuves : check-pack-completeness observe 1 VALIDATED et 16 DRAFT. Seul data/bilans/reviews/entree-seconde-maths-v1.review.yaml existe. La résolution de production d’un CoachProfile n’est confirmée que pour le responsable Mathématiques/NSI indiqué par le demandeur.
- Fichiers : `data/bilans/banks/wave1.manifest.json`, `data/bilans/reviews/entree-seconde-maths-v1.review.yaml`
- Tests : `__tests__/bilans/wave1-banks.test.ts`, `__tests__/bilans/review-registry.test.ts`, `__tests__/bilans/sign-pack.test.ts`
- Blocage : Les 16 packs DRAFT sont refusés fail-closed et ne peuvent pas être activés.
- Recommandation : Créer les CoachProfile qualifiés confirmés, compléter les revues disciplinaires et signer chaque version séparément.

### BILAN-RDY-P0-006 — Le temps par item est fabriqué par répartition uniforme

- Statut : `PARTIEL`
- Sévérité : `P0`
- Preuves : lib/bilans/worker/scoring.ts:57-59 divise la durée murale totale entre tous les items. lib/bilans/worker/scoring.ts:76-81 persiste cette valeur uniforme dans chaque ScoringAnswer. PATCH /answers ne collecte que optionId et confidence.
- Fichiers : `lib/bilans/worker/scoring.ts`, `lib/bilans/api/patch-answers.ts`, `components/bilans/CanonicalAssessmentRunner.tsx`
- Tests : `__tests__/bilans/canonical-worker-contract.test.ts`, `__tests__/components/canonical-assessment-runner.test.tsx`
- Blocage : Le champ elapsedMs ne représente pas une mesure par item et ne doit pas être présenté comme tel.
- Recommandation : Collecter une mesure bornée par item ou retirer cette granularité des preuves ; conserver seulement la durée globale réellement sourcée.

### BILAN-RDY-P1-001 — Le draineur est manuel, sans ordonnanceur, backoff ni plafond de retry

- Statut : `PARTIEL`
- Sévérité : `P1`
- Preuves : scripts/bilans/drain-scoring-outbox.ts:13-20 fournit uniquement un point d’entrée manuel. lib/bilans/worker/drain-outbox.ts:65 accepte PENDING et FAILED ; aucun backoff ou nombre maximal n’est appliqué. Aucun script npm ne publie la commande de drainage.
- Fichiers : `scripts/bilans/drain-scoring-outbox.ts`, `lib/bilans/worker/drain-outbox.ts`, `package.json`
- Tests : `__tests__/bilans/outbox-drainer-contract.test.ts`, `__tests__/integration/bilans-canonical-outbox-drainer.test.ts`
- Blocage : Une soumission reste en attente sans action opérateur et les échecs peuvent être repris sans politique d’espacement.
- Recommandation : Documenter/emballer la commande, ajouter métriques, backoff, plafond et mécanisme d’exploitation avant généralisation.

### BILAN-RDY-P1-002 — La commande batch CHECK_ONLY dépend d’une base reviewer

- Statut : `PARTIEL`
- Sévérité : `P1`
- Preuves : scripts/bilans/convert-bank-batch.ts:126-141 interroge CoachProfile dès qu’un registre existe. La commande CHECK_ONLY a échoué dans le worktree propre avec DATABASE_URL absent. Les validations pures de collection et les 17 packs restent vertes.
- Fichiers : `scripts/bilans/convert-bank-batch.ts`
- Tests : `__tests__/bilans/wave1-banks.test.ts`, `__tests__/bilans/yaml-bank-to-pack.test.ts`
- Blocage : Un audit reproductible hors base ne peut pas exécuter la commande canonique complète.
- Recommandation : Séparer validation statique/checksum et résolution dynamique du reviewer, avec un statut explicite plutôt qu’un échec opaque.

### BILAN-RDY-P1-003 — Le pack n’est pas figé pendant la passation

- Statut : `PARTIEL`
- Sévérité : `P1`
- Preuves : La tentative scelle assessmentPackChecksum à la création. GET et PATCH résolvent néanmoins le pack courant par slug/version et ne comparent pas ce checksum. Le worker compare le checksum et échoue tardivement si le pack a changé.
- Fichiers : `lib/bilans/api/create-attempt.ts`, `lib/bilans/api/get-attempt.ts`, `lib/bilans/api/patch-answers.ts`, `lib/bilans/worker/score-job.ts`
- Tests : `__tests__/api/bilans-canonical-get.route.test.ts`, `__tests__/integration/bilans-canonical-worker-review.test.ts`
- Blocage : Une mutation in-place de même version peut changer le questionnaire servi avant d’être refusée au scoring.
- Recommandation : Comparer le checksum scellé à chaque lecture/écriture ou matérialiser le DTO de passation scellé.

### BILAN-RDY-P1-004 — Le refus d’envoi du courriel d’activation n’empêche pas un succès public

- Statut : `PARTIEL`
- Sévérité : `P1`
- Preuves : app/api/bilan-gratuit/route.ts:156-175 absorbe l’échec SMTP puis affirme qu’un lien a été envoyé. __tests__/api/bilan-gratuit.test.ts vérifie explicitement ce comportement.
- Fichiers : `app/api/bilan-gratuit/route.ts`, `lib/email.ts`
- Tests : `__tests__/api/bilan-gratuit.test.ts`
- Blocage : Un parent peut recevoir une confirmation sans moyen de définir son mot de passe.
- Recommandation : Conserver l’anti-énumération mais tracer et exposer un état opérationnel récupérable ou un mécanisme de renvoi vérifié.

### BILAN-RDY-P1-005 — La revue permet valider/publier ou rejeter, mais pas corriger une révision

- Statut : `PARTIEL`
- Sévérité : `P1`
- Preuves : app/dashboard/coach/bilans/actions.ts expose uniquement validateAndPublishReportAction et rejectReportAction. La machine à états prévoit REQUEST_REGENERATION mais aucune surface Canonical ne la raccorde.
- Fichiers : `app/dashboard/coach/bilans/actions.ts`, `lib/bilans/core/state-machine.ts`, `lib/bilans/core/report-service.ts`
- Tests : `__tests__/bilans/staff-review-surface.test.ts`, `__tests__/lib/bilans/core/state-machine.test.ts`
- Blocage : Une restitution à corriger doit être rejetée sans parcours de régénération contrôlé.
- Recommandation : Raccorder une nouvelle révision immuable depuis la révision rejetée, sans édition de l’artefact publié.

### BILAN-RDY-P1-006 — Les rôles internes Canonical ne couvrent pas l’Assistante

- Statut : `PARTIEL`
- Sévérité : `P1`
- Preuves : lib/bilans/staff/review-service.ts:94-98 n’accepte que COACH. lib/bilans/api/get-report.ts autorise ADMIN ou COACH assigné pour NEXUS ; ASSISTANTE est absente.
- Fichiers : `lib/bilans/staff/review-service.ts`, `lib/bilans/api/get-report.ts`
- Tests : `__tests__/bilans/staff-review-surface.test.ts`, `__tests__/integration/bilans-canonical-report.test.ts`
- Blocage : Le périmètre Assistante demandé n’est pas défini dans le workflow Canonical.
- Recommandation : Arbitrer explicitement lecture, préparation et publication pour ASSISTANTE avant d’étendre le RBAC.

### BILAN-RDY-P1-007 — Les mappings matière et niveau restent manuels à plusieurs frontières

- Statut : `PARTIEL`
- Sévérité : `P1`
- Preuves : lib/bilans/api/create-attempt.ts:31-54 mappe manuellement Subject et GradeLevel Prisma. lib/bilans/api/get-attempt.ts:64-75 mappe manuellement les libellés de niveau. lib/bilans/catalog/subjects.ts, lib/bilans/render/stage-label.ts et lib/bilans/render/subject-display.ts sont des configurations explicites à maintenir.
- Fichiers : `lib/bilans/api/create-attempt.ts`, `lib/bilans/api/get-attempt.ts`, `lib/bilans/catalog/subjects.ts`, `lib/bilans/render/stage-label.ts`, `lib/bilans/render/subject-display.ts`, `prisma/schema.prisma`
- Tests : `__tests__/api/bilans-canonical-create.route.test.ts`, `__tests__/api/bilans-canonical-get.route.test.ts`, `__tests__/bilans/stage-label.test.ts`
- Blocage : Un nouveau niveau ou une nouvelle matière du manifeste n’est pas automatiquement exécutable sans évolution du modèle et de ces mappings.
- Recommandation : Conserver les enums de persistance explicites, mais centraliser les métadonnées d’affichage et rendre les erreurs d’absence bloquantes.

### BILAN-RDY-P1-008 — Les recettes mock ne prouvent pas le contenu réel des prompts

- Statut : `PARTIEL`
- Sévérité : `P1`
- Preuves : lib/bilans/llm/mock-transport.ts:10-63 génère des sorties codées par agent sans interpréter le texte du prompt. Les 1 020 rapports prouvent schémas, déterminisme et V1-V7, pas l’effet rédactionnel des 85 prompts. Une seule recette worker traverse réponses brutes -> FactSheet -> rendu, sur entree-premiere-maths-v1.
- Fichiers : `lib/bilans/llm/mock-transport.ts`, `data/bilans/recipe/entree-premiere-maths-v1-worker-chain.json`
- Tests : `__tests__/bilans/mock-recipe.test.ts`, `__tests__/bilans/worker-recipe.test.ts`
- Blocage : La qualité rédactionnelle et la cohérence des prompts ne sont pas prouvées par le mock.
- Recommandation : Maintenir cette preuve structurelle, mais ne l’assimiler ni à une recette LLM ni à une validation humaine.

### BILAN-RDY-P1-009 — Le tableau de bord enfant affiche des indicateurs de démonstration codés en dur

- Statut : `PARTIEL`
- Sévérité : `P1`
- Preuves : app/dashboard/parent/enfant/[studentId]/page.tsx:84-88 affiche NexusIndex et Top 15%. app/dashboard/parent/enfant/[studentId]/page.tsx:99-106 injecte des scores de cohorte statiques.
- Fichiers : `app/dashboard/parent/enfant/[studentId]/page.tsx`
- Tests : aucun
- Blocage : Ces chiffres peuvent être confondus avec le diagnostic réel au voisinage du consentement Canonical.
- Recommandation : Retirer ou étiqueter les données de démonstration avant l’ouverture aux familles.

### BILAN-RDY-P2-001 — Dette documentaire des prompts

- Statut : `BLOQUE_HUMAIN`
- Sévérité : `P2`
- Preuves : Les 85 prompts actifs ont des exemples remplis mais conservent le titre obsolète « Exemples à compléter par le responsable pédagogique ». content/bilans/prompts/maths-terminale-bilan-v1 contient dix véritables placeholders et reste hors manifeste. Une occurrence « brouillon » du prompt Français Seconde est une mauvaise formulation volontaire.
- Fichiers : `content/bilans/prompts`, `content/bilans/prompts/maths-terminale-bilan-v1`
- Tests : `__tests__/bilans/prompt-contract.test.ts`
- Blocage : Non bloquant pour les 17 packs actifs, bloquant pour une affirmation globale PROMPTS_FINALISES=YES.
- Recommandation : Traiter le répertoire historique par complétion humaine ou archivage formel dans un lot séparé.

### BILAN-RDY-P2-002 — La signature pédagogique est une liaison de checksums, pas une signature cryptographique

- Statut : `PARTIEL`
- Sévérité : `P2`
- Preuves : Le registre versionné lie sourceChecksum, cinq promptChecksums, CoachProfile.id et horodatage. Aucune signature asymétrique ni chaîne de confiance cryptographique n’est présente.
- Fichiers : `lib/bilans/catalog/review-registry.ts`, `data/bilans/reviews/entree-seconde-maths-v1.review.yaml`
- Tests : `__tests__/bilans/review-registry.test.ts`, `__tests__/bilans/sign-pack.test.ts`
- Blocage : Aucun blocage fonctionnel si le terme « signature » reste défini comme validation pédagogique auditée.
- Recommandation : Documenter cette distinction et réserver « signature cryptographique » à un futur mécanisme dédié.

### BILAN-RDY-P2-003 — Dépendances npm avec vulnérabilités signalées lors de npm ci

- Statut : `PARTIEL`
- Sévérité : `P2`
- Preuves : npm ci a signalé 5 vulnérabilités : 3 modérées et 2 élevées.
- Fichiers : `package-lock.json`, `security/brace-expansion-backport-attestation.json`
- Tests : `__tests__/scripts/validate-brace-expansion-attestation.test.ts`
- Blocage : L’impact runtime n’a pas été réévalué dans cet audit ; la CI possède une attestation bornée.
- Recommandation : Suivre l’attestation et réévaluer séparément le graphe runtime avant expiration.

## 12. Dépendances humaines

- Relecture et signature de 16 packs par des enseignants qualifiés dans leur discipline.
- Création ou confirmation des CoachProfile disciplinaires sans attribuer une discipline à un profil non qualifié.
- Relecture humaine des exemples HTML/PDF Élève, Parents, Nexus et Groupe.
- Arbitrage du rôle Assistante dans la chaîne Canonical.
- Arbitrage sur la collecte réelle du temps par item.
- Complétion ou archivage formel du répertoire historique de prompts.

## 13. Plan d'implémentation recommandé

1. Rendre activable l'enfant initial de `/api/bilan-gratuit` sans créer de doublon, puis prouver inscription, activation, connexion et consentement avec des identités synthétiques.
2. Ajouter l'éligibilité serveur niveau du Student -> niveau du pack, pilotée par le manifeste et les métadonnées canoniques.
3. Fournir au Parent une liste de rapports de ses enfants et un suivi de statut autorisé, sans exposer de score ni d'audience choisie par le client.
4. Remplacer la répartition artificielle du temps par une collecte réelle ou supprimer cette granularité.
5. Construire un E2E réel sur base éphémère pour `entree-seconde-maths-v1` : 18 réponses, confiance, interruption, reprise, double submit, drainage, 9 nœuds, revue, publication, trois audiences et PDF.
6. Paramétrer ce scénario depuis le manifeste sur les 17 packs sans liste de slugs dans le test.
7. Operationaliser le draineur : commande npm documentée, backoff, plafond, métriques, alertes et reprise.
8. Raccorder la correction/régénération immuable et arbitrer les droits Assistante/Admin.
9. Signer les autres packs uniquement après qualification humaine et CoachProfile disciplinaire propre.

## 14. Définition de fin

La définition de fin n'est pas satisfaite. Restent non prouvés ou bloqués : enfant initial activable, niveau-pack, parcours Parent, E2E complet par pack, exploitation outbox, mesure du temps, correction avant publication, rôles internes complets, 16 signatures humaines et dette historique des prompts.

## 15. Recommandation suivante

Le prochain obstacle réel est l'identité de l'enfant initial, avant le scoring ou le rendu. Tant que l'enfant créé par le tunnel public ne peut pas établir une session ELEVE sans duplication, aucun E2E honnête ne peut commencer. Le micro-lot suivant doit corriger ce seul seam, avec une base éphémère et une identité synthétique, puis enchaîner immédiatement sur l'éligibilité niveau-pack et la consultation Parent.

**`WORKFLOW_PRE_RENTREE_FINALISE=NO`**
