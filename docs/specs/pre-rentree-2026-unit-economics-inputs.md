# Pré-rentrée 2026 — données de unit economics

## Statut

- Date : 11 juillet 2026
- Tarifs : approuvés par [OWNER-003](../decisions/pre-rentree-2026-owner-approval.md#owner-003--tarifs-publics)
- Coûts et marges : **OWNER_INPUT_REQUIRED**
- Publication commerciale : **BLOCKED** par `GATE-FIN-001` et `GATE-FIN-002`
- Objet : préparer les calculs sans inventer de coût, de marge cible ou de volume commercial

Ce document n'est ni un catalogue, ni une facture, ni une autorisation de publier les tarifs. Les montants approuvés devront être ajoutés ultérieurement à `data/pricing.canonical.json` et lus via `lib/pricing.ts`.

## 1. Données commerciales approuvées

| Code approuvé | Matières | Heures élève | Prix/élève | Prix/heure élève | Acompte dérivé à 30 % avec arrondi canonique | Solde dérivé |
|---|---:|---:|---:|---:|---:|---:|
| `PRE2026_PACK_1` | 1 | 10 h | 480 TND | 48 TND/h | 140 TND | 340 TND |
| `PRE2026_PACK_2` | 2 | 20 h | 900 TND | 45 TND/h | 270 TND | 630 TND |
| `PRE2026_PACK_3` | 3 | 30 h | 1 350 TND | 45 TND/h | 410 TND | 940 TND |
| `PRE2026_PACK_4` | 4 | 40 h | 1 800 TND | 45 TND/h | 540 TND | 1 260 TND |

Les montants d'acompte sont des résultats de la règle canonique actuelle `round(total × 30 % / 10) × 10`, pas des constantes à recopier dans un template ou un composant.

## 2. Chiffre d'affaires brut observable

Hypothèse de lecture de ce tableau : tous les élèves de la ligne achètent le même pack. Dans l'exploitation réelle, la capacité est portée par chaque cohorte-module ; les effectifs peuvent donc différer entre matières.

| Pack | Heures enseignant cumulées correspondant au pack | CA à 3 élèves | CA à 4 élèves | CA à 5 élèves | CA/heure enseignant à 3 | à 4 | à 5 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `PRE2026_PACK_1` | 10 h | 1 440 TND | 1 920 TND | 2 400 TND | 144 TND/h | 192 TND/h | 240 TND/h |
| `PRE2026_PACK_2` | 20 h | 2 700 TND | 3 600 TND | 4 500 TND | 135 TND/h | 180 TND/h | 225 TND/h |
| `PRE2026_PACK_3` | 30 h | 4 050 TND | 5 400 TND | 6 750 TND | 135 TND/h | 180 TND/h | 225 TND/h |
| `PRE2026_PACK_4` | 40 h | 5 400 TND | 7 200 TND | 9 000 TND | 135 TND/h | 180 TND/h | 225 TND/h |

Le CA par heure enseignant n'est **pas une marge**. Il précède salaire/charges, préparation, salle, matériel, administration, paiement, remboursement et acquisition.

## 3. Unité économique opérationnelle recommandée

L'unité première est la **cohorte-module de 10 heures**, car :

- la capacité 3–5 s'applique par cohorte ;
- l'enseignant, la salle et le matériel sont affectés par cohorte ;
- un pack relie plusieurs cohortes qui peuvent avoir des effectifs différents ;
- un groupe supplémentaire crée 10 heures et ses propres coûts.

Allocation commerciale pour analyser un module :

| Origine du revenu | Revenu alloué/module/élève | CA module à 3 | à 4 | à 5 |
|---|---:|---:|---:|---:|
| Matière achetée seule | 480 TND | 1 440 TND | 1 920 TND | 2 400 TND |
| Matière dans pack 2/3/4 | 450 TND | 1 350 TND | 1 800 TND | 2 250 TND |

Cette allocation conserve exactement les prix des packs : `2 × 450 = 900`, `3 × 450 = 1 350`, `4 × 450 = 1 800`. Elle sert à l'analyse interne ; elle ne crée pas un prix public de module dans les packs.

## 4. Registre des données manquantes

| Identifiant | Donnée à fournir | Unité | Granularité | Statut | Propriétaire attendu | Preuve attendue |
|---|---|---|---|---|---|---|
| `UE-TEACH-001` | coût enseignant chargé | TND/heure enseignée ou TND/module | enseignant/matière/niveau | `OWNER_INPUT_REQUIRED` | responsable Nexus | grille ou accord validé |
| `UE-TEACH-002` | temps de préparation/réunion/bilan rémunéré | heures/module | matière/variante | `OWNER_INPUT_REQUIRED` | responsable Nexus | règle de rémunération |
| `UE-TEACH-003` | coût horaire des temps hors séance | TND/heure | enseignant | `OWNER_INPUT_REQUIRED` | responsable Nexus | grille validée |
| `UE-ROOM-001` | coût réel ou imputé de salle | TND/heure ou TND/jour | salle Mutuelleville | `OWNER_INPUT_REQUIRED` | responsable Nexus | bail/méthode d'imputation |
| `UE-ROOM-002` | coûts additionnels d'ouverture | TND/jour | centre | `OWNER_INPUT_REQUIRED` | responsable Nexus | énergie, entretien, accueil |
| `UE-MAT-NSI-001` | coût postes/réseau/licences/secours | TND fixe + TND/élève | cohorte NSI/SNT | `OWNER_INPUT_REQUIRED` | responsable Nexus | inventaire et amortissement retenu |
| `UE-MAT-PC-001` | coût matériel/consommables/sécurité | TND fixe + TND/élève | cohorte Physique-Chimie | `OWNER_INPUT_REQUIRED` | responsable Nexus | modalité expérimentale ou théorique |
| `UE-SUPPORT-001` | coût supports imprimés/numériques | TND/élève/module | matière | `OWNER_INPUT_REQUIRED` | responsable Nexus | nomenclature supports |
| `UE-ADMIN-001` | temps administratif de qualification | minutes/demande | canal | `OWNER_INPUT_REQUIRED` | responsable Nexus | mesure ou forfait approuvé |
| `UE-ADMIN-002` | coût administratif chargé | TND/heure | opération | `OWNER_INPUT_REQUIRED` | responsable Nexus | grille validée |
| `UE-ADMIN-003` | temps de planification/communication/bilan | heures/cohorte | cohorte | `OWNER_INPUT_REQUIRED` | responsable Nexus | estimation validée |
| `UE-PAY-001` | commission paiement | pourcentage + TND/transaction | moyen de paiement | `OWNER_INPUT_REQUIRED` | responsable Nexus | contrat prestataire |
| `UE-PAY-002` | coût facture/PDF/rapprochement | TND/transaction | paiement | `OWNER_INPUT_REQUIRED` | responsable Nexus | méthode d'imputation |
| `UE-REFUND-001` | frais prestataire de remboursement | TND + pourcentage | remboursement | `OWNER_INPUT_REQUIRED` | responsable Nexus | contrat prestataire |
| `UE-REFUND-002` | temps administratif d'un remboursement | minutes/remboursement | remboursement | `OWNER_INPUT_REQUIRED` | responsable Nexus | processus validé |
| `UE-REFUND-003` | taux prudent de cohortes non ouvertes/remboursées | pourcentage | campagne | `OWNER_INPUT_REQUIRED` | responsable Nexus | historique ou hypothèse signée |
| `UE-CAC-001` | budget de campagne attribuable | TND | campagne/canal | `OWNER_INPUT_REQUIRED` | responsable Nexus | budget validé |
| `UE-CAC-002` | nombre de nouveaux clients attribuables | clients | campagne/canal | `OWNER_INPUT_REQUIRED` | responsable Nexus | règle d'attribution analytics |
| `UE-MARGIN-001` | marge brute cible | pourcentage ou TND | module et campagne | `OWNER_INPUT_REQUIRED` | responsable Nexus | décision signée |
| `UE-MARGIN-002` | marge contributive cible après admin/CAC | pourcentage ou TND | module et campagne | `OWNER_INPUT_REQUIRED` | responsable Nexus | décision signée |

Une valeur n'est considérée fournie que si son unité, sa période, son périmètre et sa source sont explicités. « Inclus dans les charges » sans méthode d'allocation n'est pas une donnée calculable.

## 5. Définitions et formules

### Variables par cohorte-module

```text
n                  = élèves confirmés compatibles, 3 ≤ n ≤ 5
pricePerStudent    = 480 si matière seule, 450 si matière issue d'un pack 2–4
teachingHours      = 10
teacherHourlyCost  = UE-TEACH-001
prepHours          = UE-TEACH-002
prepHourlyCost     = UE-TEACH-003
roomHourlyCost     = UE-ROOM-001
roomOpeningShare   = part de UE-ROOM-002 affectée à la cohorte
materialFixed      = part fixe UE-MAT-NSI-001 ou UE-MAT-PC-001
materialPerStudent = part variable matériel + UE-SUPPORT-001
adminFixed         = qualification/planification/communication affectées
paymentRate        = UE-PAY-001 en pourcentage
paymentFixed       = UE-PAY-001/002 en montant
refundProvision    = probabilité × coût moyen UE-REFUND-001/002
cacAllocated       = UE-CAC-001 attribué à la cohorte
```

### Chiffre d'affaires

`CA_module(n) = n × pricePerStudent`

`CA_par_heure_enseignant = CA_module(n) / 10`

### Coûts directs

`coût_enseignant = 10 × teacherHourlyCost + prepHours × prepHourlyCost`

`coût_salle = 10 × roomHourlyCost + roomOpeningShare`

`coût_matériel_supports = materialFixed + n × materialPerStudent`

`coût_paiement = CA_module(n) × paymentRate + n × paymentFixed`

### Marges

`marge_brute = CA_module − coût_enseignant − coût_salle − coût_matériel_supports − coût_paiement`

`marge_contributive = marge_brute − coût_administratif − provision_remboursement − CAC_affecté`

`taux_marge_brute = marge_brute / CA_module`

`taux_marge_contributive = marge_contributive / CA_module`

Les taxes ou coûts supplémentaires éventuellement applicables doivent être ajoutés comme entrées owner documentées ; ils ne sont pas supposés ici.

## 6. Seuil de rentabilité

Si `contribution_unitaire = pricePerStudent − coûts_variables_par_élève` est strictement positive :

`seuil_élèves = ceil(coûts_fixes_cohorte / contribution_unitaire)`

Règles de décision :

- résultat inférieur à 3 : ouverture commerciale toujours soumise au minimum pédagogique de 3 ;
- résultat entre 3 et 5 : comparer à la marge cible, pas seulement à la marge nulle ;
- résultat supérieur à 5 : modèle non rentable dans la capacité approuvée ; prix/coûts/format à réarbitrer avant publication ;
- contribution unitaire nulle ou négative : aucun seuil fini, publication bloquée.

## 7. Marge par pack

La marge pack ne peut pas être obtenue en multipliant une marge moyenne si les cohortes ont des effectifs différents.

`marge_pack = somme des marges des cohortes-modules réellement consommées − coûts administratifs/paiement propres au pack`

La future requête de pilotage doit donc rapprocher :

- le devis pack accepté ;
- l'allocation de revenu par module ;
- chaque enrollment/cohorte ;
- les ressources réellement consommées ;
- remises, paiement et remboursement du dossier.

Les snapshots financiers expliquent le contrat accepté ; le catalogue courant ne recalcule pas l'histoire.

## 8. Coût d'acquisition maximal acceptable

Le CAC maximum dépend de la marge contributive cible choisie par le responsable Nexus :

`CAC_max_total = marge_avant_CAC − marge_contributive_cible_en_TND`

`CAC_max_par_nouveau_client = CAC_max_total / nouveaux_clients_attribuables`

Tant que `UE-MARGIN-002` et la règle d'attribution `UE-CAC-002` sont inconnues, afficher un CAC maximal chiffré serait inventer une décision. Statut : **OWNER_INPUT_REQUIRED**.

## 9. Tableau de saisie owner

| Scénario | 3 élèves | 4 élèves | 5 élèves |
|---|---:|---:|---:|
| CA module matière seule | 1 440 | 1 920 | 2 400 |
| CA module issu d'un pack | 1 350 | 1 800 | 2 250 |
| Coût enseignant | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` |
| Coût salle | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` |
| Coût matériel/supports | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` |
| Coût paiement | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` |
| Coût administratif | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` |
| Provision remboursement | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` |
| CAC affecté | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` | `OWNER_INPUT_REQUIRED` |
| Marge brute | non calculable | non calculable | non calculable |
| Marge contributive | non calculable | non calculable | non calculable |
| Seuil/marge cible atteints | non déterminable | non déterminable | non déterminable |

Tous les montants du tableau sont en TND. Les cellules de coût ne doivent pas être préremplies par une valeur fictive, zéro compris.

## 10. Critère de levée du blocage commercial

`GATE-FIN-001` et `GATE-FIN-002` deviennent `APPROVED` seulement lorsque :

1. toutes les entrées obligatoires ont une source et une unité ;
2. les scénarios 3/4/5 élèves sont calculés par module et pack ;
3. le seuil de rentabilité reste compatible avec la capacité maximale de 5 ;
4. la marge cible est explicitement signée ;
5. la règle de remises ne franchit pas le plancher ;
6. le responsable Nexus approuve la publication, distinctement de l'approbation des prix.
