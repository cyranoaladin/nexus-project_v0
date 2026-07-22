# Spécification du planning — Pré-rentrée 2026

## Statut

Version 1.0 — prête pour validation métier, pédagogique et logistique — 11 juillet 2026.

**Période :** lundi 17 août au vendredi 28 août 2026, hors samedi 22 et dimanche 23 août.  
**Fuseau :** `Africa/Tunis`.  
**Lieu du présentiel :** centre d'accompagnement pédagogique de Mutuelleville, sur confirmation.  
**Périmètre :** définition documentaire uniquement ; aucun tarif, schéma ou fichier applicatif n'est modifié.

## Objectif produit

Permettre à une famille d'un élève entrant en Seconde, Première ou Terminale de préinscrire son enfant à un pack de une à quatre matières. Chaque matière correspond à un module de dix heures, organisé en cinq séances de deux heures. Le produit doit annoncer honnêtement la capacité, qualifier les parcours avant affectation et ne jamais créer un groupe ou fusionner deux parcours sans ressources et validation explicites.

## Définitions normatives

- **Planning socle :** 12 modules publics, une cohorte logistique initiale par module, 60 séances, 120 heures-cours.
- **Module :** choix public niveau × matière de 10 heures.
- **Variante :** qualification pédagogique interne/publique d'un module ; elle ne réserve aucune ressource.
- **Cohorte :** groupe effectivement planifié de 3 à 5 élèves pédagogiquement compatibles.
- **Séance :** occurrence datée de 120 minutes d'une cohorte.
- **Pack :** ensemble sans doublon de 1 à 4 modules d'un même niveau.
- **Place-matière :** une place dans une cohorte pour un module ; un pack de quatre consomme quatre places-matière.
- **Socle planifié :** réservation logistique initiale, distincte de l'ouverture commerciale confirmée.

## Blocs horaires canoniques

| Bloc | Heure locale `Africa/Tunis` | Durée | Transition suivante |
|---|---:|---:|---|
| A | 08:30–10:30 | 2 h | 15 min avant B |
| B | 10:45–12:45 | 2 h | pause déjeuner de 45 min avant C |
| C | 13:30–15:30 | 2 h | 15 min avant D |
| D | 15:45–17:45 | 2 h | fin de journée |

En août 2026, Tunis est à UTC+01:00. Les instants UTC correspondants sont A 07:30–09:30Z, B 09:45–11:45Z, C 12:30–14:30Z et D 14:45–16:45Z.

## Catalogue des 12 modules publics

| ID | Niveau | Discipline canonique | Libellé public obligatoire | Semaine | Bloc | Salle socle | Enseignant socle |
|---|---|---|---|---:|---|---|---|
| PR26-S2-MATHS | Seconde | Mathématiques | Mathématiques — entrée en Seconde | 1 | A | Salle 1 | ENS_MATHS_NSI |
| PR26-P1-MATHS | Première | Mathématiques | Mathématiques Première — parcours à préciser | 1 | B | Salle 1 | ENS_MATHS_NSI |
| PR26-T-MATHS | Terminale | Mathématiques | Mathématiques Terminale — parcours à préciser | 1 | C | Salle 1 | ENS_MATHS_NSI |
| PR26-S2-FR | Seconde | Français | Français — entrée en Seconde | 1 | B | Salle 2 | ENS_FRANCAIS |
| PR26-P1-FR | Première | Français | Français EAF — voie à préciser | 1 | C | Salle 2 | ENS_FRANCAIS |
| PR26-T-FR | Terminale | Français/Expression | Expression écrite, argumentation et maîtrise de l'oral | 1 | D | Salle 2 | ENS_FRANCAIS |
| PR26-S2-INFO | Seconde | Informatique/SNT | Initiation informatique, algorithmique et SNT | 2 | A | Salle 1 | ENS_MATHS_NSI |
| PR26-P1-NSI | Première | NSI | NSI Première — EDS | 2 | B | Salle 1 | ENS_MATHS_NSI |
| PR26-T-NSI | Terminale | NSI | NSI Terminale — EDS | 2 | C | Salle 1 | ENS_MATHS_NSI |
| PR26-S2-PC | Seconde | Physique-Chimie | Physique-Chimie — entrée en Seconde | 2 | B | Salle 2 | ENS_PHYSIQUE_CHIMIE |
| PR26-P1-PC | Première | Physique-Chimie | Physique-Chimie Première — EDS | 2 | C | Salle 2 | ENS_PHYSIQUE_CHIMIE |
| PR26-T-PC | Terminale | Physique-Chimie | Physique-Chimie Terminale — EDS | 2 | D | Salle 2 | ENS_PHYSIQUE_CHIMIE |

« ENS_MATHS_NSI » désigne une seule et même personne. Aucune simultanéité Mathématiques/NSI/SNT n'existe dans le socle : les Mathématiques occupent la semaine 1 et NSI/SNT la semaine 2.

## Matrice complète des 60 séances socles

Toutes les lignes ont le statut logistique initial `SOCLE_PLANIFIE`. Une ligne ne signifie pas que toutes les variantes du module sont pédagogiquement fusionnables.

### Semaine 1 — Mathématiques et Français

| # | ID séance | Date | Bloc | Horaire | Salle | Module | Cohorte socle | Enseignant |
|---:|---|---|---|---|---|---|---|---|
| 1 | PR26-0817-A-S2-MATHS | lun. 17 août | A | 08:30–10:30 | Salle 1 | PR26-S2-MATHS | SOCLE-S2-MATHS | ENS_MATHS_NSI |
| 2 | PR26-0817-B-P1-MATHS | lun. 17 août | B | 10:45–12:45 | Salle 1 | PR26-P1-MATHS | SOCLE-P1-MATHS | ENS_MATHS_NSI |
| 3 | PR26-0817-B-S2-FR | lun. 17 août | B | 10:45–12:45 | Salle 2 | PR26-S2-FR | SOCLE-S2-FR | ENS_FRANCAIS |
| 4 | PR26-0817-C-T-MATHS | lun. 17 août | C | 13:30–15:30 | Salle 1 | PR26-T-MATHS | SOCLE-T-MATHS | ENS_MATHS_NSI |
| 5 | PR26-0817-C-P1-FR | lun. 17 août | C | 13:30–15:30 | Salle 2 | PR26-P1-FR | SOCLE-P1-FR | ENS_FRANCAIS |
| 6 | PR26-0817-D-T-FR | lun. 17 août | D | 15:45–17:45 | Salle 2 | PR26-T-FR | SOCLE-T-FR | ENS_FRANCAIS |
| 7 | PR26-0818-A-S2-MATHS | mar. 18 août | A | 08:30–10:30 | Salle 1 | PR26-S2-MATHS | SOCLE-S2-MATHS | ENS_MATHS_NSI |
| 8 | PR26-0818-B-P1-MATHS | mar. 18 août | B | 10:45–12:45 | Salle 1 | PR26-P1-MATHS | SOCLE-P1-MATHS | ENS_MATHS_NSI |
| 9 | PR26-0818-B-S2-FR | mar. 18 août | B | 10:45–12:45 | Salle 2 | PR26-S2-FR | SOCLE-S2-FR | ENS_FRANCAIS |
| 10 | PR26-0818-C-T-MATHS | mar. 18 août | C | 13:30–15:30 | Salle 1 | PR26-T-MATHS | SOCLE-T-MATHS | ENS_MATHS_NSI |
| 11 | PR26-0818-C-P1-FR | mar. 18 août | C | 13:30–15:30 | Salle 2 | PR26-P1-FR | SOCLE-P1-FR | ENS_FRANCAIS |
| 12 | PR26-0818-D-T-FR | mar. 18 août | D | 15:45–17:45 | Salle 2 | PR26-T-FR | SOCLE-T-FR | ENS_FRANCAIS |
| 13 | PR26-0819-A-S2-MATHS | mer. 19 août | A | 08:30–10:30 | Salle 1 | PR26-S2-MATHS | SOCLE-S2-MATHS | ENS_MATHS_NSI |
| 14 | PR26-0819-B-P1-MATHS | mer. 19 août | B | 10:45–12:45 | Salle 1 | PR26-P1-MATHS | SOCLE-P1-MATHS | ENS_MATHS_NSI |
| 15 | PR26-0819-B-S2-FR | mer. 19 août | B | 10:45–12:45 | Salle 2 | PR26-S2-FR | SOCLE-S2-FR | ENS_FRANCAIS |
| 16 | PR26-0819-C-T-MATHS | mer. 19 août | C | 13:30–15:30 | Salle 1 | PR26-T-MATHS | SOCLE-T-MATHS | ENS_MATHS_NSI |
| 17 | PR26-0819-C-P1-FR | mer. 19 août | C | 13:30–15:30 | Salle 2 | PR26-P1-FR | SOCLE-P1-FR | ENS_FRANCAIS |
| 18 | PR26-0819-D-T-FR | mer. 19 août | D | 15:45–17:45 | Salle 2 | PR26-T-FR | SOCLE-T-FR | ENS_FRANCAIS |
| 19 | PR26-0820-A-S2-MATHS | jeu. 20 août | A | 08:30–10:30 | Salle 1 | PR26-S2-MATHS | SOCLE-S2-MATHS | ENS_MATHS_NSI |
| 20 | PR26-0820-B-P1-MATHS | jeu. 20 août | B | 10:45–12:45 | Salle 1 | PR26-P1-MATHS | SOCLE-P1-MATHS | ENS_MATHS_NSI |
| 21 | PR26-0820-B-S2-FR | jeu. 20 août | B | 10:45–12:45 | Salle 2 | PR26-S2-FR | SOCLE-S2-FR | ENS_FRANCAIS |
| 22 | PR26-0820-C-T-MATHS | jeu. 20 août | C | 13:30–15:30 | Salle 1 | PR26-T-MATHS | SOCLE-T-MATHS | ENS_MATHS_NSI |
| 23 | PR26-0820-C-P1-FR | jeu. 20 août | C | 13:30–15:30 | Salle 2 | PR26-P1-FR | SOCLE-P1-FR | ENS_FRANCAIS |
| 24 | PR26-0820-D-T-FR | jeu. 20 août | D | 15:45–17:45 | Salle 2 | PR26-T-FR | SOCLE-T-FR | ENS_FRANCAIS |
| 25 | PR26-0821-A-S2-MATHS | ven. 21 août | A | 08:30–10:30 | Salle 1 | PR26-S2-MATHS | SOCLE-S2-MATHS | ENS_MATHS_NSI |
| 26 | PR26-0821-B-P1-MATHS | ven. 21 août | B | 10:45–12:45 | Salle 1 | PR26-P1-MATHS | SOCLE-P1-MATHS | ENS_MATHS_NSI |
| 27 | PR26-0821-B-S2-FR | ven. 21 août | B | 10:45–12:45 | Salle 2 | PR26-S2-FR | SOCLE-S2-FR | ENS_FRANCAIS |
| 28 | PR26-0821-C-T-MATHS | ven. 21 août | C | 13:30–15:30 | Salle 1 | PR26-T-MATHS | SOCLE-T-MATHS | ENS_MATHS_NSI |
| 29 | PR26-0821-C-P1-FR | ven. 21 août | C | 13:30–15:30 | Salle 2 | PR26-P1-FR | SOCLE-P1-FR | ENS_FRANCAIS |
| 30 | PR26-0821-D-T-FR | ven. 21 août | D | 15:45–17:45 | Salle 2 | PR26-T-FR | SOCLE-T-FR | ENS_FRANCAIS |

### Semaine 2 — SNT/NSI et Physique-Chimie

| # | ID séance | Date | Bloc | Horaire | Salle | Module | Cohorte socle | Enseignant |
|---:|---|---|---|---|---|---|---|---|
| 31 | PR26-0824-A-S2-INFO | lun. 24 août | A | 08:30–10:30 | Salle 1 | PR26-S2-INFO | SOCLE-S2-INFO | ENS_MATHS_NSI |
| 32 | PR26-0824-B-P1-NSI | lun. 24 août | B | 10:45–12:45 | Salle 1 | PR26-P1-NSI | SOCLE-P1-NSI | ENS_MATHS_NSI |
| 33 | PR26-0824-B-S2-PC | lun. 24 août | B | 10:45–12:45 | Salle 2 | PR26-S2-PC | SOCLE-S2-PC | ENS_PHYSIQUE_CHIMIE |
| 34 | PR26-0824-C-T-NSI | lun. 24 août | C | 13:30–15:30 | Salle 1 | PR26-T-NSI | SOCLE-T-NSI | ENS_MATHS_NSI |
| 35 | PR26-0824-C-P1-PC | lun. 24 août | C | 13:30–15:30 | Salle 2 | PR26-P1-PC | SOCLE-P1-PC | ENS_PHYSIQUE_CHIMIE |
| 36 | PR26-0824-D-T-PC | lun. 24 août | D | 15:45–17:45 | Salle 2 | PR26-T-PC | SOCLE-T-PC | ENS_PHYSIQUE_CHIMIE |
| 37 | PR26-0825-A-S2-INFO | mar. 25 août | A | 08:30–10:30 | Salle 1 | PR26-S2-INFO | SOCLE-S2-INFO | ENS_MATHS_NSI |
| 38 | PR26-0825-B-P1-NSI | mar. 25 août | B | 10:45–12:45 | Salle 1 | PR26-P1-NSI | SOCLE-P1-NSI | ENS_MATHS_NSI |
| 39 | PR26-0825-B-S2-PC | mar. 25 août | B | 10:45–12:45 | Salle 2 | PR26-S2-PC | SOCLE-S2-PC | ENS_PHYSIQUE_CHIMIE |
| 40 | PR26-0825-C-T-NSI | mar. 25 août | C | 13:30–15:30 | Salle 1 | PR26-T-NSI | SOCLE-T-NSI | ENS_MATHS_NSI |
| 41 | PR26-0825-C-P1-PC | mar. 25 août | C | 13:30–15:30 | Salle 2 | PR26-P1-PC | SOCLE-P1-PC | ENS_PHYSIQUE_CHIMIE |
| 42 | PR26-0825-D-T-PC | mar. 25 août | D | 15:45–17:45 | Salle 2 | PR26-T-PC | SOCLE-T-PC | ENS_PHYSIQUE_CHIMIE |
| 43 | PR26-0826-A-S2-INFO | mer. 26 août | A | 08:30–10:30 | Salle 1 | PR26-S2-INFO | SOCLE-S2-INFO | ENS_MATHS_NSI |
| 44 | PR26-0826-B-P1-NSI | mer. 26 août | B | 10:45–12:45 | Salle 1 | PR26-P1-NSI | SOCLE-P1-NSI | ENS_MATHS_NSI |
| 45 | PR26-0826-B-S2-PC | mer. 26 août | B | 10:45–12:45 | Salle 2 | PR26-S2-PC | SOCLE-S2-PC | ENS_PHYSIQUE_CHIMIE |
| 46 | PR26-0826-C-T-NSI | mer. 26 août | C | 13:30–15:30 | Salle 1 | PR26-T-NSI | SOCLE-T-NSI | ENS_MATHS_NSI |
| 47 | PR26-0826-C-P1-PC | mer. 26 août | C | 13:30–15:30 | Salle 2 | PR26-P1-PC | SOCLE-P1-PC | ENS_PHYSIQUE_CHIMIE |
| 48 | PR26-0826-D-T-PC | mer. 26 août | D | 15:45–17:45 | Salle 2 | PR26-T-PC | SOCLE-T-PC | ENS_PHYSIQUE_CHIMIE |
| 49 | PR26-0827-A-S2-INFO | jeu. 27 août | A | 08:30–10:30 | Salle 1 | PR26-S2-INFO | SOCLE-S2-INFO | ENS_MATHS_NSI |
| 50 | PR26-0827-B-P1-NSI | jeu. 27 août | B | 10:45–12:45 | Salle 1 | PR26-P1-NSI | SOCLE-P1-NSI | ENS_MATHS_NSI |
| 51 | PR26-0827-B-S2-PC | jeu. 27 août | B | 10:45–12:45 | Salle 2 | PR26-S2-PC | SOCLE-S2-PC | ENS_PHYSIQUE_CHIMIE |
| 52 | PR26-0827-C-T-NSI | jeu. 27 août | C | 13:30–15:30 | Salle 1 | PR26-T-NSI | SOCLE-T-NSI | ENS_MATHS_NSI |
| 53 | PR26-0827-C-P1-PC | jeu. 27 août | C | 13:30–15:30 | Salle 2 | PR26-P1-PC | SOCLE-P1-PC | ENS_PHYSIQUE_CHIMIE |
| 54 | PR26-0827-D-T-PC | jeu. 27 août | D | 15:45–17:45 | Salle 2 | PR26-T-PC | SOCLE-T-PC | ENS_PHYSIQUE_CHIMIE |
| 55 | PR26-0828-A-S2-INFO | ven. 28 août | A | 08:30–10:30 | Salle 1 | PR26-S2-INFO | SOCLE-S2-INFO | ENS_MATHS_NSI |
| 56 | PR26-0828-B-P1-NSI | ven. 28 août | B | 10:45–12:45 | Salle 1 | PR26-P1-NSI | SOCLE-P1-NSI | ENS_MATHS_NSI |
| 57 | PR26-0828-B-S2-PC | ven. 28 août | B | 10:45–12:45 | Salle 2 | PR26-S2-PC | SOCLE-S2-PC | ENS_PHYSIQUE_CHIMIE |
| 58 | PR26-0828-C-T-NSI | ven. 28 août | C | 13:30–15:30 | Salle 1 | PR26-T-NSI | SOCLE-T-NSI | ENS_MATHS_NSI |
| 59 | PR26-0828-C-P1-PC | ven. 28 août | C | 13:30–15:30 | Salle 2 | PR26-P1-PC | SOCLE-P1-PC | ENS_PHYSIQUE_CHIMIE |
| 60 | PR26-0828-D-T-PC | ven. 28 août | D | 15:45–17:45 | Salle 2 | PR26-T-PC | SOCLE-T-PC | ENS_PHYSIQUE_CHIMIE |

## Matrice des variantes pédagogiques

| Module | Variantes à présenter/collecter | Compatibilité par défaut | Règle publique |
|---|---|---|---|
| PR26-S2-MATHS | Tronc commun Seconde ; niveau diagnostique à qualifier | Une seule variante publique | Ne pas créer de parcours EDS. |
| PR26-S2-FR | Tronc commun Seconde ; niveau diagnostique à qualifier | Une seule variante publique | Ne pas employer EAF. |
| PR26-S2-INFO | Initiation informatique, algorithmique et SNT | Une seule variante publique | Ne jamais présenter comme EDS NSI. |
| PR26-S2-PC | Tronc commun Seconde | Une seule variante publique | Ne pas présenter comme EDS. |
| PR26-P1-MATHS | EDS Mathématiques ; parcours hors EDS | **Incompatibles sauf arbitrage documenté** | Le formulaire impose le choix du parcours. |
| PR26-P1-FR | EAF voie générale ; EAF voie technologique | **Incompatibles sauf tronc commun validé** | La voie est obligatoire. |
| PR26-P1-NSI | EDS NSI | Compatible seulement au sein du même programme/niveau diagnostique | Afficher EDS. |
| PR26-P1-PC | EDS Physique-Chimie | Compatible seulement au sein du même programme/niveau diagnostique | Afficher EDS. |
| PR26-T-MATHS | EDS Mathématiques ; Mathématiques expertes ; Mathématiques complémentaires | **Trois contenus non fusionnables par défaut** | Le formulaire impose le parcours ; « expertes » peut coexister dans la scolarité avec EDS, mais pas être absorbé silencieusement dans le même module de 10 h. |
| PR26-T-FR | Expression écrite, argumentation et maîtrise de l'oral | Une seule variante publique, objectifs diagnostiques possibles | Ne jamais employer EAF. |
| PR26-T-NSI | EDS NSI | Compatible seulement au sein du même programme/niveau diagnostique | Afficher EDS. |
| PR26-T-PC | EDS Physique-Chimie | Compatible seulement au sein du même programme/niveau diagnostique | Afficher EDS. |

Le statut candidat libre/scolarisé, l'établissement et le besoin remise à niveau/prise d'avance sont des attributs de qualification. Ils ne créent pas automatiquement des variantes ni des groupes distincts.

## Matrice de compatibilité des packs de 1 à 4 matières

Codes : `M` = Mathématiques, `F` = Français, `I` = informatique/SNT en Seconde ou NSI en Première/Terminale, `P` = Physique-Chimie. `OUI-L` signifie compatible logistiquement. Toute variante reste soumise à qualification pédagogique.

| # | Pack | Nb matières | Heures totales | Charge/jour S1 | Charge/jour S2 | Seconde | Première | Terminale | Observation |
|---:|---|---:|---:|---:|---:|---|---|---|---|
| 1 | M | 1 | 10 h | 2 h | 0 h | OUI-L | OUI-L | OUI-L | Parcours Maths à qualifier en P/T. |
| 2 | F | 1 | 10 h | 2 h | 0 h | OUI-L | OUI-L | OUI-L | Voie EAF à qualifier en Première. |
| 3 | I | 1 | 10 h | 0 h | 2 h | OUI-L | OUI-L | OUI-L | SNT non EDS en Seconde. |
| 4 | P | 1 | 10 h | 0 h | 2 h | OUI-L | OUI-L | OUI-L | EDS seulement en P/T. |
| 5 | M + F | 2 | 20 h | 4 h | 0 h | OUI-L | OUI-L | OUI-L | Séances successives, déjeuner autorisé en Première. |
| 6 | M + I | 2 | 20 h | 2 h | 2 h | OUI-L | OUI-L | OUI-L | Semaines distinctes. |
| 7 | M + P | 2 | 20 h | 2 h | 2 h | OUI-L | OUI-L | OUI-L | Semaines distinctes. |
| 8 | F + I | 2 | 20 h | 2 h | 2 h | OUI-L | OUI-L | OUI-L | Semaines distinctes. |
| 9 | F + P | 2 | 20 h | 2 h | 2 h | OUI-L | OUI-L | OUI-L | Semaines distinctes. |
| 10 | I + P | 2 | 20 h | 0 h | 4 h | OUI-L | OUI-L | OUI-L | Séances successives, déjeuner autorisé en Première. |
| 11 | M + F + I | 3 | 30 h | 4 h | 2 h | OUI-L | OUI-L | OUI-L | Variantes qualifiées séparément. |
| 12 | M + F + P | 3 | 30 h | 4 h | 2 h | OUI-L | OUI-L | OUI-L | Variantes qualifiées séparément. |
| 13 | M + I + P | 3 | 30 h | 2 h | 4 h | OUI-L | OUI-L | OUI-L* | *En Terminale, trois EDS apparents exigent un arbitrage de cohérence du parcours. |
| 14 | F + I + P | 3 | 30 h | 2 h | 4 h | OUI-L | OUI-L | OUI-L | Deux EDS possibles en Terminale ; qualification requise. |
| 15 | M + F + I + P | 4 | 40 h | 4 h | 4 h | OUI-L | OUI-L | OUI-L* | *Logistiquement possible ; ne pas inférer trois EDS suivis en Terminale. |

Cette matrice couvre les 15 sous-ensembles non vides pour chacun des trois niveaux, soit 45 configurations niveau × pack. Aucun pack ne dépasse quatre heures par jour. La compatibilité logistique ne garantit ni l'ouverture de toutes les cohortes ni la cohérence du parcours EDS.

## Matrice des conflits pédagogiques et besoins de dédoublement

| Situation | Détection | Réponse interdite | Statut initial | Suite requise |
|---|---|---|---|---|
| Parcours Maths Première non renseigné | Variante absente | Affecter au groupe EDS par défaut | ARBITRAGE_PEDAGOGIQUE_REQUIS | Qualification famille/pédagogie. |
| Maths Première EDS et hors EDS atteignent chacun 3 demandes | Deux ensembles incompatibles au seuil | Fusionner les six ou choisir silencieusement un parcours | SECOND_GROUPE_A_PLANIFIER | Second enseignant puis créneau/salle. |
| EAF générale et technologique atteignent chacun 3 demandes | Deux voies incompatibles au seuil | Tronc commun improvisé | SECOND_GROUPE_A_PLANIFIER | Valider deux cohortes ou un tronc commun explicite. |
| Plusieurs parcours Maths Terminale dans la même demande | EDS/expertes/complémentaires ambigus | Affecter à un libellé générique « Maths Terminale » | ARBITRAGE_PEDAGOGIQUE_REQUIS | Confirmer le ou les objectifs ; un module commercial unique ne vaut pas fusion de contenu. |
| Deux parcours Maths Terminale incompatibles atteignent le seuil | ≥3 demandes par parcours | Mélanger les progressions | SECOND_GROUPE_A_PLANIFIER | Ressource et créneau supplémentaires. |
| Une variante compatible atteint 6 demandes | Capacité socle dépassée | Inscrire un 6e élève | SECOND_GROUPE_A_PLANIFIER | Former 3+3 seulement si toutes les ressources existent. |
| Une variante compte 1 ou 2 demandes | Seuil de 3 non atteint | Ouvrir un groupe déficitaire automatiquement | LISTE_ATTENTE | Attendre le seuil ou proposition humaine compatible. |
| Dédoublement Maths/NSI sans second enseignant | Enseignant socle déjà à 6 h/j | Ajouter le bloc D au même enseignant | ENSEIGNANT_SUPPLEMENTAIRE_REQUIS | Affecter une autre ressource habilitée. |
| Enseignant trouvé, mais blocs B/C saturés en salles | Deux salles déjà occupées | Créer une troisième simultanéité | CRENEAU_SUPPLEMENTAIRE_REQUIS | Utiliser A/D si tous les packs restent valides, sinon nouvelle solution ou attente. |
| Aucun emplacement compatible dans la période | Validateur en échec | Déplacer hors dates ou créer une collision | LISTE_ATTENTE | Nouvelle vague validée dans les mêmes dates si possible, ou refus transparent. |
| Candidat libre et élève scolarisé de même variante | Statuts différents, programme identique | Séparer automatiquement | Aucun conflit automatique | Diagnostic et compatibilité pédagogique suffisent. |

## Capacité résiduelle et faisabilité d'un second groupe

Le socle occupe les deux salles en B et C. Une salle reste libre en A (Salle 2) et en D (Salle 1). L'enseignant socle concerné est toujours à 6 h/jour ; toute cohorte supplémentaire exige donc un enseignant supplémentaire, même lorsqu'une salle est libre.

La colonne « emplacement préservant tous les packs » exige qu'un élève prenant aussi l'autre matière de la semaine n'ait ni collision ni creux interdit.

| Semaine | Module à dédoubler | Bloc socle | Parallèle même bloc | Autre emplacement compatible | Verdict |
|---|---|---|---|---|---|
| 1 | Seconde Maths | A | Salle 2 libre | A parallèle | Possible avec second enseignant ; concurrence l'emplacement A. |
| 1 | Première Maths | B | Aucune salle | D, après Français C | Possible avec second enseignant ; concurrence l'emplacement D. |
| 1 | Terminale Maths | C | Aucune salle | Aucun sans creux pour le pack Maths+Français | Nouveau dispositif requis ou liste d'attente. |
| 1 | Seconde Français | B | Aucune salle | Aucun sans creux pour le pack Maths+Français | Nouveau dispositif requis ou liste d'attente. |
| 1 | Première Français | C | Aucune salle | A, avant Maths B | Possible avec second enseignant ; concurrence l'emplacement A. |
| 1 | Terminale Français | D | Salle 1 libre | D parallèle | Possible avec second enseignant ; concurrence l'emplacement D. |
| 2 | Seconde SNT | A | Salle 2 libre | A parallèle | Possible avec second enseignant ; concurrence l'emplacement A. |
| 2 | Première NSI | B | Aucune salle | D, après Physique-Chimie C | Possible avec second enseignant ; concurrence l'emplacement D. |
| 2 | Terminale NSI | C | Aucune salle | Aucun sans creux pour le pack NSI+PC | Nouveau dispositif requis ou liste d'attente. |
| 2 | Seconde Physique-Chimie | B | Aucune salle | Aucun sans creux pour le pack SNT+PC | Nouveau dispositif requis ou liste d'attente. |
| 2 | Première Physique-Chimie | C | Aucune salle | A, avant NSI B | Possible avec second enseignant ; concurrence l'emplacement A. |
| 2 | Terminale Physique-Chimie | D | Salle 1 libre | D parallèle | Possible avec second enseignant ; concurrence l'emplacement D. |

Conséquences :

- au maximum deux cohortes additionnelles peuvent être placées par semaine dans les salles existantes, une en A et une en D ;
- ce maximum théorique est de quatre cohortes additionnelles sur les deux semaines, soit 20 séances et 40 heures-cours hors socle ;
- deux besoins revendiquant A, ou deux besoins revendiquant D, sont en conflit ;
- un seul enseignant supplémentaire ne peut pas assurer A puis D le même jour, car cela créerait un retour et un long creux ;
- les modules Terminale Maths/NSI et Seconde Français/Physique-Chimie n'ont pas de solution résiduelle garantissant tous les packs ;
- toute solution par « nouvelle vague » doit rester entre le 17 et le 28 août, exclure le week-end, respecter les quatre blocs et repasser le validateur complet.

## Calcul de charge des enseignants

### Charge quotidienne

| Semaine | Enseignant | Blocs/jour | Heures/jour | Jours | Heures semaine |
|---|---|---|---:|---:|---:|
| 1 | ENS_MATHS_NSI | A + B + C | 6 h | 5 | 30 h |
| 1 | ENS_FRANCAIS | B + C + D | 6 h | 5 | 30 h |
| 1 | ENS_PHYSIQUE_CHIMIE | — | 0 h | 5 | 0 h |
| 2 | ENS_MATHS_NSI | A + B + C | 6 h | 5 | 30 h |
| 2 | ENS_FRANCAIS | — | 0 h | 5 | 0 h |
| 2 | ENS_PHYSIQUE_CHIMIE | B + C + D | 6 h | 5 | 30 h |

### Charge totale

| Enseignant | Séances | Heures totales | Maximum quotidien | Creux hors déjeuner | Retour dans la journée |
|---|---:|---:|---:|---|---|
| ENS_MATHS_NSI | 30 | 60 h | 6 h | Aucun | Aucun |
| ENS_FRANCAIS | 15 | 30 h | 6 h | Aucun | Aucun |
| ENS_PHYSIQUE_CHIMIE | 15 | 30 h | 6 h | Aucun | Aucun |
| **Total** | **60** | **120 h** | — | — | — |

La charge de 60 heures sur deux semaines pour ENS_MATHS_NSI respecte le plafond quotidien demandé, mais la disponibilité contractuelle réelle doit être validée. Aucun groupe supplémentaire ne peut lui être ajouté.

## Calcul de charge des salles

| Ressource | Blocs occupés/jour | Heures/jour | Jours | Heures totales |
|---|---|---:|---:|---:|
| Salle 1 | A + B + C | 6 h | 10 | 60 h |
| Salle 2 | B + C + D | 6 h | 10 | 60 h |
| **Total utilisé** | 6 occupations/jour | **12 h-salle/jour** | **10** | **120 h-salle** |

La capacité théorique est 2 salles × 4 blocs × 2 h × 10 jours = 160 heures-salle. Le socle en utilise 120, soit 75 %. Les 40 heures-salle résiduelles correspondent exactement à Salle 2 en A et Salle 1 en D sur les dix jours. Elles ne constituent pas une capacité commerciale automatique.

## Calcul de capacité élèves

- capacité maximale : 12 modules × 5 = **60 places-matière** ;
- seuil d'ouverture simultané de tous les modules : 12 × 3 = **36 places-matière** ;
- un élève à une matière consomme 1 place-matière et suit 10 h ;
- un élève à quatre matières consomme 4 places-matière et suit 40 h ;
- capacité maximale d'un pack quatre matières pour un niveau : **5 élèves**, limitée par la plus petite disponibilité de ses quatre cohortes ;
- minimum d'élèves distincts pour atteindre le seuil de tous les modules : 9, si trois élèves par niveau prennent chacun les quatre matières ;
- maximum théorique d'élèves distincts utilisant les 60 places-matière : 60, si chaque élève prend une seule matière ; cette valeur ne vaut pas prévision commerciale.

## Preuve formelle de faisabilité du socle

| Contrainte | Preuve | Résultat |
|---|---|---|
| 4 matières pour chaque niveau | 12 modules = 3 × 4 | Conforme |
| Packs 1 à 4 | 15 sous-ensembles non vides par niveau, tous sans chevauchement | Conforme logistiquement |
| 40 h maximum par élève | 4 × 5 × 2 h = 40 h | Conforme |
| 60 séances | 12 modules × 5 séances | Conforme |
| 120 heures-cours | 60 × 2 h | Conforme |
| 2 salles maximum | Pic de 2 en B/C ; 1 en A/D | Conforme |
| 6 h/jour/enseignant | 3 blocs × 2 h pour chaque enseignant actif | Conforme, plafond atteint |
| Maths/NSI même enseignant | Maths S1, SNT/NSI S2 ; aucune simultanéité | Conforme |
| Aucun retour enseignant | A-B-C ou B-C-D en continu avec déjeuner | Conforme |
| Aucun creux hors déjeuner | A→B et C→D : 15 min ; B→C : déjeuner 45 min | Conforme |
| 4 h/jour/élève | Au plus 2 modules/jour × 2 h | Conforme, plafond atteint pour deux matières d'une semaine |
| Aucun chevauchement au même niveau | M/F puis I/P occupent des blocs successifs | Conforme |
| 15 min minimum | Transitions 15 ou 45 min | Conforme |
| Groupes 3 à 5 | Invariant de cohorte ; ouverture conditionnelle | Faisable, à faire respecter par le modèle |
| Aucun mélange automatique | Variantes séparées et statut d'arbitrage | Faisable, à faire respecter par le workflow |
| Aucun second groupe sans ressource | Statuts et validateur bloquants | Faisable, à faire respecter transactionnellement |
| Collision salle | Une seule ligne par salle/bloc/date | Aucune |
| Collision enseignant | Une seule ligne par enseignant/bloc/date | Aucune |
| Collision cohorte | Une seule séance par cohorte/date | Aucune |
| Collision élève/groupe | Modules d'un même niveau non superposés | Aucune dans le socle |

## Parcours de préinscription attendu

1. Choisir le niveau d'entrée.
2. Choisir de une à quatre matières parmi les quatre modules du niveau.
3. Pour chaque module concerné, demander uniquement la variante nécessaire : parcours Maths, voie EAF ou EDS applicable.
4. Afficher le volume : 10, 20, 30 ou 40 heures et les semaines concernées.
5. Contrôler la compatibilité logistique du pack.
6. Contrôler la qualification pédagogique sans prétendre qu'une cohorte est ouverte.
7. Collecter les coordonnées minimales du parent et de l'élève nécessaires au premier contact, avec consentement.
8. Créer une demande, pas un compte ni un groupe.
9. Retourner l'un des états : demande reçue, qualification requise, seuil en attente, place sous réserve ou liste d'attente.
10. Confirmer l'inscription uniquement après affectation aux cohortes et contrôle de capacité des quatre choix.

## Algorithme d'ouverture et de dédoublement

Pour chaque module et variante :

1. ignorer les demandes annulées/non qualifiées dans le calcul de capacité ;
2. si variante absente ou ambiguë : `ARBITRAGE_PEDAGOGIQUE_REQUIS` ;
3. si 1–2 demandes compatibles : `LISTE_ATTENTE` ou préinscription en attente selon décision commerciale ;
4. si 3–5 demandes compatibles : proposer l'ouverture de la cohorte socle ;
5. si une sixième demande arrive : `SECOND_GROUPE_A_PLANIFIER`, sans surbooking ;
6. si deux variantes incompatibles atteignent chacune trois demandes : `SECOND_GROUPE_A_PLANIFIER` ;
7. sans enseignant distinct : `ENSEIGNANT_SUPPLEMENTAIRE_REQUIS` ;
8. avec enseignant mais sans cinq couples salle/créneau : `CRENEAU_SUPPLEMENTAIRE_REQUIS` ;
9. si le validateur complet échoue encore : `LISTE_ATTENTE` ;
10. créer atomiquement la cohorte et ses cinq séances uniquement après validation pédagogique et logistique.

## Critères de recette documentaire puis applicative

### Dates et contenu

- dates exactes 17–28 août 2026, week-end exclu ;
- quatre modules par niveau et libellés conformes ;
- aucune occurrence de Philosophie pour cette édition ;
- aucune occurrence « NSI EDS » pour la Seconde ;
- aucune occurrence « EAF » pour la Terminale.

### Planning

- 12 modules et 60 séances socles exactement ;
- cinq séances de 120 minutes par module ;
- mêmes blocs répétés sur les cinq jours de chaque semaine ;
- deux salles simultanées au maximum ;
- toutes les contraintes du tableau de preuve sont testées.

### Packs et capacité

- les 15 packs sont sélectionnables pour chacun des trois niveaux ;
- le total d'heures est exact pour chaque pack ;
- un pack quatre matières n'excède jamais 4 h/jour ;
- capacité affichée/calculée par cohorte et choix, jamais depuis la seule capacité globale du stage ;
- sixième élève bloqué sans second groupe confirmé.

### Variantes

- choix de parcours obligatoire aux endroits définis par la matrice ;
- aucune fusion par défaut ;
- chaque statut obligatoire est testable ;
- l'ouverture de groupe est atomique et auditée sans PII dans les logs.

### Fuseau

- formatage explicite `Africa/Tunis` ;
- tests aux bornes de minuit et sur les dix dates ;
- édition considérée en cours jusqu'au 28 août inclus.

## Décisions métier encore requises

1. Prix d'un module de 10 heures et remises/conditions des packs 2, 3 et 4 matières.
2. Acompte, échéancier, remboursement si seuil de trois non atteint.
3. Maintien de `pre-rentree-2026` et sort du format historique 15 h.
4. Présentiel, distanciel ou éditions séparées ; aucune disponibilité en ligne n'est présumée.
5. Libellé public du statut avant seuil de trois.
6. Règle de qualification d'un pack Terminale comprenant Maths + NSI + Physique-Chimie.
7. Compatibilités pédagogiques explicitement autorisées, si certaines variantes peuvent partager un tronc commun.
8. Identité et habilitation des enseignants ; disponibilité d'enseignants de secours.
9. Capacité et équipement des salles, notamment pour SNT/NSI.
10. Traitement des familles déjà informées du 24–28 août.

## Rollback fonctionnel attendu

Si la refonte ne peut pas être mise en service correctement, fermer temporairement les préinscriptions tout en conservant publiquement les dates correctes. Ne jamais revenir à un début au 24 août ni à une promesse de 15 heures qui ne correspond pas au produit. Les données migrées doivent rester réconciliables grâce à des identifiants stables et une table de correspondance.

## Références

- `docs/audits/2026-07-pre-rentree-date-planning-audit.md`
- `docs/adr/004-pre-rentree-modules-cohortes-seances-ressources.md`
- `AGENTS.md`
