# Rapport final — mission "vers un produit complet" (Candidat Individuel)

**Point de départ validé** : `77304e477` — *"fix(exams): close both regulatory debts — reconduction audit
trail + P3 states (ADR CLOSED)"*, jalon explicitement validé par la direction avec le verdict *"ACTIVE_INTERNAL-ready
sur le plan technique. NO-GO pour toute activation réelle ou publique. Aucune modification de BusinessConfig
ne doit encore être effectuée dans un environnement réel."*

**Portée de ce rapport** : les 12 commits produits en réponse à la directive en 16 points ci-dessous
(`06da75fb9` → `812b4a73e`). `origin/feat/candidat-individuel-pricing-devis-v2` n'a pas bougé pendant ce
travail (0 commit côté origin non présent localement) — la branche est 93 commits en avance sur origin,
**aucun push effectué**.

---

## 1. Inventaire exact des commits

| # | SHA | Titre | Périmètre | Migration | Fichiers principaux | Push |
|---|---|---|---|---|---|---|
| 1 | `06da75fb9` | feat(quotes): integrate diagnostic + budget into the pipeline (§1/§2) | Le pipeline carte-aware intègre enfin le diagnostic et le budget — jamais un second optimiseur, un seul point d'entrée | Aucune | `lib/quotes/pipeline.ts`, `lib/quotes/shadow-comparison.ts`, `lib/config/schemas.ts`, tests pipeline/config | Non poussé |
| 2 | `d68644512` | docs(quotes): decisional dossier 14 éléments + calibration V1 (§7/§9) | Dossier décisionnel étendu, namespace `quotes.costPolicy` enregistré | Aucune | `docs/candidat-individuel/dossier-decisionnel-14-elements.md`, `proposition-calibration-couts-v1.md`, `lib/config/schemas.ts` | Non poussé |
| 3 | `1495eef65` | test(quotes): synthetic shadow corpus, 29 profils (§10) | Corpus shadow synthétique, chemin réel + faille honnête trouvée | Aucune | `__tests__/lib/quotes/shadow-corpus.synthetic.test.ts`, `docs/.../shadow-corpus-synthetique-resultats.md` | Non poussé |
| 4 | `c4fed4fc9` | feat(quotes): internal assistante workspace (§5) | Surface interne assistante : recherche, création profil, simulation, revue | **Oui** — `20260826110000_add_profil_candidat_review_revision` (colonnes review/révision sur `ProfilCandidat`) | `lib/quotes/profil-candidat.server.ts`, `app/api/assistante/candidat-individuel/**`, `CandidatIndividuelWorkspace.tsx`, `prisma/schema.prisma` | Non poussé |
| 5 | `7b7f55856` | fix(quotes): shadow-log timeout + documentation (§4) | Le raccordement shadow-mode réel ne peut plus bloquer une requête | Aucune | `lib/quotes/shadow-persistence.server.ts`, `app/api/quotes/route.ts` | Non poussé |
| 6 | `94695d6db` | docs(quotes): dossier 14 éléments v2 + retrait SVC_TUTORAT_COMPRESSION (§1/§2) | Retrait argumenté d'un concept jamais défini dans le dépôt | Aucune | `data/pricing.canonical.json`, `docs/.../dossier-decisionnel-14-elements.md`, `resolution-tutorat-compression.md` | Non poussé |
| 7 | `dc3e1d66d` | feat(quotes): create draft Quote from validated simulation (§4) | `POST .../profils/:id/quote` — brouillon réel, jamais émissible | Aucune (colonnes additives déjà existantes réutilisées) | `app/api/assistante/candidat-individuel/profils/[id]/quote/route.ts`, `lib/quotes/persistence.server.ts` | Non poussé |
| 8 | `e940fc931` | feat(quotes): preview du futur wizard public (§6/§7) | Prévisualisation staff-only du futur parcours public carte-aware | Aucune | `app/dashboard/assistante/candidat-individuel/wizard-preview/`, `components/dashboard/assistante/PublicWizardPreview.tsx` | Non poussé |
| 9 | `3d58a4354` | fix(exams): P3 compressed-pace honesty warning (§3) | Avertissement explicite — retrait du tutorat ≠ besoin couvert | Aucune | `lib/exams/carte.ts`, tests carte/pipeline | Non poussé |
| 10 | `afea675ff` | fix(quotes): security hardening + wizard step-matrix gaps (§5/§9) | Fuite marge corrigée, rate limiting ajouté, 2 trous de wizard corrigés (étalement, session) | Aucune | routes `simulate`/`quote`, `lib/rate-limit/sensitive.ts`, `PublicWizardPreview.tsx` | Non poussé |
| 11 | `e3353632c` | fix(admin): pg_advisory_xact_lock deserialization crash (§2) | **Bug critique réel** : toute écriture BusinessConfig retournait 500 | Aucune | `app/api/admin/config/route.ts`, `app/api/admin/config/rollback/route.ts` | Non poussé |
| 12 | `812b4a73e` | fix(a11y): zero axe critical/serious violations (§6) | 26 violations axe → 0, sur le build de production réel | Aucune | `PublicWizardPreview.tsx`, `CandidatIndividuelWorkspace.tsx`, `Navbar.tsx`, `app/dashboard/layout.tsx` | Non poussé |

**Relation avec `origin/main`** : `origin/main` n'a pas divergé depuis le point de départ validé — aucun
risque de conflit de merge à ce stade. Ces 12 commits restent locaux, non poussés, comme pour tout le reste
de la branche.

---

## 2. Résolution de l'échec API — preuve positive sur le build de production

**Verdict corrigé (commit `e3353632c`)** : l'échec initial n'était **pas** un artefact de `next dev`. C'était
un bug réel, reproductible identiquement sous `next dev` **et** sous un vrai `next start` : `pg_advisory_xact_lock`
retourne `void`, et `$queryRawUnsafe` échoue à désérialiser cette valeur avec cette version de Prisma (6.19.3)
contre ce Postgres (`Failed to deserialize column of type 'void'`, P2010). **Toute écriture** vers
`PATCH /api/admin/config` — pour n'importe quel namespace, pas seulement candidat-individuel — retournait 500
depuis le début. Fix : `$executeRawUnsafe` (qui n'essaie jamais de désérialiser un retour).

**Preuve positive, sur l'artefact réel** (détail complet dans `docs/candidat-individuel/preuve-next-start-production.md`) :
build `npm run build` (artefact validé), lancé via `node .next/standalone/server.js`, `NODE_ENV=production`,
contre le Postgres jetable de ce dépôt, un Redis réel (`RATE_LIMIT_BACKEND=redis` — le seul mode accepté en
production), un SMTP réel (mailpit). Session réelle via le formulaire de login. Séquence testée avec codes
HTTP réels :

| Étape | Résultat |
|---|---|
| Non authentifié → `/dashboard/assistante/candidat-individuel` | 307 → `/auth/signin` |
| Flag OFF → `POST /simulate` | 403 |
| `PATCH /api/admin/config` (activation réelle) | **200** — le fix confirmé |
| Création `ProfilCandidat` | 201 |
| Reprise du profil | 200 |
| `POST /simulate` | 200, statut READY, 3 scénarios |
| `POST .../profils/:id/quote` | 201, réponse sans `snapshotRegles`/`snapshotCarte` |
| Garde d'émission DB (`assertQuoteCanBeSent`) sur le brouillon créé | Bloque bien l'envoi |

Ce PATCH a été rejoué à l'identique lors de cette session (§6, vérification axe) sur **trois rebuilds
successifs** — 200 à chaque fois, confirmant que le fix tient dans la durée, pas un accident isolé.

**Second constat, honnête, non corrigé (hors périmètre)** : un ADMIN ne peut pas naviguer vers
`/dashboard/assistante/*` — `middleware.ts` impose un préfixe de dashboard unique par rôle, redirige avant
même que la page vérifie ADMIN/ASSISTANTE. La revendication "ADMIN/ASSISTANTE" reste vraie côté API (testé),
trompeuse côté navigation (seule ASSISTANTE peut réellement parcourir ces pages). Règle préexistante,
identique pour `/dashboard/assistante/devis` — pas une régression de cette mission, changerait l'architecture
de navigation du site entier.

---

## 3. Retrait de SVC_TUTORAT_COMPRESSION — justification et compensation

`SVC_TUTORAT_COMPRESSION` n'était défini nulle part dans le dépôt (ni code, ni brief, ni les 6 offres
publiques) — le chiffrer aurait été une double invention. Retiré du catalogue actif
(`data/pricing.canonical.json`), historique conservé (git + `docs/candidat-individuel/resolution-tutorat-compression.md`).

**Le retrait ne prétend pas que P3 est couvert.** Vérification de code (pas supposition) : `lib/quotes/priority.ts::scoreSubjects`
ne laisse `monthsRemaining` influencer que l'ORDRE de priorité ; `lib/quotes/pricing.ts::volumeForSubject` (la
fonction qui fixe réellement le volume horaire, 0/4/8/12) dépend uniquement du palier de diagnostic et du
statut fondamentaux — jamais de `monthsRemaining`. Un candidat P3 reçoit exactement la même recommandation
horaire qu'un candidat standard sur 2 ans — aucune compression prise en compte, silencieusement, avant ce
correctif.

**Résolution retenue** (`3d58a4354`) : parmi les 6 options offertes par la mission, toute option nécessitant
un multiplicateur de charge exige un facteur de compression sourcé qui n'existe nulle part — l'inventer serait
exactement ce que la mission interdit. Seule option implémentable sans fabriquer un chiffre : une politique de
recommandation qui expose l'écart plutôt que de le masquer. `lib/exams/carte.ts::genererCarteExamen` pousse
désormais un avertissement explicite dans `avertissementsGeneraux` pour tout parcours
`P3_LIBRE_1AN_DEROGATION` — rythme compressé, aucune augmentation automatique de volume, accompagnement
renforcé à arbitrer explicitement avec la famille, jamais présenté comme un rythme standard. Testé :
l'avertissement apparaît pour P3, jamais pour un P1 nominal (`__tests__/lib/exams/carte.test.ts`) ; il
survit jusqu'au résultat final du pipeline quel que soit le statut atteint (`__tests__/lib/quotes/pipeline.test.ts`),
avec un commentaire de test documentant explicitement qu'aucun calcul de charge/volume réel n'existe encore —
un futur lot qui en ajoute un devra remplacer cet avertissement par de vrais chiffres, jamais l'inverse.

---

## 4. Tableaux de décision — reproduits intégralement

### 4a. Quatorze arbitrages (catalogue candidat individuel)

Convention : prix minimal/recommandé/renforcé en TND, coût retenu = coût mensuel/unitaire au volume
recommandé, qualification **certifiée** sauf mention contraire. Hypothèses de coût (agrégé 70/certifié
50/tuteur 35/structure 15 TND/h) = `[hypothèse Claude — nécessite validation direction]`.

| # | Code | Prix min/reco/renforcé (TND) | Coût retenu | Recommandation Claude | Statut |
|---|---|---|---|---|---|
| 1 | MOD_LVA | 250/470/680 (existant) | 520 (certifié) | Valider tel quel ; imposer bascule DUO/SOLO sous effectif 3 | DIRECTION_A_APPROUVER |
| 2 | MOD_LVB | 250/470/680 (existant) | 520 (certifié) | Identique à MOD_LVA — risque d'effectif plus élevé | DIRECTION_A_APPROUVER |
| 3 | MOD_SPECIALITE_ABANDONNEE | 250/470/680 | 520 (certifié) | Même grille que LVA/LVB + avertissement commercial obligatoire | DIRECTION_A_APPROUVER |
| 4 | MOD_HG_ARIA | 20/40/80 `[hyp. Claude]` | 17,5 (tuteur) | Créer le tier `autonomie_guidee_aria` (migration additive) | DIRECTION_A_APPROUVER |
| 5 | MOD_ES_ARIA | 20/40/80 `[hyp. Claude]` | 17,5 (tuteur) | Une seule décision couvre les modules ARIA 4-6 | DIRECTION_A_APPROUVER |
| 6 | MOD_EMC_ARIA | 20/40/80 `[hyp. Claude]` | 17,5 (tuteur) | Idem | DIRECTION_A_APPROUVER |
| 7 | MOD_EAF_DESCRIPTIF | 180/360/540 | 130 (certifié) | Option ponctuelle sur demande, jamais par défaut | DIRECTION_A_APPROUVER |
| 8 | MOD_MATHS_EXPERTES | 250/470/680 | 520 (certifié) | Approuver le prix par anticipation ; activation technique bloquée séparément (coefficient non sourcé) | DIRECTION_A_APPROUVER (2 décisions distinctes) |
| 9 | MOD_MATHS_COMPLEMENTAIRES | 250/470/680 | 520 (certifié) | Identique à #8 — 1 décision peut couvrir 8-11 | DIRECTION_A_APPROUVER |
| 10 | MOD_DGEMC | 250/470/680 | 520 (certifié) | Identique à #8 | DIRECTION_A_APPROUVER |
| 11 | MOD_LCA | 250/470/680 | 520 (certifié) | Identique à #8 + avertissement DUO/SOLO norme (population très faible) | DIRECTION_A_APPROUVER |
| 12 | SVC_BACS_BLANCS | 95/190/285 `[hyp. Claude]` | 82,5 (mixte) | Ligne visible, vendue à l'unité ou en package annuel | DIRECTION_A_APPROUVER |
| 13 | SVC_TUTORAT_COMPRESSION | — | — | Concept jamais défini — retiré, aucune décision tarifaire à prendre | **RETIRÉ** |
| 14 | SVC_SECOND_GROUPE | 1080/1800/2880 | 650 (certifié) | Réutiliser le tarif individuel existant (180 TND/h), pas de grille « urgence » | DIRECTION_A_APPROUVER |

**À ce stade, aucune valeur commerciale n'est marquée APPROUVÉE** — chaque ligne reste `DIRECTION_A_APPROUVER`
jusqu'à retour explicite de la direction, sauf la ligne 13, résolue par retrait (pas une décision tarifaire).
Détail complet, service rendu, marge par effectif : `docs/candidat-individuel/dossier-decisionnel-14-elements.md`.

### 4b. Neuf valeurs `quotes.costPolicy` (calibration)

| # | Valeur | Valeur actuelle en base | Ancienne valeur legacy | Recommandation Claude | Statut |
|---|---|---|---|---|---|
| 1 | Coût agrégé | Aucune (namespace jamais activé) | N/A — legacy n'a qu'un taux unique blended 100 TND/h | Fourchette 65-85 TND/h, à confirmer avec la paie réelle | DIRECTION_A_APPROUVER |
| 2 | Coût certifié | Aucune | N/A (idem) | 50 TND/h — point d'équilibre, cible atteinte dès effectif 3 | DIRECTION_A_APPROUVER |
| 3 | Coût tuteur | Aucune | N/A (idem) | 35 TND/h — statut non défini contractuellement, valeur la plus fragile des 3 | DIRECTION_A_APPROUVER |
| 4 | Structure horaire | Aucune | N/A — `variableCostPerStudentMonthTnd`=10 TND/mois existe comme proxy différent (mensuel fixe, pas horaire) | 15 TND/h de séance | DIRECTION_A_APPROUVER |
| 5 | Coût fixe dossier | Aucune | N/A | 120 TND, one-off, jamais reconduit | DIRECTION_A_APPROUVER |
| 6 | Marge bloquante | Aucune (candidat individuel) | **30 %** (`quotes.costPolicy.marginGates.warningPct`) | 45 % — divergence assumée (produit structurellement plus cher à délivrer), pas un oubli | DIRECTION_A_APPROUVER — divergence à trancher explicitement |
| 7 | Marge cible | Aucune | **40 %** (`quotes.costPolicy.marginGates.greenPct`) | 55 % | DIRECTION_A_APPROUVER — idem |
| 8 | Plancher horaire | Aucune (aucune catégorie `petit_groupe` dans `price_floor_per_student_hour_tnd`) | Catégorie la plus proche : `college`=40 TND/h (sémantique différente) | 45-50 TND/h, catégorie dédiée | DIRECTION_A_APPROUVER |
| 9 | Plafond de remise | **20 %** (`pricing.rules.discounts.global_cap_pct`) | Identique — même namespace, déjà actif | 20 % (inchangé) | **Déjà actif — aucune nouvelle décision requise** |

Détail complet, sensibilité par valeur : `docs/candidat-individuel/proposition-calibration-couts-v1.md`.

---

## 5. Matrice des seize (dix-sept) étapes du wizard

`components/dashboard/assistante/PublicWizardPreview.tsx` compte **17 étapes** — 16 initialement construites +
`etalement`, ajoutée par cette vérification quand il est apparu que le P12 (étalement plurisessions) n'était
collecté nulle part. Matrice complète (champs, condition d'affichage, validation, donnée persistée, impact
pipeline) : `docs/candidat-individuel/wizard-preview-matrice-etapes.md`. Résumé :

| Sujet du brief | Étape(s) couvrant le sujet |
|---|---|
| Statut, situation antérieure | `statut`, `anterieur` |
| Session d'examen | Affichée en tête de `statut` (constante non éditable, corrigé par cette vérification) |
| Âge/P3 | `p3` |
| Étalement | `etalement` (ajoutée par cette vérification — trou réel corrigé) |
| Modalité | `modalite` |
| Spécialités, spécialité abandonnée | `specialites`, `specialite_abandonnee` |
| Options | `options` |
| Langues | `langues` |
| Résultats antérieurs, dispenses déclarées | `resultats_anterieurs` |
| Bascule | `bascule` |
| Diagnostic | `diagnostic` |
| Format, disponibilité | **Non construits, délibérément** — aucun des deux n'existe comme concept produit réel (chaque module déclare son propre format fixe) |
| Budget | `budget` |
| Carte | `carte` |
| Scénarios | `scenarios` |
| Coordonnées, consentement | `coordonnees` |

**Deux limites réelles, nommées, pas silencieuses** : `resultats_anterieurs` ne pousse aucune donnée dans le
pipeline (aucun champ `PublicCandidateInputRaw` équivalent — reste une intention informative pour l'équipe) ;
`coordonnees` n'a aucune validation de complétude ni d'envoi réel (aperçu visuel, pas le flux `/api/quotes`
existant). Aucun sujet du brief n'a disparu sans trace — les deux qui avaient disparu (session, étalement)
sont corrigés dans cette même mission.

---

## 6. QA accessibilité — zéro violation atteinte, sur le build de production

Vérifié avec `@axe-core/playwright` contre un build de production réel (`next start`, pas `next dev`), Postgres/
Redis/Mailpit réels, session réelle, flag activé via le vrai `PATCH /api/admin/config`. 11 écrans × 2 viewports
(desktop 1280×1000, mobile 390×844) = 22 vérifications : entrée du wizard, comparaison modalité A/B,
spécialités, options, résultats antérieurs, diagnostic, budget, carte, scénarios, coordonnées, workspace
assistante principal.

**Résultat final : 0 violation critique/sérieuse sur les 22 vérifications** (26 → 0 sur ce lot). Détail des
corrections :

- `PublicWizardPreview.tsx` : `aria-label` manquant sur la progressbar ; `text-lux-gold` (contraste 2,38 sur
  fond clair) → `text-lux-gold-deep` (variante texte déjà établie dans le design system) ; champs de
  formulaire héritant d'une couleur claire du chrome sombre du dashboard (contraste ~1,1, quasi invisible) →
  `text-lux-ink` explicite ; pages wrapper utilisant `bg-white`/`text-neutral-400` génériques au lieu de
  `bg-lux-white`/`border-lux-line`/`text-neutral-300` du design system.
- `CandidatIndividuelWorkspace.tsx` : 10 déclencheurs `Select` et plusieurs champs sans nom accessible
  (`Label` sans `htmlFor`) → paires `id`/`htmlFor` ajoutées partout ; boutons `outline` sur fond sombre
  échouant au contraste (`brand-primary` ≈3,4:1) → `brand-accent` (le jeton que le design system documente
  déjà comme sûr sur fond sombre) ; premier `CardTitle` (h3) sans ancêtre h2 → h2 invisible ajouté.
- Sitewide (`Navbar.tsx`, `app/dashboard/layout.tsx`) : logo mobile 1px sous le seuil « texte large » WCAG,
  échouant le contraste 4,5:1 de justesse → `text-xl` ; **le lien d'évitement « Aller au contenu principal »
  ne déplaçait jamais réellement le focus clavier** (`#main-content` sans `tabIndex`) — confirmé par un test
  clavier scripté (Tab depuis le lien atterrissait sur `<body>`, pas `<main>`) → `tabIndex={-1}` ajouté,
  effet vérifié après correction.

**Vérifications manuelles réalisées sur le build de production** (pas seulement le contraste automatisé) :
sélection d'un groupe radio au clavier seul (sémantique native — flèches, pas Tab, confirmé volontairement
après un faux-positif de mon propre script de test) ; focus non perdu après un changement d'étape (Enter sur
« Continuer » reste sur le bouton, pas de retour à `<body>`) ; 3 régions `aria-live` présentes (compteur
d'étape `polite`, une région `assertive` pour les erreurs) ; bouton retour accessible et focusable. Constat
positif non-bug : le rate limiter de login est réellement actif en production (bloque après plusieurs
tentatives, confirmé en le déclenchant par accident pendant ce travail).

**Non fait, nommé explicitement plutôt que silencieusement omis** : zoom à 200 %, largeur 320 px, et
réduction d'animation n'ont été vérifiés qu'automatiquement (viewport mobile 390px couvre approximativement
320px, `prefers-reduced-motion` forcé dans le script axe) — pas de vérification visuelle manuelle
supplémentaire dédiée à ces trois points précis dans le temps disponible pour cette mission. Le lien
d'évitement du site public (`app/layout.tsx`) n'a **aucune cible `#main-content`** hors `/dashboard/*` —
préexistant, sitewide, hors périmètre de cette correction (touche toutes les pages marketing).

---

## 7. QA PDF — non applicable, honnêtement, pas fabriqué

**Aucune route PDF/lien signé n'existe pour le nouveau pipeline carte-aware.** Le flux PDF/token existant
(`lib/quotes/pdf-adapter.ts`, `app/devis/[token]/page.tsx`) est câblé au moteur legacy uniquement — un
`Quote` créé via `POST .../profils/:id/quote` (commit `dc3e1d66d`) n'a, à ce jour, aucun chemin vers un PDF ou
un lien signé. Ce constat était déjà documenté dans `docs/candidat-individuel/preuve-next-start-production.md`
au moment de sa création.

**Conséquence directe pour ce rapport** : la liste des 13 profils demandée (P2 modalité B, P3, P5 avec notes,
P7 avec dispenses, P8, P11, P12, options, profil avec beaucoup de lignes, élément non chiffré, devis
provisoire/définitif) **ne peut pas être générée ni visuellement inspectée pour le nouveau pipeline**, car le
produit qui les génèrerait n'existe pas encore. Fabriquer des PDF de test contre le moteur legacy (qui, lui,
a bien une route PDF) aurait testé le mauvais produit et laissé croire à une couverture qui n'existe pas —
refusé par principe, conformément à l'exigence explicite de ne jamais présenter une supposition comme une
vérification réelle.

**Action requise avant tout pilote interne réel qui produirait un PDF depuis ce pipeline** : construire la
route de génération PDF/lien signé pour `snapshotCarte`/`snapshotRegles` (un nouveau lot, pas dans le
périmètre de cette mission de QA).

---

## 8. E2E sur build de production

**Fait, réellement, sur l'artefact réel** — mais via des scripts Playwright jetables (supprimés après chaque
vérification, jamais committés), pas des fichiers `.spec.ts` pérennes exécutables par `npm run test:e2e`.
Couvert par ces scripts, contre `next start` + Postgres/Redis/Mailpit réels + session réelle (§2 et §6 ci-dessus) :
authentification (redirect non authentifié, login réel), flag OFF (403), activation réelle (PATCH 200),
création/reprise de profil, simulation réelle (READY), création de brouillon (201, pas de fuite), garde
d'émission bloquant l'envoi, navigation clavier complète d'une étape à l'autre, mobile (viewport 390px). Pas
testé sur ce lot faute de route existante : PDF, lien signé, acceptation, expiration (§7 — N/A).

**Ce qui manque réellement** : aucun fichier `e2e/*.spec.ts` committé et réutilisable pour ce pipeline
spécifiquement — contrairement à `e2e/devis-bac-public-flow.spec.ts` (wizard legacy) ou
`e2e/axe-spot-check.spec.ts` (spot-check public), qui existent et tournent en CI. La couverture E2E de ce
pipeline dépend aujourd'hui de vérifications manuelles ponctuelles répétées à chaque changement, pas d'une
suite automatisée régénérable. **Dette explicite, pas cachée** : un futur lot devrait committer un
`e2e/candidat-individuel-internal-pipeline.spec.ts` reprenant les scénarios ci-dessus contre un build de
production réel dans le pipeline CI.

---

## 9. Sécurité de la prévisualisation

Revue complète, contrôle par contrôle, avec preuve (test ou lecture de code) : `docs/candidat-individuel/securite-previsualisation.md`.
Résumé :

| Contrôle | Statut |
|---|---|
| ADMIN/ASSISTANTE autorisés, PARENT/ELEVE/non-authentifié refusés | ✅ (testé, par construction) |
| Protection IDOR entre profils | **Constat explicite, pas un bug** — tout le staff voit tous les profils, même modèle que `searchContactLeads` (outil partagé, pas un espace par utilisateur) |
| Validation Zod `.strict()` | ✅ (testé) |
| CSRF | ✅ (hérité — cookie de session `SameSite=Lax`, NextAuth v5) |
| Rate limiting | ⚠️→✅ **Absent avant cette mission, corrigé** (`afea675ff`) — nouveau scope `candidat-individuel-staff`, identité = utilisateur staff |
| Aucune mutation du flag depuis la prévisualisation | ✅ (vérifié par recherche de code) |
| Aucun champ staff accepté depuis une entrée publique | ✅ — le wizard de prévisualisation ne construit jamais de `staffExtension` |
| Aucune donnée de marge dans HTML/RSC/API/PDF | ⚠️→✅ **Fuite réelle trouvée et corrigée** (`afea675ff`) — `marginPct` et `snapshotRegles` complets fuyaient dans la réponse 201/422 de `POST .../profils/:id/quote`, testé explicitement depuis |

---

## 10. Verdict

### Résumé des 16 points

1. Inventaire des commits — ✅ §1, complet, 12 commits, aucun poussé.
2. Preuve `next start` — ✅ §2, bug critique réel trouvé et corrigé, preuve positive rejouée 3 fois.
3. Résolution du tutorat de compression — ✅ §3, retiré + compensé par avertissement honnête.
4. Quatorze arbitrages + neuf coûts — ✅ §4, reproduits intégralement, aucune valeur approuvée.
5. Matrice des dix-sept étapes — ✅ §5, complète, deux trous réels trouvés et corrigés.
6. QA accessibilité — ✅ §6, 26 → 0 violation critique/sérieuse, sur production, bug de skip-link trouvé et corrigé.
7. QA PDF — **N/A, honnêtement documenté** §7 — la route n'existe pas pour ce pipeline.
8. E2E production — ⚠️ §8, fait manuellement/scripté sur l'artefact réel, **pas encore de suite `.spec.ts` committée**.
9. Sécurité — ✅ §9, une fuite de marge réelle et une absence de rate limiting réelles, toutes deux corrigées.
10. Ce rapport — ✅.

### GO / NO-GO

**GO pilote interne** : le parcours réel fonctionne sur le build de production (§2, §6, §8 — preuve positive,
pas une supposition). Les deux bugs critiques trouvés pendant cette mission (crash `pg_advisory_xact_lock`,
fuite de marge) sont corrigés et vérifiés. Reste avant un pilote interne réel : committer une suite E2E
pérenne (§8) et, si un PDF est nécessaire au pilote, construire la route manquante (§7).

**NO-GO public, sans condition, jusqu'à nouvel ordre** : aucune valeur tarifaire, aucun volume, aucun coût
(§4) n'a été explicitement approuvé par la direction — chaque ligne reste `DIRECTION_A_APPROUVER`. La recette
interne réelle (utilisateurs staff réels, pas des scripts) n'a pas eu lieu. Ce verdict ne change pas tant que
ces deux conditions ne sont pas remplies.

**Aucune modification de `BusinessConfig` n'a été effectuée dans un environnement réel** — chaque activation
du flag pendant cette mission (§2, §6) a eu lieu sur le Postgres jetable de test de ce dépôt, jamais sur une
base de production réelle.
