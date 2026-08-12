# Audit post-#116 — preuve go-live et angles morts

## Date

10 août 2026

## Périmètre et méthode

- Révision auditée : `e15c8418e0c701a1f2dade4fccbfd845df0bfaed` (`main`).
- Branche de travail : `agent/post-116-go-live-audit`.
- Application, PostgreSQL 15, Redis et SMTP de test exécutés dans un environnement Docker jetable ; aucune base de production n'a été utilisée par les tests.
- Node `22.23.1`, npm `10.9.8`, LLM désactivé.
- Production consultée en lecture seule pour les compteurs de logs, les métadonnées Docker et l'inventaire documentaire. Aucun fichier, processus, secret, HBA, flag, lien de release ou enregistrement métier n'a été modifié.
- Aucun correctif produit n'est inclus : ce document prépare l'arbitrage d'une PR séparée.

## Verdict

**Gate go-live 100 % : ROUGE / non prouvé.**

La fonctionnalité #116 elle-même passe ses tests unitaires et ses deux tests real-db dédiés. En revanche, la suite globale n'est pas exploitable comme preuve zéro défaut : 246 tests échouent, 76 sont ignorés à l'exécution E2E, 14 ne sont pas exécutés et un test est flaky. Le script Python déclaré dans `package.json` échoue en collecte. Le dépôt contient en outre 51 quarantaines JavaScript inconditionnelles.

La production est restée inchangée pendant cet audit.

## 1. Preuve de la suite complète

### Résultats exacts

| Campagne | Suites/fichiers | Réussis | Échecs | Skips / non exécutés | Durée | Verdict |
|---|---:|---:|---:|---:|---:|---|
| Jest unitaires, sans filtre | 760 suites | 8 500 tests | 1 test | 0 | 207,585 s | Rouge |
| Jest intégration/real-db, sans filtre, timeout diagnostic 30 s | 32 suites | 193 tests | 7 tests | 0 | 119,323 s | Rouge |
| Jest DB/concurrence, sans filtre | 11 suites | 122 tests | 55 tests | 0 | 34,025 s | Rouge |
| Playwright E2E, config officielle, sans filtre | 83 fichiers / 563 cas | 289 tests | 183 tests | 76 skips, 14 non exécutés, 1 flaky | 29 min 53,150 s | Rouge |
| Pytest prérentrée déclaré par `package.json` | collecte interrompue | 0 | 5 erreurs de collecte | aucun test collecté | 2,61 s | Rouge |

Agrégat des quatre campagnes JavaScript : **803 suites Jest + 83 fichiers E2E, 9 441 cas déclarés, 9 104 réussites stables, 246 échecs, 1 flaky, 76 skips et 14 non exécutés**. Temps cumulé des exécutions finales : environ 35 min 57 s, hors provisionnement et build.

### Commandes de preuve

```text
npx jest --config jest.unit.config.js --runInBand --no-cache
npx jest --config jest.integration.config.js --runInBand --no-cache --testTimeout=30000
npx jest --config jest.config.db.js --runInBand --no-cache
npx playwright test --config playwright.config.e2e.ts --reporter=line
npm run pre-rentree:test:py
```

### Causes racines observées

| Gravité | Campagne | Cause | Emplacement / recommandation |
|---|---|---|---|
| P0 preuve | Unitaires | Le test attend encore l'ancien vocabulaire `real/mock/disabled`, alors que le contrat courant est `live/stub/off`. | `__tests__/config/env-validation.test.ts:140` — réaligner le test sur le contrat documenté, sans changer `LLM_MODE=off`. |
| P1 produit | Intégration | La transaction interactive d'une opération de cycle de vie expire à 5 s pendant l'inspection du graphe et du catalogue. Augmenter le timeout Jest ne change pas le timeout Prisma interne. | `__tests__/integration/pending-account-lifecycle.real.test.ts` et service associé — réduire le travail sous transaction ou borner explicitement la transaction après mesure. |
| P0 preuve | Intégration | Deux scénarios deviennent non déterministes dans l'agrégat partagé : atomicité de l'inscription parent et activation élève. | `__tests__/integration/parent-registration-atomicity.real.test.ts`, `__tests__/integration/activate-student.real.test.ts` — isoler les données/queues par test et remettre la base à zéro de façon fiable. |
| P0 preuve | DB | Fixtures non alignées sur le schéma : `seed` et `gradeLevel` obligatoires absents ; ancien index d'outbox attendu. | `__tests__/db/canonical-bilans-schema.test.ts`, `__tests__/database/schema.test.ts`, tests `transactions/` et `concurrency/` — générer les fixtures depuis une factory canonique. |
| P0 preuve | DB / E2E | Le seed appelle encore la colonne supprimée `pedagogical_contents.embedding`. | `__tests__/db/aria-pgvector.test.ts`, `prisma/seed.ts` — migrer le seed vers le stockage vectoriel courant. Cette erreur casse aussi l'entrée E2E officielle. |
| P0 preuve | E2E | Le bootstrap officiel ne produit pas sa population : le seed standalone ne résout pas l'alias TypeScript et le seed Prisma utilise la colonne supprimée. L'essai initial a ainsi lancé l'application sur une base à zéro utilisateur. | `scripts/seed-e2e-db.ts`, `prisma/seed.ts`, `docker-compose.e2e.yml` — fournir une seule commande hermétique qui migre, seed et vérifie les comptes par rôle avant Playwright. |
| P0 preuve | E2E | Multiples fixtures et hôtes historiques sont codés en dur ; de nombreux scénarios demandent des comptes absents ou des noms de bases incompatibles entre eux. | `e2e/helpers/auth.ts` et tests listés dans l'inventaire des skips — consommer uniquement le manifeste généré par le seed et un garde d'isolation commun. |
| P1 produit/test | E2E | Des attentes publiques ont divergé du produit : CTA, H1, contenu mobile, statut d'API 401/403. Certaines vérifications DOM sont instables sur des collections dynamiques. | `__tests__/e2e/homepage-audit.spec.ts`, `e2e/auth/navigation-public.contract.spec.ts`, `e2e/auth/pages-public-homepage-mobile.spec.ts`, `e2e/auth/public-front-go-live.spec.ts`, `e2e/auth/accessibility-basics.spec.ts` — arbitrer attente obsolète versus régression UI. |
| P1 preuve | Python | Cinq modules chargent à l'import un snapshot généré absent d'un checkout neuf. | `scripts/pre-rentree/tests/test_document_{assets,audit,renderer,templates}.py`, `test_visual_audit.py` — générer la fixture dans le setup ou versionner une fixture minimale. |

Le fichier de configuration Jest d'intégration agrège aussi plusieurs gardes de nom de base incompatibles. L'environnement doit actuellement satisfaire plusieurs marqueurs historiques à la fois, ce qui est une dette de banc de test et non une protection fiable.

### Preuve ciblée #116

- Tous les tests unitaires de `__tests__/bilans/` liés à la migration, au foyer, à la parité de score, à la provenance, au workflow et aux écrans sont passés dans la campagne sans filtre.
- `__tests__/integration/bilans-saisie-papier.real.test.ts` : **PASS**.
- `__tests__/integration/deferred-parent-email.real.test.ts` : **PASS**.
- Les 69 dossiers de migration ont une ligne appliquée sur le clone ; `prisma migrate status` répond « schema up to date ».
- Aucun changement de scoring, de provenance ou de règle append-only n'a été réalisé pendant l'audit.

Cette preuve ciblée est positive, mais ne compense pas le gate global rouge.

### Quality gates complémentaires

- Build standalone Node `22.23.1` depuis le SHA exact : **PASS** dans l'image E2E.
- `npm run lint` : **PASS**, avec 30 warnings candidat libre détaillés plus bas.
- `npx prisma generate && npm run typecheck` : **PASS**. La génération explicite est requise lorsqu'une image de dépendances est réutilisée, afin de ne pas typer le code avec un ancien client Prisma.
- `bash scripts/security/check-no-public-infrastructure.sh` : **PASS** après rédaction de ce rapport.
- `git diff --check` : **PASS**.
- `npm run check:no-hardcoded` : **FAIL** sur quatre occurrences non secrètes détaillées plus bas.

### Inventaire des skips, todo et only

Scan statique global : **60 marqueurs dans 35 fichiers** : 59 JavaScript/TypeScript et un `pytest.skip`. Il n'existe aucun `.only`, `todo`, `xit`, `xtest`, `xdescribe` ou `fixme` de test.

- 51 skips JavaScript sont inconditionnels : quarantaines de sélecteurs ou pages refondues, fixtures manquantes, hôtes codés en dur, fonctionnalités retirées/incomplètes ou flakiness.
- 8 skips JavaScript sont conditionnels à une fixture, un second compte, un état de stockage ou une autorisation de mutation.
- 1 skip Python est conditionnel à un fichier généré absent.
- Les 6 `describe.skip` développent plusieurs cas, d'où **76 cas ignorés** par Playwright.

Fichiers porteurs de skips :

```text
__tests__/e2e/bilan-pdf.e2e.spec.ts
__tests__/e2e/nexus-2-0-smoke.spec.ts
e2e/auth/admin-dashboard-audit.spec.ts
e2e/auth/auth-and-booking.spec.ts
e2e/auth/bilan-gratuit-flow.spec.ts
e2e/auth/bilan-pdf.e2e.spec.ts
e2e/auth/booking.credits.spec.ts
e2e/auth/eaf-report-raja-smoke.spec.ts
e2e/auth/eam-premiere-responsive-readonly.spec.ts
e2e/auth/eam-premiere-student.spec.ts
e2e/auth/eleve-dashboard-audit.spec.ts
e2e/auth/entitlements.gating.spec.ts
e2e/auth/forms-validation.contract.spec.ts
e2e/auth/navigation-public.contract.spec.ts
e2e/auth/nsi-pratique-2026.spec.ts
e2e/auth/parcours-eleve-stmg-premiere.spec.ts
e2e/auth/parent-dashboard-audit.spec.ts
e2e/auth/parent-dashboard.spec.ts
e2e/auth/password-reset.spec.ts
e2e/auth/payments.invoice.documents.spec.ts
e2e/auth/programme/maths-1ere-access.spec.ts
e2e/auth/programme/maths-1ere-premium.spec.ts
e2e/auth/programme/maths-1ere.spec.ts
e2e/auth/public-front-go-live.spec.ts
e2e/auth/security.advanced.spec.ts
e2e/auth/student-automatismes.spec.ts
e2e/auth/student-journey.spec.ts
e2e/auth/teacher-bilan-pdf.spec.ts
e2e/auth/test-all-pages.spec.ts
e2e/auth/test-bilan-banner.spec.ts
e2e/auth/test-dashboard-interactions.spec.ts
e2e/auth/test-real-login.spec.ts
e2e/candidate-diagnostic.spec.ts
e2e/real/coach-resource-student.spec.ts
scripts/pre-rentree/tests/test_level_dossiers.py
```

Les 51 quarantaines inconditionnelles sont injustifiées pour un gate « sans skip ». Les 9 conditions externes sont structurellement compréhensibles, mais doivent vivre dans des jobs explicitement provisionnés ; elles ne peuvent pas compter comme preuve du gate demandé.

## 2. Auth.js

### Production, lecture seule

- Les logs applicatifs conservés contiennent exactement deux événements `JWTSessionError`, chacun portant le motif « no matching decryption secret ».
- Aucun `CredentialsSignin` ni `CallbackRouteError` n'est présent dans la même fenêtre.
- Les deux événements coïncident exactement avec les deux requêtes de smoke volontairement envoyées par l'opérateur de déploiement avec des JWT invalides ; une requête immédiatement suivante, signée avec le secret actif, avait réussi, puis une fenêtre propre avait été observée.
- Les erreurs de déchiffrement ne contiennent pas d'identité utilisateur. L'attribution repose donc sur la corrélation temporelle exacte et le journal d'opération, pas sur une PII de log. Aucun autre événement ne permet d'attribuer une erreur à un utilisateur réel.

### Flux réel sur environnement vierge

Après migration et seed correct du clone, un Playwright ciblé a utilisé le vrai flux Auth.js (CSRF, callback Credentials, cookie de session, accès protégé) :

| Rôle | Résultat |
|---|---|
| ASSISTANTE | login réussi ; 9 pages protégées en HTTP 200 |
| PARENT | login réussi ; 4 pages protégées en HTTP 200 |
| ELEVE | login réussi ; 4 pages protégées en HTTP 200 |

Résultat : **3/3 tests, 17/17 pages, 0 redirection vers signin, 0 erreur 5xx, 0 marqueur Auth.js** dans la fenêtre neuve de 16,5 s.

Le premier lancement global E2E avait produit 467 marqueurs d'authentification parce que l'application pointait vers une base contenant zéro utilisateur. Après réparation du câblage du seul environnement jetable, les mêmes rôles passent sans erreur. Ce constat classe ces traces E2E comme défaut de seed, pas comme régression Auth.js.

## 3. Doublons, orphelins, code mort et hardcoding

### Doublons et divergences

| Gravité | Constat | Emplacements | Recommandation |
|---|---|---|---|
| P2 | La normalisation téléphone est bien centralisée ; aucun second chemin actif divergent trouvé. La migration contient seulement le backfill SQL ponctuel attendu. | `lib/contact/parent-phone.ts`, migration #116 | Conserver ce point d'entrée unique. |
| P2 | Le helper `scoringProvenance` est dupliqué à l'identique avec des commentaires légèrement différents. Les deux chemins rejoignent le worker canonique et la parité passe. | `lib/bilans/api/paper-entry.ts:117`, `lib/bilans/api/create-attempt.ts:82` | Extraire le helper sans modifier l'algorithme. |
| P1 | La normalisation e-mail canonique applique trim + NFC + minuscules, mais plusieurs chemins font seulement trim + minuscules. Une adresse Unicode peut donc diverger avant une contrainte unique. | Canonique : `lib/auth/parent-activation.ts:20`. Variantes : `app/api/assistante/students/route.ts:285`, `app/api/reservation/verify/route.ts:15`, `lib/email/outbox.ts:145`, `lib/diagnostics/candidat-libre/student-provisioning.server.ts:41`, `scripts/create-stmg-students.ts:43` | Créer un normaliseur générique de compte et migrer chaque consommateur après tests de collision Unicode. Ne pas toucher candidat libre dans cette PR d'audit. |
| P1 | Création initiale et ajout tardif du contact dupliquent token, activation, outbox et invalidation de session. | `lib/bilans/saisie-papier/famille.ts`, `lib/bilans/staff/parent-contact-service.ts` | Extraire une primitive transactionnelle d'activation après correction de l'orphelin ci-dessous. |
| P1 | Deux restitutions PDF Parent restent actives : chemin historique PDFKit et restitution canonique. Elles peuvent diverger sur visibilité, snapshot et rendu. | `app/api/parent/bilans/[id]/pdf/route.ts`, `lib/bilans/api/legacy-parent-pdf.ts`, `lib/pdf/bilan-parent-pdfkit.ts`, `app/api/parent/children/[studentId]/bilans/[attemptId]/report/route.ts`, `lib/bilans/api/parent-reports.ts` | Décider explicitement compatibilité ou dépréciation, puis ajouter un test de frontière commun. |

### Orphelins de données et de schéma

| Gravité | Constat | Preuve / recommandation |
|---|---|---|
| P1 | Le rattachement tardif à un parent existant déplace tous les élèves mais laisse le compte source sans e-mail et son `ParentProfile` sans enfant. | `lib/bilans/staff/parent-contact-service.ts:151-180`. Le test vérifie l'absence de nouveau parent, pas le devenir de la source. Définir une stratégie append-only de fusion/tombstone ; ne pas supprimer aveuglément. |
| P1 | Sept modèles Prisma n'ont aucun consommateur de production trouvé par l'analyse statique : `StudentReport`, `PedagogicalContent`, `StageDocument`, `ReportAudienceArtifact`, `NotificationOutbox`, `AssessmentSource`, `ReportFeedback`. | Lignes de modèles : `prisma/schema.prisma:566,667,1151,1671,1734,2528,2721`. Vérifier volumes, propriétaires fonctionnels et obligations de conservation avant tout retrait. |
| P2 | `EamProgress` et `InvoiceSequence` paraissaient orphelins via le client Prisma, mais sont consommés en SQL brut. | Ne pas supprimer ; enrichir l'outil d'analyse pour reconnaître les références SQL. |
| OK | Les 69 migrations sont présentes et appliquées sur le clone ; aucune migration orpheline détectée. | Garder `prisma migrate status` dans le gate clone. |

### Exports/fichiers sans référence entrante

Une analyse statique d'import sur 2 164 fichiers a trouvé 37 fichiers sans référence entrante, dont 3 tests et **34 candidats de production**. Ce sont des candidats, pas une autorisation de suppression : App Router, chargements dynamiques ou usages externes peuvent échapper au graphe.

```text
components/dashboard/StudentSelector.tsx
components/dashboard/coach/StudentDocuments.tsx
components/dashboard/coach/TrajectoryDesigner.tsx
components/dashboard/coach/student-report-form.tsx
components/dashboard/parent/children-list.tsx
components/dashboard/parent/score-chart.tsx
components/dashboard/parent/transaction-history.tsx
components/lamis/LamisTeacherApp.tsx
components/pdf/PdfInlinePreview.tsx
components/programme/livret-stmg/LivretStmg.tsx
components/stage-eam-stmg/MathInline.tsx
components/stages/PublicStageCard.tsx
components/stages/RequiredMaterials.tsx
components/stages/results/CompetenceRadar.tsx
components/stages/results/DetailedAnalysis.tsx
components/stages/results/ScoreHeader.tsx
components/ui/LanguageSwitcher.tsx
components/ui/ParticleSphere.tsx
components/ui/aria-comparison.tsx
components/ui/aria-embedded-chat.tsx
components/ui/aria-feedback.tsx
components/ui/back-to-top.tsx
components/ui/badge-widget.tsx
components/ui/button-enhanced.tsx
components/ui/credits-system.tsx
components/ui/dashboard-skeleton.tsx
components/ui/experts-showcase.tsx
components/ui/faq-section.tsx
components/ui/specialized-packs.tsx
components/ui/student-calendar-wrapper.tsx
lib/api-guard.ts
lib/rate-limit/presets.ts
lib/reports/stage/validateGeneratedReportJson.ts
lib/survival/reflexes.ts
```

Recommandation : confirmer chaque candidat par build, recherche des imports dynamiques, historique Git et propriétaire fonctionnel dans une PR dédiée ; aucune suppression en lot.

### Code mort et warnings

| Gravité | Constat | Emplacement / recommandation |
|---|---|---|
| P2 | Le gating NSI est court-circuité en permanence par une constante `false`; les branches d'entitlement sont inatteignables. | `lib/nsi-pratique-2026/gating.ts:10,48,67` — décision produit séparée, sans toucher #108. |
| P2 | La troisième valeur de fallback du chemin document est inatteignable après le garde qui exige déjà `url` ou `localPath`. | `app/api/assistante/students/[studentId]/documents/route.ts:141` — supprimer seulement après test de compatibilité des anciennes métadonnées. |
| P2 | Plusieurs variables de `.env.example` ne sont jamais lues par l'application : ancien bloc embeddings/RAG, URL de service PDF, anciens seuils de rate limit, anciens flags E2E. | `.env.example:81-91,120,162-163` — documenter le propriétaire ou retirer dans une PR de configuration. |
| P2 | Lint passe mais retourne **30 warnings**, pas 29 : 25 `no-explicit-any`, 2 imports inutilisés, 2 expressions inutilisées et 1 dépendance de hook manquante. Tous sont dans candidat libre. | Imports : `components/diagnostics/candidat-libre/ModuleRunner.tsx:3`, `UploadPanel.tsx:4`. Les 30 sont hors périmètre de correction demandé ; établir le baseline historique avant de qualifier lequel est nouveau. |

### Hardcoding et secrets

| Gravité | Constat | Emplacement / recommandation |
|---|---|---|
| P1 | `npm run check:no-hardcoded` échoue : deux occurrences d'e-mail public, une raison sociale et un numéro public servant de placeholder. Ce ne sont pas des secrets, mais ils contournent les sources de vérité. | `lib/diagnostics/candidat-libre/privacy-notice.ts:49,95`, `app/dashboard/assistante/bilans/saisie-papier/family-form.tsx:144` — remplacer par constantes/config après arbitrage candidat libre. |
| P1 | Une URL de service interne complète et obsolète est présente dans l'exemple d'environnement, alors que le runtime ne la lit pas. | `.env.example:120` — retirer la valeur concrète ou documenter un placeholder neutre. |
| P2 | Le script documentaire écrit dans le stockage courant, utilise une origine locale codée en dur et ne nettoie ni fichier ni ligne DB. | `scripts/test-document-flow.ts:10,23-43` — utiliser `mktemp`, une base explicitement jetable et un `finally` de nettoyage. |
| P1 | Les factures et documents ont deux racines par défaut distinctes. | `lib/invoice/storage.ts:12`, `lib/documents/storage-root.ts` — une seule racine configurée avec sous-répertoires typés. |
| P1 sécurité opérationnelle | Les métadonnées de deux conteneurs PostgreSQL de production conservent un `POSTGRES_PASSWORD` bootstrap lisible par un administrateur Docker local. Aucune valeur n'a été lue ni rapportée. | Lors d'une maintenance dédiée : valider le volume, recréer les conteneurs avec un secret fichier, puis vérifier que la variable n'est plus dans `Config.Env`. Ne pas agir pendant ce chantier applicatif. |
| OK avec dette | Le scan de sécurité officiel du dépôt passe. Le scan générique de secrets produit 20 détections synthétiques (fixtures, clés d'idempotence et exemples CI) ; la revue n'a trouvé aucun secret de production versionné. | Classer/annoter les fixtures dans l'outil sans affaiblir le scan officiel. |

## 4. Les 19 fichiers hors racine storage

### Inventaire exact et impact

La racine documentaire canonique courante contient **0 fichier / 0 octet**. Un ancien emplacement contient exactement **19 fichiers / 11 499 octets**, tous copiés au même instant lors d'une opération antérieure :

| Identifiants d'audit | Nombre | Taille unitaire | Nature | Lien DB actuel | Origine probable |
|---|---:|---:|---|---|---|
| F01–F04 | 4 | 40 octets | Noms opaques, extension PDF, contenu texte de test identique ; PDF invalide | Aucun | `scripts/test-document-flow.ts:20-40` |
| F05–F18 | 14 | 593 octets | PDF valide d'une page, forme exacte du générateur minimal de secours | Aucun | `app/api/payments/validate/route.ts` via `lib/invoice/storage.ts` ; anciens scripts de paiement |
| F19 | 1 | 3 037 octets | PDF valide d'une page, marqué explicitement TEST | Aucun | Script de validation de virement/facture |

Contrôles croisés en lecture seule :

- Aucun des 19 chemins ou noms de base ne correspond aux `UserDocument` ou aux `Invoice.pdfPath` actuels.
- Les 13 `UserDocument` présents sont déjà des tombstones : `unavailableReason` renseigné pour tous, chemins relatifs indisponibles, aucune correspondance de nom.
- Les 5 factures présentes sont 4 `CANCELLED` et 1 `DRAFT`; leur `pdfPath` est nul et aucun numéro/client ne correspond aux 15 fichiers de type facture.
- Les 14 petits PDF correspondent octet/structure au fallback `buildMinimalPdfBuffer`; les quatre faux PDF correspondent au littéral de `scripts/test-document-flow.ts`.

Impact réel : aucun appel applicatif courant ni lien DB n'a été trouvé. Ces fichiers sont des artefacts historiques de tests, mais les noms de 15 fichiers ressemblent à des pièces comptables ; cela impose une validation comptable avant suppression.

### Traitement proposé — aucune action exécutée

1. **F01–F04 : supprimer après validation technique** ; leur contenu est une fixture explicite et invalide comme PDF.
2. **F05–F19 : revue comptable** sur manifeste de hash et métadonnées minimales. Si la comptabilité confirme qu'il s'agit de tests, déplacer d'abord en quarantaine à accès restreint avec manifeste, puis supprimer selon la politique de conservation.
3. **13 tombstones DB : conserver** tant que la politique append-only et l'historique d'audit n'ont pas défini leur purge.
4. Corriger séparément les scripts pour écrire dans un répertoire temporaire et toujours nettoyer ; unifier les racines document/facture.

## Décisions requises avant correction

1. Autoriser une PR « test infrastructure » prioritaire : seed E2E canonique, fixtures DB, guards d'isolation communs, suppression/réactivation des quarantaines obsolètes.
2. Arbitrer la stratégie append-only du parent source après rattachement à un parent existant : tombstone/alias de fusion recommandé, jamais suppression implicite.
3. Décider du maintien du PDF Parent historique et des sept modèles Prisma sans consommateur trouvé.
4. Obtenir l'avis comptable sur F05–F19 avant toute manipulation.
5. Planifier séparément le nettoyage des métadonnées bootstrap Docker ; aucun changement de secret ou d'infrastructure dans une PR applicative.

## Rollback

Audit et documentation uniquement. Aucun rollback de production n'est nécessaire. Le clone et tous les services de test sont jetables et doivent être détruits après conservation des seuls totaux non sensibles.
