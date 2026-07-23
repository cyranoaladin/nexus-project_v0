# Intégration SVT — rapport de release candidate

## Périmètre

- PR : #74.
- Branche : `feat/svt-integration-clean`.
- SHA source de l'inventaire : `0264261bbf1a8d6de01eeae01691479a50f4fbf8`.
- Campagne : 15 modules, 75 séances, exactement 5 séances par module.
- SVT : Première et Terminale uniquement, documents DRAFT jusqu'à validation humaine.
- Seconde : aucune SNT ni initiation informatique.

## Grille finale complète

Blocs : A 08:30–10:30 · B 10:45–12:45 · C 13:30–15:30 · D 15:45–17:45.

### Semaine 1 — 17 au 21 août

| Bloc | Salle 1 | Salle 2 |
|---|---|---|
| A | 3e — Mathématiques | Seconde — Français |
| B | Seconde — Mathématiques | 3e — Français |
| C | Première — Mathématiques | Terminale — Philosophie |
| D | Terminale — Mathématiques | Première — Français |

### Semaine 2 — 24 au 28 août

| Bloc | Salle 1 | Salle 2 |
|---|---|---|
| A | — | Première — Physique-Chimie |
| B | Terminale — SVT | Seconde — Physique-Chimie |
| C | Terminale — NSI | Première — SVT |
| D | Première — NSI | Terminale — Physique-Chimie |

Cas explicite Terminale : un élève choisissant SVT, NSI et Physique-Chimie en semaine 2 suit B + C + D, soit **6 heures consécutives**. La grille respecte le plafond technique de 6 h, mais l'acceptation pédagogique de cette charge reste une décision humaine.

## Quatre gates de cohérence de grille

| Gate | Résultat calculé | Limite |
|---|---:|---|
| Aucun conflit de salle | ✅ | Les salles ne sont pas encore validées opérationnellement |
| Aucun conflit de rôle enseignant | ✅ | Les rôles ne sont pas encore affectés à des personnes |
| Aucun conflit de niveau | ✅ | Un niveau n'a pas deux matières sur le même bloc |
| Charge quotidienne ≤ 6 h | ✅ | Le cas Terminale est exactement au plafond |

Les gates opérationnels `teacherAssignmentsValidated` et `roomAssignmentsValidated` restent à `false`. Aucun nom réel n'est présent dans les données publiques ; les codes de rôles sont internes.

## Conformité pédagogique

- Les deux modules SVT sont mappés aux trois thèmes du BO du 25 juillet 2019.
- Horaires annuels de référence : 4 h en Première et 6 h en Terminale.
- « Corps humain et santé » est désormais explicite dans le mapping, sans prétendre couvrir l'année en dix heures.
- Formulation matériel : « Calculatrice scientifique simple recommandée, non obligatoire sauf consigne de l'enseignant. »
- Les PDF SVT portent un filigrane de travail et sont exclus des six téléchargements publics candidats.

## Documents et kit

- Documents finaux : 9 PDF, 28 pages, tous rasterisés.
- Téléchargements publics candidats : Flyer, Planning, Programmes Seconde/Première/Terminale et Tarifs, avec poids et SHA-256 issus du manifeste.
- Semaine 1 : 91 assets, calendrier relatif, date de lancement non autorisée.
- Campagne complète : 347 assets, J1…J29 relatifs, trois MP4 avec SRT/storyboards.
- Inventaire de release : 317 fichiers publics candidats ; les sources, rendus QA, ressources enseignants et éléments internes restent classés hors kit public.
- Tous ces éléments restent inaccessibles publiquement tant que le gate serveur n'est pas `PUBLIC_READY`.

## Sécurité de publication

Le gate unique couvre le site, les API, les téléchargements, le SEO, les métadonnées et la préinscription. `enablePreRegistration=false`. Les anciens helpers d'exploitation du dépôt public sont neutralisés ; aucune commande de production n'a été lancée.

## Statut

`BLOCKED` : validations pédagogiques Maths/SVT, enseignants, qualifications, salles, juridique, confidentialité, paiement, lancement et autorisation propriétaire restent ouvertes.
