# Matrice commerciale détaillée — lot de fermeture P11/P3 (mission "vers un produit complet" §4)

**Rôle de ce document** : version considérablement enrichie de `dossier-decisionnel-14-elements.md`
(gardé tel quel, non remplacé), répondant point par point à la demande explicite de la direction : une fiche
réellement arbitrable par élément (13 éléments actifs — le 14ᵉ, `SVC_TUTORAT_COMPRESSION`, reste retiré du
catalogue, voir `resolution-tutorat-compression.md`), avec les marges recalculées **via la formule réelle du
moteur** (`computeMargin`, `lib/quotes/margin.server.ts:73-99`) aux effectifs 1 à 5, sous les seuils
**45 % = bloquant / 55 % = cible** — seuils déjà décidés et codés (`lib/quotes/pricing-engine.ts`,
`MARGIN_BLOCKING_THRESHOLD_PCT`/`MARGIN_TARGET_THRESHOLD_PCT`) mais jamais raccordés à aucun chemin réel
(voir Constat n°6) ; le gate réellement exécuté aujourd'hui à la création d'un devis reste 30 %/40 %.

**Statut global : aucune valeur n'est approuvée.** Ce document n'active rien, ne modifie aucune donnée réelle,
ne débloque aucune émission.

**Méthode de calcul (vérifiée)** : un script jetable (non committé, supprimé après usage) a reproduit
littéralement la formule de `computeMargin` — revenu (somme des `unitPriceMonthly`), coût enseignant
(`teacherCostPerHourTnd × heures ÷ taille_de_groupe` pour `GROUPE`, `÷2` pour `DUO`, sans division pour
`INDIVIDUEL`), coût variable (`variableCostPerStudentMonthTnd × nombre_de_lignes`), marge = contribution ÷
revenu. **Vérification de non-divergence** : le script appelle aussi `computeMargin` réellement (bloqué en
import direct par la garde `server-only` du fichier — impossible d'exécuter le module serveur dans un script
autonome ; la formule a donc été recopiée à l'identique après lecture ligne à ligne du fichier, puis
validée en comparant sa sortie à celle de `computeMargin` appelé sur le même cas à effectif=3, taille de
groupe conservatrice par défaut du moteur) : `marginPct` obtenu par les deux chemins = `41.134751773...`,
identique au dernier bit — **confirmé, aucune divergence**. Le moteur réel ne prend **aucun paramètre
d'effectif** (`CONSERVATIVE_GROUP_SIZE = 3` est câblé en dur) — voir Constat n°1.

---

## Constats transversaux (à lire avant les fiches)

**1. Le moteur réel ne calcule pas de marge par effectif — il assume toujours 3 élèves.**
`computeMargin` n'accepte pas de paramètre de taille de groupe ; `CONSERVATIVE_GROUP_SIZE = 3` est une
constante interne. Le tableau « marge selon effectif » ci-dessous est donc **une extension légitime de la
même formule, avec la taille de groupe rendue variable pour répondre à la question posée par la direction**
— jamais un calcul indépendant. Mais telle qu'elle existe aujourd'hui en production, `computeMargin` ne
peut *jamais* distinguer un devis à 1 élève d'un devis à 5 : le gate de marge actuel (30 %/40 %, voir
Constat n°6) s'applique donc **uniformément**, en assumant toujours 3, y compris pour un groupe qui
n'ouvrirait qu'à 1 ou 2 élèves réels. C'est une lacune produit réelle, indépendante de ce lot : si la
direction veut un gate de marge sensible à l'effectif réel, `computeMargin` doit être modifié pour recevoir
l'effectif constaté (ou prévu) en paramètre — non fait ici, hors périmètre du lot P11/P3.

**2. Deux hypothèses de coût enseignant coexistent et donnent des verdicts opposés.**
- Politique **actuellement en vigueur par défaut dans le code** (`DEFAULT_COST_POLICY`,
  `lib/quotes/margin.server.ts:38-42`, utilisée si aucune ligne `BusinessConfig` namespace
  `quotes.costPolicy` n'existe) : `teacherCostPerHourTnd = 100`, `variableCostPerStudentMonthTnd = 10`.
- Hypothèse **« certifié »** documentée dans `proposition-calibration-couts-v1.md` (jamais injectée dans le
  moteur, jamais approuvée) : `teacherCostPerHourTnd = 50`.
  Sous les seuils proposés 45 %/55 %, la politique **réellement active aujourd'hui** bloque le palier
  recommandé (8h/470 TND) d'un module `MOD_*` jusqu'à l'effectif 4 inclus (marge 41,1 % à l'effectif 3,
  sous le seuil de 45 %) — alors que l'hypothèse « certifié » (jamais injectée) le validerait dès
  l'effectif 2 (55,3 %). **Tant que la direction n'a pas statué sur la politique de coût réelle à charger
  dans `BusinessConfig`, le moteur tourne aujourd'hui avec l'hypothèse la plus dure des deux** (100 TND/h),
  ce qui est fail-closed par défaut (aucun override n'existe en base à ce jour) mais n'a jamais été signalé
  explicitly comme un choix — c'est un fait technique, pas une décision produit.

**3. `computeMargin` n'est utilisé aujourd'hui que par la route de création de devis interne**
(`app/api/assistante/candidat-individuel/profils/[id]/quote/route.ts`), jamais par le pipeline public. Les
montants ci-dessous sont donc représentatifs de ce que verrait une assistante au moment de la création d'un
devis, pas d'un calcul déjà exposé publiquement.

**4. Unité de coût enseignant** : le modèle actuel n'a qu'un seul poste de coût enseignant par heure — pas
de décomposition "enseignant / structure / fixe" séparée dans le moteur réel. La décomposition
enseignant+structure utilisée dans les fiches ci-dessous (ex. 50 TND enseignant + 15 TND structure = 65
TND/h "certifié") vient uniquement de `proposition-calibration-couts-v1.md`, jamais injectée dans
`computeMargin`, qui ne connaît qu'un seul nombre agrégé (`teacherCostPerHourTnd`).

**5. Aucun "coût fixe dossier" n'existe dans le moteur.** `variableCostPerStudentMonthTnd` (10 TND/mois/
élève par défaut) est le seul coût non lié aux heures ; il n'y a pas de ligne distincte pour un coût fixe
d'ouverture de dossier, de correction administrative, ou de structure hors séance.

**6. 45 %/55 % ne sont pas une invention de ce document — ils sont DÉJÀ codés, mais dans du code mort.**
Correction importante par rapport à une version précédente de cette analyse : `lib/quotes/pricing-engine.ts`
définit déjà `MARGIN_BLOCKING_THRESHOLD_PCT = 45` et `MARGIN_TARGET_THRESHOLD_PCT = 55` (ligne 371-372,
commentaire d'origine : *"mission §7/§9 — bloquante <45%, signalée <55%"* — décidés lors d'une phase
antérieure de ce dossier), avec sa propre fonction `computeMargin(priceTnd, costTnd)` et
`assertMarginAcceptable`. **Mais ni l'une ni l'autre n'a le moindre appelant** en dehors de leur propre
fichier (vérifié par grep sur tout le dépôt) — **exactement le même défaut que `computeSecondGroupePayment`
avant ce lot, et que `resolveGroupModality` (Constat DUO/SOLO ci-dessus)**. Le chemin réellement exécuté
aujourd'hui à la création d'un devis (`app/api/assistante/candidat-individuel/profils/[id]/quote/route.ts`)
appelle une fonction **différente et sans lien** — `lib/quotes/margin.server.ts::computeMargin(lines,
policy)` (même nom, fichier différent, signature différente — deux fonctions homonymes non liées) — dont les
seuils réels par défaut sont **30 % (bloquant) / 40 % (cible)** (`DEFAULT_COST_POLICY.marginGates`) avec un
coût enseignant unique blended de 100 TND/h (pas de distinction agrégé/certifié/tuteur). **Troisième
occurrence du même schéma architectural dans cette session** (mécanisme correct mais jamais raccordé) — les
tableaux ci-dessous appliquent 45 %/55 % comme demandé par la mission, en le signalant explicitement comme
une réutilisation d'un seuil déjà décidé mais non actif, pas une nouvelle proposition arbitraire.

---

## 1 — MOD_LVA (Langue vivante A)

| Champ | Valeur |
|---|---|
| Code | `MOD_LVA` |
| Service rendu | Renforcement écrit + oral de LVA pour un candidat libre sans enseignement d'établissement |
| Population | Candidats libres Terminale ayant conservé/repassant l'épreuve `lva` |
| Statut réglementaire | Épreuve obligatoire du bac général — aucune ambiguïté réglementaire sur ce module |
| Unité de vente | Forfait mensuel par élève (`petit_groupe`) |
| Période | Mensuel, sur la durée de préparation (jusqu'à 10 mois selon le profil) |
| Heures | Live uniquement (pas de tutorat/ARIA distinct) : 4h/8h/12h selon palier |
| Effectifs min/max | Min 1 (ouverture DUO/SOLO en dessous du seuil), cible 3, max non plafonné par le moteur (revenu par élève reste identique) |
| Catégorie d'intervenant | Enseignant certifié standard |
| Coût enseignant (certifié, hyp.) | 50 TND/h |
| Coût structure (hyp.) | 15 TND/h |
| Coût total "certifié" retenu (8h) | 520 TND (8×50 + 8×15) |
| Prix minimal / recommandé / renforcé | 250 / 470 / 680 TND/élève/mois (tarif existant, réutilisé tel quel) |
| Raison métier des 3 paliers | minimal = socle 4h suffisant pour un rattrapage ciblé ; recommandé = 8h, volume standard des offres existantes ; renforcé = 12h pour un déficit important à rattraper en peu de mois |

**Revenu et marge — palier recommandé (8h @ 470 TND), politique de coût RÉELLEMENT ACTIVE (100 TND/h, seuils
proposés 45 %/55 %)** :

| Effectif | Coût enseignant | Contribution | Marge | Verdict (45/55) | Prix mini pour BLOCK(45%) | Prix mini pour TARGET(55%) |
|---|---|---|---|---|---|---|
| 1 | 800,0 TND | −340,0 TND | −72,3 % | **BLOCK** | 1473 TND | 1800 TND |
| 2 | 400,0 TND | 60,0 TND | 12,8 % | **BLOCK** | 745 TND | 911 TND |
| 3 (défaut moteur) | 266,7 TND | 193,3 TND | 41,1 % | **BLOCK** | 503 TND | 615 TND |
| 4 | 200,0 TND | 260,0 TND | 55,3 % | PASS_TARGET | 382 TND | 467 TND |
| 5 | 160,0 TND | 300,0 TND | 63,8 % | PASS_TARGET | 309 TND | 378 TND |

**Sous hypothèse « certifié » (50 TND/h, jamais injectée dans le moteur)** : PASS_TARGET dès l'effectif 2
(55,3 %). Écart de verdict majeur entre les deux hypothèses — voir Constat n°2.

**Comportement sous effectif minimal (< 3, l'hypothèse conservatrice du moteur)** : le moteur ne bloque
**pas** aujourd'hui la création d'un devis à 1 ou 2 élèves — `computeMargin` n'est jamais appelé avec
l'effectif réel, seulement avec l'hypothèse fixe 3. Un devis à 1 élève au tarif recommandé produirait donc en
réalité une marge de −72,3 % (perte nette) sans qu'aucun gate ne s'en aperçoive, tant que la taille réelle du
groupe n'est pas remontée au moteur.

**Bascule DUO/SOLO** : `resolveGroupModality` (`lib/quotes/pricing-engine.ts:127-145`) implémente déjà la
logique réelle (seuil `group_min_open=3`, données existantes dans `data/pricing.canonical.json`, bascule
DUO à effectif 2, SOLO en dessous) — mais **c'est exactement le même défaut que `computeSecondGroupePayment`
avant ce lot** : vérifié par grep, `resolveGroupModality` n'a **aucun appelant en dehors de sa propre
définition et d'un message d'erreur** (`resolveCatalogueModules` refuse même de pricer une ligne `per_hour`
sans passer par elle, mais rien dans `pipeline.ts`/`catalogue.ts` ne l'appelle jamais). La bascule DUO/SOLO
est donc **mécanisme mort**, exactement comme P11 l'était avant cette session — aucune bascule automatique
n'empêche aujourd'hui un groupe à 1 élève de rester tarifé au tarif `petit_groupe` plein. **Hors périmètre
de ce lot de fermeture (mandat = P11/P3 uniquement)** — signalé ici pour la direction, pas corrigé dans
cette session.

**Inclusion/supplément** : supplément — absent des 6 offres actuelles.

**Décision attendue** : (a) approuver 250/470/680 TND ; (b) statuer sur la politique de coût réelle à
charger en `BusinessConfig` (100 TND/h par défaut vs 50 TND/h hypothèse "certifié") ; (c) statuer sur les
seuils 45 %/55 % vs les 30 %/40 % actuellement actifs ; (d) exiger le raccordement de l'effectif réel à
`computeMargin` avant toute activation commerciale à effectif variable.

## 2 — MOD_LVB (Langue vivante B)

Identique à `MOD_LVA` en tout point (même famille tarifaire `petit_groupe`, même formule, mêmes montants) —
épreuve couverte : `lvb`. Seule différence commerciale documentée : population historiquement plus faible
(moins de candidats libres conservent LVB), donc risque d'effectif sous 3 **plus élevé** en pratique — le
Constat sur l'absence de gate d'effectif réel (ci-dessus) s'applique avec un risque accru ici.

**Décision attendue** : identique à MOD_LVA.

## 3 — MOD_SPECIALITE_ABANDONNEE

Identique à `MOD_LVA` en grille tarifaire, coût et marge. Différences :

| Champ | Valeur |
|---|---|
| Service rendu | Socle méthodologique/culture générale sur la spécialité de 1ère abandonnée — hors épreuve du bac |
| Statut réglementaire | **Ne couvre aucune épreuve notée** — avertissement commercial obligatoire requis à l'affichage |
| Épreuve couverte | Aucune |

**Décision attendue** : approuver la grille (identique MOD_LVA) + le principe d'un avertissement obligatoire
et non contournable côté affichage famille (« ne prépare aucune épreuve du bac »).

## 4 — MOD_HG_ARIA (autonomie guidée)

| Champ | Valeur |
|---|---|
| Code | `MOD_HG_ARIA` |
| Service rendu | Parcours structuré en autonomie + suivi humain ponctuel, sans cours de groupe |
| Population | Candidats libres Terminale conservant `histoire-geographie` |
| Statut réglementaire | Épreuve obligatoire — aucune ambiguïté |
| Unité de vente | Forfait mensuel individuel (`autonomie_guidee_aria`) |
| Heures | Synchrone 0,25h/0,5h/1h + autonomie 2h/3h/4h selon palier — **pas de "live" au sens `petit_groupe`** |
| Effectifs min/max | Non applicable — produit individualisé par construction, pas de notion de groupe |
| Catégorie d'intervenant | Tuteur (pas un enseignant certifié — accompagnement, pas cours) |
| Coût tuteur retenu | 35 TND/h × 0,5h = 17,5 TND/mois (palier recommandé) |
| Prix minimal / recommandé / renforcé | 20 / 40 / 80 TND/mois `[hypothèse Claude — jamais approuvée]` |
| Raison métier des 3 paliers | minimal = suivi a minima (0,25h/mois) pour un élève déjà autonome ; recommandé = 0,5h, format standard ; renforcé = 1h pour un élève nécessitant davantage d'accompagnement humain |

**Marge (non dépendante de l'effectif — produit individuel)** :

| Palier | Prix | Coût | Marge | Verdict (45/55) |
|---|---|---|---|---|
| minimal | 20 TND | 17,5 TND | **12,5 %** | **BLOCK** |
| recommandé | 40 TND | 17,5 TND | 56,3 % | PASS_TARGET |
| renforcé | 80 TND | 17,5 TND | 78,1 % | PASS_TARGET |

**Anomalie confirmée (voir Constat de mission)** : le palier minimal à 20 TND est **mécaniquement bloqué**
sous les seuils proposés — 12,5 % de marge, très en dessous de 45 %. Prix plancher pour atteindre BLOCK
(45 %) : 31,8 TND ; pour TARGET (55 %) : 38,9 TND. **Le prix minimal de 20 TND ne peut pas être recommandé
tel quel si la direction approuve le gate 45 %/55 % — soit le prix plancher remonte à ~32-39 TND, soit ce
palier reste `BELOW_TARGET`/`BLOCK` assumé (produit d'appel à marge sacrifiée), décision explicite requise.**

**Inclusion/supplément** : supplément — le Pilotage (150 TND/mois) inclut l'accès à la plateforme ARIA mais
pas le suivi humain dédié facturé ici.

**Décision attendue** : (a) créer le tier `autonomie_guidee_aria` (migration additive, non faite) ; (b)
approuver ou corriger le prix minimal de 20 TND compte tenu du blocage mécanique ci-dessus ; (c) statuer sur
le statut d'intervenant "tuteur" vs "enseignant certifié" (coût très différent : 17,5 vs 25 TND pour 0,5h à
50 TND/h).

## 5 — MOD_ES_ARIA

Identique à `MOD_HG_ARIA` en tout point — épreuve couverte : `enseignement-scientifique`. Même anomalie sur
le palier minimal (12,5 % de marge, BLOCK sous 45/55).

## 6 — MOD_EMC_ARIA

Identique à `MOD_HG_ARIA` — épreuve couverte : `emc`. Même anomalie. **Une seule décision de direction peut
couvrir les 3 modules ARIA (4-6)** si la grille et le correctif de prix minimal sont acceptés en bloc.

## 7 — MOD_EAF_DESCRIPTIF

| Champ | Valeur |
|---|---|
| Code | `MOD_EAF_DESCRIPTIF` |
| Service rendu | Aide à la constitution du descriptif des textes/œuvres (obligation réglementaire de l'EAF) |
| Population | Candidats libres Première (EAF anticipée) |
| Statut réglementaire | Obligation administrative liée à l'EAF — pas une épreuve notée en tant que telle |
| Unité de vente | Séances individuelles (`individuel_presentiel`), tarif existant réutilisé |
| Heures | 1h/2h/3h selon palier |
| Effectifs min/max | Non applicable — individuel par construction |
| Catégorie d'intervenant | Enseignant certifié |
| Coût retenu | 65 TND/h certifié (50 enseignant + 15 structure) |
| Prix minimal / recommandé / renforcé | 180 / 360 / 540 TND |
| Raison métier | 1 séance = constitution minimale ; 2 séances = révision + finalisation (standard) ; 3 séances = accompagnement complet pour un dossier plus complexe |

**Marge (constante aux 3 paliers, produit individuel)** :

| Palier | Heures | Prix | Coût | Marge | Verdict (45/55) |
|---|---|---|---|---|---|
| minimal | 1h | 180 TND | 65 TND | 63,9 % | PASS_TARGET |
| recommandé | 2h | 360 TND | 130 TND | 63,9 % | PASS_TARGET |
| renforcé | 3h | 540 TND | 195 TND | 63,9 % | PASS_TARGET |

**Anomalie signalée par la mission (180/360/540 vs coût 130 TND)** : confirmée mais **non problématique** —
marge saine à 63,9 % aux 3 paliers ; l'écart initial signalé (coût "130 TND" comparé à un prix "180") vient
de la comparaison palier-mini (180) au coût du palier recommandé (130, 2h) — une fois chaque palier comparé
à son propre coût, aucune anomalie de marge ne subsiste.

**Inclusion/supplément** : supplément optionnel, jamais inclus par défaut dans le forfait EAF 8h/mois.

**Décision attendue** : approuver le principe opt-in + la grille 180/360/540 TND.

## 8 — MOD_MATHS_EXPERTES (option)

| Champ | Valeur |
|---|---|
| Code | `MOD_MATHS_EXPERTES` |
| Service rendu | Préparation à l'option Mathématiques Expertes (points bonus, loi des points) |
| Statut réglementaire | Option facultative — **coefficient non sourcé dans le dépôt**
(`OPTION_COEFFICIENT_NON_SOURCE`, dette technique documentée séparément, hors périmètre commercial) |
| Grille / coût / marge | Identiques à `MOD_LVA` (250/470/680 TND, mêmes tableaux d'effectif ci-dessus) |
| Décision attendue | (a) approuver le prix **par anticipation** ; (b) confirmer que l'activation technique reste bloquée tant que le coefficient n'est pas sourcé réglementairement — deux décisions distinctes, jamais fusionnées |

## 9 — MOD_MATHS_COMPLEMENTAIRES (option)

Identique à `MOD_MATHS_EXPERTES` en tout point. Une décision de direction peut couvrir les 4 options (8-11)
en bloc si la grille est acceptée.

## 10 — MOD_DGEMC (option)

Identique à `MOD_MATHS_EXPERTES`.

## 11 — MOD_LCA (option)

Identique à `MOD_MATHS_EXPERTES`, avec avertissement supplémentaire : population de candidats très faible —
la bascule DUO/SOLO (non automatisée aujourd'hui, voir Constat n°1) sera ici la **norme**, pas l'exception,
ce qui aggrave le risque de marge négative documenté pour MOD_LVA à effectif 1-2.

## 12 — SVC_BACS_BLANCS

| Champ | Valeur |
|---|---|
| Code | `SVC_BACS_BLANCS` |
| Service rendu | Mise en situation d'examen + correction individualisée |
| Population | Tout candidat libre, générique à toute épreuve écrite du profil |
| Statut réglementaire | Aucune contrainte réglementaire — produit purement commercial |
| Unité de vente | À l'unité ou en package annuel |
| Nombre de bacs blancs | 1 / 2 / 3 selon palier |
| Effectifs min/max | Non applicable — 1 copie = 1 élève |
| Catégorie d'intervenant | Correction : enseignant certifié (30 min) + restitution : tuteur (15 min) |
| Coût unitaire | 41,25 TND/bac (30min×50 certifié + 15min×(35 tuteur + structure, agrégé)) |
| Prix minimal / recommandé / renforcé | 95 / 190 / 285 TND `[hypothèse Claude — jamais approuvée]` |

**Marge (constante aux 3 paliers)** :

| Palier | Bacs | Prix | Coût | Marge | Verdict (45/55) |
|---|---|---|---|---|---|
| minimal | 1 | 95 TND | 41,25 TND | 56,6 % | PASS_TARGET |
| recommandé | 2 | 190 TND | 82,5 TND | 56,6 % | PASS_TARGET |
| renforcé | 3 | 285 TND | 123,75 TND | 56,6 % | PASS_TARGET |

**Anomalie signalée par la mission (95/190/285 vs coût 82,5 TND)** : même remarque que MOD_EAF_DESCRIPTIF —
82,5 TND est le coût du palier **recommandé** (2 bacs), pas du palier minimal (1 bac, coût réel 41,25 TND).
Comparaison palier-à-palier correcte : marge saine et constante à 56,6 %, pas d'anomalie de fond, seulement
une ambiguïté unité-vs-package dans la présentation initiale — clarifiée ici.

**Inclusion/supplément** : supplément visible — le Pilotage (150 TND/mois) ne couvre aucun temps de
correction dédié.

**Décision attendue** : approuver 95/190/285 TND + la fréquence recommandée (2/an).

## 13 — SVC_TUTORAT_COMPRESSION — RETIRÉ DU CATALOGUE ACTIF

Aucun changement depuis `dossier-decisionnel-14-elements.md` — concept jamais défini dans le dépôt, retiré
par principe (double invention refusée). Aucune décision tarifaire à prendre.

## 14 — SVC_SECOND_GROUPE (P11)

| Champ | Valeur |
|---|---|
| Code | `SVC_SECOND_GROUPE` |
| Service rendu | Rattrapage de 2 disciplines dans la fenêtre contrainte post-1er groupe (parcours P11) |
| Population | Candidats en 2nd groupe (rattrapage), moyenne comprise dans `[8, 10]` |
| Statut réglementaire | Classification légale **non bloquée** (`requiresHumanReview: false` au niveau parcours) — seul le prix `SVC_SECOND_GROUPE` reste `DIRECTION_A_VALIDER` (question commerciale, pas légale) |
| Unité de vente | Forfait unique, paiement intégral à la réservation (`PAY_IN_FULL_AT_BOOKING`, voir mission §2) |
| Période | Ponctuel — pas de mensualisation, pas d'échéancier annuel |
| Heures | 6h/10h/16h total (3h/5h/8h par discipline) selon palier — format `individuel` |
| Effectifs min/max | Non applicable — individuel par construction |
| Catégorie d'intervenant | Enseignant certifié |
| Coût retenu | 65 TND/h certifié (50 enseignant + 15 structure) |
| Prix minimal / recommandé / renforcé | 1080 / 1800 / 2880 TND (180 TND/h, tarif `individuel` existant réutilisé — `INDIVIDUEL_HOUR_MIN`) |
| Raison métier | 6h = rattrapage ciblé minimal (2 disciplines à 3h chacune) ; 10h = volume standard (5h/discipline) ; 16h = accompagnement intensif (8h/discipline) pour un écart important |

**Marge (constante aux 3 paliers, produit individuel)** :

| Palier | Heures | Prix | Coût | Marge | Verdict (45/55) |
|---|---|---|---|---|---|
| minimal | 6h | 1080 TND | 390 TND | 63,9 % | PASS_TARGET |
| recommandé | 10h | 1800 TND | 650 TND | 63,9 % | PASS_TARGET |
| renforcé | 16h | 2880 TND | 1040 TND | 63,9 % | PASS_TARGET |

**Anomalie signalée par la mission (1080/1800/2880 vs coût 650 TND, ~39,8 % annoncé)** : le chiffre ~39,8 %
cité dans la directive initiale ne se reproduit pas avec le coût "certifié" (65 TND/h) — il correspond à un
coût enseignant plus élevé (~108 TND/h, proche de la politique **actuellement active par défaut**, 100
TND/h + structure). **Sous la politique de coût réellement active aujourd'hui (100 TND/h, sans poste
structure séparé dans le moteur réel)** : coût = 10h × 100 = 1000 TND, marge = (1800−1000−10)/1800 = **43,9
%** — **sous le seuil bloquant proposé de 45 %**, confirmant l'alerte de la mission : selon la politique de
coût réellement chargée en base, ce palier recommandé peut basculer sous le seuil bloquant. **Aucun prix
SVC_SECOND_GROUPE ne peut être considéré comme sûr avant que la direction n'ait tranché la politique de coût
réelle** (Constat n°2) — ce qui ne change rien au fait que `directionApprovalStatus` reste `DIRECTION_A_VALIDER`
dans `data/pricing.canonical.json` (aucune approbation, quelle que soit l'issue de ce calcul).

**Inclusion/supplément** : supplément — produit autonome, hors packs annuels, mécanisme de paiement 100 % à
la réservation câblé cette session (voir preuve RED→GREEN, rapport final §9).

**Décision attendue** : (a) approuver 180 TND/h + les 3 paliers ; (b) statuer sur la politique de coût réelle
(100 TND/h actif par défaut vs 65 TND/h "certifié") avant d'approuver, le verdict de marge en dépendant
directement au palier recommandé.

---

## Synthèse — 13 éléments, seuils proposés 45 %/55 %, politique de coût RÉELLEMENT ACTIVE (100 TND/h)

| Code | Prix min/reco/renforcé | Coût (100 TND/h, actif) | Marge palier reco | Verdict (45/55) |
|---|---|---|---|---|
| MOD_LVA | 250/470/680 | 800 (8h) | 12,8 % (eff.2) → 41,1 % (eff.3) | **BLOCK jusqu'à eff.3 inclus** |
| MOD_LVB | idem | idem | idem | idem |
| MOD_SPECIALITE_ABANDONNEE | idem | idem | idem | idem |
| MOD_HG_ARIA | 20/40/80 | 17,5 | 12,5 % (mini) | **BLOCK au palier minimal** |
| MOD_ES_ARIA | idem | idem | idem | idem |
| MOD_EMC_ARIA | idem | idem | idem | idem |
| MOD_EAF_DESCRIPTIF | 180/360/540 | 65-195 | 63,9 % | PASS_TARGET |
| MOD_MATHS_EXPERTES | 250/470/680 | 800 (8h) | idem MOD_LVA | idem MOD_LVA (+ blocage réglementaire séparé) |
| MOD_MATHS_COMPLEMENTAIRES | idem | idem | idem | idem |
| MOD_DGEMC | idem | idem | idem | idem |
| MOD_LCA | idem | idem | idem | idem (+ risque effectif accru) |
| SVC_BACS_BLANCS | 95/190/285 | 41,25-123,75 | 56,6 % | PASS_TARGET |
| SVC_SECOND_GROUPE | 1080/1800/2880 | 1000 (10h, 100 TND/h) | 43,9 % | **BLOCK au palier recommandé sous la politique active** |

**Aucun prix de ce document n'est approuvé.** Trois familles de prix sont **mécaniquement bloquées** sous
les seuils proposés et la politique de coût réellement active aujourd'hui : `MOD_*` (petit-groupe) jusqu'à
effectif 3 inclus, `*_ARIA` au palier minimal, et `SVC_SECOND_GROUPE` au palier recommandé. Cela ne peut pas
être résolu par ce document seul — cela nécessite une décision explicite de direction sur la politique de
coût (§5) avant toute approbation de prix.
