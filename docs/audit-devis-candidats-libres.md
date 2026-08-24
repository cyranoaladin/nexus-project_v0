# Audit — Moteur de tarification & simulateur de devis « Candidats libres » (v2)

> Document de découverte, produit conformément à la section 1 du brief `feat/candidat-individuel-pricing-devis-v2`. Aucune ligne de code n'a été modifiée pour produire cet audit. **Ne pas commencer le Lot 1 avant validation explicite de la direction sur les points de la section 5.**
>
> Date : 2026-08-23. Branche auditée : `feat/candidat-individuel-pricing-devis-v2` (116 fichiers modifiés vs `main`, +8621/-16920 lignes).

---

## 0. Résumé exécutif

**Ce projet n'est pas greenfield.** La branche courante porte déjà un moteur de devis « candidat individuel » quasi complet, construit sur ~15 commits récents, avec sa propre terminologie (`Quote` plutôt que `Devis`, `lib/exams/` plutôt que `lib/bac/reglementation/`, `lib/quotes/` plutôt que `lib/tarification/`). Il couvre déjà :

- un modèle Prisma `Quote` / `QuoteLine` / `QuoteAuditLog` avec figeage de version (`pricingVersion`, `examPolicyVersion`) et chaîne de révision immuable (`previousRevisionId` / `supersededBy`) ;
- un moteur de recommandation pur et testable (`lib/quotes/recommendation.ts`, `optimizer.ts`, `pricing.ts`, `prorata.ts`) ;
- un référentiel réglementaire versionné et sourcé pour la session 2027 (`data/exams/bac-general-2027.json` + `lib/exams/catalog.ts` + `lib/exams/schema.ts`), incluant déjà l'article 3 (dérogation « bac en 1 an ») avec logique `autoCheckable` / `ELIGIBILITY_REQUIRES_HUMAN_REVIEW` ;
- un garde-fou de marge serveur (`lib/quotes/margin.server.ts`, seuils GREEN 40% / WARNING 30% / BLOCKED en dessous, configuration auditée via `BusinessConfig`) ;
- un plafond de remise (20%, non cumulable) et un plancher de prix horaire déjà codés dans `lib/pricing.ts` ;
- un générateur PDF (`lib/quote/pdf.ts` + `lib/quotes/pdf-adapter.ts`) sans fuite de coût/marge, invoqué en `/api/assistante/quotes/pdf` ;
- un accès famille par lien signé sans compte (`app/devis/[token]/page.tsx`), et un espace staff « assistante » complet (`app/dashboard/assistante/devis/`, recherche de lead, historique, envoi, révisions) ;
- une intégration a11y (axe-core) déjà branchée sur `/devis-bac` dans `e2e/axe-spot-check.spec.ts`.

**Ce qui manque réellement et constitue le vrai périmètre du brief** :

1. **La matrice des 12 parcours (P1→P12)** n'existe pas. Le système actuel modélise implicitement un seul cas (primo-candidat, cycle de 2 ans, sans distinction modalité A/B explicite dans le calcul des coefficients). Aucun `ParcoursType`, aucune notion de redoublement, amélioration de notes, titulaire déjà diplômé, bascule scolaire→libre, changement de spécialité, second groupe, étalement plurisessions.
2. **La modalité A/B n'est pas câblée dans le calcul des coefficients.** Le JSON réglementaire a un champ `ponctuellesModality` narratif mais aucune règle qui fait varier un coefficient (6 vs 3+3) selon la modalité choisie.
3. **La conservation de notes est incomplète.** Le seuil ≥10/5 sessions est codé, mais **la perte de la mention** en cas de conservation — l'arbitrage central du brief §2.8 — n'apparaît nulle part dans le JSON ni dans l'UI.
4. **Les dispenses de partie pratique (NSI/PC/SI/SVT)** ne sont pas codées.
5. **Les règles d'exclusion d'options** (Maths expertes/complémentaires, DGEMC) sont documentées en prose dans l'audit réglementaire narratif, mais aucun validateur ne les fait respecter dans le profil candidat.
6. **Le wizard public** (`/devis-bac`, `components/quotes/DevisWizard.tsx`) est un flux de type « diagnostic → budget → 3 scénarios » à quelques étapes, pas les 11 étapes détaillées en §8 du brief (statut → situation de départ → session/âge → étalement → modalité → voie/spés → options → niveaux → notes/dispenses → format → coordonnées). Il n'a ni persistance locale, ni query-param de pré-remplissage, ni récapitulatif latéral vivant.
7. **Aucune carte d'examen (`genererCarteExamen`) n'est générée** comme livrable central visible par la famille — le wizard actuel va directement à un budget puis 3 scénarios de couverture, sans jamais afficher un tableau épreuve-par-épreuve avec statut (`A_PRESENTER`/`CONSERVEE`/`DISPENSEE`/`RECONDUITE`) et référence réglementaire.
8. **Back-office** : pas d'éditeur de grille tarifaire, pas d'éditeur de modules, pas d'éditeur de règles de session avec alerte `verifieLe`, pas de `<SimulateurMarge />` visuel (le calcul serveur existe, l'UI de pilotage non).
9. **Deux modèles d'échéancier divergent déjà en production** (voir §3.5) — il faut trancher lequel devient la référence candidat-libre avant d'ajouter les variantes du brief §6.7.

Le travail restant est donc **majoritairement l'extension du moteur réglementaire et de la carte d'examen**, pas la reconstruction de l'infrastructure de devis/PDF/paiement/back-office staff, qui existe déjà et doit être réutilisée.

---

## 1. Réponses aux questions de découverte (brief §1)

### 1.1 Où vivent les offres aujourd'hui ?

Source unique : **`data/pricing.canonical.json`** (~2000 lignes, version `2026-2027.6`), accédée exclusivement via le loader typé **`lib/pricing.ts`** (728 lignes, `import 'server-only'`). Import JSON direct interdit ailleurs (subset client dans `lib/pricing-client.ts`, synchronisation vérifiée par `__tests__/lib/pricing-client-sync.test.ts`).

Rien n'est en base Postgres : `prisma/seed.ts` ne contient aucune offre/tarif. Les « 6 SKU » candidat libre sont des `AnnualOffer` filtrés par `audience: ["candidat_individuel"]` :

| id | niveau | intitulé | h/mois | prix annuel (TND) | acompte | mensualités |
|---|---|---|---|---|---|---|
| `libre-pilotage` | tous | Pilotage | 0 | 1500 | 0 | 10 |
| `libre-sur-mesure` | tous | Sur mesure | 8 | 6200 | 0 | 10 |
| `premiere-libre-cap-anticipees` | première | Cap Anticipées | 12 | 7900 | 0 | 10 |
| `premiere-libre-renforcee` | première | Renforcée | 20 | 11900 | 0 | 10 |
| `terminale-libre-focus-bac` | terminale | Focus Bac | 20 | 12900 | 0 | 10 |
| `terminale-libre-integrale` | terminale | Intégrale | 30 (plafond) | 16900 | 0 | 10 |

À noter : ces 6 offres utilisent déjà `deposit: 0` + 10 mensualités égales — **pas** le modèle générique 30%+9 mensualités du reste du catalogue (voir §1.5).

Briques modulaires du moteur sur-mesure (`candidat_individuel_modules`) : `pilotage` (150 TND/mois forfait), `petit_groupe` (paliers 4h/250, 8h/470, 12h/680 TND/mois, groupe 3-6), `duo` (90 TND/h/élève), `individuel` (180 TND/h plancher).

### 1.2 Où est implémentée `/offres` et son filtrage ?

`app/offres/page.tsx` (Server Component). Les 8 catégories du brief existent **exactement** telles que nommées (`app/offres/page.tsx:42-54`) : Tout voir, Parcours annuels, Candidat libre, Plateforme, Les Intensifs, Prépa épreuves, Boussole, Pass, Carte Nexus.

Le filtrage n'est **pas** un système d'onglets serveur : `OffersFiltersClient.tsx` bascule `.hidden`/`aria-hidden` côté client sur des blocs marqués `data-offres-categories`, regroupés en 3 « méga-sections » (`NavyBand`) : Année (annual/libre/plateforme), Stages (intensifs/ponctuel), Sur-mesure (coaching/pass/carte).

Design system confirmé : tokens CSS `--color-lux-*` (`app/globals.css:274-291`, contrastes AA documentés dans `docs/design/contrast-matrix.md`), classes utilitaires `.lux-eyebrow`, `.lux-price`, `.lux-cta-*`, `.lux-focus` (`app/globals.css:1345-1418`), polices Fraunces (`--font-display`) et DM Sans (`--font-body`) chargées en `next/font/local` dans `app/layout.tsx:35-47`.

### 1.3 Où est implémenté `/recommandation` et où s'arrête-t-il ?

`components/premium/RecommendationWizard.tsx` (état 100% local `useState`, pas de persistance, pas de query-param). **Le wizard a 3 étapes** (niveau → statut scolaire/libre → besoin), pas 1 comme le brief le suppose. Il ne s'arrête pas sur un cul-de-sac : la 3ᵉ étape produit des `ExamCard`s de résultat.

Fait important déjà câblé **sur cette branche** (commit `b95c86128`) : pour un candidat individuel Première/Terminale voie générale, le CTA de résultat pointe déjà vers `/devis-bac` (« Obtenir mon devis personnalisé ») plutôt que vers `/offres`. C'est le point d'entrée naturel à faire évoluer vers le wizard 11 étapes du brief §8, pas un nouveau point d'entrée à créer.

### 1.4 Entité Devis/Quote/Simulation/CarteExamen, PDF, espace client ?

- **`Quote`/`QuoteLine`/`QuoteAuditLog`** existent pleinement (`prisma/schema.prisma:1289-1458`, migration `20260822213413_add_quote_domain`). Pas de `Devis` ni `CarteExamen` — `Quote` en tient lieu fonctionnellement. Champs de figeage : `pricingVersion`, `examPolicyVersion`, `diagnosticChecksum` ; chaîne de révision `previousRevisionId`/`supersededBy`/`revisionNumber` ; `QuoteAuditLog` append-only.
- **PDF** : `lib/quote/pdf.ts` (rendu PDFKit générique 2 pages) + `lib/quotes/pdf-adapter.ts` (mapping `QuoteScenario` → `QuotePDFData`, délibérément dupliqué pour ne pas tirer `server-only` dans le bundle client — cf. commit `2cf86c561`). Invocation via `POST /api/assistante/quotes/pdf`, rôle ADMIN/ASSISTANTE uniquement, aucun coût/marge dans le PDF.
- **Espace client** : pas de portail authentifié pour les devis. `app/dashboard/parent/` existe mais n'a aucune référence à `Quote`. `app/famille/page.tsx` est une page marketing publique, pas un espace connecté. L'accès famille se fait par **lien signé sans compte** : `app/devis/[token]/page.tsx` + `POST /api/quotes/[id]/accept` (token-only, pas d'auth staff).
- **Espace staff** : `app/dashboard/assistante/devis/` (rôle ASSISTANTE/ADMIN), composant `DevisWorkspace.tsx` (575 lignes) — recherche de lead, création de devis (PII fraîche ou lead/élève existant), historique par lead/élève, envoi (transition de statut), export PDF.

### 1.5 Échéanciers actuels — deux modèles qui coexistent

**Modèle générique** (`lib/pricing.ts:584-602`, catalogue général) : `computeSchedule()` = acompte 30% arrondi au multiple de 10 TND le plus proche, puis N mensualités (défaut 9) calculées par `Math.floor(reste/N)`, le résidu d'arrondi absorbé intégralement par la **dernière** mensualité. C'est le modèle « 30% + 9 mensualités » que le brief demande de conserver.

**Modèle du moteur candidat-libre** (`lib/quotes/pricing.ts`, `lib/quotes/recommendation.ts:125,136`) : **`deposit: 0` + 10 mensualités égales**, documenté explicitement dans `lib/quotes/pdf-adapter.ts:57-68` comme décision de mission (« payment model »). C'est le modèle déjà utilisé par les 6 SKU candidat-libre eux-mêmes (§1.1).

➡️ **Divergence tranchée en §5 (D4, définitif au 2026-08-24)** : le brief §6.7 dit « conserve la logique existante (acompte 30% + 9 mensualités) et ajoute deux variantes » — la logique *déjà utilisée par le code candidat-libre sur cette branche* est le modèle à 0% d'acompte, mais **la production (`main`) n'a jamais utilisé ce modèle** pour le candidat libre (`term-libre-mixte` : 30% + 9 mensualités, voir D4). La référence retenue par la mission finale est **25% + 10 mensualités**.

La proratisation d'entrée en cours d'année (`lib/quotes/prorata.ts`, calendrier académique 10 mois sept.→juin, tarif plein × mois restants, pas de prorata au jour) est un mécanisme séparé, déjà solide, réutilisable tel quel.

### 1.6 Design system et composants réutilisables pour formulaire long

Deux wizards existants à réutiliser comme base, aucun n'a de récapitulatif latéral (composant à créer) :

- **`components/quotes/DevisWizard.tsx`** (633 lignes) — le plus proche du besoin : barre de progression en pastilles (`role="progressbar"`), `StepFieldset` (fieldset/legend réutilisable), `RadioOption` (carte radio 44px, `border-lux-gold` si sélectionné, focus-ring), validation `canGoNext` par étape, capture PII inline, `ScenarioCard` pour la comparaison finale à 3 niveaux.
- **`components/premium/RecommendationWizard.tsx`** (281 lignes) — plus simple, même pattern de progression, à conserver comme point d'entrée diagnostic léger.

Gap confirmé : **aucun composant de récapitulatif latéral** (`OrderSummary`/`StickySummary`) n'existe dans le repo — à construire pour le brief §8.3. Gap a11y confirmé : ni wizard n'a de région `aria-live` annonçant le changement d'étape ni de déplacement de focus vers le titre d'étape (WCAG 4.1.3) — à ajouter.

axe-core est déjà en place (`@axe-core/playwright`), `e2e/axe-spot-check.spec.ts` couvre déjà `/offres` et `/devis-bac` — toute nouvelle route doit être ajoutée à `publicPages` dans ce fichier.

### 1.7 Mécanisme de persistance immuable d'artefacts

Le système visé par le brief est le pipeline **Bilans** (évaluation pédagogique canonique, sans rapport métier avec la tarification) : `ReportMaterialization` / `ReportAudienceArtifact` (`prisma/schema.prisma:1889-1914`, migration `20260803120000_add_immutable_report_materializations`). Immuabilité forcée par **trigger PostgreSQL** (`BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`), pas par convention applicative. Correction = nouvelle `ReportRevision` → nouvelle matérialisation, jamais de mutation.

**Ce mécanisme n'est pas directement réutilisable** pour `Quote` (couplage fort au domaine bilan : audiences ELEVE/PARENTS/NEXUS, rendu Chromium HTML/PDF). En revanche, **`Quote` a déjà son propre mécanisme de figeage plus léger et directement pertinent** : `lib/quotes/snapshot.server.ts` (stamping `pricingVersion`/`examPolicyVersion` à la création) + chaîne de révision `previousRevisionId`/`supersededBy` (appliquée en code/tests, pas en trigger DB). C'est le patron à prolonger pour le nouveau `snapshotRegles`/`snapshotCarte` du brief §4, pas le système Bilans.

---

## 2. Cartographie brief → existant

| Brief demande | Équivalent existant | Statut |
|---|---|---|
| `lib/bac/reglementation/session-2026.ts` etc. | `data/exams/bac-general-2027.json` + `lib/exams/schema.ts` + `lib/exams/catalog.ts` (session 2027 uniquement, format JSON+Zod, pas TS littéral par session) | **Partiel** — un seul fichier session, pas de résolveur multi-session, coefficients modalité A/B non différenciés, dispense pratique NSI/PC/SI/SVT absente, perte de mention absente |
| `lib/bac/reglementation/tunisie-ift.ts` | `tunisiaSpecific` dans le même JSON (`registrationPortal`, `academieDeRattachement`, `feesNote`, `confidence: "UNCERTAIN"`) | **Existe**, à extraire en fichier dédié avec `verifieLe: Date` structuré |
| `ParcoursType` (P1→P12) | Rien — le moteur ne modélise qu'un candidat primo-inscrit générique | **Absent — travail neuf principal** |
| `genererCarteExamen(profil, session)` | Rien d'équivalent ; le wizard produit des `RecommendedLine[]`/`QuoteScenario`, pas une carte épreuve-par-épreuve avec statut réglementaire | **Absent — travail neuf** |
| `lib/bac/validation/` (validateurs composables) | Pattern précédent réutilisable : `lib/bilans/validators/index.ts` (règles nommées V1-V7, `ValidationFailure[]`, parse-and-freeze) + primitives Zod `lib/validation/common.ts` | **Patron existant à répliquer, contenu neuf** |
| Moteur tarifaire + garde-fous (§6) | `lib/quotes/pricing.ts`, `optimizer.ts`, `margin.server.ts` (seuils 40%/30%), `lib/pricing.ts` (`applyDiscount`, plafond 20%, plancher/h) | **Très largement existant — à étendre, pas reconstruire** |
| `COEFFICIENT_PARCOURS` | Concept proche mais différent : `QuoteStrategy` (RESPECT_BUDGET/BEST_BALANCE/MOST_COMPLETE) pilote la couverture, pas un multiplicateur par parcours réglementaire | **Absent, à ajouter** |
| Mutualisation socle EP / tension « 5 max » | Non implémenté ; CGV existantes (`docs/audit-reglementaire-bac-candidats-libres-nexus.md` art. 6) engagent déjà « 5 élèves max Terminale, 6 max Première/Seconde » | **Tension confirmée réelle, décision D1 à trancher** |
| `Devis` (modèle Prisma) | `Quote`/`QuoteLine`/`QuoteAuditLog`, quasi-isomorphe au modèle du brief | **Existe sous un autre nom — décision D2 : étendre `Quote` plutôt que dupliquer** |
| PDF devis | `lib/quote/pdf.ts` + `lib/quotes/pdf-adapter.ts`, déjà sans fuite de coût/marge | **Existe — à étendre avec carte d'examen + disclaimer réglementaire du brief §9** |
| Wizard 11 étapes (§8) | `DevisWizard.tsx` (flux court : diagnostic → budget → 3 scénarios), `RecommendationWizard.tsx` (3 étapes) | **Fondations réutilisables, flux à réécrire/étendre significativement** |
| Espace client (§9, « rattaché au compte famille ») | Lien signé sans compte (`/devis/[token]`), pas de portail connecté | **Décision D3 à trancher : garder le lien signé ou câbler aussi le dashboard parent connecté** |
| Back-office (§10) | `DevisWorkspace.tsx` (staff), calcul marge serveur existant, **aucune UI** d'édition grille tarifaire / modules / règles session / `<SimulateurMarge />` visuel | **Absent côté UI — travail neuf** |
| Tests (§12) | Conventions Jest (pas Vitest) + Playwright + axe déjà en place, précédents directs : `__tests__/lib/quotes/*.test.ts`, `__tests__/lib/pricing-canonical-validator.test.ts`, `e2e/axe-spot-check.spec.ts` | **Conventions à suivre telles quelles** |

---

## 3. Écarts et travail réellement neuf

Par ordre de dépendance :

1. **Référentiel réglementaire complet** — étendre `lib/exams/` (ou créer `lib/bac/reglementation/` en couche additive dessus, décision D5) pour couvrir : coefficients modalité A/B par matière (HG/LVA/LVB/ES/EMC, à vérifier matière par matière contre les notes de service listées en annexe du brief), dispense partie pratique NSI/PC/SI/SVT, perte de mention en cas de conservation de notes, règles d'exclusion d'options (Maths expertes/complémentaires/DGEMC) sous forme de règles machine (pas seulement narratives), bascule scolaire→libre (deux branches §2.9), dispenses titulaire bac (arrêté 14 mai 2020), second groupe (§2.11).
2. **`ParcoursType` + `genererCarteExamen`** — la matrice P1-P12, ses 12 tests dédiés (§12), le calcul des statuts `A_PRESENTER`/`CONSERVEE`/`DISPENSEE`/`RECONDUITE`.
3. **`lib/bac/validation/`** — les 13 contrôles du §5 du brief, sur le patron `lib/bilans/validators/`.
4. **Extension du moteur tarifaire** — `COEFFICIENT_PARCOURS`, `FACTEUR_CYCLE_TERMINAL` (modalité A), hiérarchisation automatique P3, module `CELLULE_CYCLADES`/`EAF_DESCRIPTIF` non désélectionnables, décision socle EP mutualisé (les deux implémentations demandées par le brief, configurable).
5. **Extension du modèle `Quote`** — soit ajout de colonnes (`profilId`, `parcours`, `snapshotCarte`) sur `Quote` existant, soit nouveau modèle `ProfilCandidat` lié en FK légère (comme `ContactLead`/`Student` le sont déjà) — décision D2.
6. **Wizard 11 étapes** — extension de `DevisWizard.tsx` ou nouveau composant partageant `StepFieldset`/`RadioOption` ; récapitulatif latéral neuf ; persistance locale neuve ; pré-remplissage `?parcours=` neuf ; focus/aria-live neuf.
7. **PDF** — ajout de la carte d'examen et du disclaimer réglementaire exact du brief §9 à `lib/quote/pdf.ts`.
8. **Back-office** — 3 écrans d'édition neufs (grille tarifaire, modules, règles de session) + `<SimulateurMarge />` visuel branché sur `lib/quotes/margin.server.ts` existant.
9. **Contenus publics** — mise à jour `/candidat-libre-bac-francais`, `/offres` onglet Candidat libre (remplacer 6 SKU par 3 scénarios), FAQ, schema.org.

---

## 4. Ce que je n'ai **pas** vérifié (à ne pas coder sans vérification directe)

Conformément au §15 du brief (« n'invente aucune règle réglementaire »), les points suivants restent `À_VERIFIER` et ne doivent pas être codés en dur sans confirmation :

- Coefficient modalité B par matière (3+3 réellement identique pour HG/LVA/LVB/EMC, ou variations) — le JSON actuel n'a qu'une valeur unique par matière, pas de branche A/B.
- Dates et frais d'inscription IFT (déjà marqués `"confidence": "UNCERTAIN"` dans le JSON — bon signal, à conserver).
- Disponibilité des évaluations ponctuelles d'options selon l'académie (réserve à afficher, non encore présente dans l'UI).
- Conditions exactes de conservation des notes de contrôle continu de première (nuance mentionnée en brief §2.8, absente du JSON).

---

## 5. Décisions tranchées (2026-08-23)

**D1 — Mutualisation du socle EP (brief §6.6). TRANCHÉ.** Ni fusion ni renoncement : découpage par matière.
- HG, Enseignement scientifique, EMC → **forfait d'autonomie guidée** (ARIA + jalons + bacs blancs). Ce n'est pas un format « groupe », donc la promesse contractuelle « 5 élèves max » (CGV art. 6) ne s'y applique pas — la tension est désamorcée, pas arbitrée.
- LVA, LVB → restent en **live petit groupe**, volume court (leurs évaluations ponctuelles comportent un oral). Ce sont les deux seules matières où la tension « 5 max » vs atelier mutualisé subsiste réellement.
- Pour LVA/LVB uniquement : coder les deux formats (groupe 5 max / atelier 8-12) tels que prescrits par le brief §6.6, **configurables, groupe-5 actif par défaut**, atelier désactivé tant que la direction ne tranche pas explicitement pour ces deux matières.

**D2 — `Devis` vs `Quote`. TRANCHÉ.** Étendre `Quote` (pas de modèle `Devis` séparé). Précision actée : **`ProfilCandidat` est un modèle séparé avec FK vers `Quote`**, pas des colonnes sur `Quote` — le profil est mutable et vit plus longtemps qu'un devis (une famille génère plusieurs scénarios/révisions depuis un même profil). `snapshotCarte` et `snapshotRegles` restent des colonnes sur `Quote` lui-même : ils doivent être figés avec la révision, pas partagés avec le profil mutable.

**D3 — Espace client famille. TRANCHÉ.** Lien signé (`/devis/[token]`) comme unique canal. Intégration `app/dashboard/parent/` mise en backlog — au moment de l'émission d'un devis, l'audience est à 100% prospect, pas encore titulaire d'un compte famille (YAGNI).

**D4 — Échéancier candidat-libre de référence. TRANCHÉ DÉFINITIVEMENT par la mission finale du 2026-08-24 (§2 D4), remplace toutes les révisions précédentes** (2026-08-23 : 10%+8 ; première révision : 25%+10 ; deuxième révision : 20%+9). **25% d'acompte + 10 mensualités** est la référence commerciale définitive. Corrige le modèle `deposit: 0` + 10 mensualités actuellement utilisé par les 6 SKU candidat-libre et par `lib/quotes/pricing.ts` sur cette branche.

Formule sans ambiguïté imposée par la mission : `acompte = arrondiMonetaire(totalNet × 25%)`, `reste = totalNet − acompte`, 10 mensualités couvrent exactement le reste, la dernière absorbe l'écart d'arrondi, `acompte + Σmensualités = totalNet` — invariant automatisé requis (aucun écart d'un dinar). L'acompte est non remboursable sauf non-ouverture du groupe imputable à Nexus ; report possible selon les règles CGV existantes.

Fait vérifié qui reste pertinent : la production (`main`) n'a jamais eu de modèle sans acompte pour le candidat libre (`term-libre-mixte` : `deposit: 2370` sur `price_annual: 7900` = 30% exactement, `n_installments: 9` — cf. `git show main:data/pricing.canonical.json`). Le `deposit: 0` de cette branche était une régression de protection non actée, pas une décision produit délibérée. La mission tranche à 25%+10 plutôt que 20%+9 (ma proposition précédente, jamais implémentée en code — seule la décision documentée change, aucune migration de code n'est affectée) ou 30%+9 (modèle générique) : ni 0% (aucune protection), ni 30% universel (interdit explicitement au §21 des interdictions absolues), ni 10 mensualités alignées sur le calendrier académique complet plutôt que le N=9 générique. La variante `JALONS_EPREUVES` reste disponible en option, non par défaut, uniquement si la direction la choisit explicitement (§2 D4). Migration des 6 SKU et de `lib/quotes/pricing.ts` à prévoir en Lot 5/7, sans impact rétroactif sur les `Quote` déjà émis (figés par `snapshotRegles`).

**D5 — `lib/bac/reglementation/` vs extension de `lib/exams/`. TRANCHÉ.** Pas de nouveau namespace : extension pure de `lib/exams/` (le chemin `lib/bac/reglementation/` du brief était illustratif, pas normatif). Le format JSON + Zod existant est conservé — c'est de la donnée validable et éditable depuis le back-office (Lot 7), supérieur à des fichiers TS littéraux. Le Lot 1 ajoute un résolveur multi-session dans `lib/exams/`.

**D6 — Sessions 2026/2027/2028. TRANCHÉ.** Session 2027 complétée intégralement + résolveur multi-session + squelette 2028 (textes non encore tous parus — ne pas inventer, §15). Session 2026 conservée **en lecture seule**, référentiel historique uniquement (non vendable, inscriptions 2026 closes), nécessaire pour les redoublants (P5) qui conservent des notes obtenues sous les coefficients 2026 (ex. Grand Oral coef 10) en se présentant en 2027 (coef 8).

> ⚠️ **Point `À_VERIFIER` explicitement identifié, à ne pas coder sans confirmation du Bureau des examens** : une note conservée garde-t-elle le coefficient de sa session d'obtention, ou prend-elle le coefficient de la session de représentation ? Les dispositions transitoires 2022 évoquaient un report « à due proportion des coefficients qui leur étaient attribués », mais ce n'est pas transposable sans vérification directe. Le Lot 3 (`genererCarteExamen` pour P5/P6) ne doit pas trancher ce point par une supposition — le marquer `À_VERIFIER` dans le code et le comportement par défaut (fail-closed vers révision humaine, sur le modèle de `sameSessionEligibility`).

> ⚠️ **Deuxième point `À_VERIFIER` porté par l'audit, non résolu** : le coefficient modalité B (3+3) n'est explicitement confirmé par note de service que pour l'enseignement scientifique. HG, LVA/LVB et EMC doivent être vérifiés matière par matière dans leurs notes de service respectives avant d'écrire une valeur dans `lib/exams/` — aucune généralisation par analogie entre matières.

---

## 6. Plan d'implémentation en lots (révisé)

Numérotation alignée sur le brief §14, contenu ajusté à l'existant réel.

| Lot | Contenu | Fichiers principaux touchés | Estimation |
|---|---|---|---|
| 0 | Audit (ce document) | `docs/audit-devis-candidats-libres.md` | Fait |
| 1 | Socle réglementaire étendu | `lib/exams/*` (extension) ou nouveau `lib/bac/reglementation/` selon D5 ; sessions 2026-2028 selon D6 ; modalité A/B, dispenses pratiques, perte de mention, exclusions d'options, bascule scolaire→libre, titulaire bac, second groupe | 3-4 j |
| 2 | Modèle de données | Migration Prisma additive : `ParcoursType`, `Modalite`, `ProfilCandidat`, extension `Quote` (selon D2) ; pas de nouvelle table `EpreuveCatalogue`/`ModulePedagogique` si le JSON canonique suffit (à confirmer) | 1-2 j |
| 3 | `genererCarteExamen` | Nouveau module pur, 12 tests de parcours P1-P12 | 3-4 j |
| 4 | Validation du profil | `lib/bac/validation/` sur le patron `lib/bilans/validators/` | 1-2 j |
| 5 | Tarification & garde-fous | Extension `lib/quotes/pricing.ts`/`optimizer.ts` : `COEFFICIENT_PARCOURS`, `FACTEUR_CYCLE_TERMINAL`, hiérarchisation P3, décision D1/D4 | 2-3 j |
| 6 | Wizard 11 étapes | Extension `DevisWizard.tsx` ou nouveau composant partageant `StepFieldset`/`RadioOption` ; récapitulatif latéral neuf ; persistance ; a11y (aria-live, focus) ; E2E P2/P3-bloqué/P5 | 5-7 j |
| 7 | PDF, espace client, back-office | Extension `lib/quote/pdf.ts` (carte d'examen, disclaimer) ; décision D3 ; 3 écrans back-office neufs + `<SimulateurMarge />` visuel | 4-5 j |
| 8 | Contenus publics & SEO | `/candidat-libre-bac-francais`, `/offres` (remplacement 6 SKU → 3 scénarios), FAQ, schema.org | 2 j |

Chaque lot : commit atomique, résumé des décisions prises, liste explicite de ce qui reste `À_VERIFIER`, feature flag `MOTEUR_DEVIS_V2` pour rollout progressif (brief §13).

---

## 7. Prochaine étape

Décisions **D1 à D6 tranchées** le 2026-08-23 (§5), **D4 tranché définitivement par la mission finale du 2026-08-24** (référence : **25% + 10 mensualités**, cf. §5). Plan d'implémentation détaillé du Lot 1 (socle réglementaire étendu dans `lib/exams/`) écrit, exécuté et clos : `docs/superpowers/plans/2026-08-23-lot1-socle-reglementaire.md`. La taxonomie P1-P12 (Lot 2) est désormais tranchée par la mission finale — voir `docs/candidat-individuel/ADR-PARCOURS-P1-P12.md`.
