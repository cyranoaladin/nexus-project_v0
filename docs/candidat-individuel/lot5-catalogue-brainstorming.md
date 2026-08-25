# Brainstorming — Catalogue de services et modules (Lot 5)

**STATUS = DIRECTION_APPROVED_FOR_IMPLEMENTATION (2026-08-25).** Les 3 arbitrages de direction sont
tranchés ci-dessous. Ce document est la référence d'architecture pour l'implémentation TDD qui suit —
committé séparément, avant tout code de ce lot.

---

## 0. Constat critique ayant motivé ce lot

Un flux public de recommandation/devis candidat-individuel est en place (`app/recommandation/page.tsx`,
`components/premium/RecommendationWizard.tsx`, `app/api/quotes/{route,recommend,margin}.ts`), entièrement
bâti sur `lib/quotes/exam-profile.ts::buildExamProfile(SituationInput)` — indépendant de tout le travail
`lib/exams/` de cette session (Lots 1-4). Grep exhaustif confirmé : aucun de ces fichiers ne référence
`ParcoursType`, `CarteExamenResult`, ou `ProfilCandidat`. `SituationInput` ne porte ni statut d'épreuve
(CONSERVEE/DISPENSEE/RECONDUITE), ni P1-P12, ni dispenses, ni options terminale — `buildExamProfile`
génère une ligne par matière comme si le candidat était systématiquement primo-candidat, cycle complet,
sans aucune dispense ni conservation. **Conséquence directement actionnable** : ce flux peut aujourd'hui
recommander et facturer la préparation d'une épreuve déjà conservée ou dispensée.

---

## 1. Réponse aux 4 questions du catalogue

| Question | Réponse |
|---|---|
| Quelle épreuve doit être préparée ? | Résolu par `lib/exams/carte.ts::genererCarteExamen` → `CarteExamenResult.epreuves[].statut`. Consommé, pas reconstruit. |
| Quel service/module couvre cette épreuve ? | N'existe pas — table épreuve→module absente partout. Construit dans ce lot, TDD. |
| Sous quel format ce service peut-il être livré ? | Partiel — `candidat_individuel_modules` porte les tarifs par format, pas le mapping module→format. Complété dans ce lot. |
| Comment sera-t-il tarifé ? | Existe — `lib/pricing.ts` + `candidat_individuel_modules`. Référencé (`pricingRuleId`), jamais dupliqué. |

---

## 2. Audit de l'existant — verdicts (recherche en lecture seule)

| Élément | Verdict |
|---|---|
| `data/pricing.canonical.json::candidat_individuel_modules` | RÉUTILISABLE TEL QUEL comme table de taux (pilotage 150/mois, petit_groupe 4/8/12h, duo 90/h, individuel min 180/h) |
| `rules.grand_oral_policy` | CONFIRMÉ, réutilisé tel quel — `{included_sessions:4, session_duration_minutes:120, total_hours_max:8}`, aucune autre valeur trouvée |
| `lib/pricing.ts` (loaders) | RÉUTILISABLE TEL QUEL |
| `lib/quotes/pricing.ts`, `optimizer.ts`, `priority.ts` | À ÉTENDRE PAR ADAPTATEUR, PAS REMPLACÉS CE LOT |
| `lib/quotes/recommendation.ts::matchCanonicalPack` | À NORMALISER (lot ultérieur — pas ce lot) : compare prix annuel + plancher d'heures, aucune vérification de périmètre/exclusions |
| `lib/quotes/diagnostic.ts::DiagnosticTier` | RÉUTILISABLE TEL QUEL — `SOLIDE/A_CONSOLIDER/A_INSTALLER/A_RECTIFIER/NON_EVALUE`. Aucune taxonomie `FRAGILE/MOYEN/BON` nulle part dans le dépôt — confirmé absente, ne pas la réintroduire. |
| Anti-double-facturation | N'EXISTE PAS — construit ce lot, TDD |
| `BusinessConfig` | RÉUTILISABLE TEL QUEL comme mécanisme d'override (nouveau namespace à ajouter plus tard, pas ce lot) |
| `lib/entitlement/`, `lib/operational-catalog.ts` | SANS RAPPORT — collision de nom à éviter : `operational_special_packs.GRAND_ORAL` (pack ARIA, produit différent) vs `rules.grand_oral_policy` (politique candidat-individuel) |
| `dispensePartiePratique` | CONFIRMÉ — NSI, PHYSIQUE_CHIMIE, SCIENCES_INGENIEUR, SVT exactement |

---

## Décision 1 — Séquençage : catalogue + adaptateur, recâblage public différé

**Choisi** : construire le catalogue canonique, la matrice carte→modules, l'anti-doublon, et un
adaptateur produisant le contrat actuellement attendu par le moteur existant (`ExamProfileSubject[]`
-compatible), avec des tests de compatibilité. **Ne pas** recâbler `/recommandation`/`RecommendationWizard`
sur le nouveau moteur dans ce lot — lot séparé, explicitement annoncé.

### Confinement obligatoire du flux legacy (mesure immédiate, ce lot)

Tant que le flux public repose sur `SituationInput` seul :

- Toute estimation produite par ce chemin est explicitement qualifiée de **provisoire**.
- Elle n'affirme jamais que toutes les épreuves affichées sont effectivement à présenter.
- Elle indique que notes conservées, reconductions et dispenses seront vérifiées avant émission
  définitive.
- Tout `Quote` persisté depuis ce chemin porte une provenance explicite (moteur legacy / profil
  réglementaire incomplet / carte non validée / revue humaine obligatoire).
- Il ne peut pas être automatiquement envoyé comme devis définitif, ni automatiquement accepté comme
  contrat définitif.
- Son PDF, si généré, est marqué « estimation provisoire ».
- La transformation en devis définitif exige : un `ProfilCandidat`, une validation réussie, une carte
  d'examen, les deux gates d'émission (`validateProfilCandidat` + `genererCarteExamen`) à `true`, un
  snapshot des règles et de la carte.

**Implémentation retenue** : un champ additif de maturité réglementaire sur `Quote` (nom exact et détail
technique dans le plan d'implémentation, voir §4bis) plutôt qu'un détournement du statut commercial
existant (`QuoteStatus` reste inchangé — DRAFT/SENT/etc. ; la maturité réglementaire est une dimension
orthogonale). Garde-fou ciblé, rétrocompatible (défaut sur les lignes existantes = comportement actuel
inchangé), couvert par des tests. Le parcours public existant n'est pas cassé.

---

## Décision 2 — Volumes des modules : structure complète, aucune invention

**Choisi** : catalogue structurellement complet ; tout module sans volume fiable porte un état typé
explicite `DIRECTION_A_VALIDER` (jamais `0`, `null`, ou une valeur arbitraire). Le typage distingue :
module sans volume applicable, module forfaitaire, module inclus (dans un service transverse), volume
réellement nul, volume non encore décidé (`DIRECTION_A_VALIDER`), volume calculé (dérivé d'une offre
existante), volume plafonné (ex. Grand Oral), volume estimatif.

**Modules concernés en priorité** : LVA, LVB, spécialité non poursuivie, HG en autonomie guidée,
enseignement scientifique en autonomie guidée, EMC en autonomie guidée, accompagnement EPS, descriptif
EAF (si non déjà dérivable), options, tutorat de compression, second groupe.

**Fiches d'arbitrage** : pour chaque module `DIRECTION_A_VALIDER`, une fiche livrée dans
`docs/candidat-individuel/lot5-fiches-arbitrage-volumes.md` (épreuve couverte, coefficient, nature
écrit/oral, contenu du service, format, séances proposées, durée, volume synchrone/autonomie,
évaluations incluses, hypothèses basse/recommandée/renforcée, coût de production estimé, prix résultant,
marge selon effectif, compatibilité avec les 6 offres, recommandation argumentée) — **propositions
soumises à validation commerciale/pédagogique, pas des données actives.**

**Règle de blocage** : un module `DIRECTION_A_VALIDER` peut apparaître dans la carte de couverture, comme
besoin identifié, signalé au personnel — mais ne peut jamais recevoir silencieusement un prix, entrer
dans un total définitif, permettre l'émission automatique, ou être présenté comme une prestation
contractuellement arrêtée. Testé explicitement (§ tests).

---

## Décision 3 — Échéancier P11 : différé au lot moteur tarifaire

**Choisi** : P11 décrit dans le catalogue uniquement comme produit autonome (2 disciplines, volume
court, fenêtre contrainte, prestation synchrone, disponibilité à confirmer, tarification distincte de
l'annuel, échéancier spécifique requis) — **sans** acompte 25%, sans 10 mensualités, sans intégration à
un pack Terminale annuel, sans règle de prorata annuel. Aucun montant/échéancier inventé ce lot.

---

## 4. Architecture de l'adaptateur (transitoire)

Entrée : `{ profilValide, parcours: ParcoursResolution, carte: CarteExamenResult, selection:
CatalogueSelection }`. Sortie temporaire : forme compatible `ExamProfileSubject[]` consommée sans
modification par `diagnostic.ts`/`priority.ts`/`optimizer.ts`/`pricing.ts`/`recommendation.ts`.

Règles :
- Exclut les épreuves `CONSERVEE`, `RECONDUITE`, ou `DISPENSEE` **confirmées** (pas les cas incertains).
- Maintient les épreuves `A_PRESENTER`.
- Bloque (ne convertit pas silencieusement en "pas de besoin") les dispenses seulement déclarées et les
  mécanismes de notes indéterminés — ces cas remontent comme `necessiteVerificationHumaine`, jamais
  comme absence de ligne.
- Conserve avertissements et raison de chaque exclusion (traçabilité, pas une simple soustraction).
- Transmet l'autorisation/interdiction d'émission (`canEmitAutomatically`) jusqu'au consommateur.

**Responsabilité** : ponter le nouveau moteur carte-aware vers l'ancien moteur commercial sans perte
d'information, le temps que `/recommandation` soit recâblé.
**Limites** : ne remplace pas `matchCanonicalPack`/l'anti-doublon pack-level (hors périmètre ce lot) ;
opère uniquement côté staff/interne pour l'instant (pas branché sur `/recommandation`).
**Condition de retrait** : dès que `/recommandation`/`RecommendationWizard`/les routes `app/api/quotes/*`
consomment directement `CatalogueSelection`/`CarteExamenResult`, cet adaptateur devient mort et doit être
supprimé dans le même lot qui fait ce recâblage — jamais laissé comme code mort indéfiniment.
**Consommateurs legacy actuels** : `app/recommandation/page.tsx`, `RecommendationWizard.tsx`,
`app/api/quotes/{route,recommend,margin}.ts`.
**Futur consommateur carte-aware** : un lot séparé et explicitement annoncé, non planifié ici.

**Garde architectural** : un test d'architecture (`__tests__/architecture/*`, sur le modèle de
`candidat-libre-runtime-reachability.test.ts` déjà existant dans le dépôt) doit vérifier qu'aucun second
moteur de recommandation permanent ne se construit autour de cet adaptateur — l'adaptateur reste un pont
à sens unique (carte-aware → legacy shape), jamais l'inverse, jamais un point d'extension pour de la
nouvelle logique métier.

---

## 5. Modèle du catalogue et anti-double-facturation

Chaque module/service porte : `serviceId`/`moduleId`, `epreuveCodes` (référence `lib/exams/`, jamais
redéfini), `deliveryMode` (modalité), `coverageKeys` (liste de clés de couverture uniques),
`pricingRuleId` (référence `candidat_individuel_modules`, jamais un prix en dur), `volumePolicy` (typé
selon Décision 2), `inclusionPolicy` (inclus dans un service transverse / vendable séparément),
`requiresHumanReview`, `directionApprovalStatus`.

**Coverage keys** (exemples, liste non exhaustive) : `PILOTAGE_REGLEMENTAIRE`, `DIAGNOSTIC_STRATEGIQUE`,
`CARTE_EXAMEN`, `APPUI_CYCLADES`, `SUIVI_ECHEANCES`, `ARIA_ACCESS`, `BILANS_PERIODIQUES`, `EAF_ECRIT`,
`EAF_ORAL`, `EAF_DESCRIPTIF`, `GRAND_ORAL`. Si un pack couvre déjà une clé, une ligne élémentaire portant
la même clé n'est pas facturée une seconde fois — le résultat de résolution **explique** la suppression
(pas seulement la fait silencieusement).

---

## 6. Pilotage Nexus — socle obligatoire

Le Pilotage reste le socle obligatoire des parcours annuels candidat-individuel (hors P11/P12
particuliers). Il couvre déjà diagnostic, analyse réglementaire, carte d'examen, appui Cyclades, suivi
des échéances, ARIA, bilans, espaces associés — aucune ligne payante supplémentaire pour les mêmes
couvertures. Rendre certains services optionnels/séparés serait une décision commerciale versionnée
future, pas une conséquence technique de ce lot.

---

## 7. Six offres existantes — matrice et classification

| Offre | Services inclus | Volume | Prix annuel | Acompte (25%) | 10 mensualités | Classification |
|---|---|---:|---:|---:|---:|---|
| Pilotage | Bilan diagnostique, analyse réglementaire, carte, appui Cyclades, espaces élève/parent, plan de travail, bilans périodiques | 0h/mois | 1500 | 380 | 112 | Pack canonique actif |
| Sur mesure | Pilotage complet + 1 module 8h/mois petit groupe | 8h/mois | 6200 | 1550 | 465 | Pack canonique actif (repère "à partir de" pour tout besoin mono-matière) |
| Cap Anticipées (Première) | Pilotage + EAF 8h + Maths anticipées 4h | 12h/mois | 7900 | 1980 | 592 | Pack canonique actif |
| Renforcée (Première) | Cap Anticipées (12h) + 8h selon diagnostic/carte | 20h/mois | 11900 | 2980 | 892 | Pack canonique actif |
| Focus Bac (Terminale) | EDS1 8h + EDS2 8h + Philo 4h + Grand Oral 8h/an (hors plafond mensuel) | 20h/mois | 12900 | 3220 | 968 | Pack canonique actif |
| Intégrale (Terminale) | Jusqu'à 30h/mois selon diagnostic, 2 EDS + Philo, Grand Oral inclus dans le plafond, HG/LVA/LVB/ES selon besoin | 30h/mois | 16900 | 4220 | 1268 | Pack canonique actif |

**Anomalie relevée pendant l'audit, à corriger dans les données (pas dans ce document)** : les offres
Cap Anticipées et Renforcée listent explicitement "Pilotage Nexus complet" dans `included`, mais Focus
Bac et Intégrale ne le mentionnent pas dans leur propre liste `included` alors qu'elles sont présumées le
couvrir aussi — incohérence de texte libre, exactement le type de problème que les `coverageKeys`
structurés (§5) doivent rendre vérifiable par machine plutôt que par relecture humaine.

**Aucune des 6 offres n'est ni supprimée ni reprix cette étape.** Le moteur ne sélectionne un pack que si
sa couverture (coverage keys) est supérieure ou égale à celle des modules comparés — règle déjà en germe
dans `matchCanonicalPack` (plancher d'heures + prix annuel), à étendre avec les coverage keys dans le lot
de normalisation ultérieur (hors périmètre immédiat de ce lot, la vérification structurelle du catalogue
suffit ici).

---

## 8. Taxonomie diagnostique

`SOLIDE/A_CONSOLIDER/A_INSTALLER/A_RECTIFIER/NON_EVALUE` réutilisée exclusivement — confirmé, aucune
autre taxonomie dans le dépôt. Politique `NON_EVALUE` : estimation provisoire, volume par défaut
explicitement identifié comme tel (pas silencieusement traité comme `A_CONSOLIDER`), recommandation
d'effectuer le diagnostic affichée, aucune personnalisation fine prétendue.

---

## 9. Grand Oral

Politique conservée sans modification : 4×2h = 8h annuelles maximum, jamais 14/18/24h. Vérification
anti-doublon explicite entre inclusion Focus Bac, inclusion Intégrale, ligne élémentaire Grand Oral, et
tout pack/service transverse futur — testé.

---

## Ce que ce lot NE fait PAS

- Ne recâble pas `/recommandation`/`RecommendationWizard` sur le nouveau catalogue (lot séparé).
- Ne construit pas les Gates 1/2 de `ADR-dette-reconduction-p3-gates.md` (hors périmètre, déjà tracé).
- Ne fixe aucun volume de module non dérivable des 6 offres existantes (`DIRECTION_A_VALIDER`).
- Ne définit pas l'échéancier P11 (différé au lot moteur tarifaire).
- Ne touche pas `lib/entitlement/`, `lib/operational-catalog.ts`, ni aucun pack ARIA existant.
- Ne modifie ni les noms ni les prix des 6 offres.
