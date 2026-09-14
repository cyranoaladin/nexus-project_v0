# Audit des modalités officielles et des diagnostics Nexus

Date de l'audit : **2026-09-11**. Sources consultées ce jour et conservées sous leur URL
dans `referentiels/modalites_epreuves.json`. Rien ici n'est restitué de mémoire.

## 1. Sources

| Source | Nature | Ce qu'elle établit |
|---|---|---|
| Mémento *Modalités de l'évaluation en cycle terminal*, MENSER, septembre 2025 | tableau des épreuves et des coefficients | durées, coefficients, natures, répartition 60/40, coefficients du contrôle continu |
| Note de service NOR MENE2121270N, consolidée février 2025 | modalités d'évaluation des candidats | définition du candidat individuel, évaluations ponctuelles, les deux modalités de passation |
| Définitions consolidées des épreuves de spécialité (NSI, physique-chimie, SVT, HLP, HGGSP, mathématiques) | notes de service consolidées 2024 | structure exacte de chaque épreuve, dispense de partie pratique |
| Épreuve orale terminale « Grand oral », consolidée juin 2024 | note de service | déroulé en deux temps, questions apportées par le candidat |
| EPS tronc commun, consolidée novembre 2024 | circulaire | examen ponctuel terminal du candidat individuel |

Les pages HTML d'éduscol et du Bulletin officiel sont protégées et n'ont pas répondu ; les
notes de service consolidées, elles, sont servies en PDF et ont toutes été récupérées.
Là où un texte n'a pas pu être lu, le référentiel le dit.

## 2. Ce que l'audit a corrigé

### 2.1 Le Grand oral ne mesurait pas ce que l'épreuve pèse

La grille comptait cinq critères : structure, précision, langue, interaction, posture.
L'épreuve, elle, commence par **deux questions que le candidat apporte** et parmi
lesquelles le jury choisit. Le diagnostic fournissait la question : il rendait invisible le
premier acte de l'épreuve, et ne mesurait ni l'ancrage disciplinaire ni l'esprit critique
que le second temps éprouve.

Trois critères ajoutés — `QUEST`, `DISCIP`, `ARGU` — et le déroulé revu : le candidat
propose ses deux questions, le coach en retient une. Quinze minutes de diagnostic contre
vingt d'épreuve et vingt de préparation : l'échantillonnage est assumé et écrit dans
l'instrument. Il n'observe pas l'endurance sur dix minutes d'exposé continu.

La fenêtre « trois à cinq critères » du validateur était écrite en dur dans le script ;
elle est passée au référentiel, avec l'exception motivée.

### 2.2 Le coefficient du Grand oral change à la session 2027

10 jusqu'à la session 2026, **8 à compter de la session 2027**. Le diagnostic ne note pas
sur le barème de l'examen : cela ne change aucune mesure, mais la couverture du livret
l'affiche, et elle le lit au référentiel.

## 3. Les parties pratiques — ce qu'il ne faut pas faire croire

> « Les candidats individuels et les candidats des établissements d'enseignement privés
> hors contrat sont dispensés de cette épreuve pratique. Pour ces catégories de candidats
> régulièrement dispensés, la note de l'épreuve de spécialité est constituée de la note
> obtenue à la partie écrite de l'épreuve rapportée à 20 points. »

Cette phrase figure, presque mot pour mot, dans les définitions de NSI, de physique-chimie
et de SVT. Conséquences tenues dans la release :

- le diagnostic de ces trois spécialités porte sur **l'écrit réellement présenté** ;
- la page « Avant de commencer » du livret le dit au candidat, pour qu'il ne prépare pas
  une épreuve qu'il ne passera pas ;
- le matériel NSI sur machine sort du pack candidat et va dans
  `04_INTERNE/COMPETENCES_COMPLEMENTAIRES/`. Il reste un outil pédagogique — écrire du code
  vaut mieux que le lire — mais il n'est plus présenté comme une partie d'épreuve.

## 4. Blueprints par spécialité

Durée officielle, durée du diagnostic, et ce que le diagnostic n'observe pas.

| Spécialité | Officiel | Diagnostic | Part | Partie pratique | Ce que le diagnostic n'observe pas |
|---|---|---|---|---|---|
| Mathématiques | 4 h, coef. 16, écrite | 90 min | 38 % | — | l'endurance sur quatre heures, la composition d'un problème long |
| Physique-chimie | 3 h 30 + 1 h, coef. 16 | 90 min | 43 % | dispensée | la manipulation ; la résolution de problème longue |
| NSI | 3 h 30 + 1 h, coef. 16 | 90 min | 43 % | dispensée | la programmation au clavier sous le regard d'un examinateur |
| SVT | 3 h 30 + 1 h, coef. 16 | 90 min | 43 % | dispensée | la manipulation ; l'exercice 2 en vraie grandeur |
| SES | 4 h, coef. 16, écrite | 90 min | 38 % | — | la dissertation complète, l'épreuve composée entière |
| HGGSP | 4 h, coef. 16, écrite | 90 min | 38 % | — | la dissertation complète sur quatre heures |
| HLP | 4 h, coef. 16, écrite | 90 min | 38 % | — | l'essai en vraie grandeur |

**Ce que cette table dit, et qu'il faut assumer.** Un diagnostic de 90 minutes ne mesure
pas une épreuve de quatre heures : il en échantillonne les tâches. C'est légitime pour
situer un candidat en début d'accompagnement ; ce ne l'est pas pour prédire une note. Les
livrets le disent au candidat plutôt que de le laisser croire l'inverse.

## 5. Le trou de couverture, chiffré

Le candidat individuel présente, au titre du contrôle continu, des évaluations ponctuelles
dont la somme des coefficients vaut **40**. Nexus en couvre **14**.

| Enseignement | Coefficient | Nexus |
|---|---|---|
| Spécialité suivie uniquement en première | 8 | `EDS-<x>/N1` |
| Enseignement scientifique | 6 | `TC-ES` |
| **Histoire-géographie** | **6** | **non couvert** |
| **Langue vivante A** | **6** | **non couvert** |
| **Langue vivante B** | **6** | **non couvert** |
| **Éducation physique et sportive** | **6** | **non couvrable par un document** |
| **Enseignement moral et civique** | **2** | **non couvert** |

Le Cahier § 3.1 plaçait HG, LV et EMC hors périmètre V1 et renvoyait leur couverture « aux
items de compréhension et d'expression de FR-EAF et FR-MAI ». L'audit ne conteste pas la
décision de périmètre : il conteste qu'on puisse, avec ce périmètre, parler de
« diagnostics complets du bac candidat libre ». Vingt points de coefficient sur quarante ne
sont adressés par aucun instrument, et l'EPS ne le sera jamais par un document.

**Deux statuts, et non un seul :**

- `DIAGNOSTICS_NEXUS_SUPPORTED_COMPLETE` — tout ce que Nexus offre est produit, validé,
  diffusable. **Vrai.**
- `REGULATORY_BAC_COVERAGE_COMPLETE` — toutes les évaluations obligatoires du candidat
  individuel sont couvertes. **Faux**, et affiché comme tel dans
  `00_GUIDE/COUVERTURE_REGLEMENTAIRE.csv`.

Créer HG, LVA, LVB et EMC selon la même méthode — programme, blueprint, banque d'items,
clés, grilles, textes sources vérifiés — est un chantier du même ordre que les sept
spécialités existantes. Il relève d'une décision de périmètre de la direction, pas d'un
correctif de livraison.

## 6. Le choix des évaluations ponctuelles n'est pas le profil

> « soit ils se présentent à ces évaluations ponctuelles à la fin du cycle terminal […]
> soit ils se présentent à ces évaluations ponctuelles en fin de chaque année du cycle
> terminal »

Ce choix est formulé à l'inscription en première et il est définitif. Il commande la
version des instruments adossés au contrôle continu — `1RE` et `TLE` pour la modalité
annuelle, `ETENDUE` pour la fin de cycle — et il ne se confond pas avec le profil : un
candidat de première peut avoir choisi l'une ou l'autre.

Le dépôt liait autrefois `TC-ES/1RE` au profil P1, `TLE` à P2 et `ETENDUE` à P3. C'était
vrai du cas le plus fréquent et faux en général. La variable
`mode_evaluations_ponctuelles` est portée au référentiel avec sa règle et **branchée dans
la sélection** : `maquette_donnees._instruments_du_profil` choisit la version de TC-HG,
TC-EMC et TC-ES d'après le mode, les faits candidats (`faits_candidat`) le portent et le
refusent hors domaine, et chaque situation valide est vérifiée par
`tests/test_espace_candidats.py`. Le point est fermé dans `APRES_LIVRAISON.md`.

## 7. Ce que l'audit d'acceptation a rouvert (2026-09-12)

### 7.1 NSI — la partie pratique sortait du livret par la porte, rentrait par la fenêtre

La dispense était écrite en page 2 du livret, et la question 32 demandait d'ouvrir
`rendu.py` sur la machine du centre. Les deux items concernés — `NSI-1-PROG-01` et
`NSI-T-PROG-02` — sont désormais déclarés dans
`epreuves_terminales.EDS-NSI.partie_pratique.items_hors_livret_candidat` et ne sont plus
imprimés. Ils restent dans la banque, dans les assemblages et dans le moteur : aucune
mesure ne bouge. La programmation continue d'être diagnostiquée à l'écrit — remise en
ordre des étapes d'écriture d'une fonction, analyse d'une erreur d'exécution — et les
compétences algorithmiques par les items `ALGO` du bloc B.

### 7.2 Quatre situations réglementaires sans document

L'audit a trouvé que le candidat de première **sans** spécialité mathématiques, celui en
une session dans le même cas, et les candidats de deuxième partie qui ne doivent qu'une
des deux épreuves anticipées de français, n'avaient aucun livret : leur variante partageait
un chemin avec une autre et se faisait écraser. Les quatre ont maintenant leur document, et
un test nomme chacune des quatre situations.
