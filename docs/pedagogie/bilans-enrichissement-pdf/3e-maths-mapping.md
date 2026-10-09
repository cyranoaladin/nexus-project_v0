# Enrichissements des PDF : troisième et Terminale mathématiques

## Sources et périmètre

Le PDF `Nexus_Bilan_Septembre_2026_Troisieme.pdf` a été extrait et les huit pages inspectées visuellement. Cette correspondance intègre son contenu dans le bilan troisième et transpose ses principes transversaux au bilan Terminale mathématiques. Le programme de collège ne devient pas un programme de Terminale.

Les banques historiques restent inchangées. Ajouts uniquement dans `bilan-enrichment-3e.json` et `bilan-enrichment-tle-maths.json`. Les six corrections ajoutées figurent dans `bilan-enrichment-3e-corrections.json`, à importer exclusivement depuis le module `server-only` de correction.

## Inventaire livré

| Profil | Modules ajoutés | Compétences ajoutées / total | Essais ajoutés / total | Questions ajoutées / total |
|---|---:|---:|---:|---:|
| Troisième | 2 | 14 / 30 | 6 / 14 | 43 / 76 |
| Terminale maths | 0 | 0 / 24 | 0 / 8 | 44 / 74 |

Les questions historiques sont conservées : 33 en troisième, 30 en Terminale mathématiques. Le nombre de questions inclut les réponses facultatives et les dix lignes de fréquence compactes. Il n'inclut pas les compétences ni les métadonnées de confiance des essais.

Troisième : nouvelles sections `journey`7, `habits`15, `family`4, `trial-reflection`2 ; ajouts `experience`7, `growth`2, `next`6. Terminale : 8,15,4,2 ; ajouts7,3,5 respectivement. Aucune section de questions ne dépasse24champs. Le troisième nécessite le découpage des30compétences en deux étapes par le chargeur ; Terminale conserve son étape24compétences. Les parcours restent sous16étapes.

## Correspondance du PDF troisième, sans oubli

### Page1 — parcours et cadre

Bilan sans note, centré septembre, droit à la critique, synthèse avec élève et parents et échange individuel : cadre de l'interface existante, section `family`, ajout d'option à `experience.ask` / `experience.tm-q-ask`. Les durées papier30–35min ne sont pas reprises comme durée validée du parcours enrichi : cible d'interface45–60min, reprise possible.

Nom, niveau, groupe, date : contexte connu en lecture seule à afficher par l'interface, sans recréer des comptes. Établissement/classe, début, séances suivies, absences : `journey.*school-class`, `*start-date`, `*attendance`, `*absences`, tous facultatifs ; l'incertitude est explicitement recevable. Assiduité déclarée n'est pas registre administratif.

Souvenir de livret/exercice/activité : troisième `scope.other` existant ; Terminale `tm-q-remembered-session`. Attentes initiales max3 et autre : `*initial-expectations`, `*initial-expectations-other` ; attente actuelle `*expectation-now`. Aisance actuelle : `growth.confidence-now` / `growth.tm-q-confidence-now` existants, sans doublon.

### Page2 — méthodes

M1 à M10 → `habits.*habit-instruction`, `*habit-first-trace`, `*habit-resource`, `*habit-localize`, `*habit-explain`, `*habit-check`, `*habit-error`, `*habit-retry`, `*habit-plan`, `*habit-prepare`. Échelle complète : jamais ou presque, parfois, souvent, toujours ou presque, pas d'occasion/non concerné, refus. Type `scale` pour un affichage compact.

Deux réactions au blocage : première réaction historique `methods.stuck` / `tm-q-stuck` conservée (radio), avec ajout aide/cours, attente correction, passer/revenir ; seconde `*second-reaction`. « Autre » précisé dans `*helpful-habit`, qui recueille aussi habitude utile et exemple. Pas de conversion destructrice radio→multi.

Fréquence hors devoirs obligatoires : `*outside-homework`, distincte de reprise spécifique des séances. Freins temps/fatigue/quoi faire/comprendre seul/organisation/rien/autre : `*home-barriers` + `*home-barriers-other` ; rien exclusif. Habitude à améliorer dès semaine suivante : `next.*method-goal` avec action, moment, aide.

### Page3 — compétences et priorité

| Compétence PDF | Troisième, ID(s) couvrants | Adaptation Terminale, sans ajout de compétence |
|---|---|---|
| F1 simplifier et irréductibilité | `3-reduce-s`, `3-irreducible` | transformations justifiées : `tm-limit-transform` |
| F2 addition/soustraction | **`3-fraction-add`** | différence de termes : `tm-difference` |
| F3 multiplication/division | **`3-fraction-multiply`** | `tm-quotient`, `tm-auxiliary`, `tm-return` |
| F4 signes/priorités | `3-operations`, contrôle des signes dans méthodes et essais | `tm-quotient`, `tm-bound-sign`, `tm-return` |
| A1 multiples/diviseurs/critères | **`3-multiple-divisor`**, `3-criteria` | reconnaissance justifiée : `tm-nature`, `tm-definition` |
| A2 division euclidienne | **`3-euclidean-use`**, `3-div-s` | procédure et interprétation : `tm-explicit`, `tm-sum`, `tm-loop` |
| A3 premier/décomposition | `3-prime`, `3-factors` | structure et transformation : `tm-nature`, `tm-auxiliary` |
| A4 diviseurs communs/partage | **`3-common-divisors`**, `3-lots-s` | choix et minimalité : `tm-threshold`, `tm-error-bound` |
| L1 substituer | **`3-literal-value`** | `tm-explicit`, `tm-definition` |
| L2 réduire | **`3-literal-reduce`** | `tm-difference`, `tm-limit-transform` |
| L3 développer/signes | **`3-literal-expand`** | `tm-difference`, `tm-return` |
| L4 factoriser | **`3-literal-factor`** | `tm-limit-transform`, `tm-auxiliary` |

Nouveaux thèmes sont conditionnels : le PDF ne prouve pas qu'ils aient été travaillés. Aucun changement des prérequis anciens. Priorité disciplinaire : `next.target-topic` / `tm-q-target` ; pourquoi : `*priority-reason`.

### Page4 — géométrie, réussites et difficultés

| Compétence PDF | Troisième | Principe Terminale |
|---|---|---|
| G1 similitude par angles | `3-geo-s`, essai `3-pdf-similarity` | preuve par propriétés : `tm-logic`, `tm-induction` |
| G2 sommets/côtés correspondants | `3-geo-s` | correspondances indices : `tm-definition`, `tm-target` |
| G3 coefficient/calcul longueur | **`3-similarity-length`** | raison et termes : `tm-nature`, `tm-explicit` |
| T1 conditions Thalès | **`3-thales-conditions`** | hypothèses : `tm-invariant`, `tm-quotient`, `tm-monotone` |
| T2 rapports cohérents | **`3-thales-ratios`** | quotient et indices : `tm-quotient`, `tm-return` |
| T3 longueur Thalès | **`3-thales-length`** | théorème après conditions : `tm-monotone`, `tm-limit-value` |
| T4 réciproque/parallélisme | **`3-thales-converse`** | sens logique : `tm-logic`, existence avant valeur `tm-limit-value` |

Les correspondances Terminale sont didactiques, pas des équivalences de maîtrise entre programmes.

Réussite/exercice/seul-aidé : `growth.progress-example` / `tm-q-trace` existants. Difficulté persistante : `persistent` / `tm-q-persistent` ; ce qui a déjà été essayé : `*already-tried`. Blocages max2 : troisième `methods.blockers` avec lire figure et inconnue ajoutés ; Terminale nouveau `tm-q-difficulty-types`, adapté notations/indices. Les options inconnue/absence de difficulté/refus sont exclusives.

Échelles : conserver toutes les clés historiques, dont `start` ; le loader/interface ajoute `difficulty` pour permettre difficulté sans imposer incapacité à commencer. Aucun recodage historique.

### Page5 — séances et changements

Rythme/difficulté : anciens `pace`/`level-fit` et `tm-q-pace`/`tm-q-difficulty`. Quantité : `*workload`. Temps recherche : anciens radios avec options « parfois trop long » et « variable » ajoutées.

Objectifs clairs : `*objectives-clear`. Utilisation livret/aide : troisième `*booklet-navigation`, car `booklet` mesure l'usage ; Terminale `tm-q-booklet` existant mesure déjà le repérage. Adaptation aux besoins : `*needs-fit`, distinct de difficulté. Explications/corrections : troisième `clarity` existant + `*corrections-useful`, Terminale `*explanations-useful`. Accès professeur : troisième `help-time` existant, Terminale `*help-access`, distinct de l'efficacité de son aide. Question/erreur sans gêne : ancienne question avec option explicite ajoutée. Groupe/concentration : `*group-focus` ; anciens échanges entre élèves restent distincts.

Conserver et changer : `format-feedback` / `tm-q-format-feedback` ; pourquoi : `*feedback-reason` facultatif, seulement si pas déjà expliqué. Compréhension : `*understanding-change`. Autonomie/confiance : questions historiques. Exemple classe/maison : troisième `transfer-example` / `progress-example`, Terminale `tm-q-trace` / `tm-q-free` déjà proposés. Ne pas inférer une progression objective du seul ressenti.

### Page6 — besoins, objectifs, parents

Dix aides : `*help-needs`, max3 ; priorité `*help-priority`, radio `priorityOf` vers ce même champ de `next`, options complètes identiques, filtre UI sur sélections. Le refus reste possible. Les dix aides sont bases, exemples, temps, méthode, entraînement, rédaction, retour erreurs, défis, reprise entre séances, échange individuel.

Autre attente : `next.free` / `tm-q-free`. Objectif disciplinaire : questions historiques de cible, action, moment, professeur. Indicateur de progrès : troisième nouveau `*progress-check`, Terminale `tm-q-verification` existant. Objectif méthode/habitude + action/aide/moment : `*method-goal`. Prochain point : `*review-date`, souhait à confirmer, pas rendez-vous automatique.

Parents : `family.*family-understand`, `*family-support`, `*family-other`. Encouragement, organisation horaires, laisser chercher, vérifier plan, autre sont présents ; pas de maximum3 inventé. Demande échange professeur : `*individual-followup`. Confirmation relecture : champ historique `review.confirmed`.

### Pages7–8 — essais et conditions

Les six énoncés du PDF sont ajoutés à la troisième sous de nouveaux IDs. Aucun remplacement de l'ancien essai de lots, fractions du reste ou triangles/aires, car leurs nombres et demandes diffèrent.

| PDF | ID nouveau | Résultat de contrôle réservé enseignant |
|---|---|---|
| 3F | `3-pdf-fractions` | 1/3 |
| 3A | `3-pdf-sharing` | 42 lots de2crayons/3gommes, maximalité justifiée |
| 3L | `3-pdf-literal` | B=4x−17 ; B(−2)=−25 ; C=5(x+3) |
| 3G | `3-pdf-similarity` | A↔D,B↔E,C↔F ; k=1,5 ; DF=7,5cm |
| 3T | `3-pdf-thales` | AC=8cm ; MN=5cm |
| 3R | `3-pdf-converse` | 3/5=4,2/7 ; ordre des points puis réciproque |

La figure3T contenait des informations absentes du texte extrait : AM=3cm, AB=6cm, AN=4cm, BC=10cm. Elles sont toutes transcrites dans l'énoncé accessible, avec appartenances aux segments et parallélisme.

Terminale garde ses8essais : calcul, choix méthode, conditions, transformation, preuve déjà couverts, aucun chapitre collège ajouté.

Avant : `trial-reflection.*before-trials`. Après : `*after-trials`, réponse explicitement après un essai. Conditions seul/aidé/nonfait et confiance après chaque essai sont métadonnées de l'interface, pas doublons de questions dans ces JSON. Garder anciennes clés answer/aid/retry/skipped, ajouter confiance facultative. Nontravaillé continue d'exclure l'essai. Sans cours/calculatrice en troisième ; Terminale suit chaque consigne, car l'essai de seuil autorise la calculatrice. Deux essais maximum avec professeur, recherche incomplète admise, aucun score global.

## Conservation et tests

Les fichiers historiques ne sont pas modifiés. Les nouveaux IDs ne remplacent pas d'ancien énoncé. Les anciennes options restent disponibles ; seulement appendOptions. Les anciennes copies doivent rester lisibles et ne pas être rouvertes automatiquement. L'absence de réponse à une question ajoutée n'est pas une absence de compétence.

TDD `__tests__/lib/espace/bilan__pdf3e-data.test.ts` : RED : 4 échecs (fichiers non encore créés), puis GREEN : 4/4 après implémentation. Vérifications : forme exacte, collisions IDs, limites, sections non vides, priorityOf pointant vers multichoix limité à trois, références tâches/skills/sources, conservation tâches, dix fréquences compactes, avant/après, six corrections, mesures intégrales figure, pas de correction dans JSON public, Terminale sans nouveaux chapitres.

Les vérifications d’intégration, de persistance et d’interface sont détaillées dans le compte rendu d’audit de la publication.

## Parcours navigateur vérifiés sur le harnais local

`enrichment.spec.ts` : quatre parcours Chromium passent (troisième, seconde, Terminale maths, Terminale NSI), en 2,6 minutes. Chaque parcours vérifie un essai du profil, les nouvelles rubriques parcours/habitudes/famille, le maximum de trois aides et la priorité liée aux aides sélectionnées, l'invalidation de cette priorité si l'aide est retirée, la persistance après rechargement, difficulté distincte de l'ancien premier niveau, confiance et conditions de l'essai, complément après essai sans effacement du positionnement initial, transmission, commentaire enseignant, export privé complet, synthèse familiale et copie élève en lecture seule.

Premier lancement : un sélecteur de test exigeait le nom accessible exact d'un champ texte sans inclure son aide associée. Corrigé en recherche par libellé, conformément aux autres tests ; le second lancement passe intégralement. Aucun assouplissement du délai ni modification de production pour contourner cet échec. Tests exécutés avec comptes synthétiques et base locale jetable uniquement.

Les anciens tests E2E ont été adaptés aux identifiants stables d'étape, aux nombres d'étapes par profil et à la séparation des compétences complémentaires. Leur campagne complète et le contrôle sur l'artefact compilé relèvent du rapport d'intégration principal.

## Validation sur l’artefact final compilé

Les campagnes finales passent entièrement : Chromium **35/35**, Firefox **30/30**, WebKit **30/30**, soit **95 exécutions E2E réussies**. Toutes utilisent le même artefact `d743d2fb10567eaabab5b4325743d108ff65010d`, BUILD_ID `k90hnlhrcZWshgRWbc6uF`. Répertoire effectif du serveur et identifiant de build contrôlés, base locale jetable et comptes synthétiques, espace de clés Redis neuf par navigateur. Logs, captures et quatre PDF Chromium conservés séparément dans les preuves privées de l’opération.

Une première campagne sur l’artefact précédent avait révélé deux assertions anciennes attendant le libellé exact « Essai non fait » ; le rendu complet « Essai non fait — aucune conclusion de maîtrise. » était bien présent. Les assertions ont été actualisées. Une tentative antérieure de démarrage du harnais utilisait un nom d’espace Redis trop long, provoquant le refus sécurisé des connexions ; la configuration locale a été corrigée. Ces observations sont conservées dans les logs initiaux ; aucune protection applicative n’a été désactivée. Aucun échec n’est présent dans les trois campagnes finales.
