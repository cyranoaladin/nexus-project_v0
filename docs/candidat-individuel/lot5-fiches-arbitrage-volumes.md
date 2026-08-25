# Fiches d'arbitrage — modules `DIRECTION_A_VALIDER` (Lot 5)

Ces propositions sont des **hypothèses de travail soumises à validation commerciale et pédagogique** —
jamais des données actives. Aucun de ces modules ne peut recevoir de prix, entrer dans un total, ou
autoriser une émission automatique tant que ce statut n'est pas levé (`lib/quotes/catalogue-schema.ts`
l'impose structurellement : un module `DIRECTION_A_VALIDER` ne peut jamais porter de `pricingRuleId`).

Coût de production et marge par effectif nécessitent les coûts enseignants réels — non accessibles
depuis `lib/exams/`/`lib/quotes/` (ces valeurs sont délibérément absentes des tests publics, cf.
`__tests__/lib/quotes/pdf-adapter.test.ts` "never contains a teacher-cost/margin key"). Ces deux champs
sont donc explicitement laissés en attente ci-dessous plutôt qu'inventés.

---

## Fiche 1 — Histoire-Géographie, Enseignement scientifique, EMC (autonomie guidée ARIA)

`MOD_HG_ARIA`, `MOD_ES_ARIA`, `MOD_EMC_ARIA` — structure identique, seule la discipline change.

- **Épreuve couverte** : histoire-geographie / enseignement-scientifique / emc (ponctuelles, `selon_modalite`).
- **Coefficient** : celui de l'épreuve dans le référentiel de session (`data/exams/bac-general-2027.json`), non reproduit ici pour éviter une double source — lu dynamiquement par `lib/quotes/catalogue.ts`.
- **Nature** : écrite (ponctuelle), pas d'oral.
- **Contenu du service (D1, décision approuvée)** : parcours de travail structuré, ressources, jalons, exercices, évaluations, bacs blancs, corrections, points de suivi humain planifiés — jamais présenté comme un cours en groupe.
- **Format** : `autonomie_guidee_aria`.
- **Séances proposées / durée** : pas de séance synchrone régulière par défaut (autonomie guidée) — hypothèse basse : 0 séance synchrone + points de suivi ponctuels ; hypothèse renforcée : 1 point de suivi humain / mois (30 min).
- **Volume synchrone** : hypothèse basse 0h/mois, hypothèse recommandée 0,5h/mois (point de suivi), hypothèse renforcée 1h/mois.
- **Volume d'autonomie** : hypothèse basse 2h/mois, hypothèse recommandée 3h/mois, hypothèse renforcée 4h/mois — aucune de ces valeurs n'est sourcée dans les 6 offres existantes (elles ne modélisent que des enveloppes globales, jamais un volume HG/ES/EMC isolé).
- **Évaluations incluses** : bacs blancs ARIA, corrections automatisées + humaines ponctuelles.
- **Coût de production estimé / Prix résultant / Marge selon effectif** : `DIRECTION_A_VALIDER` — nécessite les coûts enseignants réels.
- **Compatibilité avec les 6 offres** : Intégrale (30h/mois) mentionne déjà "Histoire-Géographie, LVA/LVB, Enseignement scientifique selon besoin" sans détail horaire — un volume ARIA à faible coût synchrone reste cohérent avec cette enveloppe globale sans la dépasser.
- **Recommandation argumentée** : démarrer sur l'hypothèse recommandée (0,5h synchrone + 3h autonomie/mois) uniquement si le diagnostic signale une faiblesse réelle (cohérent avec `defaultCandidateForRegularSupport: false` déjà appliqué à ces matières dans le moteur existant) — ne jamais l'ajouter par défaut à un panier pour l'étoffer.

---

## Fiche 2 — Langue vivante A / B (petit groupe live)

`MOD_LVA`, `MOD_LVB`.

- **Épreuve couverte** : lva / lvb (ponctuelles, `selon_modalite`).
- **Nature** : écrite et orale (CO/EE/EOC selon le format réel de l'épreuve LV — non détaillé dans le référentiel actuel, à vérifier avec un professeur de langues avant arbitrage final).
- **Contenu** : préparation écrite et orale combinée.
- **Format** : `petit_groupe` (D1), avec bascule DUO/SOLO si le groupe ne s'ouvre pas (seuil `min_group_open`/`max_group_size` déjà définis dans `candidat_individuel_modules`).
- **Séances proposées** : hypothèse basse 1 séance/mois (2h), hypothèse recommandée 2 séances/mois (4h), hypothèse renforcée 4 séances/mois (8h, aligné sur le tier `petit_groupe` existant à 8h/mois).
- **Volume synchrone** : basse 2h/mois, recommandée 4h/mois, renforcée 8h/mois.
- **Volume d'autonomie** : non modélisé (LV reste principalement synchrone dans le référentiel actuel).
- **Évaluations incluses** : entraînements oraux type épreuve, corrections écrites.
- **Coût / Prix / Marge** : `DIRECTION_A_VALIDER`.
- **Compatibilité 6 offres** : Intégrale (30h/mois) cite "LVA/LVB... selon besoin" — un volume de 4h/mois (hypothèse recommandée) par langue reste absorbable dans cette enveloppe sans la dépasser si combiné à un nombre limité d'autres modules à volume réduit.
- **Recommandation** : hypothèse recommandée (4h/mois, tier `PETIT_GROUPE_4H` déjà existant dans `candidat_individuel_modules`), déclenché uniquement sur besoin diagnostiqué (même principe que Fiche 1).

---

## Fiche 3 — Spécialité de première non poursuivie (`MOD_SPECIALITE_ABANDONNEE`)

- **Épreuve couverte** : specialite-abandonnee (ponctuelle, `selon_modalite`).
- **Nature** : dépend de la discipline abandonnée (variable — pas un format fixe).
- **Contenu** : remise à niveau ciblée sur le programme de Première de la discipline abandonnée.
- **Format** : `petit_groupe`, **strictement mono-discipline** (D1 — aucune mutualisation transdisciplinaire), bascule DUO/SOLO si nécessaire.
- **Séances / volume** : hypothèse basse 1 séance/mois (2h), hypothèse recommandée 2 séances/mois (4h), hypothèse renforcée 4 séances/mois (8h).
- **Évaluations incluses** : évaluations ponctuelles réellement requises (jamais systématiques — cf. Intégrale "Évaluations ponctuelles réellement requises").
- **Coût / Prix / Marge** : `DIRECTION_A_VALIDER`.
- **Compatibilité 6 offres** : concept absent des 6 offres actuelles sous cette forme précise — le plus proche est l'enveloppe "selon besoin" de l'Intégrale.
- **Recommandation** : hypothèse recommandée (4h/mois), avec la contrainte mono-discipline vérifiée par le moteur avant toute ouverture de groupe (risque commercial si le seuil `min_group_open=3` n'est jamais atteint pour une discipline abandonnée rare — la direction doit trancher entre DUO/SOLO systématique ou attente d'ouverture).

---

## Fiche 4 — Accompagnement du descriptif EAF (`MOD_EAF_DESCRIPTIF`)

- **Épreuve couverte** : eaf-oral (le descriptif alimente l'oral, n'est pas une épreuve séparée).
- **Nature** : accompagnement méthodologique/administratif, pas un cours disciplinaire.
- **Contenu** : aide à la constitution du descriptif des textes/œuvres étudiés, exigé pour l'oral de français.
- **Format** : `individuel_presentiel` (proposé — un descriptif est par nature personnel, pas mutualisable en groupe).
- **Séances** : hypothèse basse 1 séance (1h), hypothèse recommandée 2 séances (2h au total), hypothèse renforcée 3 séances (3h).
- **Coût / Prix / Marge** : `DIRECTION_A_VALIDER`.
- **Compatibilité 6 offres** : aujourd'hui implicite dans `MOD_EAF_ECRIT_ORAL` (8h/mois écrit+oral combinés) — aucune ligne séparée nulle part. Décision requise : rester implicite (pas de fiche produit séparée) ou extraire une ligne dédiée.
- **Recommandation** : ne pas créer de ligne facturable séparée tant que le volume EAF combiné (8h/mois) n'est pas démontré insuffisant — probable sur-ingénierie sinon.

---

## Fiche 5 — Options (Maths expertes, Maths complémentaires, DGEMC, LCA)

`MOD_MATHS_EXPERTES`, `MOD_MATHS_COMPLEMENTAIRES`, `MOD_DGEMC`, `MOD_LCA`.

- **Épreuve couverte** : aucune — ce sont des options (`lib/exams/options.ts`), jamais dans `epreuves[]`. Coefficient : confirmé non sourcé nulle part (`OPTION_COEFFICIENT_NON_SOURCE`, Lot 1/4).
- **Nature** : variable selon l'option.
- **Contenu** : préparation spécifique à l'option choisie.
- **Format** : `petit_groupe` proposé par défaut (faible effectif attendu compte tenu de la rareté de ces options en candidat individuel — DUO/SOLO probable en pratique).
- **Volume** : aucune hypothèse chiffrée proposée — le coefficient lui-même n'étant pas sourcé, tout volume serait une double invention (coefficient ET volume). Nécessite d'abord une recherche réglementaire (hors périmètre `lib/quotes/`, retour à `lib/exams/`) avant même un arbitrage commercial.
- **Recommandation** : traiter au cas par cas en revue humaine (déjà le comportement du moteur : `NEEDS_HUMAN_REVIEW` systématique) — ne pas industrialiser tant que le coefficient réglementaire n'est pas sourcé.

---

## Services non chiffrés (hors modules pédagogiques)

- **`SVC_BACS_BLANCS`** : cité dans le brief initial, absent des `included[]` réels des 6 offres. Nécessite une décision : le créer comme ligne visible (et à quel volume/fréquence) ou le laisser purement implicite dans le Pilotage.
- **`SVC_TUTORAT_COMPRESSION`** : concept jamais défini nulle part dans le dépôt — ni volume, ni contenu, ni public cible connus. Nécessite un brief produit avant toute fiche d'arbitrage utile.
- **`SVC_SECOND_GROUPE`** (P11) : structure déjà décrite (mission Lot 5 §12, brainstorming §Décision 3) — échéancier explicitement différé au lot moteur tarifaire, pas une fiche de volume classique.

---

## Ce que cette fiche ne fait PAS

Aucun chiffre ci-dessus n'est une donnée active : `catalogueModuleSchema` interdit structurellement un
`pricingRuleId` sur un module `DIRECTION_A_VALIDER` (test `__tests__/lib/quotes/catalogue-schema.test.ts`).
Ces hypothèses servent uniquement de point de départ pour une décision de direction — jamais consommées
par le moteur tant que le statut n'est pas levé.
