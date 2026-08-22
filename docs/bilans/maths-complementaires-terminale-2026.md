# Positionnement Maths complémentaires — entrée en Terminale 2026

## Objet

Ce lot ajoute au pipeline Canonical Bilans le questionnaire papier Nexus Réussite
« Maths complémentaires · entrée en Terminale », session 2026 : 18 QCM, 25 minutes,
une réponse A/B/C/D et une certitude 1–4 par item. La copie déjà imprimée reste la
référence de transcription : les lettres des options ne sont jamais permutées.

Le pack est volontairement préparé en **DRAFT**. Son activation exige une validation
pédagogique humaine nominative, la génération du pack JSON lié aux checksums de cette
revue, l'inscription dans le manifeste actif et le feature flag du pack.

## Programme applicable en 2026-2027

Le nouveau programme de Terminale mathématiques complémentaires publié au BO n°14 du
2 avril 2026 n'entre en application qu'à la rentrée 2027-2028. Pour la rentrée 2026,
le programme en vigueur reste donc celui issu du BO spécial n°8 du 25 juillet 2019.

Ce programme s'adresse prioritairement aux élèves ayant suivi la spécialité
mathématiques en Première et ne la poursuivant pas en Terminale, tout en ayant besoin
de mathématiques pour leur poursuite d'études. Il réinvestit le programme de Première
et l'enrichit par de nouvelles notions.

Références institutionnelles :

- Ministère de l'Éducation nationale, BO n°14 du 2 avril 2026,
  « Programme de l'enseignement optionnel de mathématiques complémentaires de la
  classe terminale de la voie générale » — application 2027-2028.
- Éduscol, « Programmes et ressources en mathématiques - voie GT » — application
  progressive : Seconde/Première en 2026-2027, Terminale en 2027-2028 ; le programme
  2019 reste listé parmi les programmes en vigueur pour la Terminale.
- BO spécial n°8 du 25 juillet 2019, programme de mathématiques complémentaires.

## Cartographie pédagogique des 18 questions

| Questions | Nœud CPS | Statut pédagogique |
| --- | --- | --- |
| Q1-Q2 | suites.modele-affine-seuil | Réactivation Première : suites et modèles d'évolution |
| Q3-Q4 | derivation.extremum-tangente | Réactivation Première : dérivation, variations, tangente |
| Q5-Q6 | fonctions.produit-et-exponentielle | Réactivation Première : produit et calcul exponentiel |
| Q7-Q8 | exponentielle.positivite-variations | Réactivation Première : exponentielle |
| Q9-Q10 | logarithme.proprietes-inequations | **Pont Terminale** : logarithme, notion nouvelle |
| Q11-Q12 | second-degre.signe-solutions | Outil de Première réinvesti dans l'étude de fonctions |
| Q13-Q14 | probabilites.independance-bayes | Q13 réactivation ; Q14 **pont Terminale** vers l'inférence bayésienne |
| Q15-Q16 | esperance.binomiale-jeu | Espérance réactivée ; Q15 **pont Terminale** vers la loi binomiale |
| Q17-Q18 | evolutions.taux-successifs | Réactivation des taux et coefficients multiplicateurs |

Les prompts Élève, Parents, Nexus et Vérificateur portent une règle explicite : un
item de pont ne doit jamais être présenté comme une « lacune de Première ».

## Correction éditoriale de la question 14

La copie papier porte, pour l'option B, la formulation :
« Non : la probabilité qu'elle soit porteuse est d'environ 59 % ».

Le calcul exact donne :

`0,03 × 0,95 / (0,03 × 0,95 + 0,97 × 0,02) ≈ 0,595`.

La lettre **B** reste donc la bonne réponse de la copie papier, mais le libellé numérique
est normalisé en : « Oui, à environ 59 % ». La lettre n'est pas changée afin que la
transcription d'une copie déjà remplie reste exacte.

## Pourquoi le pack est paper-only

La copie imprimée a une distribution de bonnes réponses très déséquilibrée : 12 réponses
B et 6 réponses C. Le validateur V14 impose normalement qu'aucune position de bonne
réponse ne dépasse 40 %, protection utile pour les questionnaires en ligne.

Réordonner numériquement les options de ce questionnaire casserait toutefois la
correspondance A/B/C/D avec les copies papier déjà distribuées. Le lot introduit donc une
politique générique de canal :

```json
{
  "delivery": {
    "online": false,
    "paperEntry": true,
    "fixedPaperForm": true
  }
}
```

V14 n'est neutralisé que pour ce type de formulaire **fixe et exclusivement papier**.
Dès qu'un pack est utilisable en ligne, V14 reste bloquant.

## Workflow métier réutilisé

Aucune seconde chaîne de calcul n'est créée.

```text
Dashboard assistante
  -> /api/bilans/saisie-papier
  -> CanonicalAssessmentAttempt (provenance=SAISIE_PAPIER)
  -> SUBMITTED
  -> canonical_job_outbox / SCORE_ATTEMPT
  -> facts.v1.0.1 + FactSheet
  -> rendu déterministe
  -> GENERATE_REPORT
  -> revue / publication selon la machine d'états Canonical
```

La saisie papier utilise les mêmes invariants que la passation en ligne : réponses
complètes, « Sans réponse » explicite, certitude éventuellement absente sur une copie,
idempotence, même scoring et mêmes contrôles structurels.

## LLM et agents

Le pack fournit ses cinq prompts versionnés :

1. `preAnalysis`
2. `eleve`
3. `parents`
4. `nexus`
5. `verifier`

Le gateway générique `BilanLlmGateway` les exécute dans cet ordre, puis applique les
validateurs déterministes. Aucun agent spécifique « maths complémentaires » n'est créé :
la spécialisation est portée par le pack, le CPS et les prompts.

Important : le worker `GENERATE_REPORT` conserve le verrou global
`NEXUS_BILAN_FAMILY_NARRATION_ENABLED`. Tant que ce flag n'est pas explicitement ouvert,
les rapports familles restent sur le rendu déterministe. Ce lot **ne lève pas ce verrou** :
le code existant exige de recâbler une revue COACH qualifiée avant d'autoriser la narration
LLM des bilans familles en production.

## Persistance de la matière

Le code de pack distingue explicitement `MATHS_COMPLEMENTAIRES` pour le catalogue, les
labels, le rendu et les prompts. La colonne Prisma `Subject` n'est pas étendue dans ce lot :
le CanonicalAttempt persiste la famille `MATHEMATIQUES`, tandis que l'identité exacte de
l'option reste immuable dans `assessmentPackId=entree-terminale-maths-complementaires-v1`
et dans le checksum/version du pack. Une extension de l'enum Prisma serait une migration
transverse distincte sans bénéfice pour le scoring ou le rendu de ce pack.

## Activation — gate humaine obligatoire

Avant apparition dans le dashboard de saisie papier :

1. revue pédagogique humaine du YAML, du CPS et des cinq prompts ;
2. création du registre `data/bilans/reviews/entree-terminale-maths-complementaires-v1.review.yaml`
   avec l'identifiant réel du relecteur et les checksums courants ;
3. génération de `data/bilans/banks/entree-terminale-maths-complementaires-v1.json` ;
4. ajout du pack au manifeste actif `wave1.manifest.json` et mise à jour des compteurs ;
5. CI complète verte ;
6. activation de
   `NEXUS_BILAN_PACK_ENTREE_TERMINALE_MATHS_COMPLEMENTAIRES_V1_ENABLED=true`.

Aucun `validatedBy` n'est inventé par le code et aucune activation ne peut être obtenue
par la seule présence du fichier source.
