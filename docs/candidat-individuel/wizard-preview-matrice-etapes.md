# Matrice des étapes — wizard de prévisualisation (mission "vers un produit complet" §5)

## Réconciliation des chiffres (lot de fermeture technique §2)

**Pourquoi `e940fc931` annonçait 16 étapes alors que cette matrice en contient 17** : `e940fc931` a introduit
le tableau `STEPS` avec exactement 16 entrées (`statut, anterieur, p3, cycle, modalite, specialites,
specialite_abandonnee, options, langues, resultats_anterieurs, bascule, diagnostic, budget, carte, scenarios,
coordonnees` — vérifié par lecture directe de ce commit). Le commit suivant, `afea675ff` (§5/§9 de la mission
précédente), a ajouté l'étape `etalement` entre `p3` et `cycle` en corrigeant un vrai trou (le P12 —
étalement plurisessions — n'était collecté par aucune étape). **17 est le compte exact et actuel**, pas une
erreur à corriger : `git show e940fc931:.../PublicWizardPreview.tsx | grep -c "^  '"` = 16 ;
`grep -c "^  '"` sur le fichier actuel = 17.

**Liste canonique (source unique)** : le tableau `STEPS` de
`components/dashboard/assistante/PublicWizardPreview.tsx` — reproduit intégralement ci-dessous dans la
colonne « Étape UI ». Aucun écran de résultat, de synthèse ou d'introduction n'est compté comme une étape
supplémentaire : `carte` et `scenarios` (des écrans de résultat) SONT déjà deux entrées distinctes du tableau
`STEPS` lui-même, pas des ajouts implicites.

**Pourquoi la vérification précédente n'a contrôlé que 11 « écrans » alors que le wizard compte 17 étapes** :
le script jetable utilisé alors avançait par clics successifs et ne lançait `axe` qu'après certains clics,
pas après chacun — 7 étapes (`anterieur`, `p3`, `etalement`, `cycle`, `specialite_abandonnee`, `langues`,
`bascule`) étaient traversées sans vérification individuelle, regroupées implicitement avec l'étape suivante
contrôlée. Ce n'était pas une équivalence justifiée au cas par cas — juste un raccourci du script,
maintenant corrigé.

**Correction apportée par ce lot** : `e2e/auth/candidat-individuel-a11y-keyboard.spec.ts`, committé et
rejouable (`npm run test:e2e:ephemeral`, ou `docker compose -f docker-compose.e2e.yml up --build` avec
`PLAYWRIGHT_ARGS` ciblé), visite et contrôle **chacune des 17 étapes individuellement**, en desktop et
mobile, plus une passe dédiée à la branche PREMIERE de l'étape `cycle` (le parcours principal utilisé pour
traverser les 17 étapes est en TERMINALE, qui affiche la branche « non applicable » de `cycle » — la branche
active est donc vérifiée séparément, pas laissée sans couverture). Aucune étape n'est regroupée par
« équivalence de composant » dans cette version — chacune obtient son propre résultat `axe` avec le détail
des 4 niveaux de sévérité (`critical`/`serious`/`moderate`/`minor`), pas seulement critical/serious.

---


`components/dashboard/assistante/PublicWizardPreview.tsx` — **17 étapes** (16 annoncées dans le rapport
précédent + `etalement`, ajoutée par cette vérification : le P12 n'était collecté nulle part, un vrai trou
corrigé dans ce lot, pas seulement documenté).

## Matrice reproductible (17/17 étapes testées individuellement)

Toutes les lignes ci-dessous sont couvertes par `e2e/auth/candidat-individuel-a11y-keyboard.spec.ts`
(`describe.each` sur `STEPS_IN_ORDER`, desktop 1280×1000 et mobile 390×844) — 0 violation axe à tout niveau
de sévérité sur chacune, plus une passe clavier dédiée (voir §6 pour le détail par test).

| index | route/état | intitulé | champs présents | branche conditionnelle | desktop testé | mobile testé | clavier testé | axe testé |
|---|---|---|---|---|---|---|---|---|
| 0 | `statut` | Statut | `level`, `estTitulaireBacDejaObtenu` | Aucune | ✅ | ✅ | ✅ (sélection radio) | ✅ |
| 1 | `anterieur` | Situation antérieure | `estRedoublant`, `intentionAmelioration`, `changementSpecialite` | `intentionAmelioration` affiché seulement si redoublant+Terminale | ✅ | ✅ | — | ✅ |
| 2 | `p3` | Bac accéléré (P3) | `wantsBacAccelere`, `eligibilityAnswers` | Questions d'éligibilité affichées seulement si `wantsBacAccelere` | ✅ | ✅ | — | ✅ |
| 3 | `etalement` | Étalement plurisessions (P12) | `etalementPlurisessionsDeclare` | Aucune | ✅ | ✅ | — | ✅ |
| 4 | `cycle` | Cycle complet | `intentionCycleComplet` | Branche active seulement si `level==='PREMIERE'` (testée séparément, cf. ci-dessous) ; message « non applicable » en Terminale | ✅ | ✅ | — | ✅ (branche Terminale ET branche Première) |
| 5 | `modalite` | Modalité A/B | `modalite`, `modaliteUnknown` | Aucune (choix requis pour avancer) | ✅ | ✅ | — | ✅ |
| 6 | `specialites` | Spécialités | `specialite1`, `specialite2` | Champs actifs seulement si `level==='TERMINALE'` | ✅ | ✅ | — | ✅ |
| 7 | `specialite_abandonnee` | Spécialité abandonnée | `specialiteAbandonnee` | Aucune (optionnel) | ✅ | ✅ | — | ✅ |
| 8 | `options` | Options terminale | `optionsTerminale` | Aucune (optionnel) | ✅ | ✅ | — | ✅ |
| 9 | `langues` | Langues | `langueA`, `langueB` | Aucune (optionnel) | ✅ | ✅ | — | ✅ |
| 10 | `resultats_anterieurs` | Résultats antérieurs | `resultatsAnterieursNote` | Aucune (texte libre, jamais transmis au pipeline — cf. constat sous le tableau) | ✅ | ✅ | — | ✅ |
| 11 | `bascule` | Bascule scolaire | `brancheBascule` | Aucune (optionnel) | ✅ | ✅ | — | ✅ |
| 12 | `diagnostic` | Diagnostic | Aucun champ (lien informatif) | Aucune | ✅ | ✅ | — | ✅ |
| 13 | `budget` | Budget | `budget`, `strategy` | Déclenche l'appel réel `/simulate` | ✅ | ✅ | — | ✅ |
| 14 | `carte` | Carte d'examen (résultat) | Aucun champ | Affiche le statut réel renvoyé par le pipeline | ✅ | ✅ | — | ✅ |
| 15 | `scenarios` | Scénarios (résultat) | Aucun champ | Aucune | ✅ | ✅ | — | ✅ |
| 16 | `coordonnees` | Coordonnées | `piiForm` (nom, prénom, WhatsApp, email, consentement) | Dernière étape, jamais envoyée (aperçu uniquement) | ✅ | ✅ | — | ✅ |

**Clavier** : au-delà de la sélection radio par sémantique native (ligne 0), 4 tests clavier dédiés
(non liés à une étape unique) couvrent : le lien d'évitement déplace réellement le focus vers `<main>`, le
focus n'est jamais perdu après un changement d'étape, le compteur d'étape est annoncé via `aria-live`, le
bouton retour est atteignable au clavier — voir `e2e/auth/candidat-individuel-a11y-keyboard.spec.ts`, bloc
`describe('... — keyboard-only navigation')`.

**2 champs du brief ne sont volontairement pas des étapes séparées** : `format` (présentiel/distanciel/
mixte) et `disponibilité` — aucun des deux n'existe comme concept produit réel aujourd'hui (chaque module du
catalogue déclare son propre format fixe, confirmé lors du corpus shadow synthétique §10). Construire une
étape pour un concept absent du produit serait une fiction d'interface, refusée par principe.

**1 champ affiché mais non interactif** : la session d'examen (`SUPPORTED_SESSION = 2027`) est maintenant
visible en tête de la première étape (corrigé par cette vérification — elle ne l'était pas), mais reste une
constante non éditable : une seule session est supportée par le référentiel réglementaire actuel.

| Étape UI | Champs `PublicCandidateInputRaw` | Condition d'affichage | Validation | Donnée persistée | Impact pipeline |
|---|---|---|---|---|---|
| `statut` | `level`, `estTitulaireBacDejaObtenu` (+ session affichée, non éditable) | Toujours, étape 1 | `level` requis pour avancer | localStorage (brouillon wizard) | `level`/`estTitulaireBacDejaObtenu` → `resolveParcoursType` (P1/P2 vs P7) |
| `anterieur` | `estRedoublant`, `intentionAmelioration` (si redoublant + Terminale), `changementSpecialite` | Toujours | Aucune (tout optionnel) | localStorage | P4/P5/P6 (redoublement) ; P9 modificateur (changement spécialité) |
| `p3` | `wantsBacAccelere`, `eligibilityAnswers` (5 questions) | Toujours | Aucune — déclaratif, revue humaine explicite affichée si `wantsBacAccelere` | localStorage | Alimente `bacAccelereEligibilityAnswers` → P3 côté staff (l'audit P3EligibiliteAudit reste staff-only, cette étape ne fait que déclarer l'intention) |
| `etalement` **(ajoutée par cette vérification)** | `etalementPlurisessionsDeclare` | Toujours | Aucune — avertissement « revue humaine systématique » affiché si coché | localStorage | P12 (`etalementPlurisessionsDeclare`) → `requiresHumanReview=true` systématique côté moteur |
| `cycle` | `intentionCycleComplet` | Uniquement si `level === 'PREMIERE'` (message « non applicable » sinon) | Aucune | localStorage | Distingue P10 (anticipées seules) de P1/P2 (cycle complet) pour un profil Première |
| `modalite` | `modalite`, `modaliteUnknown` | Toujours | Un choix requis (A, B, ou « je ne sais pas ») pour avancer | localStorage | `modalite: null` si « je ne sais pas » — jamais deviné (fail-closed, cohérent avec `shadow-comparison.ts`) |
| `specialites` | `specialite1`, `specialite2` | Champs actifs seulement si `level === 'TERMINALE'` (message informatif sinon) | 2 spécialités distinctes requises en Terminale pour avancer | localStorage | Détermine `eds1`/`eds2` sur la carte, base du calcul de priorité/volume |
| `specialite_abandonnee` | `specialiteAbandonnee` | Toujours (optionnel) | Aucune | localStorage | P9 (changement de spécialité) ; module MOD_SPECIALITE_ABANDONNEE potentiel |
| `options` | `optionsTerminale` | Toujours (optionnel) | Aucune | localStorage | Modules options (coefficient réglementaire non sourcé — `DIRECTION_APPROVAL_REQUIRED` systématique) |
| `langues` | `langueA`, `langueB` | Toujours (optionnel) | Aucune | localStorage | Modules MOD_LVA/MOD_LVB potentiels |
| `resultats_anterieurs` | `resultatsAnterieursNote` (texte libre) | Toujours (optionnel) | Aucune — jamais transmise au pipeline (voir note ci-dessous) | localStorage | **Aucun aujourd'hui** — voir constat sous le tableau |
| `bascule` | `brancheBascule` | Toujours (optionnel) | Aucune | localStorage | P8 (bascule scolaire → individuel) |
| `diagnostic` | Aucun champ — lien informatif vers le bilan | Toujours | Aucune | Aucune | Aucun (diagnostic réel saisi hors wizard, côté bilan) |
| `budget` | `budget` (via `monthlyBudgetTnd`), `strategy` | Toujours | `budget > 0` requis — déclenche l'appel `/simulate` au clic | localStorage + envoi au pipeline | Budget → `optimizeForBudget` (scénarios ESSENTIEL/RECOMMANDE/COMPLET) |
| `carte` | Aucun champ (résultat) | Toujours, après simulation | Affiche le statut réel (READY / revue / blocage) | Aucune (résultat éphémère, pas persisté) | Affichage de `CarteExamenResult` — épreuves, coefficients, statuts, avertissements (dont le nouvel avertissement P3, §3) |
| `scenarios` | Aucun champ (résultat) | Toujours, après `carte` | N/A | Aucune | Affichage des `QuoteScenario[]` — **prix affiché avant toute donnée personnelle (mission §10)** |
| `coordonnees` | `piiForm` (nom, prénom, WhatsApp, email, consentement) | Toujours, dernière étape | Aucune contrainte de saisie dans cette prévisualisation (voir note) | Aucune — jamais envoyée, prévisualisation uniquement | **Aucun** — ce lot ne duplique pas la création réelle du devis (`/api/quotes` existant, hors périmètre de la prévisualisation) |

## Constats explicites (pas seulement une matrice complète — deux limites réelles nommées)

1. **`resultats_anterieurs` ne pousse aucune donnée dans le pipeline.** Le champ existe dans l'état React et
   s'affiche, mais `runSimulation()` ne le transmet jamais dans le corps de la requête `/simulate` — parce
   qu'aucun champ `PublicCandidateInputRaw` ne correspond à une note antérieure déclarative libre (les seuls
   champs liés aux notes, `notesConservees`/`dispensesDeclarees`, sont staff-only par construction, cf.
   `lib/exams/normalize.ts`). Ce n'est pas un bug caché — le texte reste une intention informative pour
   l'équipe (à traiter manuellement), jamais un champ structuré consommé automatiquement. Documenté ici
   explicitement pour ne pas laisser croire que la saisie a un effet.
2. **`coordonnees` n'a aucune validation de complétude ni d'envoi réel** — cette étape est un aperçu visuel
   de l'écran final, pas une implémentation du flux de capture de lead (volontaire, voir
   `assistante-workspace-surface.md` : « ce lot ne duplique pas la création de `Quote` depuis le wizard
   public »). Un vrai wizard public devra relier ce formulaire au flux `/api/quotes` existant.

## Correction appliquée par cette vérification (pas seulement trouvée)

Avant cette vérification, **2 sujets de la liste de la mission avaient disparu sans trace** : la session
n'était affichée nulle part, et l'étalement (P12) n'était collecté par aucune étape. Les deux sont corrigés
dans ce même commit (nouvelle étape `etalement`, ligne de session ajoutée à `statut`) — la matrice ci-dessus
décrit l'état après correction, pas l'état trouvé au départ.
