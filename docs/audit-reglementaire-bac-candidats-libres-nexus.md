# Audit réglementaire — Bac français, candidats libres, Nexus Réussite (2026/2027)

> **Usage interne — document de travail.** Ne pas diffuser sans validation direction.  
> Dernière mise à jour : 22 août 2026 (revalidation réglementaire live — voir corrections ci-dessous)  
> Responsable : équipe pédagogique Nexus Réussite
>
> **Source canonique versionnée** : les coefficients et règles ci-dessous sont maintenant encodés et testés dans `data/exams/bac-general-2027.json` (schéma `lib/exams/schema.ts`, chargeur `lib/exams/catalog.ts`, tests `__tests__/lib/exams-catalog.test.ts`). Ce document reste la trace narrative de l'audit ; en cas de divergence, le JSON versionné fait foi et doit être corrigé en premier.

---

## 1. Sources consultées

| Source | Statut | Note |
|---|---|---|
| Bulletin officiel Éducation nationale (BO) — réforme du bac 2021 | Officiel — confirmé | education.gouv.fr |
| Circulaires d'organisation des épreuves du baccalauréat général | Officiel — à reconfirmer chaque session | education.gouv.fr |
| Note de service candidats libres (académie de rattachement Aix-Marseille) | **Non consulté directement** — à vérifier chaque année | ac-aix-marseille.fr |
| Institut français de Tunisie (IFT) — inscriptions candidats libres Tunis | **Non consulté directement** — contact IFT à établir | institutfrancais-tunisie.com |
| Cyclades — portail candidats | Officiel — à vérifier chaque session | cyclades.education.fr |
| Textes relatifs aux épreuves anticipées (EAM, EAF) | Officiel — BO spécial 2019/2020 | Épreuves effectives à partir de la session 2021 |
| Modalités EPS candidats libres | **Non trouvé** — à vérifier | BO + académie |
| Frais d'inscription IFT session 2026 | **Non trouvé** — contact IFT nécessaire | À confirmer avant communication famille |

---

## 2. Points confirmés

### Baccalauréat général — épreuves terminales

- **Épreuves de spécialité (EDS)** : 2 spécialités conservées en Terminale, coef 16 chacune (total 32). Passées en mars pour les scolarisés.
- **Philosophie** : coef 8, épreuve terminale en juin.
- **Grand Oral** : **coef 8 à partir de la session 2027** (⚠️ correction — précédemment noté coef 10 dans cette version du document ; le coef 10 restait exact pour les sessions antérieures à 2027). La réduction de 10 à 8 est la conséquence directe de l'introduction de l'EAM (voir ci-dessous) : décret n°2025-513 et arrêté du 10 juin 2025. Épreuve orale en juin portant sur les 2 spécialités de Terminale.
- **Tronc commun ponctuel** (histoire-géo, LVA, LVB, enseignement scientifique, EPS) : coef 6 chacune (total 30), **+ EMC coef 2** (BO MENE2531481N) **+ spécialité abandonnée coef 8** = 40 au total pour les candidats individuels. Pour les scolarisés, ce même bloc est évalué en contrôle continu.
- **Épreuves anticipées (Première)** : EAF français écrit (coef 5) + oral (coef 5) ; **EAM (épreuve anticipée de mathématiques, coef 2) — nouvelle épreuve, introduite à partir de la session 2027, première passation juin 2026 pour les élèves de Première. Ne pas confondre avec la réforme 2021 : l'EAM ne préexistait pas.** Passées en fin de Première.

### Spécialité abandonnée en fin de Première

- Évaluée en contrôle continu (scolarisés) ou en épreuve ponctuelle (candidats libres) sur le programme de Première.
- Coefficient 8.

### Options

- **Maths expertes** : accessible uniquement si Maths est une EDS conservée en Terminale.
- **Maths complémentaires** : accessible aux élèves n'ayant **pas** conservé Maths comme EDS en Terminale.
- **Latin, grec, LVC** : options à coef plus faible.

---

## 3. Candidats libres — modalités à confirmer selon inscription

### Inscription

- **Cyclades** : portail d'inscription en ligne. Ouverture des inscriptions : automne (fenêtre approximative terminale ≈ 10 oct → 17 nov ; première ≈ 20 oct → 17 nov — **à vérifier chaque année**).
- **Institut français de Tunisie** : dépôt du dossier papier et règlement des frais. Académie de rattachement : Aix-Marseille.
- **Documents habituellement requis** : pièce d'identité valide, justificatif de non-scolarisation/radiation, photos d'identité, formulaire IFT, règlement des frais d'inscription.

> ⚠️ **Ces délais et pièces sont indicatifs.** Ils doivent être confirmés chaque année auprès de l'IFT et de l'académie de rattachement avant communication aux familles.

### Modalité A / B (ponctuelles tronc commun)

- **Modalité A** : ponctuelles étalées — certaines en fin de Première (LVA, LVB), d'autres en fin de Terminale.
- **Modalité B** : toutes les ponctuelles regroupées en fin de Terminale.
- Choix définitif à l'inscription Cyclades. Ne peut pas être modifié après clôture.

> ⚠️ **La modalité A/B n'est pas dans les textes du BO** de la même façon pour tous les candidats libres ; les modalités précises dépendent de l'académie et de l'année. **Vérification obligatoire auprès de l'IFT avant conseil aux familles.**

### Tronc commun en ponctuel (candidats libres)

- Epreuves de tronc commun passées en ponctuel (pas de contrôle continu) : histoire-géographie, LVA, LVB, enseignement scientifique, EMC, EPS.
- Total ≈ 40 % de la note finale : souvent sous-estimé par les familles.
- **À ne pas négliger dans l'accompagnement Nexus.**

### Spécialité abandonnée (candidats libres Première)

- Passée en épreuve ponctuelle sur le programme de Première.
- Programme exact et conditions de passation : **à confirmer selon convocation**.

---

## 4. Points à vérifier IFT / académie chaque année

| Point | Statut | Action |
|---|---|---|
| Dates exactes fenêtre d'inscription Cyclades | À vérifier | Contacter IFT en septembre |
| Frais d'inscription IFT (montant, modes de paiement) | À vérifier | Site IFT ou contact direct |
| Liste précise des pièces du dossier | À vérifier | Site IFT |
| Modalité A/B : applicabilité et options effectives | À vérifier | Textes académie + IFT |
| Épreuves EPS candidats libres : épreuve passée comment ? | **Résolu** — épreuve ponctuelle obligatoire, coef 6, contrôle en cours de formation ou examen ponctuel terminal selon la situation du candidat (arrêté du 21 décembre 2011) | siec.education.fr |
| Langue vivante C / option éventuelle | À préciser | BO + convocation |
| DNB candidats libres : conditions exactes | À préciser | BO + académie |

### Présentation des épreuves anticipées et terminales à la même session ("Bac accéléré")

> **Point critique, absent des versions précédentes de ce document.** Le moteur de devis Nexus ne doit jamais déclarer un candidat éligible à une préparation sur une seule session sur la base d'une hypothèse approximative — voir CDC §11.

- **Règle générale** : anticipées et terminales sont présentées à deux sessions différentes (cycle de deux ans). Le choix de modalité A/B des ponctuelles ne change **que** le calendrier des ponctuelles, jamais celui des anticipées, et n'ouvre **pas** d'éligibilité à une préparation en un an.
- **Exception nommément encadrée** : article 3 de l'arrêté du 16 juillet 2018 (source primaire consultée directement : legifrance.gouv.fr/loda/article_lc/LEGIARTI000037208154). Autorise à présenter anticipées + terminales à la même session les candidats remplissant l'une des conditions suivantes :
  - âgé d'au moins 20 ans au 31 décembre de l'année de l'examen ;
  - ayant un enfant à charge à l'inscription ;
  - de retour en formation initiale ;
  - empêché par force majeure dûment constatée lors d'une inscription antérieure aux anticipées ;
  - résidant temporairement à l'étranger au niveau de la classe de première ;
  - résidant **de façon permanente** à l'étranger dans un pays **sans centre d'examen**, ou avec un centre trop éloigné de sa résidence ;
  - ayant déjà échoué au bac général ou technologique et se représentant ;
  - ayant présenté les anticipées sans se réinscrire l'année suivante ;
  - déjà titulaire d'un bac général, technologique, professionnel, BT ou BTA ;
  - titulaire d'un diplôme étranger comparable aux études secondaires françaises ;
  - ayant changé de voie ou de série en terminale.
- **Cas Tunisie — à ne jamais généraliser** : la Tunisie dispose d'un centre d'examen (Institut français de Tunisie, académie de rattachement Aix-Marseille). La clause "pays sans centre d'examen" ne s'applique donc **pas** automatiquement à un candidat résidant en Tunisie. Un argument de "centre trop éloigné" reste possible mais relève d'une décision au cas par cas de l'académie, jamais d'une déduction automatique. Les conditions les plus pertinentes pour le public Nexus restent : âge ≥ 20 ans, diplôme étranger déjà obtenu, échec antérieur au bac, déjà titulaire d'un autre bac.
- **Implémentation** : ce dispositif est encodé dans `data/exams/bac-general-2027.json` → `candidatIndividuelRules.sameSessionEligibility`, avec un indicateur `autoCheckable` par condition. Le moteur ne conclut `ELIGIBLE` que sur une condition auto-vérifiable confirmée positivement ; toute autre situation renvoie `ELIGIBILITY_REQUIRES_HUMAN_REVIEW`.

---

## 5. Prudence — Épreuves Anticipées de Mathématiques (EAM)

- **Correction (22 août 2026)** : l'EAM n'est **pas** une épreuve de la réforme 2021. C'est une épreuve **nouvelle**, introduite à partir de la session 2027 (décret n°2025-513, arrêté du 10 juin 2025), première passation en juin 2026 pour les élèves alors en Première. La version précédente de ce document ("généralisée 2021") mélangeait l'EAM avec l'EAF/le Grand Oral de la réforme 2021 — c'est faux et corrigé ici.
- Coefficient 2. Écrit de 2h, sans calculatrice, en fin de Première.
- Programme : celui de la spécialité mathématiques de Première pour les élèves qui l'ont suivie, sinon celui de "mathématiques spécifique" intégré à l'enseignement scientifique.
- Conséquence directe : réduction du coefficient du Grand Oral de 10 à 8 (voir §2) pour préserver la répartition 60 % anticipées+terminales / 40 % ponctuelles.
- Pour les candidats individuels : **conditions de passation à confirmer** selon l'académie et l'IFT chaque année.
- Nexus accompagne la préparation mais **ne garantit pas les conditions d'inscription officielle**.

---

## 6. Prudence — DNB candidats libres

- Le DNB (Diplôme National du Brevet) peut être préparé en candidat libre.
- Conditions spécifiques, épreuves partiellement différentes (pas d'oral de projet).
- **Les coefficients exacts et la liste des épreuves du DNB candidats libres doivent être vérifiés** chaque année.
- Nexus prépare les matières (maths, français, histoire-géo) sans se substituer à l'inscription officielle.

---

## 7. Conséquences pour l'assistante devis

### Ce que l'outil peut affirmer avec confiance

- La liste des épreuves principales (spécialités, philo, Grand Oral, anticipées).
- Les coefficients publiés au BO (spécialités coef 16, philo 8, Grand Oral 10, EAF 5+5, EAM 2).
- Le principe de la modalité A/B pour les ponctuelles.
- La nécessité de s'inscrire via Cyclades + IFT.

### Ce que l'outil ne doit PAS présenter comme certitude absolue

- Les dates exactes d'inscription (varient chaque année).
- Les frais d'inscription IFT (à confirmer).
- La liste exacte des pièces du dossier.
- Les modalités précises EPS/LVC/option pour candidats libres.
- Les coefficients DNB candidats libres.

### Formulation recommandée dans l'outil

> *Repères réglementaires à vérifier selon les textes officiels et la convocation reçue. Nexus accompagne la constitution du dossier sans se substituer à l'inscription officielle.*

---

## 8. Conclusion pour la direction

**L'outil nexus_assistante_devis_v2.html est utilisable en entretien interne** pour :
- orienter la recommandation commerciale ;
- donner un cadre réaliste des épreuves et du programme ;
- alerter sur les points de vigilance (tronc commun, modalité A/B, EAM).

**Il ne doit pas être utilisé comme source réglementaire opposable aux familles.** Toute information sur les conditions d'inscription, délais et frais doit être confirmée auprès de l'IFT et de l'académie de rattachement avant communication officielle.

**Go-live conditionnel** (cf. liste de validation) :
- [ ] Validation des règles de réduction par la direction
- [ ] Confirmation des dates IFT pour 2026/2027
- [ ] Sécurisation de l'accès (basic auth ou restriction IP)
- [ ] Relecture de la sortie PDF par la direction
- [ ] Validation des arbitrages tarifaires (points 0.1, 0.2, 0.3 du build script)

---

## Annexe A : Conditions Générales de Vente (CGV) — Version Sécurisée 2026/2027

> **Document contractuel** — À faire signer ou accepter numériquement lors de l'inscription.  
> **Note juridique** : À faire relire par un conseil juridique tunisien pour conformité locale avant déploiement final.

---

### Article 1 : Objet et Réservation

L'inscription à un parcours Nexus Réussite est confirmée par le versement d'un **acompte de réservation** représentant généralement 20% à 30% du montant total.

**Fonction de l'acompte** : Cet acompte bloque la place de l'élève dans un groupe à effectif plafonné (5 élèves max en Terminale, 6 max en Première/Seconde, 8 max en Brevet).

**Clause de sécurité** : La réservation est ferme et non remboursable, sauf dans le cas où Nexus Réussite serait dans l'impossibilité d'ouvrir le groupe concerné et ne pourrait proposer aucune solution alternative acceptable par la famille (changement de créneau, format semi-individuel, ou basculement vers l'offre en ligne).

---

### Article 2 : Modalités de Paiement

Les parcours annuels peuvent être réglés selon un échéancier convenu entre les parties (exemple type : acompte + 3 traites mensuelles).

**Condition suspensive** : L'accès aux séances de présentiel, à la plateforme numérique et aux stages est conditionné au paiement des traites à leur date d'échéance.

**Clause de suspension** : En cas de retard de paiement supérieur à 15 jours, Nexus se réserve le droit de suspendre temporairement l'accès aux services jusqu'à régularisation complète, sans préjudice des intérêts de retard applicables.

---

### Article 3 : Politique de remises

Les remises sont des conditions commerciales encadrées par le catalogue canonique et ne doivent jamais être reconstruites depuis une ancienne grille.

**Règles de cumul** : Les réductions de type fratrie, parrainage, ancien élève, et paiement comptant ne sont pas cumulables entre elles par défaut, sauf accord écrit et exceptionnel de la direction de Nexus Réussite.

**Modalité de validation** : Toute demande de cumul de réductions dépassant 10% doit être soumise à la direction et validée explicitement avant émission du devis définitif.

---

### Article 4 : Arrêt Anticipé du Parcours (Clause de Recalcul)

En cas de désistement ou d'arrêt du parcours à l'initiative de la famille en cours d'année scolaire :

1. **Recalcul contractuel** : Les prestations déjà consommées (séances de cours effectuées, stages suivis, accès plateforme utilisé, bulletins émis) sont recalculées selon les conditions contractuelles validées et les montants issus du catalogue canonique en vigueur.

   **Méthode de calcul (par ordre de priorité) :**
   - **Méthode 1** : proratisation du parcours annuel souscrit, lorsque le parcours est proratisable.
   - **Méthode 2** : valorisation des prestations effectivement consommées selon le catalogue canonique.
   - **Méthode 3** : coût réel facturé pour les prestations spécifiques non proratisables.

   → La méthode retenue doit être explicitée dans le dossier famille avant toute régularisation.

2. **Regularisation** : La famille devra régler la différence entre le montant recalculé des prestations consommées et les sommes déjà versées, avant tout départ définitif.

3. **Conservation des sommes** : Les sommes déjà versées (acompte et traites) restent acquises à Nexus et ne donnent lieu à aucun remboursement, sauf application de l'article 1 (impossibilité d'ouverture du groupe par Nexus).

**Exemples chiffrés** : ne pas utiliser d'exemple historique dans ce document. Générer tout exemple depuis le devis ou le catalogue canonique en vigueur.

---

### Article 5 : Absences et Rattrapages

**Principe** : Une absence de l'élève à une séance programmée, quelle qu'en soit la cause, n'ouvre pas droit automatiquement à remboursement ni à report de séance.

**Heures d'urgence** : Les "heures d'urgence" éventuellement incluses dans certaines offres sont destinées à traiter des blocages pédagogiques ponctuels et ne constituent pas un crédit d'heures permettant de rattraper des absences non justifiées.

**Absences justifiées** : En cas d'absence justifiée par motif de force majeure (certificat médical, événement familial majeur), Nexus étudiera la possibilité d'un rattrapage sous réserve de disponibilité, sans garantie systématique.

---

### Article 6 : Ouverture et Composition des Groupes

**Engagement d'effectif** : Nexus s'engage à maintenir des groupes réduits, avec un maximum de 5 élèves lorsque le format relève du catalogue canonique actuel.

**Seuil de viabilité** : Si, à la date de rentrée effective, un groupe n'atteint pas le seuil minimum de viabilité (4 élèves pour Terminale/Première/Seconde, 5 élèves pour Brevet), Nexus s'engage à proposer à la famille, dans un délai de 15 jours calendaires :
- Un changement de créneau horaire vers un groupe ouvert ;
- Un passage en format semi-individuel (tarif adapté) ;
- Un basculement vers l'offre en ligne (plateforme accompagnée) ;
- Un remboursement intégral de l'acompte de réservation.

**Composition** : Nexus se réserve le droit de refuser une inscription si l'homogénéité du niveau du groupe ne peut être garantie, afin de préserver la qualité pédagogique pour l'ensemble des participants.

---

### Article 7 : Plateforme Numérique et Données Personnelles

**Accès** : L'accès à la plateforme Nexus est un service annexe au parcours pédagogique. Il est maintenu actif tant que le contrat est en vigueur et les paiements à jour. L'accès est révoqué en cas de résiliation ou de suspension pour impayé.

**Support** : La plateforme ne constitue pas un service de messagerie instantanée disponible 24h/24. Les délais de réponse des enseignants et référents sont communiqués en début de parcours.

**Données personnelles** : Les données des élèves et des parents sont traitées de manière confidentielle, conformément à la législation en vigueur en Tunisie et aux standards de protection des données. Elles ne sont utilisées que dans le cadre du suivi pédagogique et ne sont transmises à aucun tiers extérieur.

---

### Article 8 : Propriété Intellectuelle

Les contenus pédagogiques mis à disposition sur la plateforme (fiches, exercices, annales, vidéos) sont la propriété exclusive de Nexus Réussite ou de ses partenaires licenciés. Toute reproduction, distribution ou utilisation commerciale sans autorisation écrite préalable est strictement interdite.

---

### Article 9 : Force Majeure

Nexus Réussite ne saurait être tenu responsable des retards ou manquements à ses obligations résultant de causes échappant à son contrôle raisonnable, notamment : pandémie, fermeture administrative des établissements, grèves, catastrophes naturelles, ou toute autre circonstance imposée par les autorités compétentes.

En cas de fermeture prolongée imposée, Nexus s'engage à proposer des solutions alternatives (distanciel, reports de séances, crédits) selon les modalités précisées dans son protocole de continuité pédagogique.

---

### Article 10 : Juridiction et Droit Applicable

Les présentes conditions générales sont régies par le droit tunisien. Tout litige relatif à leur interprétation ou exécution relève de la compétence des juridictions tunisiennes.

---

### Validation des CGV

**Fait à** : Tunis, le _______________

**Pour Nexus Réussite** :
Nom : _____________________________
Signature : _____________________________

**Pour le Client (Parent/Tuteur légal)** :
Nom : _____________________________
Prénom de l'élève : _____________________________
Signature : _____________________________

**Acceptation numérique** (alternative) : 
Date et heure de validation électronique : _______________
Adresse IP : _______________

---

## Historique des Révisions

| Version | Date | Auteur | Changements majeurs |
|---------|------|--------|-------------------|
| 1.0 | Juin 2025 | Direction | Version initiale |
| 2.0 | Juin 2026 | Lead Senior | Refonte business model, clause de recalcul, seuils effectifs, tarifs 2026/2027 |
