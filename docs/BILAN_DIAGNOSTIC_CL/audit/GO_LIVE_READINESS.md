# Diagnostics V2 — état de mise en service

*Audit de clôture des 14 et 15 septembre 2026. Branche `feat/diagnostics-v2-audit`.*

Ce document dit ce que la collection couvre, ce qu'elle ne couvre pas, ce qui a été
trouvé et corrigé, et ce qui reste à surveiller. Les chiffres qu'il porte sont dérivés du
dépôt par `scripts/go_live_gate.py` et les pièces de `audit/` ; aucun n'est recopié.

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
| Pages composées | **3 848** |

**Profils servis.** Première partie du baccalauréat (P1), deuxième partie (P2),
baccalauréat complet en une session (P3). **Sessions** 2027 et 2028.

**Situations candidates.** 12 915 états valides énumérés, 5 952 classes de sélection,
11 packs témoins tenus comme référence.

---

## Ce que la release ne couvre pas

Trois enseignements obligatoires du candidat individuel restent hors de l'offre de
diagnostic : **langue vivante A**, **langue vivante B** (6 points de coefficient chacune)
et **éducation physique et sportive** (6 points). Soit **18 des 40 points** du contrôle
continu, contre 22 couverts.

Le dispositif ne doit donc jamais être présenté comme couvrant l'intégralité du
baccalauréat. Le guide de l'opérateur le dit en toutes lettres, et deux verdicts distincts
sont tenus : `READY_FOR_NEXUS_SUPPORTED_SCOPE = YES`,
`READY_FOR_FULL_REGULATORY_BAC_COVERAGE = NO`.

---

## Sources officielles

Quatorze textes ont été relevés sur le Bulletin officiel ou Légifrance, cités mot à mot et
datés du jour de la consultation : mémento DGESCO de septembre 2025, définition consolidée
du Grand oral de juin 2024, note de service de l'épreuve anticipée de mathématiques
(MENE2515469N), les trois arrêtés de programme du 26 février 2026, note d'EMC du
10 décembre 2025, note d'EPS du 20 février 2026, modalités consolidées du contrôle continu,
situations particulières d'inscription (MENE2523745N), œuvres de français des sessions 2027
(MENE2418442N) et 2028 (MENE2518792N). Le registre complet est dans
`audit/REGULATORY_SOURCE_REGISTER.json`.

**Aucune affirmation réglementaire non étayée ne subsiste dans un document remis au
candidat.**

### Une incertitude, déclarée comme telle

**L'évaluation ponctuelle d'enseignement moral et civique n'a aucune modalité publiée pour
l'année scolaire 2026-2027.** La note du 10 décembre 2025 la définit — orale, 30 minutes,
30 minutes de préparation — pour la seule année 2025-2026, au titre des sessions 2026 et
2027, et elle abroge celle de 2021. Les Bulletins officiels de 2026 ont été balayés
jusqu'au n° 34 du 10 septembre, dernier paru. Ce n'est pas une incertitude de
documentation : c'est une absence de texte.

Conséquence tenue : le livret d'EMC est un entretien de diagnostic Nexus et se présente
comme tel. Sa couverture porte « Évaluation ponctuelle » et le coefficient du contrôle
continu — deux faits établis — et **rien de la forme de l'épreuve**. À réévaluer à chaque
Bulletin officiel.

---

## Ce que l'audit a trouvé

**Vingt-six défauts, tous corrigés** : 7 bloquants, 12 majeurs, 7 mineurs. Le registre
complet, avec la preuve de chacun, est dans `audit/FINDINGS.jsonl`.

Les sept bloquants méritent d'être nommés, parce qu'ils disent ce qu'un test vert ne voit
pas.

1. **Trois clés de correction fausses.** Un programme dont la valeur renvoyée est 67 et
   dont la clé annonçait 85. Un écho à 340 m·s⁻¹ dont la clé annonçait 170 m en écrivant
   elle-même « soit 680 m au total » — et qui comptait comme erreur la réponse exacte. Une
   élision impossible devant consonne, donnée pour la bonne réponse.
2. **Dix items demandaient d'analyser un document que le livret n'imprimait pas.** Trois
   ouvraient sur « Voici la réponse d'un autre candidat » sans la joindre. Sept, en
   histoire-géographie, renvoyaient à un discours, une carte ou une affiche absents : la
   correction avait été écrite, puis appliquée à une version sur trois.
3. **Six livrets annonçaient « ÉPREUVE OFFICIELLE : contrôle continu »** pour des
   documents qui ne correspondent à aucune évaluation du baccalauréat — le dossier
   d'entrée Nexus, le positionnement et la maîtrise du français.
4. **Les livrets de spécialité non poursuivie annonçaient l'épreuve terminale**, 3 h 30 et
   coefficient 16, à des candidats qui ne la présenteront jamais : leur spécialité de
   première est évaluée par une évaluation ponctuelle, coefficient 8.

Parmi les majeurs, deux tiennent à la mesure elle-même.

- **La bonne réponse était en position B dans 65,5 % des 267 QCM** — 100 % en
  histoire-géographie, 94 % en enseignement scientifique. Un candidat qui cochait B partout,
  sans lire une question, emportait deux tiers des points. Les positions ont été
  redistribuées de façon exactement équilibrée et reproductible ; chaque libellé de
  mécanisme d'erreur a suivi sa proposition.
- **Onze items cotaient un point une configuration impossible** : « trois étapes sur quatre
  sont à leur place », alors qu'aucune permutation de quatre éléments n'a exactement trois
  points fixes. Le palier n'était jamais attribué.

---

## Ce qui a été vérifié, et comment

| Contrôle | Résultat |
|---|---|
| Suite de tests complète | **0 échec** |
| Clone propre, suite complète | **0 échec** (`audit/CLEAN_CLONE_ACCEPTANCE.json`) |
| Questions relues une par une | **553 / 553**, 0 en échec |
| Assemblages | **31**, 0 erreur, toutes les durées dans leur fenêtre |
| Documents promis par un énoncé | **0 manquant** sur 891 renvois contrôlés |
| Préflight PDF (texte, polices, débordement, format) | **154 PDF, 3 848 pages, 0 défaut** |
| Rendu visuel de chaque page | **3 848 pages rendues**, 0 à reprendre |
| Données personnelles dans le dépôt public | **0** |
| Secrets | **0** (`gitleaks` : aucune fuite) |
| Corrigé visible dans un document candidat | **0** |
| Reproductibilité octet à octet | **173 / 173 fichiers identiques** entre deux constructions |

**Inspection visuelle.** Chaque page de la collection a été rendue en image et mesurée ;
les planches de contact par document ont été relues. Une seule page a été signalée par la
mesure — une ligne orpheline seule sur la page trois du guide de l'opérateur — et la
pagination du générateur a été corrigée.

**Reproductibilité.** Quatre PDF composés par reportlab changeaient d'une construction à
l'autre : la bibliothèque les horodate et leur donne un identifiant tiré au sort. Le
contenu était identique, les octets ne l'étaient pas. Corrigé ; la release est désormais
reproductible octet à octet.

---

## Ce qui reste à surveiller

1. **La modalité d'EMC 2026-2027**, décrite plus haut. À reprendre dès publication.
2. **Deux variantes de français tenues en réserve** — `FR-EAF/ecrit_2028` et
   `FR-EAF/oral_2028`. Aucun candidat de la campagne en cours ne peut les sélectionner :
   elles serviront quand la promotion de première d'aujourd'hui sera en terminale. Le
   catalogue le déclare et dit pourquoi.
3. **Une compétence n'est évaluée que par un seul item** dans l'une des matrices de
   couverture. Ce n'est pas un défaut de justesse, mais la triangulation y est moindre :
   `audit/CONTENT_COVERAGE_MATRIX.json` la nomme.
4. **Aucune donnée de passation réelle n'existe.** Aucune fidélité, aucune corrélation,
   aucun indice psychométrique n'est avancé : ce qui est établi ici est la validité de
   contenu — couverture du programme, exactitude, absence d'ambiguïté —, pas une
   performance mesurée sur une cohorte.

---

## Verdict

Les douze gates de mise en service sont au vert, les vingt-six défauts sont corrigés et
aucun n'est resté ouvert. Le détail gate par gate, avec ses preuves, est dans
`audit/GO_LIVE_GATE.json`.

**GO_LIVE_READY = YES** pour le périmètre soutenu par Nexus, et non pour la couverture
réglementaire complète du baccalauréat, qui demeure incomplète par construction — langues
vivantes et éducation physique restent hors de l'offre.
