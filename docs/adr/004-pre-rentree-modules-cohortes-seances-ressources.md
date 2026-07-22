# ADR 004 — Modèle des modules, cohortes, séances et ressources de pré-rentrée

## Statut

**Proposé — prêt pour validation métier et technique — 11 juillet 2026.**

Aucune migration ni modification de schéma n'est autorisée tant que cet ADR n'est pas accepté.

## Contexte

La pré-rentrée 2026 couvre deux semaines, quatre matières/blocs disciplinaires par niveau, cinq séances de deux heures par matière et des groupes de trois à cinq élèves. Une famille sélectionne une à quatre matières. Certaines matières portent des variantes pédagogiques incompatibles qui doivent être visibles au formulaire sans être assimilées à des groupes déjà ouverts.

Le modèle actuel est centré sur :

- un `Stage` ayant une capacité globale, des listes de matières/niveaux et deux dates ;
- des `StageSession` directement rattachées au stage ;
- des réservations au niveau du stage ;
- un lieu textuel sur le stage ou la séance ;
- un enseignant optionnel sur chaque séance.

Il ne sait pas exprimer un module de 10 heures, une cohorte de 3 à 5, un parcours, un choix multi-matières, une salle réservable ni un workflow de dédoublement.

## Forces qui structurent la décision

1. Le planning socle doit rester exactement à 12 modules et 60 séances.
2. Les variantes ne sont pas des cohortes tant qu'elles ne sont pas ouvertes.
3. Une cohorte est l'unité de capacité, d'affectation enseignante et de planification.
4. Une séance est une occurrence datée d'une cohorte, pas un produit commercial autonome.
5. Les contraintes de salle, enseignant, groupe et élève doivent être vérifiables automatiquement.
6. Les prix restent dans la source canonique et ne doivent pas être dupliqués dans le planning.
7. Les données de mineurs doivent être minimisées ; le planning n'a pas besoin de recopier leur identité.

## Options étudiées

### Option 1 — Étendre seulement `Stage` et `StageSession`

Ajouter quelques champs JSON ou texte (`track`, `room`, `module`) aux tables existantes.

Avantages : faible coût initial et compatibilité rapide avec les écrans existants.

Inconvénients : capacité toujours ambiguë, contraintes impossibles à garantir, duplication des libellés, réservations multi-matières fragiles, conflits difficiles à requêter. Cette option recrée la dette au lieu de la traiter.

### Option 2 — Modèle relationnel normalisé édition → module → cohorte → séance

Introduire des unités métier explicites et relier les choix d'inscription aux modules/variantes.

Avantages : contraintes testables, capacité par cohorte, conflits détectables, historique fiable, extension aux futurs stages.

Inconvénients : migration plus importante, adaptation des API et des tableaux de bord, nécessité d'une stratégie de coexistence.

### Option 3 — Planning versionné dans un document JSON unique

Conserver toute la structure opérationnelle dans un fichier canonique et projeter vers l'interface.

Avantages : matrice lisible, versionnable et facile à auditer avant lancement.

Inconvénients : mauvais support des inscriptions et affectations en temps réel, absence d'intégrité référentielle, risque de divergence avec la base et les dashboards.

## Décision proposée

Adopter **l'option 2**, avec une définition initiale versionnée du socle dans le code et une persistance relationnelle opérationnelle après validation.

Le document de planning est la preuve métier ; la base devient la source d'état des cohortes, séances et inscriptions une fois la migration exécutée. Les tarifs restent exclusivement servis par `data/pricing.canonical.json` via `lib/pricing.ts`.

## Agrégats et responsabilités

### 1. Édition de stage

Responsabilité : porter l'identité commerciale et la période civile.

Champs conceptuels :

- `editionId` stable : `pre-rentree-2026` ;
- `title` ;
- `dateStart = 2026-08-17` ;
- `dateEnd = 2026-08-28` ;
- `timeZone = Africa/Tunis` ;
- `locationId` correspondant au centre de Mutuelleville ;
- état de publication/ouverture ;
- référence vers le produit tarifaire validé, sans recopier son prix.

### 2. Module

Responsabilité : décrire le bloc pédagogique public choisi par une famille.

Un module possède :

- un identifiant stable, par exemple `PR26-S2-MATHS` ;
- une édition ;
- un niveau ;
- une discipline canonique ;
- un libellé public dépendant du niveau ;
- une semaine socle et un bloc canonique ;
- `sessionCount = 5`, `sessionDurationMinutes = 120`, `totalMinutes = 600` ;
- une liste de variantes autorisées ;
- une capacité calculée depuis ses cohortes, jamais une capacité globale implicite.

Le module ne porte pas de prix en dur. Il référence une règle commerciale validée ultérieurement.

### 3. Variante pédagogique

Responsabilité : qualifier le besoin sans ouvrir de ressource logistique.

Exemples : `PREMIERE_MATHS_EDS`, `PREMIERE_MATHS_HORS_EDS`, `PREMIERE_EAF_GENERALE`, `PREMIERE_EAF_TECHNOLOGIQUE`, `TERMINALE_MATHS_EDS`, `TERMINALE_MATHS_EXPERTES`, `TERMINALE_MATHS_COMPLEMENTAIRES`.

Une variante possède un libellé public, une catégorie (`EDS`, `HORS_EDS`, `VOIE`, `OPTION`, `TRONC_COMMUN`), une règle de compatibilité et un état de validation pédagogique. Elle ne possède ni salle, ni enseignant, ni cinq séances tant qu'une cohorte ne l'embarque pas.

### 4. Cohorte

Responsabilité : regrouper 3 à 5 élèves pédagogiquement compatibles et réserver les ressources nécessaires.

Une cohorte possède :

- un module ;
- une ou plusieurs variantes uniquement si une compatibilité explicite a été validée ;
- `minCapacity = 3`, `maxCapacity = 5` ;
- un enseignant affecté ;
- une salle affectée par ses séances ;
- un statut de planification ;
- cinq séances lorsque la cohorte est effectivement planifiée ;
- son propre compteur de places confirmées/en attente.

La cohorte socle est une réservation logistique initiale. Sa présence ne prouve pas que toutes les variantes du module peuvent y être fusionnées.

### 5. Séance

Responsabilité : matérialiser une occurrence datée de deux heures.

Une séance possède exactement une cohorte, une date, une heure de début/fin, un enseignant effectif et une salle. La discipline et le niveau sont dérivés du module. La durée doit être de 120 minutes pour cette édition.

### 6. Salle

Responsabilité : devenir une ressource contrôlable plutôt qu'une chaîne de caractères.

Pour le socle : `SALLE_1` et `SALLE_2`, toutes deux rattachées au centre pédagogique de Mutuelleville. La capacité physique doit être confirmée à au moins cinq élèves plus un enseignant. Deux occupations simultanées constituent le maximum absolu.

### 7. Enseignant

Responsabilité : porter la ressource humaine et ses habilitations.

Le planning utilise trois rôles fonctionnels :

- `ENS_MATHS_NSI`, commun aux Mathématiques et à la NSI/SNT ;
- `ENS_FRANCAIS` ;
- `ENS_PHYSIQUE_CHIMIE`.

Ils seront reliés à des profils enseignants réels après confirmation. L'affectation doit permettre de vérifier collision, charge quotidienne, continuité et habilitation disciplinaire.

### 8. Choix d'inscription

Responsabilité : représenter les 1 à 4 matières et leur qualification sans recopier la PII.

Chaque réservation de stage possède de un à quatre choix de module. Chaque choix référence :

- le module ;
- la variante demandée ou `A_QUALIFIER` ;
- la cohorte affectée, nullable tant que non planifiée ;
- un statut de qualification/attente ;
- les décisions d'arbitrage sans notes sensibles en texte libre.

Une contrainte unique interdit deux choix pour le même module dans une réservation.

## Statuts de planification et transitions

Le workflow utilise les statuts métier obligatoires comme états explicites, dans cet ordre de résolution :

1. `ARBITRAGE_PEDAGOGIQUE_REQUIS` : variante absente, ambiguë ou compatibilité non validée.
2. `SECOND_GROUPE_A_PLANIFIER` : une cohorte dépasse cinq demandes compatibles, ou deux variantes incompatibles atteignent chacune trois demandes.
3. `ENSEIGNANT_SUPPLEMENTAIRE_REQUIS` : le besoin de dédoublement est validé mais aucun enseignant habilité n'est affecté.
4. `CRENEAU_SUPPLEMENTAIRE_REQUIS` : l'enseignant existe mais aucun couple créneau/salle compatible n'est réservé.
5. `LISTE_ATTENTE` : le seuil de trois n'est pas atteint, ou les ressources ne peuvent pas être sécurisées dans la période.

Le statut interne `SOCLE_PLANIFIE` est utilisé pour les 12 cohortes logistiques initiales. Il ne doit pas être présenté comme une confirmation d'ouverture commerciale. Un état séparé `OUVERT`/`CONFIRME` pourra être ajouté au workflow d'exploitation après validation.

Une transition est déclenchée par un service de domaine et journalisée ; aucun hook frontend ne crée une cohorte ou cinq séances directement.

## Règles de compatibilité

- Par défaut, deux variantes différentes sont incompatibles.
- Une compatibilité ne peut être créée que par une règle explicite, versionnée et approuvée par le responsable pédagogique.
- Le statut scolaire (AEFE/candidat libre) n'est pas en soi une incompatibilité si niveau, programme, variante et diagnostic sont compatibles.
- Présentiel et distanciel sont des modalités de livraison, pas des variantes pédagogiques ; une cohorte hybride requiert une décision distincte.
- Un élève peut sélectionner logistiquement les quatre modules de son niveau ; la cohérence de ses EDS reste un contrôle de qualification.

## Règles d'ouverture d'une cohorte supplémentaire

Une cohorte supplémentaire ne peut être créée que si toutes les conditions suivantes sont vraies :

1. au moins trois demandes actives pédagogiquement compatibles ;
2. aucune cohorte existante compatible ne possède de place libre jusqu'à cinq ;
3. décision pédagogique documentée ;
4. enseignant habilité et disponible ;
5. cinq créneaux de deux heures disponibles sur les cinq jours de la bonne semaine ;
6. salle disponible sans dépasser deux salles simultanées ;
7. respect de 6 heures/jour, absence de retour et de creux interdit ;
8. respect de 4 heures/jour et absence de collision pour tous les packs concernés ;
9. validation logistique finale.

La création est atomique : cohorte + cinq séances + affectations. En cas d'échec d'une seule vérification, aucune séance partielle n'est persistée.

## Invariants de validation

Le validateur de planning doit refuser toute édition qui viole l'un des invariants suivants :

- séance hors 17–21 ou 24–28 août 2026 ;
- séance le 22 ou le 23 août ;
- durée différente de 120 minutes ;
- module socle avec autre chose que cinq séances ;
- enseignant ou salle doublement occupé ;
- cohorte doublement occupée ;
- plus de deux salles simultanées ;
- plus de 360 minutes d'enseignement par enseignant et par jour ;
- retour enseignant après un créneau libre hors déjeuner ;
- moins de 15 minutes entre deux séances successives ;
- plus de 240 minutes par élève et par jour ;
- chevauchement de deux modules du même niveau ;
- cohorte au-delà de cinq confirmés ou ouverte sous trois sans statut d'attente ;
- Mathématiques et NSI/SNT affectées simultanément à `ENS_MATHS_NSI` ;
- fusion de variantes sans règle de compatibilité active.

## Temps et fuseau

Les dates d'édition sont des dates civiles. Les séances sont construites à partir de `date + heure locale + Africa/Tunis`, puis persistées comme instants UTC. Pour août 2026 :

| Bloc | Heure Tunis | Instant UTC correspondant |
|---|---|---|
| A | 08:30–10:30 | 07:30–09:30Z |
| B | 10:45–12:45 | 09:45–11:45Z |
| C | 13:30–15:30 | 12:30–14:30Z |
| D | 15:45–17:45 | 14:45–16:45Z |

L'API publique renvoie l'instant ISO et `timeZone`. Le client formate explicitement avec `timeZone: 'Africa/Tunis'`, jamais avec le fuseau implicite du navigateur pour le planning officiel.

## Intégrité et concurrence

Les protections recommandées combinent :

- contraintes uniques/index de chevauchement lorsque PostgreSQL les permet ;
- transaction sérialisable lors de l'affectation d'une place ou de la création d'une cohorte ;
- verrou logique par édition/module pendant le recalcul de capacité ;
- validateur de domaine avant écriture ;
- revalidation après écriture dans la même transaction.

Les réponses d'erreur restent sobres et ne contiennent ni identité d'élève, ni payload complet, ni détails internes de planning.

## Conséquences positives

- le compteur de 60 séances socles reste démontrable ;
- la capacité est enfin reliée à la matière et au parcours ;
- les conflits deviennent explicites et actionnables ;
- le formulaire peut collecter le minimum utile sans créer de groupe fictif ;
- le modèle est réutilisable pour Toussaint, hiver et printemps.

## Coûts et risques

- migration des réservations existantes et adaptation de plusieurs dashboards ;
- coexistence temporaire avec les champs historiques ;
- besoin de règles de transition précises pour éviter les doubles réservations ;
- effort de recette supérieur à une correction éditoriale ;
- aucune décision de ce modèle ne résout la tarification, qui reste hors périmètre.

## Non-objectifs

- modifier les prix, acomptes ou échéanciers ;
- ouvrir automatiquement les variantes comme groupes ;
- affecter nominativement les enseignants avant validation opérationnelle ;
- autoriser une troisième salle simultanée ;
- déplacer les dates hors du 17–28 août ;
- déployer ou migrer la production dans cette phase.

## Stratégie de migration proposée

1. Accepter cet ADR et les règles métier.
2. Ajouter les nouvelles structures sans supprimer les anciennes.
3. Seed idempotent de l'édition et des 60 séances socles.
4. Projeter temporairement l'ancien `Stage` vers la nouvelle édition pour préserver les consommateurs.
5. Requalifier les réservations existantes avec intervention humaine lorsque nécessaire.
6. Basculer les lectures publiques puis les dashboards.
7. Comparer capacités, réservations et séances entre ancien et nouveau modèle.
8. Déprécier les champs globaux uniquement après une période de stabilité.

## Rollback

- désactiver l'ouverture de l'édition sans supprimer les nouvelles données ;
- conserver la correspondance entre anciennes réservations et nouveaux choix ;
- revenir aux anciennes lectures applicatives derrière un mécanisme de bascule ;
- ne jamais restaurer publiquement la date du 24 août comme début ;
- annuler une migration de données par table de correspondance et sauvegarde, pas par suppression aveugle.

## Décisions requises avant acceptation

- valider la tarification séparée des modules/packs ;
- confirmer que le modèle relationnel sera la source opérationnelle ;
- confirmer la règle de liste d'attente sous trois demandes ;
- confirmer l'application de l'absence de creux aux élèves ;
- confirmer les deux salles et leurs équipements ;
- valider les compatibilités pédagogiques éventuelles, dont aucune n'est présumée ici ;
- décider si une cohorte en ligne constitue une ressource/salle distincte ou une édition distincte.

## Références

- `docs/audits/2026-07-pre-rentree-date-planning-audit.md`
- `docs/specs/pre-rentree-2026-planning.md`
- `data/pricing.canonical.json`
- `lib/pricing.ts`
- `lib/stages/public.ts`
- `prisma/schema.prisma`
