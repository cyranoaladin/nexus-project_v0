# Couverture des PDF — Seconde et Terminale NSI

## Sources et périmètre

- `Nexus_Bilan_Septembre_2026_Seconde.pdf`, 8 pages : extraction intégrale et inspection des huit pages rendues. Inventaire source détaillé dans `couverture-seconde.md`.
- `Nexus_Bilan_Septembre_2026_Troisieme.pdf` : rubriques générales communes transférables ; inventaire disciplinaire dans `couverture-troisieme.md`. Les chapitres de Troisième ne sont pas insérés dans un bilan de NSI, et la géométrie de Troisième n’est pas réputée avoir été enseignée en Seconde.
- Banque historique : `lib/espace/bilan-bank.json` pour la Seconde ; `lib/espace/bilan-terminale-nsi.json` pour la NSI. Les énoncés, identifiants, options et prérequis historiques restent inchangés.
- Enrichissements : `bilan-enrichment-2nde.json`, `bilan-enrichment-tle-nsi.json`. Les six corrigés de Seconde sont isolés dans `bilan-enrichment-2nde-corrections.json`, à importer exclusivement depuis la couche serveur des corrigés.

Les PDF sont des questionnaires proposés ; ils ne prouvent pas que chaque notion a été travaillée par chaque élève en septembre. Le filtre par thème déclaré travaillé et par compétence non travaillée reste indispensable. Les nouveaux champs sont facultatifs. Les réponses déjà enregistrées ne sont ni réécrites ni interprétées sur une nouvelle échelle.

## Conventions de lecture

Dans les tableaux, `pdf-*` signifie un champ de l’enrichissement Seconde et `tn-pdf-*` son adaptation NSI. Un identifiant sans ces préfixes désigne un champ existant conservé. `scale` est une réponse unique présentée de manière compacte ; ce type ne calcule aucun score. Les questions mentionnées dans une même cellule se complètent, sans fusionner les réponses déjà enregistrées.

Les aspects réflexifs communs des pages 1, 2, 5 et 6 des deux PDF sont couverts ci-dessous. Les contenus disciplinaires et essais des pages 3, 4, 7 et 8 sont conservés au niveau correspondant, ou adaptés aux compétences NSI déjà sourcées.

## Page 1 — cadre, parcours et attentes

| Élément du PDF | Seconde | Terminale NSI | Adaptation |
|---|---|---|---|
| Bilan sans note, septembre uniquement, réponse personnelle, droit à un avis critique | Intro générale, `scope`, intro `journey` et `habits`, `review` | Mêmes mécanismes et intros | Ne pas transformer une déclaration en preuve de maîtrise. |
| Professeur lecteur, synthèse avec élève et pour famille, entretien possible | `review`, `family`, `pdf-individual-talk` | `review`, `family`, `next.tn-parler` | Transmission et retour enseignant conservés. |
| Prénom, nom, niveau et groupe | Identité connue du compte et de l’inscription | Idem | Ne pas créer de nouveaux utilisateurs ni demander de retaper leur identité. |
| Établissement et classe | `journey.pdf-school-class` | `journey.tn-pdf-school-class` | Facultatif, peut rester vide si déjà connu ; aucune adresse demandée. |
| Date du bilan | Métadonnées de sauvegarde/transmission | Idem | Ne pas demander de date déclarative redondante. |
| Début des séances | `journey.pdf-start` | `journey.tn-pdf-start` | Date approximative ou oubli accepté. |
| Séances suivies, absences, « je ne me souviens pas » | `journey.pdf-attendance` | `journey.tn-pdf-attendance` | Une réponse libre contient les deux nombres éventuels ; ne pas assimiler à un relevé d’assiduité attesté. |
| Souvenir d’un livret, exercice, activité | `scope.other` | `scope.other`, `experience.tn-supports` | Les activités NSI sont nommées dans la banque historique. |
| Attentes initiales, trois maximum, autre précisé | `journey.pdf-initial-expectations`, `pdf-initial-other` | `journey.tn-pdf-initial-expectations`, `tn-pdf-initial-other` | Cours, bases, contrôles, autonomie, confiance, approfondissement, organisation, autre. |
| Attente la plus importante aujourd’hui | `journey.pdf-current-expectation` | `journey.tn-pdf-current-expectation` | Distincte des attentes initiales. |
| Aisance actuelle pour commencer | `growth.confidence-now` | `growth.tn-confiance` | Anciennes échelles conservées, avec option de refus. |
| Questionnaire 30–35 min, essais séparés 15–20 min | Durée et navigation à adapter au parcours enrichi | Idem | Ces durées papier ne doivent pas être promises pour l’ensemble des nouvelles questions. Sauvegarde et reprise nécessaires. |

## Page 2 — les dix habitudes et le travail entre séances

L’échelle ajoutée est : jamais ou presque / parfois / souvent / toujours ou presque / pas d’occasion ou non concerné. Les fréquences historiques sont conservées lorsqu’elles couvrent déjà l’habitude ; aucun remappage de valeurs n’est effectué.

| Item | Seconde | Terminale NSI |
|---|---|---|
| M1 Relire la consigne, repérer ce qu’on cherche | `habits.pdf-habit-instruction` | `methods.tn-modele` : reformulation des données, résultat attendu et effets |
| M2 Garder une trace avant l’aide | `habits.pdf-habit-first-trace` | `habits.tn-pdf-habit-first-trace` |
| M3 Chercher propriété, méthode ou exemple | `habits.pdf-habit-resource` | `habits.tn-pdf-habit-resource` : contrat, exemple, trace d’exécution |
| M4 Situer précisément sa difficulté | `habits.pdf-habit-locate` | `habits.tn-pdf-habit-locate` |
| M5 Expliquer même si résultat connu | `habits.pdf-habit-explain` | `habits.tn-pdf-habit-explain` : expliquer même si le programme semble fonctionner |
| M6 Contrôler calcul, unité, cohérence | `habits.pdf-habit-check` ; ancien `methods.checking` conservé | `habits.tn-pdf-habit-check` : résultat, effets, cas limite autorisé ; `methods.tn-tests` distingue les types de tests |
| M7 Noter erreur et cause | `habits.pdf-habit-error-note` | `habits.tn-pdf-habit-error-note` ; `growth.tn-erreur-utile` recueille un exemple |
| M8 Refaire sans correction | `habits.pdf-habit-redo` | `methods.tn-aide-reprise` : autre petit essai sans modèle après aide |
| M9 S’entraîner sur ce qui a été décidé | `habits.pdf-habit-agreed-practice` | `habits.tn-pdf-habit-agreed-practice` |
| M10 Préparer questions et documents | `habits.pdf-habit-prepare` | `habits.tn-pdf-habit-prepare` |

| Autres éléments | Seconde | Terminale NSI | Choix préservés |
|---|---|---|---|
| Deux réactions les plus fréquentes au blocage | `habits.pdf-resistance`, `pdf-resistance-other` | `habits.tn-pdf-resistance`, `tn-pdf-resistance-other` | Relire/essayer autrement, consulter cours/aide, demander immédiatement, attendre correction, passer puis revenir, abandonner, autre ; maximum deux. Les anciennes questions sur la **première** réaction restent distinctes. |
| Habitude utile et exemple | `habits.pdf-helpful-habit` | `habits.tn-pdf-helpful-habit` | Exemple libre, pas de réponse modèle. |
| Fréquence hors devoirs obligatoires | `habits.pdf-practice-outside-homework` | `habits.tn-pdf-practice-outside-homework` | Jamais / une / deux / trois fois ou plus / variable. Distincte de la fréquence historique plus générale. |
| Freins au travail | `habits.pdf-home-blockers`, `pdf-home-other` | `habits.tn-pdf-home-blockers`, `tn-pdf-home-other` | Temps, fatigue, ne sait quoi faire, ne comprend pas seul, organisation, rien, autre. « Rien » est exclusif ; le PDF ne limite pas le nombre de freins. |
| Petite habitude à améliorer prochainement | `next.pdf-method-goal`, `pdf-method-action` | `next.tn-pdf-method-goal`, `tn-pdf-method-action` | Deuxième objectif facultatif, action avec moment et aide. |

## Page 3 — compétences de Seconde

Le PDF propose 19 compétences au total : 6 en calcul littéral, 6 en arithmétique et 7 sur les ensembles de nombres. La banque Seconde comportait 16 compétences ; elle reçoit 14 compétences additionnelles, soit 30. Les anciennes compétences de calcul numérique, puissances et racines sont conservées, même lorsqu’elles ne figurent pas dans ce PDF.

| Item PDF | Identifiant Seconde | Traitement |
|---|---|---|
| L1 Traduire une situation | `2-literal-translate` | Nouveau module `2-literal`, déclaré travaillé avant tout positionnement. |
| L2 Substitution, y compris négative | `2-literal-substitute` | Nouveau. |
| L3 Réduction, parenthèses | `2-literal-reduce` | Nouveau. |
| L4 Distributivité simple/double | `2-literal-expand` | Nouveau. |
| L5 Identités remarquables | `2-literal-identity` | Nouveau. |
| L6 Factorisation | `2-literal-factor` | Nouveau. |
| A1 Multiples, diviseurs, critères | `2-divisors` + `2-divisibility-criteria` | L’ancien item traduit les relations ; le nouveau couvre les critères. |
| A2 Division euclidienne, reste | `2-euclid` | Nouveau. |
| A3 Primalité et justification | `2-prime` | Existant conservé. |
| A4 Facteurs premiers | `2-factors` | Existant conservé. |
| A5 Décomposition pour fraction | `2-factor-fraction` | Nouveau, différent du calcul général de fractions. |
| A6 Divisibilité ou parité justifiée | `2-divisibility-proof` + `2-parity` | Divisibilité ajoutée ; parité existante. |
| Compétence prioritaire et pourquoi | `next.target-topic` + `next.pdf-priority-reason` | L’ancien champ n’est pas réécrit. |

Pour la NSI, ces contenus mathématiques ne sont pas importés. La même démarche de positionnement s’applique aux 22 compétences existantes des six thèmes : classes/objets/références ; interfaces/contrats/tests ; ensembles d’entiers sans doublons ; listes/piles/files ; récursion simple ; récursion sur structures. `next.tn-notion-cible` et `next.tn-pdf-priority-reason` documentent la priorité et sa raison. Aucune question de complexité n’est ajoutée sans source pédagogique correspondante.

## Page 4 — nombres, réussites et difficultés

| Item PDF | Seconde | Terminale NSI |
|---|---|---|
| E1 Reconnaître ℕ, ℤ, 𝔻, ℚ, ℝ | `2-sets-recognize` | Positionnement sur les compétences NSI pertinentes, sans import de ces ensembles mathématiques. |
| E2 Choisir le plus petit ensemble | `2-sets-s` | Idem. |
| E3 Inclusions, ∈, ∉ | `2-sets-symbols` | Idem. |
| E4 Décimal, rationnel, irrationnel | `2-sets-nature` | Idem. |
| E5 Exact ou approché | `2-exact` | Idem. |
| E6 Simplifier avant classement | `2-sets-s` | Idem. |
| E7 Justifier ou réfuter par contre-exemple | `2-sets-counterexample` | Justifications et tests discriminants dans `tn-test-contrat` et essais existants. |
| Réussite précise, situation, seul ou aidé | `growth.progress-example` et son aide de saisie existante | `growth.tn-exemple-progres`, qui demande aussi l’aide utilisée |
| Difficulté persistante et ce qui a déjà été tenté | `growth.persistent`, `growth.pdf-persistent-attempt` | `growth.tn-pdf-persistent-attempt` |
| Deux blocages maximum | `methods.blockers`, options ajoutées « Lire une figure… » et « Je ne sais pas encore » | `growth.tn-obstacle`, options ajoutées cours utile, temps, concentration, oser essayer |

Les neuf catégories concrètes du PDF — mots, cours, méthode, calcul, figure, rédaction, concentration, temps, oser essayer — sont couvertes par les catégories historiques et les ajouts. En NSI, calcul/figure deviennent lecture du code, trace des valeurs et contrats, sans demander une compétence de géométrie. « Aucune difficulté » et « Je ne sais pas encore » restent des choix exclusifs.

L’échelle papier D (« en difficulté ») est plus large que l’ancien choix web `start` (« ne sait pas encore commencer »). Ne pas réinterpréter ce choix historique : le nouveau choix additif `difficulty` (« Je rencontre encore des difficultés ») couvre D sans changer `start`, et les champs libres précisent la difficulté. NT est couvert par `scope` et `mastery.notworked` ; ? par `mastery.unsure` ; aide/autonomie/explication par les valeurs historiques correspondantes.

## Page 5 — avis sur les séances et changements ressentis

| Dimension | Seconde | Terminale NSI |
|---|---|---|
| Rythme lent/adapté/rapide/variable | `experience.pace` | `experience.tn-rythme` |
| Difficulté faible/adaptée/forte/variable | `experience.level-fit` | `experience.tn-pdf-difficulty` |
| Quantité de travail | `experience.pdf-workload` | `experience.tn-pdf-workload` |
| Temps de recherche insuffisant/adapté/trop long/variable | `experience.pdf-search-fit` | `experience.tn-pdf-search-fit` |
| Objectifs clairs | `experience.pdf-clear-objectives` | `experience.tn-pdf-clear-objectives` |
| Utiliser livrets/retrouver aide | `experience.pdf-booklet-agency` | `experience.tn-pdf-booklet-agency` |
| Exercices répondant aux besoins | `experience.pdf-needs-fit` | `experience.tn-pdf-needs-fit` |
| Explications/corrections utiles | `experience.clarity`, `experience.pdf-corrections-useful` | `experience.tn-pdf-correction-impact` |
| Aide du professeur disponible | `experience.help-time` | `experience.tn-questions` |
| Question et erreur sans gêne | `experience.pdf-safe-error` | `experience.tn-pdf-safe-error` |
| Groupe propice à concentration | `experience.pdf-group-focus` | `experience.tn-pdf-group-focus` |
| Conserver, changer, essayer, pourquoi | `experience.format-feedback` + `pdf-adjustment-reasons` | `experience.tn-ajustement` + `tn-pdf-adjustment-reasons` |
| Compréhension moins bonne/stable/meilleure/inconnue | `growth.pdf-understanding-change` | `growth.tn-pdf-understanding-change` |
| Autonomie | `growth.autonomy-change` | `growth.tn-autonomie` |
| Confiance | `growth.confidence-change` | `growth.tn-pdf-confidence-change` |
| Exemple en classe ou à la maison | `growth.transfer-example`, `progress-example` | `growth.tn-pdf-transfer-example`, `tn-exemple-progres` |

Les nouvelles questions d’accord utilisent pas du tout / plutôt non / plutôt oui / tout à fait / non concerné ou pas d’avis. Les anciennes questions de fréquence restent sur leur échelle historique. La perception d’une évolution ne devient pas un progrès démontré ; les traces et commentaires enseignants servent à la préciser.

## Page 6 — besoins, objectifs et famille

| Élément | Seconde | Terminale NSI |
|---|---|---|
| Jusqu’à trois aides parmi les dix proposées | `next.pdf-needed-supports` | `next.tn-pdf-needed-supports` |
| Aide la plus utile parmi la sélection | `next.pdf-top-support` avec `priorityOf: pdf-needed-supports` | `next.tn-pdf-top-support` avec `priorityOf: tn-pdf-needed-supports` |
| Autre attente ou question non posée | `next.free` | `next.tn-remarque` |
| Objectif disciplinaire et notion | `next.target-topic`, `priorities` | `next.tn-notion-cible`, `tn-priorites` |
| Action précise et moment | `next.commitment`, `when`, `support-needed` | `next.tn-action`, `tn-moment`, `tn-aide-prof` |
| Comment vérifier le progrès | `next.pdf-verification` | `next.tn-verification` |
| Deuxième objectif : habitude de travail | `next.pdf-method-goal` | `next.tn-pdf-method-goal` |
| Action, moment, aide pour cette habitude | `next.pdf-method-action` | `next.tn-pdf-method-action` |
| Date du prochain point | `next.pdf-next-check-date` | `next.tn-pdf-next-check-date` |
| Message aux parents | `family.pdf-family-understand` | `family.tn-pdf-family-understand` |
| Encourager, horaires, laisser chercher, plan de travail, autre | `family.pdf-family-support`, `pdf-family-other` | `family.tn-pdf-family-support`, `tn-pdf-family-other` |
| Relecture et transmission | `review.confirmed` | `review.confirmed` |
| Souhait de précision individuelle | `family.pdf-individual-talk` | `next.tn-parler` |

Les dix aides sont présentes : revoir une base, exemples expliqués, temps de recherche, choix de méthode, entraînement, justification, retour précis sur erreurs, défis, reprise entre séances, entretien individuel. Pour la NSI, la justification vise une trace, un contrat ou un test. Les deux objectifs sont facultatifs ; la date proposée n’est pas un rendez-vous confirmé. La priorité peut être refusée ; si une aide est désélectionnée, la priorité doit être réconciliée par l’interface et validée côté serveur.

## Pages 7–8 — essais et métacognition

| Essai PDF Seconde | Nouvel identifiant | Observation ciblée |
|---|---|---|
| 2L1 Développer et contrôler A=(2x−3)(x+4)−2x(x+1), x=−1 | `2-pdf-L1` | Distributivité, réduction, substitution, contrôle par deux écritures. |
| 2L2 Factoriser B=9x²−25 et C=(x+2)(3x−1)+4(x+2) | `2-pdf-L2` | Reconnaître différence de carrés et facteur commun, expliquer le choix. |
| 2A1 Décomposer 180/252 et rendre irréductible | `2-pdf-A1` | Facteurs premiers, simplification justifiée, irréductibilité. |
| 2A2 Somme de deux impairs | `2-pdf-A2` | Preuve générale avec deux entiers, pas accumulation d’exemples. |
| 2E1 Classer −7,0,125,1/3,√49,√2 | `2-pdf-E1` | Plus petit ensemble, simplification, rationnel non décimal, irrationnel ; convention 0∈ℕ. |
| 2E2 Deux affirmations sur rationnels/décimaux et 0,333=1/3 | `2-pdf-E2` | Contre-exemple, différence entre exact et approché. |

Les sept anciens essais Seconde restent disponibles ; aucun de leurs énoncés ou prérequis ne change. Les six nouveaux essais portent une référence exacte aux pages 7 ou 8. Les corrections et observations didactiques sont séparées du JSON public.

En Terminale NSI, les huit essais existants sont conservés : alias d’objets ; comparaison des contrats ; test révélant une normalisation fautive ; effet du retrait d’un ensemble ; pile/file ; trace récursive ; oubli de `return` ; tranche de liste et récursion. Les essais mathématiques des PDF ne sont pas importés. L’équivalent du premier essai sans calculatrice est une prédiction sur papier avant exécution ; une exécution ou aide ultérieure doit être distinguée de cette première trace.

| Conditions et réflexion du PDF | Représentation |
|---|---|
| Essais distincts, choisis avec professeur, notions réellement travaillées | Sélection et filtres `scope/mastery`, intro `trial-reflection` ; un ou deux essais facultatifs à la fois. |
| Recherche incomplète permise, conserver ses essais, pas score global | `evidence.answer` et `retry` séparés, intros explicites. |
| Ressenti avant : confiant/partagé/inquiet/difficile à dire | `trial-reflection.pdf-before-trials` / `tn-pdf-before-trials`. |
| Seul, avec aide, non fait ; NT si non travaillé | Champs `evidence` existants, complétés par les conditions mises en œuvre par l’intégration centrale ; NT filtre les essais sans les compter comme échecs. |
| Confiance après : faible/moyenne/forte | Champ optionnel par essai à intégrer au schéma `evidence`, à la relecture et aux exports ; pas de question dupliquée dans ces banques. |
| Préciser son auto-positionnement après les essais | `trial-reflection.pdf-after-position` / `tn-pdf-after-position` ; la réponse initiale reste conservée. |

## Comptages et garde-fous

| Profil | Questions réflexives historiques | Ajouts réflexifs | Total | Compétences | Essais disponibles |
|---|---:|---:|---:|---:|---:|
| Seconde | 33 | 46 | 79 | 16 + 14 = 30 | 7 + 6 = 13 |
| Terminale NSI | 30 | 45 | 75 | 22 inchangées | 8 inchangés |

Le total réflexif exclut l’identification automatique, le positionnement par thème/compétence, les champs internes des essais et la relecture. Les nouveaux blocs ont 6/16/4/2 questions en Seconde et 6/14/3/2 en NSI ; après ajouts, aucune rubrique réflexive n’excède 24 champs. Les 30 compétences Seconde demandent une répartition entre `mastery` et `mastery-extra`, avec lecture fusionnée et préservation des anciens IDs.

Ce volume est substantiel : ne pas imposer toutes les réponses, ne pas maintenir aveuglément la durée papier, permettre de sauvegarder et reprendre. Les échelles compactes réduisent l’encombrement mais ne justifient pas de minorer le temps de réflexion.

## Vérification des données réalisée

Cycle TDD dédié dans `__tests__/lib/espace/bilan__pdf2nde-data.test.ts` : cinq tests ont échoué sur l’absence des banques, puis les cinq ont réussi après ajout. Ils contrôlent structure additive, identifiants distincts, options uniques, plafonds de champs, références de priorité, périmètres disciplinaires, existence des compétences requises et séparation des corrigés. Les tests d’interface, sauvegarde, droits et export relèvent de la vérification centrale de l’intégration ; ce document ne les déclare pas exécutés à ce stade.

Revue pédagogique complémentaire : un sixième test a révélé l’absence de question explicite sur l’utilité des corrections en Seconde (la reprise d’une correction ne mesure pas son utilité). Ajout de `experience.pdf-corrections-useful`, puis six tests réussis. Les six corrigés ont été recalculés et vérifiés : aucune erreur mathématique trouvée.
