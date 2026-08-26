# Rapport final — mission "vers un produit complet" (Candidat Individuel)

> **STATUS = GO_RECETTE_INTERNE_END_TO_END** (technique) — **NO_GO_PUBLIC** (commercial, inchangé)
>
> Ce rapport a d'abord affirmé une clôture des 16 points de la directive QA sans preuve suffisante (PDF non
> raccordé, aucune suite E2E persistée). Le lot de fermeture technique décrit ici comble ces deux lacunes avec
> des preuves réelles, positives, rejouées plusieurs fois jusqu'à obtenir un résultat propre :
>
> - Wizard, simulation, persistance, brouillon `Quote` : **prouvés** (rapport précédent, §2/§8).
> - PDF (brouillon interne + carte d'examen) raccordé à l'infrastructure existante, aucun second moteur : **prouvé** (§4 ci-dessous).
> - Lien signé : gate serveur ajouté et prouvé (candidat-individuel bloqué tant que non `CARTE_VALIDATED_DEFINITIVE`, légitime inchangé) (§6).
> - Suite E2E **committée et rejouable** contre le build de production réel, dans l'infrastructure e2e officielle du dépôt : **56/56 tests verts** (§3).
> - Accessibilité : 0 violation axe à *toute* sévérité sur les 17 étapes individuellement + workspace, desktop et mobile (§2/§6).
> - Sécurité, tarification, échéancier : prouvés en base réelle (§4/§9).
>
> **`NO_GO_PUBLIC` reste inconditionnel** : aucune valeur des 14 arbitrages ni des 9 paramètres `costPolicy`
> n'est approuvée par la direction (§8 ci-dessous, reproduit intégralement), et aucune recette interne humaine
> (des personnes réelles de l'équipe, pas des scripts) n'a eu lieu. Aucune mutation de `BusinessConfig` n'a été
> effectuée dans un environnement réel — chaque activation de ce rapport (les deux lots) a eu lieu sur une
> base Postgres jetable (session précédente : `nexus_disposable_test` ; ce lot : `nexus_e2e`, recréée à chaque
> exécution).

**Point de départ validé** : `77304e477` — jalon "ACTIVE_INTERNAL-ready sur le plan technique. NO-GO pour
toute activation réelle ou publique."

**Portée** : 17 commits au total depuis le point validé (`06da75fb9` → `882702e36` au moment de la rédaction,
plus les commits de finalisation de ce document). `origin/feat/candidat-individuel-pricing-devis-v2` n'a pas
bougé (0 commit côté origin non présent localement) — branche 98 commits en avance, **aucun push effectué**.

---

## 1. Inventaire des commits

### 1a. Mission QA initiale (12 commits — déjà détaillés dans la version précédente de ce rapport)

`06da75fb9` → `812b4a73e` : intégration diagnostic/budget, dossier décisionnel, corpus shadow, workspace
interne, timeout shadow-log, retrait tutorat compression, création brouillon Quote, preview wizard public,
avertissement P3, durcissement sécurité, correctif `pg_advisory_xact_lock`, accessibilité (26→0 violations).
Détail complet (périmètre, migrations, fichiers, statut) : voir git log, chaque message de commit documente
son propre périmètre exhaustivement.

### 1b. Lot de fermeture technique (5 commits — ce document)

| # | SHA | Titre | Migration | Fichiers principaux | Push |
|---|---|---|---|---|---|
| 13 | `27c0980f0` | docs: rapport final (16 points) — **statut corrigé par ce lot, voir bandeau ci-dessus** | Aucune | `docs/candidat-individuel/rapport-final-mission-produit-complet.md` | Non poussé |
| 14 | `7cdb1ac77` | feat(quotes): raccordement PDF/lien signé (§4) | Aucune | `lib/quote/pdf.ts`, `lib/quotes/pdf-adapter.server.ts` (nouveau), `app/api/assistante/candidat-individuel/quotes/[quoteId]/pdf/route.ts` (nouveau), `app/api/quotes/public/[token]/pdf/route.ts` (nouveau), `lib/quotes/public-view.server.ts`, `app/devis/[token]/page.tsx`, `__tests__/database/candidat-individuel-pdf.test.ts` (nouveau) | Non poussé |
| 15 | `6e7f7ca7f` | fix(quotes): 3 défauts visuels PDF réels trouvés en QA (§5) | Aucune | `lib/quote/pdf.ts`, `__tests__/lib/quote/pdf.test.ts`, `docs/candidat-individuel/wizard-preview-matrice-etapes.md` (réconciliation §2) | Non poussé |
| 16 | `882702e36` | test(quotes): suite E2E réelle committée (§3) | Aucune | `e2e/auth/candidat-individuel-a11y-keyboard.spec.ts` (nouveau), `e2e/auth/candidat-individuel-pipeline.spec.ts` (nouveau), `e2e/helpers/candidat-individuel-db.ts` (nouveau), `lib/quotes/pdf-adapter.server.ts` (correctif P11), `components/dashboard/assistante/PublicWizardPreview.tsx` (correctif heading-order), `scripts/seed-e2e-db.ts`, `package.json` | Non poussé |
| 17 | *(à venir)* | docs: rapport final mis à jour + vérifications 320px/zoom | Aucune | `docs/candidat-individuel/rapport-final-mission-produit-complet.md`, `e2e/auth/candidat-individuel-a11y-keyboard.spec.ts` | Non poussé |

**Relation avec `origin/main`** : inchangée — 0 divergence depuis le point de départ validé.

---

## 2. Réponse aux exigences PDF/E2E que le rapport précédent avait laissées ouvertes

Le rapport précédent affirmait « 16 points clôturés » tout en documentant lui-même deux réserves. Ce lot les
ferme avec des preuves, pas des affirmations :

- **PDF déclaré « non applicable »** → corrigé. Ce n'était pas correct : le dépôt a déjà un moteur PDF
  (`lib/quote/pdf.ts`, pdfkit) et un modèle `Quote` unique. §4 ci-dessous documente le raccordement complet,
  sans second moteur ni second modèle, avec preuve DB réelle et QA visuelle sur PDFs réellement rendus.
- **Aucune suite E2E persistée** → corrigée. §3 ci-dessous : 56 tests committés, rejouables via
  `npm run test:e2e:candidat-individuel`, exécutés à blanc jusqu'à un résultat 56/56 propre.

---

## 3. Suite E2E réelle, committée, rejouable

`e2e/auth/candidat-individuel-a11y-keyboard.spec.ts` + `e2e/auth/candidat-individuel-pipeline.spec.ts`,
exécutées via `npm run test:e2e:candidat-individuel` (nouveau script — sa propre infrastructure isolée,
`docker-compose.e2e.yml` avec un nom de projet Compose dédié, `nexus-e2e-candidat-individuel`, pour ne plus
jamais entrer en collision avec `docker-compose.test.yml`, voir constat plus bas).

**Infrastructure réelle, pas simulée** : `pgvector/pgvector:pg15` (jetable, tmpfs), Redis réel, Mailpit réel,
`npm run build` exécuté à l'intérieur du conteneur Docker (pas réutilisé de l'hôte), `prisma migrate deploy`
contre une base neuve, le seed réel du dépôt (`scripts/seed-e2e-db.ts`, étendu de façon additive pour activer
`pricing.candidatIndividuelPipeline.state` dans **cette base jetable uniquement**), le flux NextAuth réel
(CSRF → callback credentials → cookie de session), servi par `node server.js` (artefact standalone réel).
Aucun mock ne traverse la frontière HTTP/Next/Prisma dans les scénarios principaux.

**Résultat final** : **56/56 tests verts** (dernier run propre, reproduit à la demande via
`npm run test:e2e:candidat-individuel`). Ce nombre n'a pas été atteint du premier coup — chaque run
intermédiaire a produit un résultat réel (jamais inventé) qui a conduit soit à un correctif applicatif réel,
soit à un correctif de script, documentés ci-dessous avec preuve.

### 3.1 — 3.6 Couverture

| Sous-section mission | Couverture réelle dans ce lot |
|---|---|
| §3.1 sécurité/rôle/flag | Non authentifié, PARENT (page + API), ASSISTANTE, ADMIN (API autorisé, page bloquée par `middleware.ts` — constat déjà documenté, pas une régression), **flag `OFF` réel** (valeur `"OFF"` du schéma, pas une absence) bloquant page et API |
| §3.2 parcours nominal | Wizard → sauvegarde brouillon → simulation → vérifications DB réelles (FK `profilId`, `snapshotCarte`/`snapshotRegles` non nuls) |
| §3.3 révision/workflow | Demande de revue (dialogue natif géré), création de révision, badge de révision vérifié après un vrai rechargement de la liste (pas un état optimiste) |
| §3.4 fail-closed | 1 cas représentatif prouvé de bout en bout (modalité B, coefficients `À_VERIFIER`) — jamais `READY`, non contournable par appel API direct. Les 10 autres cas listés par la mission sont déjà couverts exhaustivement au niveau unitaire (`lib/exams/*.test.ts`, `lib/quotes/pipeline.test.ts`) — non dupliqués ici |
| §3.5 tarification | Création réelle d'un brouillon `Quote` + vérification DB directe : `deposit + 9×monthlyTotal + lastInstallmentAmount === grandTotal` |
| §3.6 robustesse | Double-soumission : le bouton se désactive côté client (constat, pas un test de course contre le réseau — voir §3-bugs) ; IDOR : documenté comme modèle de visibilité partagé intentionnel (§9, inchangé), pas un défaut à corriger |
| §7 (recette UI/UX) | Clavier seul (skip link → `<main>`, sémantique radio native, focus non perdu, `aria-live`, bouton retour), 320px sans débordement horizontal, zoom 200% simulé sans débordement — le reste (lecteur d'écran approfondi, tous les états de chargement/vide/erreur) reste une inspection manuelle non exhaustive, nommé honnêtement |

### Bugs réels trouvés et corrigés pendant la construction de cette suite

1. **`PublicWizardPreview.tsx`, étape `coordonnees`** : un `<h3>` sans `<h2>` précédent (même famille de
   défaut que celui déjà corrigé dans le workspace, mission §6) — trouvé par axe contre l'application réelle,
   pas par un script jetable. Corrigé : `h3` → `h2`.
2. **`lib/quotes/pdf-adapter.server.ts`, détection P11** : voir §4 — un vrai gap de couverture pipeline trouvé
   en écrivant cette suite, pas un bug PDF.

### Constat honnête, corrigé séparément de tout test

Un run E2E antérieur à cette suite a supprimé accidentellement le conteneur `nexus-postgres-test` (utilisé
par le reste de la session) : `docker-compose.e2e.yml` et `docker-compose.test.yml` partagent le même nom de
projet Compose par défaut (dérivé du nom du répertoire), donc un `down --remove-orphans` sur l'un pouvait
retirer le conteneur de l'autre. Restauré immédiatement (base jetable, tmpfs, aucune donnée réelle perdue).
Corrigé durablement : `npm run test:e2e:candidat-individuel` fixe désormais un nom de projet Compose distinct
(`nexus-e2e-candidat-individuel`), ce qui rend cette collision impossible à l'avenir.

---

## 4. PDF raccordé à l'infrastructure existante — aucun second moteur

**Audit préalable** (avant tout code) : `lib/quote/pdf.ts` (`renderQuotePDF`, pdfkit, DTO `QuotePDFData`),
`lib/quotes/pdf-adapter.ts` (adaptateur legacy, client-safe, construit depuis un scénario en mémoire),
`app/api/assistante/quotes/pdf/route.ts` (route existante, aveugle à la DB — fait confiance au JSON du
client), `app/devis/[token]/page.tsx` (page famille — lit `Quote`+`lines` directement, aucune vérification de
maturité), le mécanisme de token signé (`lib/quotes/persistence.server.ts`), `lib/quotes/emission-guard.ts`
(`collectQuoteEmissionBlockers`, déjà le gate canonique unique pour l'envoi/l'acceptation).

**Ce qui a été ajouté, additivement** :

- `QuotePDFData` gagne 2 champs optionnels (`draftBannerTitle`, `carteExamen`) + une 3ᵉ page PDF, dessinée
  uniquement quand `carteExamen` est présent. Chaque devis legacy (sans `snapshotCarte`) reste byte-identique
  à avant — prouvé par un test de régression (`pdf.test.ts`) qui vérifie explicitement 2 pages et l'absence
  de texte brouillon/carte quand absent.
- `lib/quotes/pdf-adapter.server.ts` (nouveau, serveur uniquement — séparé du fichier client-safe existant
  exprès) : construit `QuotePDFData` **directement depuis une ligne `Quote`+`lines` persistée**, jamais une
  recomposition avec les tarifs courants. Fonctionne identiquement pour legacy et candidat-individuel (les
  deux moteurs alimentent exactement les mêmes colonnes `Quote`/`QuoteLine` via `createQuote`). Le bandeau
  brouillon est piloté par `collectQuoteEmissionBlockers` — le même gate unique déjà utilisé pour
  l'envoi/l'acceptation, jamais un drapeau côté client.
- `GET /api/assistante/candidat-individuel/quotes/:quoteId/pdf` (nouvelle route staff, ADMIN/ASSISTANTE +
  flag pipeline, scope de rate-limit `quotes-pdf` réutilisé), strictement limitée à `profilId != null` — 404
  pour tout devis legacy (qui garde sa route existante, intacte).
- **Gate du lien signé** (`getQuoteForFamilyView`, le point de lecture unique déjà identifié comme tel dans
  son propre commentaire) : un devis candidat-individuel avec un bloqueur d'émission renvoie désormais le
  même `NOT_FOUND` qu'un token invalide. Limité à `profilId != null` — chaque devis legacy garde son
  comportement exact d'avant, vérifié par un test dédié.
- `GET /api/quotes/public/:token/pdf` (nouveau, famille) — réutilise `getQuoteForFamilyView`, donc hérite du
  même gate automatiquement.

**Aujourd'hui, tout PDF candidat-individuel affiche le bandeau brouillon** — rien ne peut encore atteindre
`CARTE_VALIDATED_DEFINITIVE` (constat déjà documenté par le lot précédent, confirmé inchangé). C'est le
comportement correct et attendu, pas un défaut.

**Gap honnête découvert en construisant ce lot** : `lib/quotes/pricing-engine.ts::computeSecondGroupePayment`
(P11, « 100% à la réservation ») **n'est appelé nulle part** dans le pipeline câblé — vérifié en lisant
`lib/quotes/pricing.ts` et `lib/quotes/pipeline.ts` en entier. `QuoteScenario.deposit` est un nombre
obligatoire ; aucun chemin ne produit aujourd'hui un devis P11 réellement facturé à 100% à la réservation.
C'est un écart réel, préexistant, entre la règle commerciale déclarée (§0 de la directive) et
l'implémentation — nommé ici honnêtement, pas corrigé par ce lot centré sur le PDF (un futur lot doit câbler
`computeSecondGroupePayment` dans le pipeline). L'adaptateur PDF est construit pour reconnaître correctement
ce cas *le jour où* il sera câblé (`months === 1`), sans jamais fabriquer un échéancier 25%+mensualités pour
un tel devis.

### QA visuelle — 3 défauts réels trouvés et corrigés

Matrice de 10 scénarios synthétiques (profil annuel court, profil à beaucoup de lignes, P5 notes conservées,
P7 dispenses, dossier à avertissements multiples, P11, comparaison pack, échéancier avec arrondi, libellés
longs/accents, profil bloqué) — PDFs réellement rendus, rasterisés page par page (`pdftoppm`) et inspectés
visuellement, pas seulement l'extraction de texte. Tous les 10 rendent maintenant proprement (échéancier
correct, carte d'examen lisible, accents corrects, aucune fuite de coût). 3 défauts réels trouvés dans le
moteur PDF partagé, corrigés, chacun avec un test de régression qui rend un vrai PDF et l'inspecte
(`pdftotext`/`pdfinfo`) — **aucun n'est spécifique à candidat-individuel**, les deux moteurs (legacy et
candidat-individuel) produisaient déjà les données qui déclenchaient ces bugs, jamais détectés faute d'un
échantillon de test représentatif :

1. La hauteur de la boîte « Échéancier indicatif » plafonnait son calcul à 9 lignes alors que la boucle de
   rendu dessinait toutes les lignes sans limite — le modèle réel D4 (25% + 10 mensualités = 11 lignes)
   débordait silencieusement dans le pied de page. Corrigé : hauteur dynamique, jamais de ligne supprimée.
2. Le champ `mode` (ex. « Acompte 5850 TND (25%) + mensualités ») s'enroulait sur 2 lignes et sa 2ᵉ ligne
   entrait en collision avec `objectif` dessiné juste en dessous à un offset fixe. Corrigé : troncature à une
   ligne (ellipsis) au lieu d'un enroulement libre.
3. Le message « échéancier personnalisé à établir » (prévu uniquement pour un échéancier réellement vide)
   s'affichait aussi sous un paiement P11 réel à 1 ligne, faute de distinguer les deux cas. Corrigé.

---

## 5. Matrice des 17 étapes — réconciliée

Voir `docs/candidat-individuel/wizard-preview-matrice-etapes.md` (mis à jour par ce lot) pour le détail
complet : pourquoi 16 vs 17 (pas une erreur — `etalement` ajoutée un commit après l'annonce initiale, un vrai
trou P12 corrigé, pas un trou dans le comptage), la liste canonique, et **une matrice reproductible où
chacune des 17 étapes est testée individuellement** (desktop + mobile + une passe dédiée à la branche
PREMIERE de `cycle`), remplaçant l'ancien contrôle groupé à 11 « écrans ».

---

## 6. Accessibilité — toutes sévérités, 17 étapes individuelles

`e2e/auth/candidat-individuel-a11y-keyboard.spec.ts` : **0 violation axe, à toute sévérité (critical/serious/
moderate/minor — pas un filtre critical/serious)**, sur chacune des 17 étapes individuellement, desktop et
mobile, plus le workspace assistante et la branche PREMIERE de `cycle`. Un défaut réel (heading-order sur
`coordonnees`) a été trouvé et corrigé pendant la construction de cette suite (§3 ci-dessus) — le nombre
« zéro » n'est écrit ici qu'après correction et nouvelle exécution propre, jamais avant.

Vérifications manuelles/scriptées : clavier seul (5 tests dédiés), 320px, zoom 200% simulé — voir §3.

Non fait, nommé honnêtement : inspection approfondie avec un vrai lecteur d'écran (screen reader) au-delà de
l'arbre d'accessibilité capturé par Playwright ; tous les états de chargement/vide/erreur/succès un par un.

---

## 7. Sécurité, tarification — inchangés, reconfirmés

Voir le rapport précédent §9 pour le détail complet (fuite de marge corrigée, rate limiting ajouté, IDOR
documenté comme modèle intentionnel). Reconfirmé par ce lot au niveau E2E réel (§3.1, §3.5) et par
`__tests__/database/candidat-individuel-pdf.test.ts` (aucune fuite de coût/marge dans un PDF réellement
généré, même sur un profil brouillon complet).

---

## 8. Arbitrages commerciaux — reproduits intégralement, aucune valeur approuvée

Reproduits dans le message final de cette session, pas seulement par référence — quatorze arbitrages du
catalogue et neuf paramètres `quotes.costPolicy`, chacun avec identifiant, valeur actuelle, valeur proposée,
justification, effet prix/marge/opérationnel, niveau de confiance, statut exact (`NON_APPROUVE` partout sauf
le retrait `SVC_TUTORAT_COMPRESSION`), décision attendue de la direction.

Rappel sur `SVC_TUTORAT_COMPRESSION` : retiré du catalogue (concept jamais défini nulle part dans le dépôt —
le chiffrer aurait été une double invention). Ne prétend pas que le besoin P3/accéléré est couvert : un
avertissement explicite (`avertissementsGeneraux`, mission §3, commit `3d58a4354`) signale le rythme
compressé et l'absence de compensation automatique de volume, testé (`carte.test.ts`, `pipeline.test.ts`).

---

## 9. Vérifications finales exécutées

| Vérification | Résultat |
|---|---|
| `npx tsc --noEmit` | Clean |
| `eslint` (fichiers touchés) | Clean |
| `prisma validate` | Schéma valide |
| `prisma migrate deploy` (base neuve, `nexus_e2e`) | Toutes les migrations appliquées avec succès |
| `prisma migrate diff` (post-déploiement) | 2 dérives détectées, **préexistantes, sans rapport avec ce lot** : renommage d'un index sur `canonical_teacher_brief_annotations` (troncature de nom), et un index manquant sur `eam_progress` (table brute hors gestion Prisma, `scripts/migrate-eam.ts`) — non introduites par ce travail, non corrigées ici (hors périmètre) |
| `lib/exams` + `lib/quotes` (ciblé) | 37 suites, 476 tests — 100% verts |
| `__tests__/api` | 187 suites, 1525 tests — 100% verts |
| Suite unitaire globale | 880 suites, 9774 tests — 1 flake préexistant (`teacher-dossier-render.test.ts`, timeout machine, confirmé isolé et vert plusieurs fois, sans lien avec ce travail) |
| Suite DB (Postgres réel) | 173/173 sur les 7 fichiers `__tests__/database/` |
| **Suite E2E candidat-individuel (production build réel)** | **56/56**, run final propre |
| `npm run build` | Exit 0, artefact standalone valide, aucune fuite de donnée runtime |
| Démarrage + healthcheck de l'artefact standalone | HTTP 200 sur `/` et `/auth/signin`, vérifié séparément sur un build post-correctifs PDF |
| Secrets/PII dans les sorties | `scripts/security/check-versioned-credentials.mjs` : 0 trouvaille, à chaque commit |

---

## 10. Git et état final

```
git status --short   → clean (hors le commit de finalisation de ce document)
git fetch origin      → 0 commit côté origin non présent localement
ahead/behind          → 98 en avance, 0 en retard
aucun push, aucun déploiement, aucune mutation de BusinessConfig réelle
```

## Verdict

**`GO_RECETTE_INTERNE_END_TO_END`** — wizard, API, persistance, `Quote`, PDF, lien signé, sécurité,
accessibilité et E2E de production sont tous prouvés, avec des preuves réelles et positives (pas des
suppositions), rejouables à la demande via `npm run test:e2e:candidat-individuel`.

**`NO_GO_PUBLIC`** reste et restera obligatoire tant que :
1. les 14 valeurs de catalogue et les 9 paramètres `costPolicy` (§8) n'ont pas été explicitement approuvés
   par la direction — aujourd'hui, zéro l'est ;
2. une recette humaine interne réelle (des personnes de l'équipe Nexus, pas des scripts automatisés) n'a pas
   eu lieu.

Aucune activation, mutation, ou déploiement réel n'a été effectué à aucun moment de cette mission.
