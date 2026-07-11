# Décisions métier à valider — Pré-rentrée 2026

## Statut

**Propositions argumentées — aucune décision ci-dessous n'est réputée acceptée.**

Le responsable Nexus doit renseigner `ACCEPTÉE`, `REFUSÉE` ou `À REVOIR`, la date et l'auteur pour chaque décision. L'implémentation reste interdite avant cet arbitrage.

## Tableau de synthèse

| # | Décision | Recommandation | Blocage restant | Statut |
|---:|---|---|---|---|
| 1 | Tarification | 480 / 900 / 1 350 / 1 800 TND, sous réserve de coût direct et politique de remise | Coût enseignant, salle, matériel, cannibalisation | À valider |
| 2 | `intensif-renfort` | Le conserver historique ; créer des produits Pré-rentrée 10 h distincts | Noms/codes produits | À valider |
| 3 | Modalité | Présentiel Mutuelleville uniquement ; online = cohorte distincte | Capacité/équipement réels | À valider |
| 4 | Sous le seuil de 3 | Confirmation au plus tard le 10 août 2026 à 18:00, remboursement/report explicite | Délai de remboursement et moyen de paiement | À valider |
| 5 | Terminale/EDS | Deux spécialités + option Maths séparée ; validation de cohérence | UX et cas particuliers candidats libres | À valider |
| 6 | Compatibilité pédagogique | Incompatible par défaut, règle déclarative et arbitrage historisé | Autorité pédagogique et règles initiales | À valider |
| 7 | Enseignants/salles | Ressources et équipements obligatoires avant confirmation | Identités, coûts, inventaire matériel | À valider |
| 8 | Anciennes dates | Campagne corrective segmentée, choix maintien/modification/remboursement | Liste des familles et paiements déjà reçus | À valider |

## Grille d'impact complète

Cette grille garantit que chaque arbitrage est évalué selon les mêmes dimensions. Les sections suivantes apportent les calculs et règles détaillés.

| # | Contexte et options | Avantages | Inconvénients | Risque principal | Impact technique | Impact commercial | Impact pédagogique | Impact logistique | Recommandation | Décision propriétaire attendue |
|---:|---|---|---|---|---|---|---|---|---|---|
| 1 | Quatre prix proposés ; conserver, ajuster ou refuser | Lisibilité, 45–48 TND/h, packs simples | Packs 2–4 déjà au plancher ; marge inconnue | Vendre à marge insuffisante ou contourner une remise | Nouveaux produits/getters et snapshot de devis | Positionnement saisonnier à protéger des offres annuelles | 10 h financées par matière | Rentabilité variable à 3/4/5 élèves | Valider conditionnellement après coûts et marge cible | Prix, acompte, remises, marge minimale |
| 2 | Réutiliser, surcharger ou remplacer `intensif-renfort` | Nouveau produit : sens exact et historique intact | Codes et tests supplémentaires | Recalcul ou confusion des réservations 15 h | Discriminant/catalogue V2, V1 inchangé | Offre Pré-rentrée plus compréhensible | Alignement cinq séances/10 h | Capacité par cohorte | Créer des produits 10 h séparés | Maintien V1 et codes V2 |
| 3 | Présentiel, hybride ou cohortes séparées | Présentiel : promesse et ressources maîtrisées | Online ultérieur exige une cohorte complète | Promesse de modalité non dotée | Modalité portée par cohorte | Message honnête, conversion éventuellement plus étroite | Pas de classe hybride dégradée | Mutuelleville, salle et équipement certains | Présentiel ; online séparé seulement si doté | Modalité de lancement et conditions online |
| 4 | Encaisser avant/après seuil, rembourser ou reporter | T-7 laisse une semaine de replanification | Remboursements et communication à opérer | Acompte conservé ou conversion individuelle abusive | Machine d'état, paiement/remboursement, audit | Cadre rassurant si CGV explicites | Aucun groupe sous seuil imposé | Ressources libérées ou réaffectées le 11 août | Acompte remboursable, décision le 10 août 18:00 | Délai, canal et CGV remboursement/report |
| 5 | Mélanger EDS/options ou les séparer | Modèle académique fidèle et formulaire explicable | Cas atypiques à arbitrer | Afficher trois EDS ou créer une cohorte incohérente | `specialties` distinct de `mathOption`, validation | Conseil plus crédible | Objectifs adaptés au vrai parcours | Affectation aux variantes correctes | Deux EDS + option Maths séparée | Invariants et exceptions |
| 6 | Fusion implicite, séparation systématique ou règles versionnées | Règles versionnées : sûres, auditables, adaptables | Gouvernance et arbitrage nécessaires | Fusion silencieuse d'objectifs incompatibles | Moteur déclaratif, version/checksum, audit | Capacité non survendue | Différenciation explicitement approuvée | Dédoublement/ressources détectés tôt | Incompatible par défaut | Autorité et matrice initiale |
| 7 | Confirmer avant ou après dotation complète | Confirmation fiable, conflits évités | Ouverture plus tardive de certaines cohortes | Groupe vendu sans enseignant/salle/matériel | Ressources structurées, validateur de planning | Moins de promesses annulées | Enseignant qualifié et matériel adéquat | Inventaire, capacité, sécurité et disponibilités | Gate bloquant avant confirmation | Noms, coûts, salles, équipements, valideur |
| 8 | Informer uniformément ou segmenter par engagement | Traitement proportionné et traçable | Inventaire et coordination multicanal | Contradiction, litige ou famille non recontactée | Journal de communication et statut de réponse | Confiance préservée par correction claire | Matières/parcours reconfirmés | Disponibilités 17–28 août recalculées | Campagne segmentée et coordonnée | Segments, message, canaux, droits, responsable |

## Décision 1 — Tarification

### Hypothèse étudiée

| Pack | Heures | Prix | Prix/heure élève | Acompte canonique arrondi | Solde |
|---|---:|---:|---:|---:|---:|
| 1 matière | 10 h | 480 TND | 48 TND/h | 140 TND | 340 TND |
| 2 matières | 20 h | 900 TND | 45 TND/h | 270 TND | 630 TND |
| 3 matières | 30 h | 1 350 TND | 45 TND/h | 410 TND | 940 TND |
| 4 matières | 40 h | 1 800 TND | 45 TND/h | 540 TND | 1 260 TND |

Les acomptes utilisent la règle existante `round(price × 30 % / 10) × 10`. Ils ne sont donc pas toujours exactement égaux à 30 % après arrondi : 140/480 = 29,17 % et 410/1 350 = 30,37 %.

### Plancher et dégressivité

- 480/10 = 48 TND/h, soit 3 TND/h au-dessus du plancher Stage de 45.
- Les packs 2 à 4 sont exactement au plancher de 45 TND/h.
- La dégressivité réelle est de 6,25 % par heure entre une matière et les packs multi-matières (`48 → 45`).
- Aucun rabais ordinaire supplémentaire ne peut être appliqué aux packs 2 à 4 sans franchir le plancher de 45.
- Sur une matière, la marge de remise avant plancher est au maximum 30 TND, soit 6,25 %.
- La Carte Nexus autorise actuellement 10 % sur les stages unitaires avec un plancher membre de 40 TND/h, mais exclut les packs. Il faut décider si « 2 à 4 matières » est un pack exclu ou un ensemble de modules unitaires ; aucune interprétation implicite n'est acceptable.

### Revenu par cohorte et seuil de rentabilité

Le coût enseignant n'est pas présent dans le dépôt. L'audit ne peut donc pas calculer une marge brute absolue. Les bornes suivantes permettent la décision.

Pour une matière achetée seule, revenu par cohorte de 10 h :

| Élèves | Revenu | Coût direct total maximum avant marge nulle | Équivalent/heure de cours si aucun autre coût |
|---:|---:|---:|---:|
| 3 | 1 440 TND | 1 440 TND | 144 TND/h |
| 4 | 1 920 TND | 1 920 TND | 192 TND/h |
| 5 | 2 400 TND | 2 400 TND | 240 TND/h |

Pour une matière incluse dans un pack multi-matières, allocation économique de 450 TND par matière/élève :

| Élèves | Revenu module | Coût direct total maximum avant marge nulle | Équivalent/heure de cours si aucun autre coût |
|---:|---:|---:|---:|
| 3 | 1 350 TND | 1 350 TND | 135 TND/h |
| 4 | 1 800 TND | 1 800 TND | 180 TND/h |
| 5 | 2 250 TND | 2 250 TND | 225 TND/h |

Formule à valider avec les coûts réels :

`marge brute module = nombre élèves × prix alloué par matière − 10 × coût enseignant horaire − coûts directs salle/matériel/paiement`.

Le seuil de rentabilité en élèves est :

`ceil((10 × coût enseignant horaire + coûts directs fixes) / prix alloué par matière)`.

### Cannibalisation

Le prix horaire est proche des stages historiques (47–48 TND/h) et inférieur/égal aux planchers des formules annuelles. Le risque de cannibalisation est modéré si le produit est présenté comme saisonnier, sans suivi annuel ni substitution à l'accompagnement continu. Il devient élevé si la communication laisse croire que 40 h remplacent l'année ou si des remises additionnelles font passer sous 45 TND/h.

### Recommandation

Adopter l'hypothèse comme **base commerciale conditionnelle**, uniquement après fourniture de :

- coût enseignant chargé par heure et temps de préparation ;
- coût des salles, ordinateurs, consommables Physique-Chimie et frais de paiement ;
- objectif minimal de marge brute à 3, 4 et 5 élèves ;
- règle d'éligibilité aux remises et Carte Nexus ;
- comparaison documentée avec les offres annuelles.

### Décision attendue

Confirmer les quatre prix, la méthode d'acompte, l'absence de remise sous plancher et le seuil de marge cible.

## Décision 2 — Format historique `intensif-renfort`

### Contexte

`intensif-renfort` signifie aujourd'hui 15 h, 720 TND, acompte 220, solde 500. Des éditions et réservations historiques peuvent y faire référence.

### Options

1. Modifier le format existant en 10 h : simple, mais réécrit l'histoire et casse factures/tests.
2. Conserver le format et lui ajouter un mode Pré-rentrée : ambigu, deux significations pour un identifiant.
3. Créer des produits 10 h Pré-rentrée séparés : plus de catalogue, mais contrat explicite et historique préservé.

### Recommandation

Option 3. Conserver `intensif-renfort` inchangé. Créer un code de module 10 h et des produits pack dédiés, après décision tarifaire. Les réservations/factures historiques conservent leur snapshot.

### Impacts

- Technique : nouveaux types/getters/tests, aucune mutation rétroactive.
- Commercial : libellés propres à la Pré-rentrée.
- Pédagogique : le produit correspond réellement à cinq séances de deux heures.
- Logistique : capacité gérée par cohorte, pas par ancien format.

### Décision attendue

Valider le maintien historique et les nouveaux codes produits.

## Décision 3 — Modalité

### Options

1. Présentiel Mutuelleville uniquement.
2. Cohorte hybride présentiel/online.
3. Cohortes présentiel et online distinctes.

### Recommandation

Option 1 au lancement. Si une offre online est réellement dotée, utiliser l'option 3. Interdire l'hybride : expérience inégale, équipement supplémentaire, capacité et présence ambiguës.

Une cohorte online doit avoir son propre enseignant, ses cinq séances, sa capacité, son tarif, sa liste d'attente et son lien sécurisé. Le frontend ne peut afficher « ou en ligne » qu'après ouverture effective.

### Décision attendue

Confirmer « présentiel à Mutuelleville » et retirer toute promesse online non dotée.

## Décision 4 — Groupe sous le seuil de trois

### Workflow proposé

1. `DEMANDE_RECUE` : aucun compte obligatoire, aucun groupe promis.
2. `PREINSCRIPTION_QUALIFIEE` : matières/parcours confirmés.
3. `ACOMPTE_EN_ATTENTE` ou `ACOMPTE_RECU_REMBOURSABLE` : preuve liée à la demande.
4. `GROUPE_EN_CONSTITUTION` tant que l'effectif est inférieur à trois.
5. **Date limite : lundi 10 août 2026 à 18:00 `Africa/Tunis`**.
6. Au seuil et avec ressources : `COHORTE_CONFIRMEE`.
7. Sous seuil ou sans ressources : `COHORTE_NON_OUVERTE`, information le 11 août au plus tard.
8. Choix explicite : remboursement intégral, report vers un produit identifié ou maintien sur liste d'attente. Aucun report par défaut.
9. Remboursement initié dans un délai contractuel à valider, avec preuve et journal.

Les demandes reçues après le 10 août ne peuvent rejoindre que des cohortes déjà confirmées avec place disponible.

### Risques

- Encaisser trop tôt augmente la charge de remboursement.
- Attendre le seuil avant paiement réduit l'engagement famille.
- Une conversion automatique en individuel viole la promesse et le pricing.
- Une conservation indéfinie de l'acompte est interdite.

### Recommandation

Accepter un acompte remboursable après qualification, avec échéance T-7, CGV explicites et report uniquement par consentement traçable.

### Décision attendue

Valider la date, le délai de remboursement, le moyen de remboursement et le texte CGV.

## Décision 5 — Terminale, spécialités et option Maths

### Règle académique proposée

- `specialties` contient normalement exactement deux EDS conservés en Terminale.
- `mathOption` vaut `AUCUNE`, `EXPERTES` ou `COMPLEMENTAIRES`.
- `EXPERTES` exige Mathématiques parmi les deux spécialités.
- `COMPLEMENTAIRES` exige que Mathématiques ne soit pas une spécialité conservée.
- Le parcours EDS Maths est dérivé de la présence de Mathématiques dans `specialties`, pas stocké comme troisième option concurrente.
- Le formulaire ne doit jamais afficher ou produire « trois EDS ».

### Cas du pack quatre matières

Le pack est logistiquement possible, mais Maths + NSI + Physique-Chimie ne doit pas être interprété comme trois EDS. La famille doit préciser le motif du troisième bloc : option Maths, remise à niveau, changement de spécialité, préparation transverse ou erreur à arbitrer.

### Recommandation

Séparer dans le contrat de formulaire :

- deux `specialties` ;
- un `mathOption` ;
- les matières de stage souhaitées ;
- un statut d'arbitrage si le souhait ne correspond pas au parcours académique.

### Décision attendue

Valider ces invariants et les exceptions candidats libres/changement d'EDS.

## Décision 6 — Compatibilité pédagogique

### Options

1. Compatibilité implicite selon le libellé : rapide, non auditée.
2. Incompatibilité systématique : sûre, parfois trop rigide.
3. Incompatibilité par défaut + règles déclaratives versionnées : sûre et adaptable.

### Recommandation

Option 3. Une règle contient : variantes source/cible, objectifs communs, différenciation prévue, version, période, auteur, approbateur pédagogique, date et justification. Toute modification crée une nouvelle version. Une cohorte conserve la version appliquée.

Un tronc commun n'est autorisé que si le responsable pédagogique documente les objectifs, supports et modalités de différenciation. Sinon, groupes distincts.

### Décision attendue

Nommer l'autorité d'approbation et valider la matrice initiale.

## Décision 7 — Enseignants et salles

### Gate obligatoire avant confirmation

- enseignant identifié et affecté à la cohorte ;
- disponibilité enregistrée sur les cinq jours ;
- qualification matière, niveau et parcours ;
- charge et absence de collision validées ;
- salle identifiée, capacité au moins cinq élèves plus enseignant ;
- ordinateurs et réseau pour SNT/NSI ;
- matériel/consommables et protocole de sécurité pour Physique-Chimie ;
- modalité cohérente avec le produit ;
- validation logistique nominative et datée.

### Recommandation

Une cohorte sans l'un de ces éléments reste non confirmée. Une salle texte ou un coach assigné au stage entier ne suffit pas. Aucun second groupe ne doit être créé par duplication d'une cohorte existante.

### Décision attendue

Fournir les enseignants, coûts, salles, capacités et inventaires d'équipement.

## Décision 8 — Familles informées du 24–28 août

### Segmentation

| Segment | Traitement |
|---|---|
| Lead sans engagement | Information corrective + nouvelle proposition complète |
| Préinscription sans paiement | Confirmation matières, parcours et disponibilité 17–28 août |
| Acompte déclaré/en attente | Vérification puis choix maintien/modification/annulation |
| Paiement validé | Contact prioritaire, avenant/confirmation et droit au remboursement selon CGV |
| Réservation liée à un compte | Message cohérent email + dashboard ; WhatsApp seulement si consentement/canal validé |

### Message canonique

Le message doit indiquer clairement : stage du 17 au 28 août, week-end exclu, deux semaines disciplinaires, horaires selon niveau, 10 h par matière et nécessité de reconfirmer les matières/parcours. Aucun canal ne doit continuer à afficher uniquement le 24–28.

### Traçabilité

Journaliser le modèle/version du message, canal, destinataire interne référencé, date, résultat, choix de la famille et opérateur. Ne pas copier la PII dans les logs techniques.

### Recommandation

Générer la liste depuis les données réelles, faire relire le message par le responsable Nexus, envoyer une campagne coordonnée, puis bloquer toute confirmation tant que la famille n'a pas répondu.

### Décision attendue

Valider le message, les droits de remboursement, les canaux et le responsable de campagne.

## Registre de validation

| Décision | Choix du responsable | Auteur | Date | Commentaire/condition |
|---:|---|---|---|---|
| 1 | À renseigner | — | — | — |
| 2 | À renseigner | — | — | — |
| 3 | À renseigner | — | — | — |
| 4 | À renseigner | — | — | — |
| 5 | À renseigner | — | — | — |
| 6 | À renseigner | — | — | — |
| 7 | À renseigner | — | — | — |
| 8 | À renseigner | — | — | — |

## Références

- [Audit d'impact système](../audits/2026-07-pre-rentree-system-impact-audit.md)
- [Contrat de sources de vérité](pre-rentree-2026-source-of-truth-contract.md)
- [Stratégie de migration](pre-rentree-2026-migration-strategy.md)
