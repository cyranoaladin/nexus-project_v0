# Mathématiques complémentaires — positionnement papier d'entrée en Terminale

Date d'intégration : 2026-08-22  
Pack : `entree-terminale-maths-complementaires-v1`  
Vague : `vague-2-maths-complementaires-2026`

## 1. Périmètre

Le document papier Nexus comporte 18 QCM, une durée indicative de 25 minutes et une certitude obligatoire de 1 à 4 pour chaque réponse renseignée. Une question inconnue doit rester vide : l'absence de réponse est une information diagnostique et ne doit pas être remplacée par une réponse au hasard.

L'intégration reprend exactement la chaîne canonique des autres bilans : la saisie par l'assistante ne constitue pas un moteur parallèle. Elle crée une tentative de provenance `SAISIE_PAPIER`, immédiatement soumise, puis le même job de scoring produit la FactSheet et alimente la même chaîne de restitution.

## 2. Référentiel réglementaire retenu pour la rentrée 2026

Pour un élève qui entre en Terminale en septembre 2026, les prérequis proviennent de sa Première 2025-2026. Le référentiel de Première pertinent reste donc le programme de spécialité fixé au BO spécial n°1 du 22 janvier 2019 (NOR MENE1901632A). Le programme 2026 de Première n'entre en application qu'à la rentrée 2026-2027 et concerne la nouvelle cohorte de Première.

Pour l'option de Terminale 2026-2027, le programme applicable reste celui du BO spécial n°8 du 25 juillet 2019 (NOR MENE1921265A). Le nouveau programme publié au BO n°14 du 2 avril 2026 (NOR MENE2902920A) n'entre en application qu'à la rentrée 2027-2028.

Conséquence importante : les questions 9 et 10 sur le logarithme sont enregistrées comme **familiarisation / bridge vers la Terminale**, et non comme prérequis de Première. Une réponse fausse ou vide sur ces deux items ne peut pas être décrite dans un bilan comme une « lacune de Première ».

## 3. Cartographie des 18 questions

| Questions | Nœud CPS | Domaine de scoring | Lecture pédagogique |
|---|---|---|---|
| 1–2 | `1re.maths-complementaires-prerequis.suites.modeles-discrets` | `suites` | suites, récurrence, évolutions multiplicatives |
| 3 et 8 | `1re.maths-complementaires-prerequis.derivation.variations-fonctions` | `derivation` | variations, extremum, exponentielle composée à un affine |
| 4–5 | `1re.maths-complementaires-prerequis.derivation.nombre-derive-formules` | `derivation` | tangente, nombre dérivé, dérivée d'un produit |
| 6–7 | `1re.maths-complementaires-prerequis.exponentielle.regles-image` | `exponentielle` | règles de calcul et positivité de l'exponentielle |
| 9–10 | `terminale.maths-complementaires.exponentielle.logarithme-familiarisation` | `exponentielle` | bridge Terminale, jamais déficit de Première |
| 11–12 | `1re.maths-complementaires-prerequis.second-degre.signe-racines` | `second-degre` | discriminant, racines, signe d'un trinôme |
| 13–14 | `1re.maths-complementaires-prerequis.probabilites.conditionnement-independance` | `probabilites` | indépendance et probabilité conditionnelle |
| 15–16 | `1re.maths-complementaires-prerequis.probabilites.variables-aleatoires-esperance` | `probabilites` | loi binomiale et espérance |
| 17–18 | `1re.maths-complementaires-prerequis.pourcentages.evolutions-successives` | `pourcentages` | taux et évolutions successives |

Chaque nœud CPS est couvert par exactement deux items. Les domaines de restitution sont : `suites`, `derivation`, `exponentielle`, `second-degre`, `probabilites`, `pourcentages`.

## 4. Invariant critique : lettres papier versus ordre interne

Le test imprimé possède une distribution très déséquilibrée des bonnes **lettres** : B est la bonne lettre sur la majorité des questions. Le validateur canonique interdit qu'une même **position de tableau JSON** porte plus de 40 % des réponses correctes.

Il ne faut pas confondre ces deux notions. Les identifiants A/B/C/D sont conservés strictement ; l'ordre interne des options est équilibré pour le garde-fou anti-biais, avec une distribution des positions correctes de `5 / 5 / 4 / 4`. La projection de saisie papier trie ensuite les options par identifiant A→D. Ainsi, la lettre entourée sur la copie reste toujours la lettre saisie, sans affaiblir le contrôle anti-biais du pack.

## 5. Anomalie éditoriale de la question 14

La copie demande si une personne testée positive est « probablement porteuse » avec : prévalence 3 %, sensibilité 95 %, faux positifs 2 %.

Le calcul donne :

`P(porteur | +) = 0,03×0,95 / (0,03×0,95 + 0,97×0,02) ≈ 0,595`.

L'option B contient donc la bonne valeur numérique, environ 59 %, mais commence par « Non ». Cette négation est incohérente avec une probabilité supérieure à une chance sur deux. Le pack conserve B comme **réponse visée par le document papier**, tout en enregistrant l'anomalie dans la correction et dans les prompts `eleve`, `parents`, `nexus` et `verifier` afin qu'aucun agent ne transforme ce « Non » en vérité mathématique.

**Avant activation en production, la formulation papier doit idéalement être corrigée**, par exemple en « Oui : la probabilité qu'elle soit porteuse est d'environ 59 % ». À défaut, l'équipe doit accepter explicitement que B représente l'intention de correction malgré l'erreur éditoriale.

## 6. Workflow applicatif

Chaîne effective :

`Dashboard assistante / saisie papier`
→ sélection élève + pack
→ saisie `optionId` + `confidence` ou réponse vide
→ tentative `SAISIE_PAPIER`
→ statut `SUBMITTED`
→ job `SCORE_ATTEMPT`
→ FactSheet `facts.v1.0.1`
→ rendu déterministe du bilan
→ agents `preAnalysis`, `eleve`, `parents`, `nexus`, `verifier` lorsque la narration de famille est activée
→ revue humaine / publication selon le workflow existant.

Aucun nouveau moteur de scoring, aucune nouvelle file de jobs et aucun fork spécifique « maths complémentaires » n'ont été créés.

## 7. Décisions techniques

- La vague 1 reste inchangée : 17 banques / 306 items et ses preuves versionnées ne sont pas rouvertes.
- La matière est ajoutée dans une vague 2 autonome : 1 banque / 18 items.
- La découverte de la vague 2 est elle-même derrière le feature flag exact du pack.
- Dans Prisma, la tentative est persistée sous la discipline large `MATHEMATIQUES`. L'option exacte est portée par `assessmentPackId = entree-terminale-maths-complementaires-v1` et sa version ; aucune migration de l'enum global `Subject` n'est nécessaire.
- Le RAG demeure désactivé pour cette Terminale conformément à la décision existante A56 ; le pack n'invente aucune source RAG.
- Les cinq prompts et leurs checksums sont liés au pack validé. Le vérificateur bloque notamment les faux diagnostics sur le logarithme et l'interprétation erronée de la question 14.

## 8. Activation

Feature flag du pack :

`NEXUS_BILAN_PACK_ENTREE_TERMINALE_MATHS_COMPLEMENTAIRES_V1_ENABLED=true`

La narration LLM de la famille reste contrôlée par le mécanisme global déjà en place ; cette intégration ne modifie pas son réglage global.

Checklist avant activation : validation des tests CI, relecture pédagogique de la banque et des cinq prompts, correction ou acceptation explicite de l'anomalie Q14, puis activation du feature flag dans l'environnement cible et essai complet avec une copie papier factice avant toute saisie réelle.
