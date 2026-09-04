# Domaine Candidat Individuel — Taxonomie Canonique & Règles Métier

> Document de référence du domaine Candidat Individuel (Track A — Convergence Nexus Réussite).
> Définit la taxonomie P1–P12, les fondements réglementaires, l'évaluation multi-faits et les invariants stricts.

---

## 1. Principes Directeurs & Bounded Context

Le domaine **Candidat Individuel** encadre l'accompagnement des élèves préparant le baccalauréat français en candidat individuel (candidats libres), notamment dans le réseau d'enseignement français à l'étranger (AEFE / Tunisie).

### Invariants fondamentaux

1. **Direction stricte de dépendance (SSOT)** :
   $$\text{ProfilCandidat} \longrightarrow \text{CarteExamen} \longrightarrow \text{ParcoursType}$$
   Le `ParcoursType` est une classification opérationnelle **dérivée**, jamais sélectionnée par l'utilisateur ou la famille.
2. **Évaluation multi-faits exhaustive** :
   Un profil peut remplir les critères de plusieurs parcours (ex. redoublant titulaire d'un premier baccalauréat). Tous les parcours applicables sont identifiés et conservés dans `faitsConcurrents`. Un ordre de priorité canonique détermine le parcours principal affiché.
3. **Revue humaine obligatoire (Fail-Closed)** :
   Certaines situations réglementaires ne peuvent être validées sur simple déclaration :
   - `P3_LIBRE_1AN_DEROGATION` : motif dérogatoire avec audit staff obligatoire (`p3EligibiliteAudit`).
   - `P7_TITULAIRE_BAC` : dispenses déclarées non encore confirmées par l'administration.
   - `P12_ETALEMENT_PLURISESSIONS` : étalement plurisessions déclaré.
4. **Étanchéité devis & pricing** :
   Le domaine candidat n'a pas de moteur tarifaire parallèle. Le chiffrage passe exclusivement par `lib/quotes/pricing.ts` et `data/pricing.canonical.json`.

---

## 2. Taxonomie Canonique P1 à P12

### P1 — `P1_LIBRE_2ANS_MODALITE_A`
- **Libellé famille** : *Candidat individuel — parcours sur deux ans*
- **Description** : Candidat libre en cycle complet de 2 ans, modalité A (évaluations ponctuelles réparties entre 1ère et Terminale).
- **Réglementation** : Code de l'éducation, arrêté du 16 juillet 2018 relatif aux épreuves du baccalauréat général.

### P2 — `P2_LIBRE_2ANS_MODALITE_B`
- **Libellé famille** : *Candidat individuel — parcours sur deux ans*
- **Description** : Candidat libre en cycle complet de 2 ans, modalité B (modalité d'évaluation spécifique selon le statut de l'établissement d'origine).

### P3 — `P3_LIBRE_1AN_DEROGATION`
- **Libellé famille** : *Candidat individuel — parcours accéléré (même session)*
- **Description** : Présentation de l'ensemble des épreuves (anticipées de 1ère et terminale) lors d'une même session d'examen.
- **Réglementation** : Arrêté du 16 juillet 2018, article 3 (dérogations accordées aux sportifs de haut niveau, raisons médicales graves, retour de l'étranger, etc.).
- **Garde** : `requiresHumanReview = true` systématique. L'éligibilité repose sur `checkSameSessionEligibility` et un audit validé par le staff.

### P4 — `P4_REDOUBLEMENT_PREMIERE`
- **Libellé famille** : *Redoublement — classe de première*
- **Description** : Candidat redoublant sa classe de première, présentant à nouveau les épreuves anticipées de français.

### P5 — `P5_REDOUBLEMENT_TERMINALE`
- **Libellé famille** : *Redoublement — classe de terminale*
- **Description** : Candidat ayant échoué au baccalauréat et se représentant en classe de terminale. Possibilité de conservation de notes $\ge 10/20$.

### P6 — `P6_AMELIORATION_ET_TERMINALE`
- **Libellé famille** : *Amélioration de notes — présentation en terminale*
- **Description** : Candidat titulaire ou non souhaitant améliorer ses notes de terminale pour Parcoursup ou mentions.

### P7 — `P7_TITULAIRE_BAC`
- **Libellé famille** : *Déjà titulaire du baccalauréat*
- **Description** : Candidat titulaire d'un baccalauréat (français ou étranger équivalent) se présentant à une nouvelle série ou spécialité.
- **Réglementation** : Arrêté du 14 mai 2020 fixant les conditions de dispense d'épreuves pour les candidats déjà titulaires d'un baccalauréat.
- **Garde** : Si des dispenses sont au statut `DECLAREE` (non encore `CONFIRMEE` par justificatif officiel), `requiresHumanReview = true`.

### P8 — `P8_SCOLARISE_VERS_LIBRE`
- **Libellé famille** : *Bascule scolaire vers candidat individuel*
- **Description** : Candidat scolarisé en cours de cycle qui bascule vers le statut de candidat individuel.
- **Réglementation** : Note de service du 28 juillet 2021 relative aux modalités d'évaluation des candidats dans les situations particulières. Option de conservation ou de renonciation aux moyennes de contrôle continu de première (`brancheBascule`).

### P9 — Changement de spécialité (Modificateur transverse)
- **Nature** : Ce n'est **pas** une valeur de l'enum `ParcoursTypeCode`.
- **Implémentation** : Champ booléen transverse `changementSpecialite: boolean` cumulable avec n'importe quel parcours principal (ex. P5 avec changement de spécialité).

### P10 — `P10_EPREUVES_ANTICIPEES_SEULES`
- **Libellé famille** : *Épreuves anticipées uniquement*
- **Description** : Candidat de niveau première ne s'engageant cette session que sur les épreuves anticipées (français écrit et oral), sans projection déclarée sur le cycle complet (`intentionCycleComplet = false`).

### P11 — `P11_SECOND_GROUPE`
- **Libellé famille** : *Second groupe (rattrapage)*
- **Description** : Candidat ayant obtenu une moyenne générale comprise entre 8,00 et 9,99/20 à l'issue du premier groupe d'épreuves, admis à se présenter aux épreuves orales de rattrapage (2 disciplines).
- **Réglementation** : Arrêté du 16 juillet 2018 relatif aux épreuves du second groupe.
- **Invariant** : `moyenneMin <= moyenneMax` vérifié par schéma et fail-closed au runtime.

### P12 — `P12_ETALEMENT_PLURISESSIONS`
- **Libellé famille** : *Étalement sur plusieurs sessions*
- **Description** : Candidat ayant formulé une demande d'étalement des épreuves sur plusieurs sessions consécutives.
- **Garde** : `requiresHumanReview = true` obligatoire avant toute émission de devis ou confirmation pédagogique.

---

## 3. Ordre de Priorité pour le Parcours Principal

Lors de l'évaluation dans `lib/exams/parcours.ts` :

1. `P3_LIBRE_1AN_DEROGATION`
2. `P12_ETALEMENT_PLURISESSIONS`
3. `P11_SECOND_GROUPE`
4. `P7_TITULAIRE_BAC`
5. `P8_SCOLARISE_VERS_LIBRE`
6. `P6_AMELIORATION_ET_TERMINALE`
7. `P5_REDOUBLEMENT_TERMINALE`
8. `P4_REDOUBLEMENT_PREMIERE`
9. `P10_EPREUVES_ANTICIPEES_SEULES`
10. `P1_LIBRE_2ANS_MODALITE_A`
11. `P2_LIBRE_2ANS_MODALITE_B`

Chaque fait concordant additionnel est conservé dans `facts` et exposé dans l'audit.

---

## 4. Persistance & Mutabilité

- **Changement de profil** : Une modification de `ProfilCandidat` ne mute jamais la ligne en base. Elle crée une nouvelle révision chaînée via `previousProfilId` avec `revisionNumber = previous.revisionNumber + 1`.
- **Garantie d'unicité** : `previousProfilId` est annoté `@unique` au niveau Prisma/Postgres, empêchant toute écriture concurrente concurrente de diverger (code `P2002`).
