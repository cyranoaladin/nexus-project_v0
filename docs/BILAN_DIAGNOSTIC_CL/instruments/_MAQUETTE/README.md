# _MAQUETTE — jeu de données fictif

**Ces données sont fictives.** Elles ne décrivent aucun candidat réel, aucune passation n'a eu
lieu, et aucun élément nominatif n'y figure : le candidat est désigné par le code `CL-2026-0000`,
réservé aux jeux d'essai et jamais attribué à une personne.

Elles servent à trois choses : construire la maquette du bilan par application manuelle des règles
du § 8.2, alimenter le bilan de sortie produit par `scripts/bilan.py`, et servir de fixture aux
tests des deux.

## Contenu

| Fichier | Contenu |
|---|---|
| `qp.json` | Réponses au questionnaire de parcours, au format des variables du référentiel |
| `qp_variante_mineure.json` | Le même candidat, à une date de naissance près, pour éprouver la version parent |
| `met.json` | Réponses au questionnaire de méthodes |
| `saisie.csv` | Scores de tous les items assemblés, au format du § 6.2 |
| `grilles.csv` | Scores par critère des tâches de type C et des grilles coach, même format |
| `maquette_bilan.md` | Maquette destinée à la direction : règle par règle, la donnée, la règle citée, le résultat |
| `bilan_P3_CL-2026-0000.md` | Bilan de sortie remis au candidat, sept sections du § 8.1 |
| `bilan_P3_CL-2026-0001*.md` | Le même candidat mineur : sa version et celle de ses responsables légaux |

## Profil retenu

Ces valeurs sont celles de `qp.json` ; elles sont confrontées au questionnaire et aux
instruments réellement assemblés par `tests/test_maquette.py`. Le tableau qui suit est
lu par ce test : il ne peut pas diverger du jeu sans le faire échouer.

| Élément | Valeur |
|---|---|
| Profil | P3 |
| Session visée | 2027 |
| Spécialités déclarées | MATH, SES, PC |
| Spécialité abandonnée | SES |
| Versions assemblées | EDS-MATH/NT, EDS-PC/NT, EDS-SES/N1 |
| Configuration française | les_deux |
| Mode de rendu | maquette |

C'est le cas le plus contraint : les règles de priorité entre matières, l'alerte de
calibration et l'alerte de charge s'y déclenchent toutes. La spécialité abandonnée est
mesurée en version de Première (N1), ce que la cartographie du bilan dit désormais dans les
intitulés eux-mêmes.

*Correction du 2026-09-10 : ce paragraphe annonçait « poursuivies mathématiques et sciences
économiques et sociales, abandonnée physique-chimie », l'inverse du questionnaire, de la
spécification et du bilan. Le jeu n'a pas été touché ; la description l'a été.*
