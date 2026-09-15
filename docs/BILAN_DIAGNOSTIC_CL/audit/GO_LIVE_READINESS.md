# Diagnostics V2 — état de mise en service

*Document produit par `scripts/go_live_readiness.py` depuis les pièces d'audit.*
*Aucun chiffre n'y est saisi : chacun est lu à la source canonique de sa famille.*

Ce document dit ce que la collection couvre, ce qu'elle ne couvre pas, ce qui a été
trouvé et corrigé, et ce qui reste à surveiller.

---

## Ce que la release contient

| | |
|---|---|
| Instruments | **20**, en **39 variantes** (première, terminale, cycle complet, sessions 2027 et 2028) |
| Questions de banque | **553**, toutes relues une par une |
| Assemblages | **31** |
| Livrets remis au candidat | **69** |
| Corrections du coach | **66** |
| Recueils d'impression | **15** |
| Fichiers de release | **171**, tous décrits au manifeste |
| Pages composées | **3 848** |

**Profils servis.** Première partie du baccalauréat (P1), deuxième partie (P2),
baccalauréat complet en une session (P3). **Sessions** 2027 et 2028.

**Situations candidates.** 12 915 états valides énumérés, 5 952 classes de sélection,
11 packs témoins tenus comme référence.

---

## Ce que la release ne couvre pas

Trois enseignements obligatoires du candidat individuel restent hors de l'offre de
diagnostic : **LVA, LVB, EPS**. Soit **18 des 40 points** du contrôle
continu, contre 22 couverts.

Le dispositif ne doit donc jamais être présenté comme couvrant l'intégralité du
baccalauréat. Deux verdicts distincts sont tenus :
`READY_FOR_NEXUS_SUPPORTED_SCOPE = YES`,
`READY_FOR_FULL_REGULATORY_BAC_COVERAGE = NO`.

---

## Sources officielles

**14 textes** ont été relevés sur le Bulletin officiel ou
Légifrance, cités mot à mot et datés du jour de la consultation. Le registre complet
est dans `audit/REGULATORY_SOURCE_REGISTER.json`.

**0 affirmation réglementaire non étayée**
ne subsiste dans un document remis au candidat.

### Une incertitude, déclarée comme telle

**Modalité de l'évaluation ponctuelle d'EMC pour l'année scolaire 2026-2027 : aucun texte publié.**

Aucun document remis au candidat n'énonce de modalité d'EMC. Le livret TC-EMC est un entretien de diagnostic Nexus et se présente comme tel ; sa couverture porte « Évaluation ponctuelle » et le coefficient du contrôle continu, tous deux établis, et rien de la forme de l'épreuve.

À réévaluer à chaque Bulletin officiel hebdomadaire.

---

## Ce que l'audit a trouvé

**26 défauts, tous corrigés** : 7 bloquants, 12 majeurs, 7 mineurs.
Aucun n'est resté ouvert. Le registre complet, avec la preuve de chacun, est dans
`audit/FINDINGS.jsonl`.

Les bloquants méritent d'être nommés, parce qu'ils disent ce qu'un test vert ne voit
pas.

- **answer_key** — La clé annonce « La valeur renvoyée est 85 » ; le programme de l'énoncé renvoie 67 pour n = 3.
- **answer_key** — Écho après 2,0 s à 340 m·s⁻¹ : la clé annonce 170 m, tout en écrivant « soit 680 m au total ». L'obstacle est à 340 m. Pire, le palier 1 point cotait comme erreur la réponse exacte (340 m).
- **answer_key** — « Ce sont les images … le poète emploie » : la clé donne « qu' », élision impossible devant consonne. La seule forme correcte était « que », comptée fausse.
- **missing_support** — Trois items demandent de critiquer « la réponse d'un autre candidat » sans qu'aucune production ne soit jointe : question insoluble sur le livret remis au candidat.
- **regulatory_claim** — Six livrets candidat canoniques imprimaient sous le cartouche « ÉPREUVE OFFICIELLE » la valeur « Contrôle continu » pour des instruments qui ne correspondent à aucune évaluation du baccalauréat : le dossier d'entrée Nexus, le positionnement et la maîtrise du français. Doublement faux pour le français, qui ne relève pas du contrôle continu en voie générale.
- **regulatory_claim** — Les livrets « spécialité non poursuivie » annonçaient « ÉPREUVE OFFICIELLE 3 h 30, coef. 16 » et se sous-titraient « épreuve terminale de spécialité ». Le candidat qui a arrêté cette spécialité en fin de première ne présentera jamais cette épreuve : elle est évaluée par une évaluation ponctuelle du contrôle continu, coefficient 8.
- **missing_support** — Sept items demandaient de lire un discours, une carte ou une affiche que le livret n'imprimait pas. Le livret de Première portait la notice d'un discours de Lamartine, puis trois questions demandant d'y relever un argument, de le critiquer et de le confronter à une seconde source, sans une ligne du discours. Six points sur quarante en 1RE, huit sur cinquante en ETENDUE.

Parmi les majeurs, deux tiennent à la mesure elle-même : la position des bonnes
réponses de QCM, concentrée sur une seule lettre au point qu'un candidat qui l'aurait
cochée partout sans lire aurait emporté les deux tiers des points ; et onze items qui
cotaient un point une configuration qu'aucune permutation ne réalise.

---

## Ce qui a été vérifié, et comment

| Contrôle | Résultat |
|---|---|
| Suite de tests complète, en clone propre | **14 183 passés, 0 échec**, 2 ignorés motivés |
| Questions relues une par une | **561 relectures**, 0 en échec |
| Assemblages | **31**, 0 erreur, toutes les durées dans leur fenêtre |
| Documents promis par un énoncé | **0 manquant** sur 891 renvois contrôlés |
| Préflight PDF (texte, polices, débordement, format) | **154 PDF, 3 848 pages, 0 défaut** |
| Rendu visuel de chaque page | **3 848 pages rendues**, 0 à reprendre |
| Données personnelles dans le dépôt public | **0** |
| Secrets | **0** (`gitleaks` : aucune fuite) |
| Corrigé visible dans un document candidat | **0** |
| Reproductibilité octet à octet | **173 / 173 fichiers identiques** entre deux constructions |

**Inspection visuelle.** Chaque page de la collection a été rendue en image et
mesurée ; les planches de contact par document ont été relues.

**Clone propre.** La release telle qu'elle est versionnée a été vérifiée dans un arbre
neuf — sans rendu préexistant, sans cache, sans la source interne de français. La
méthode et le résultat sont dans `audit/CLEAN_CLONE_ACCEPTANCE.json`.

---

## Ce qui reste à surveiller

1. **Modalité de l'évaluation ponctuelle d'EMC pour l'année scolaire 2026-2027**, décrite plus haut. À reprendre dès publication.

2. **2 variantes tenues en réserve** — `FR-EAF/ecrit_2028`, `FR-EAF/oral_2028`. Aucun candidat de la campagne en cours ne peut les sélectionner ; le catalogue le déclare et dit pourquoi.

3. **1 compétence n'est évaluée que par un seul item** dans les matrices de couverture. Ce n'est pas un défaut de justesse, mais la triangulation y est moindre : `audit/CONTENT_COVERAGE_MATRIX.json` la nomme.

4. **Aucune donnée de passation réelle n'existe.** Aucune fidélité, aucune corrélation, aucun indice psychométrique n'est avancé : ce qui est établi ici est la validité de contenu — couverture du programme, exactitude, absence d'ambiguïté —, pas une performance mesurée sur une cohorte.

---

## Verdict

Les 12 gates de mise en service sont au vert, les 26 défauts sont corrigés et aucun n'est resté ouvert. Le détail gate par gate, avec ses preuves, est dans `audit/GO_LIVE_GATE.json`.

**GO_LIVE_READY = YES** pour le périmètre soutenu par Nexus, et non pour la couverture réglementaire complète du baccalauréat, qui demeure incomplète par construction — LVA, LVB, EPS restent hors de l'offre.

L'état courant du dépôt, calculé et vérifié par test, est au § 0 de `README_ETAT.md`.
