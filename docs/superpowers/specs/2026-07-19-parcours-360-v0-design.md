# Parcours 360 V0 — conception

**Date :** 19 juillet 2026

**Statut :** validé

**Périmètre :** chaîne documentaire locale du Diagnostic 360 au plan d’action annuel

## 1. Objectif

Construire une V0 opérationnelle qui transforme des observations pédagogiques structurées en quatre PDF nominatifs :

1. bilan initial ;
2. bilan parents ;
3. bilan élève ;
4. plan d’action annuel.

La chaîne doit fonctionner hors ligne, sans clé d’API. Un adaptateur Claude facultatif peut proposer les brouillons rédactionnels, sans changer le contrat de sortie. Aucune version diffusable ne peut être produite sans relecture humaine nominative.

## 2. Contexte du dépôt

Le dépôt contient déjà :

- des modèles Prisma `Student`, `Diagnostic`, `Stage`, `StageBilan`, `Bilan` et `GeneratedPedagogicalReport` ;
- une chaîne de génération de bilans dans `lib/bilan-generation/` ;
- plusieurs moteurs PDF, dont une chaîne Python/HTML/CSS/WeasyPrint auditée dans `scripts/pre-rentree/` ;
- des contrôles PDF portant sur les métadonnées, les polices, les liens, le texte extrait et les termes interdits.

La V0 réutilise les conventions documentaires et les contrôles de la chaîne pré-rentrée, mais reste isolée dans `tools/parcours360/`. Elle ne modifie ni Prisma ni les écrans applicatifs.

## 3. Périmètre

### Inclus

- schéma JSON versionné commun à la V0 et mappable vers la V1 ;
- validation syntaxique et règles métier ;
- mode rédactionnel manuel et déterministe ;
- adaptateur Claude facultatif ;
- génération locale des radars en SVG ;
- modèles HTML/CSS des quatre documents ;
- rendu PDF A4 avec métadonnées, langue et polices incorporées ;
- cycle brouillon, relecture, diffusion ;
- audits automatisés et jeu de données anonymisé ;
- tests unitaires, d’intégration et visuels de référence.

### Exclus

- migrations Prisma ;
- écrans du wizard, de suivi du stage ou de l’espace famille ;
- stockage distant et envoi automatique ;
- jobs BullMQ ;
- création des douze tests disciplinaires ;
- calendrier officiel 2026-2027 tant que les dates ne sont pas vérifiées.

## 4. Architecture

La V0 est un paquet Python autonome organisé en quatre frontières :

- `domain/` : schémas, types, normalisation et règles métier ;
- `generation/` : rédaction déterministe, contrat fournisseur et adaptateur Claude ;
- `rendering/` : modèles, radars SVG, HTML et PDF ;
- `audit/` : cohérence, qualité PDF et autorisation de diffusion.

Le cycle réel comporte deux phases indépendantes :

- `INITIAL`, avant le stage, produit et fait approuver le bilan initial ;
- `SORTIE`, après le stage, produit et fait approuver le bilan parents, le bilan élève et le plan annuel.

Le flux d’une phase est le suivant :

```text
projection de source.json pour la phase
    ↓ validation + hash de la projection
draft.<phase>.json ← mode manuel ou adaptateur Claude
    ↓ rendu
PDF de la phase, filigranés
    ↓ relecture nominative + hashes source et brouillon
review.<phase>.json
    ↓ rendu temporaire + audit bloquant + publication atomique
PDF diffusables de la phase + rapport de contrôle
```

Les observations d’origine ne sont jamais réécrites par le générateur. Une nouvelle génération remplace seulement le brouillon dérivé de la phase demandée. L’ajout du suivi de stage n’invalide pas le bilan initial déjà diffusé si la projection `INITIAL` est inchangée.

## 5. Dossier de travail d’un élève

```text
dossier-<identifiant>/
├── source.json
├── draft.initial.json
├── draft.sortie.json
├── review.initial.json
├── review.sortie.json
├── assets/
│   └── radars/*.svg
├── drafts/
│   ├── initial/*.pdf
│   └── sortie/*.pdf
├── delivery/
│   ├── releases/<release-id>/*.pdf
│   └── manifest.json
└── audit.<phase>.json
```

### `source.json`

Contient uniquement les faits saisis. Son schéma JSON Schema 2020-12 est versionné. `additionalProperties` vaut `false` à tous les niveaux.

| Champ | Type et cardinalité | Règle |
|---|---|---|
| `schemaVersion` | chaîne requise | valeur exacte `1.0.0` |
| `dossierId` | chaîne requise | `^[a-z0-9][a-z0-9-]{5,63}$` |
| `createdAt` | date-heure RFC 3339 requise | fuseau explicite |
| `identiteScolaire` | objet requis | contraintes ci-dessous |
| `orientation` | objet requis | contraintes ci-dessous |
| `diagnostics` | tableau requis, 1 à 4 | une entrée par matière, identifiants uniques |
| `profilTravail` | objet requis | déclaré et observé séparés |
| `feuillesRoute` | tableau requis | exactement une par matière diagnostiquée |
| `suiviStage` | tableau facultatif en phase initiale | requis en phase sortie |

#### Identité et orientation

| Champ | Type et bornes |
|---|---|
| `prenom` | chaîne de 1 à 60 caractères |
| `classeRentree` | `SECONDE`, `PREMIERE` ou `TERMINALE` |
| `voie` | `GENERALE`, `TECHNOLOGIQUE` ou `NON_RENSEIGNEE` |
| `specialites` | 0 à 3 chaînes distinctes de 1 à 60 caractères |
| `mathsOption` | `EXPERTES`, `COMPLEMENTAIRES`, `AUCUNE`, `HESITE` ou `NON_APPLICABLE` |
| `filieres` | 0 à 5 chaînes distinctes de 1 à 100 caractères |
| `tests` | 0 à 5 objets `{id, nom, vise, date, dateVerifiee}` |
| `parcoursup` | booléen |
| `echeancesSpecifiques` | 0 à 5 objets `{id, libelle, date, dateVerifiee}` |

Les identifiants imbriqués suivent `^[a-z][a-z0-9-]{2,47}$`. Une date est ISO `YYYY-MM-DD` ou `null`. Une date non nulle exige `dateVerifiee: true` ; sinon seul le libellé est imprimé.

#### Diagnostics et domaines

Chaque diagnostic contient :

- `id` stable ;
- `matiere` dans `MATHEMATIQUES`, `PHYSIQUE_CHIMIE`, `FRANCAIS`, `NSI` ;
- `dateTest` au format ISO ;
- 4 à 6 domaines ;
- pour chaque domaine : `id`, `nom` de 1 à 80 caractères, `niveauInitial` dans `ACQUIS`, `FRAGILE` ou `LACUNE`, score brut facultatif `{obtenu, maximum}` avec `0 <= obtenu <= maximum <= 100`, 0 à 5 erreurs distinctes parmi `CALCUL`, `METHODE`, `REDACTION`, `CONSIGNE`, `RAPIDITE`, et exemple facultatif limité à 300 caractères.

#### Profil de travail

`profilTravail.axes` comporte une entrée unique pour chacun des axes `AUTONOMIE`, `ORGANISATION`, `RAPPORT_ERREUR`, `CONCENTRATION` et `RYTHME`. Chaque entrée possède `declare` et `observe`, chaînes facultatives limitées à 400 caractères. Au moins une valeur `declare` ou `observe` doit être non nulle dans l’ensemble du profil. Une observation absente reste `null` ; le générateur ne rapproche pas les deux colonnes par inférence.

#### Feuille de route et suivi

Chaque entrée de `feuillesRoute` porte le `diagnosticId` de sa matière et contient exactement cinq séances numérotées de 1 à 5. Une séance contient 1 à 3 `domaineIds` appartenant à ce diagnostic, une priorité limitée à 300 caractères et un livrable limité à 120 caractères. Il existe exactement une feuille de route par diagnostic.

En phase `SORTIE`, chaque entrée de `suiviStage` porte le même `diagnosticId`. Il existe exactement un suivi par diagnostic et un enregistrement pour chaque séance planifiée :

- `presence` vaut `PRESENT`, `ABSENT` ou `EXCUSE` ;
- une séance présente contient 1 à 3 évaluations `{domaineId, niveauFinal}` aux `domaineId` distincts et une observation facultative de 500 caractères ; `niveauFinal` saisi vaut uniquement `ACQUIS`, `FRAGILE` ou `LACUNE` ;
- une séance `ABSENT` ou `EXCUSE` contient zéro évaluation et un motif factuel facultatif de 200 caractères ;
- un domaine sans évaluation finale reste `NON_EVALUE` ;
- un livrable a un libellé de 1 à 120 caractères et un statut `REMIS`, `A_FINALISER` ou `NON_REMIS`.

Une séance manquante est une erreur de schéma. Une absence explicitement enregistrée n’est pas une erreur. Lorsqu’un domaine est évalué dans plusieurs séances, son `niveauFinal` est le niveau de l’évaluation présente portant le plus grand numéro de séance. Sans évaluation présente, il vaut `NON_EVALUE`. Cette règle unique alimente le radar final, les comparaisons et les constats.

Les coordonnées parentales, données de santé et informations sans utilité pédagogique sont exclues.

### Niveaux

L’échelle de compte rendu est :

- `ACQUIS` ;
- `FRAGILE` ;
- `LACUNE` ;
- `NON_EVALUE`.

`NON_EVALUE` est uniquement un niveau final dérivé lorsqu’aucune évaluation présente n’existe ; il n’est jamais saisi comme niveau initial ou évaluation de séance. Les radars représentent cette échelle catégorielle de manière explicite et n’inventent pas un score académique.

### `draft.<phase>.json`

Le brouillon est également régi par un JSON Schema 2020-12 fermé. Son enveloppe contient :

| Champ | Type et règle |
|---|---|
| `schemaVersion` | valeur exacte `1.0.0` |
| `dossierId` | identique à `source.json` |
| `phase` | `INITIAL` ou `SORTIE` |
| `sourceProjectionSha256` | 64 caractères hexadécimaux |
| `generation` | `{mode, fournisseur, modele, promptVersion, generatedAt}` |
| `documents` | un document initial ou les trois documents de sortie |
| `qualityWarnings` | 0 à 20 codes normalisés |

`generation.mode` vaut `MANUAL` ou `CLAUDE`. En mode manuel, `fournisseur` et `modele` valent `null`; en mode Claude, ils valent respectivement `ANTHROPIC` et la valeur explicite de `PARCOURS360_CLAUDE_MODEL`. `promptVersion` est une chaîne versionnée et `generatedAt` une date-heure RFC 3339. Les avertissements appartiennent à l’ensemble fermé `NON_EVALUE_PRESENT`, `DATE_SANS_JOUR`, `OBSERVATION_ABSENTE`, `ABSENCE_STAGE` et `PAGINATION_A_SURVEILLER`.

La projection `INITIAL` contient l’identité scolaire, l’orientation, les diagnostics, le profil de travail et les feuilles de route. La projection `SORTIE` contient ces mêmes champs et le suivi du stage. Les hashes sont calculés sur la sérialisation canonique JSON RFC 8785 ; le hash du brouillon couvre le fichier complet.

Un texte personnalisé est un objet `EvidenceText` :

```json
{
  "text": "La priorité porte sur la méthode de récurrence.",
  "claimType": "RECOMMANDATION",
  "evidenceRefs": ["/diagnostics/0/domaines/2/niveauInitial"],
  "derivedNumbers": []
}
```

`text` contient 1 à 600 caractères et `evidenceRefs` contient 1 à 8 pointeurs JSON RFC 6901 distincts vers la projection source de la phase. Chaque pointeur doit exister. `claimType` appartient à `NIVEAU_INITIAL`, `NIVEAU_FINAL`, `PROGRESSION`, `ERREUR`, `OBSERVATION_TRAVAIL`, `ASSIDUITE`, `ORIENTATION` ou `RECOMMANDATION`.

Le validateur impose la compatibilité suivante :

- `NIVEAU_INITIAL` référence un ou plusieurs `niveauInitial` ;
- `NIVEAU_FINAL` référence la dernière évaluation du domaine ou les séances justifiant `NON_EVALUE` ;
- `PROGRESSION` référence le niveau initial et la dernière évaluation du même domaine ;
- `ERREUR` référence `erreurs` ou `exemple` ;
- `OBSERVATION_TRAVAIL` référence un axe déclaré ou observé ;
- `ASSIDUITE` référence `presence`, `motif` ou une observation de séance ;
- `ORIENTATION` référence uniquement l’objet orientation ;
- `RECOMMANDATION` référence au moins un niveau final, une erreur, une observation de travail ou une échéance d’orientation.

`derivedNumbers` contient au plus cinq objets `{value, operation: "COUNT", refs}`. Le validateur recalcule chaque compte à partir des références. Le texte statique du modèle n’utilise pas `EvidenceText`. Le contrôle automatique prouve l’existence et la compatibilité de catégorie des preuves ; la fidélité sémantique finale de la phrase reste un point explicite de la relecture humaine.

Le contrat documentaire est fermé :

- `INITIAL` contient exactement `bilanInitial` : synthèse de 5 `EvidenceText`, profil de travail de 1 à 4, synthèse d’orientation de 0 à 3 ;
- `SORTIE.bilanParents` contient une synthèse de 2 à 5, des constats par matière de 1 à 4, des observations d’apprentissage de 1 à 4 et une recommandation unique ;
- `SORTIE.bilanEleve` contient 1 à 8 acquis, exactement 3 priorités et 2 à 3 conseils de méthode ;
- `SORTIE.planAnnuel` contient exactement les quatre périodes prévues, chacune avec 1 à 3 priorités, 0 à 3 jalons et au plus un point d’étape Nexus, puis 0 à 5 échéances spécifiques.

Les tableaux, radars, identités, niveaux et livrables sont rendus directement depuis `source.json`, pas recopiés dans le brouillon.

### `review.<phase>.json`

| Champ | Type et règle |
|---|---|
| `schemaVersion` | valeur exacte `1.0.0` |
| `dossierId` | identique aux autres fichiers |
| `phase` | `INITIAL` ou `SORTIE` |
| `statut` | `DRAFT` ou `RELU` |
| `sourceProjectionSha256` | hash de la projection effectivement relue |
| `draftSha256` | hash du brouillon effectivement relu |
| `reluPar` | `null` en brouillon, sinon chaîne de 2 à 100 caractères |
| `reluLe` | `null` en brouillon, sinon date-heure RFC 3339 |
| `notes` | chaîne facultative de 0 à 2 000 caractères |

`release` recalcule les deux hashes. Un changement de fait pertinent pour la phase ou du brouillon rend l’approbation caduque.

### Bornes de rendu

- 1 à 4 matières ;
- 4 à 6 domaines et exactement 5 séances par matière ;
- aucun champ texte n’est tronqué automatiquement ;
- les noms longs utilisent la césure CSS, sans réduction sous 10 pt ;
- les cibles de pages s’appliquent à 1 ou 2 matières ; une matière supplémentaire peut ajouter une page ;
- maxima bloquants : 6 pages pour le bilan initial, 5 pour le bilan parents, 3 pour le bilan élève et 2 pour le plan annuel.

Un dépassement demande une correction humaine du brouillon ; le moteur ne tasse ni ne coupe le contenu.

## 6. Documents produits

### Bilan initial — cible de 3 à 4 pages

- synthèse en cinq lignes ;
- radar initial par matière ;
- tableau Acquis / Fragile / Lacune / Non évalué par domaine ;
- exemples concrets d’erreurs lorsqu’ils ont été saisis ;
- profil de travail factuel ;
- orientation et échéances identifiées ;
- priorité personnalisée de chacune des cinq séances.

### Bilan parents — cible de 2 à 3 pages

- rappel du point de départ ;
- radar final superposé au radar initial ;
- acquis consolidés, fragilités restantes et travaux de fond ;
- observations factuelles sur l’assiduité, la participation et l’autonomie ;
- recommandation Nexus honnête, y compris lorsqu’aucun service complémentaire n’est nécessaire.

### Bilan élève — cible de 1 à 2 pages

- tutoiement ;
- acquis exacts ;
- exactement trois priorités de rentrée ;
- deux ou trois conseils de méthode fondés sur les observations ;
- liste des livrables constituant le kit de rentrée.

### Plan d’action annuel — 2 pages

- quatre périodes : septembre–Toussaint, Toussaint–Noël, janvier–février, mars–juin ;
- jalons scolaires, priorités et points d’étape ;
- échéances propres au projet de l’élève ;
- dispositifs Nexus seulement lorsqu’ils sont pertinents ;
- plan utilisable par une famille qui ne reprend aucun service.

Une échéance officielle non vérifiée est mentionnée sans date précise.

## 7. Charte et contraintes PDF

- A4 portrait ;
- bleu nuit `#071A3A`, or `#C9A227` réservé aux éléments décoratifs ;
- corps d’au moins 10 pt ;
- logo et polices incorporés localement ;
- radars lisibles en couleur et en niveaux de gris ;
- tableaux et lignes non scindés entre deux pages ;
- métadonnées Title, Author « Nexus Réussite », Subject et Language `fr` ;
- liens actifs lorsqu’une URL ou une adresse apparaît ;
- poids inférieur à 2 Mo par PDF ;
- première page informative et lisible sur téléphone.

Les PDF `DRAFT` portent un filigrane visible « BROUILLON — NON DIFFUSABLE ». Les PDF de `delivery/` n’en portent aucun.

Les actifs sont ceux du dépôt :

- logo avec slogan `public/images/logo_slogan_nexus_x3.png`, largeur maximale 55 mm ;
- logo compact `public/images/logo_nexus_reussite.png`, largeur maximale 12 mm ;
- `app/fonts/DMSans-Variable.woff2` pour le corps ;
- `app/fonts/Fraunces-Variable.woff2` pour les titres ;
- `app/fonts/IBMPlexMono-Regular.woff2` pour les identifiants et métadonnées discrètes.

La V0 reprend les patrons d’écriture atomique, de chargement local des actifs et d’audit de `scripts/pre-rentree/document_renderer.py` et `scripts/pre-rentree/document_audit.py`. Elle n’importe pas leurs données métier de pré-rentrée.

## 8. Interface en ligne de commande

```text
parcours360 init <dossier>
parcours360 validate <dossier>
parcours360 draft <dossier> --phase initial|sortie --provider manual|claude
parcours360 render <dossier> --phase initial|sortie
parcours360 approve <dossier> --phase initial|sortie --reviewer "Nom"
parcours360 release <dossier> --phase initial|sortie
parcours360 audit <dossier> --phase initial|sortie
```

- `init` refuse un dossier non vide et crée un exemple minimal anonymisé ;
- `validate` contrôle le schéma et les règles des phases disponibles ;
- `draft` génère le contrat rédactionnel de la phase ;
- `render` crée les brouillons filigranés de la phase ;
- `approve` enregistre le relecteur et les deux hashes ;
- `release` refuse toute validation absente ou caduque et invoque obligatoirement l’audit ;
- `audit` est une commande autonome en lecture seule.

Les écritures utilisent un fichier temporaire dans le même répertoire puis `os.replace`. Une commande rejouée avec les mêmes entrées est sans effet. `draft` ne rappelle pas Claude et `release` ne crée pas une nouvelle version si les hashes et la configuration sont inchangés. Une régénération intentionnelle exige `draft --force`; elle n’efface pas les anciennes releases.

Codes de sortie : `0` succès, `2` validation, `3` génération, `4` rendu, `5` relecture, `6` audit et `7` configuration.

## 9. Génération manuelle déterministe

Le mode manuel est défini par `generation/manual_rules.yaml`, versionné et testé. Il ne résume pas librement les données : il applique des sélections et formulations contrôlées.

### Ordres et calculs communs

- matières dans l’ordre de `diagnostics` ;
- domaines dans leur ordre source ;
- priorité : `LACUNE`, puis `FRAGILE`, puis `NON_EVALUE`, puis `ACQUIS` ;
- progression : comparaison ordinale `LACUNE=0`, `FRAGILE=1`, `ACQUIS=2`; `NON_EVALUE` est exclu du calcul ;
- dernier niveau final selon la règle de la séance au numéro le plus élevé ;
- listes coupées uniquement aux maxima du contrat, jamais au milieu d’un texte.

### Bilan initial

- une phrase de distribution des niveaux par matière ;
- ajout des domaines prioritaires dans l’ordre commun jusqu’à obtenir exactement cinq phrases ;
- profil de travail : les quatre premiers axes non vides dans l’ordre `AUTONOMIE`, `ORGANISATION`, `RAPPORT_ERREUR`, `CONCENTRATION`, `RYTHME`, avec l’observation avant la déclaration ;
- orientation : filières, tests visés puis échéances, dans cet ordre, avec trois blocs au maximum.

### Bilan parents

- un constat par matière indiquant les domaines en progression, stables, en recul et non évalués ;
- observations : synthèse d’assiduité, puis jusqu’à trois observations de séance non vides dans l’ordre matière/séance ;
- recommandation : travail régulier sur les trois premiers domaines `LACUNE`, sinon consolidation des trois premiers `FRAGILE`, sinon poursuite autonome ; si tous les domaines sont `NON_EVALUE`, le texte demande un nouveau point factuel sans conclure à une progression.

### Bilan élève

- acquis : les huit premiers domaines finaux `ACQUIS`, dans l’ordre source ; si aucun n’est disponible, une phrase factuelle indique que les données de sortie ne permettent pas encore de confirmer un acquis ;
- priorités : exactement trois domaines, selon l’ordre commun ; un domaine `ACQUIS` sélectionné en complément est formulé comme un maintien, et un domaine `NON_EVALUE` comme un point à vérifier ;
- conseils : deux ou trois conseils choisis d’abord selon les axes de travail documentés, puis selon les types d’erreur ; si moins de deux conseils sont obtenus, compléter avec les priorités de domaine selon les règles de repli ci-dessous.

Correspondances des conseils d’axe :

| Axe | Conseil contrôlé |
|---|---|
| `AUTONOMIE` | Commence chaque séance de travail par une tâche précise et vérifiable. |
| `ORGANISATION` | Planifie tes exercices dans un créneau identifié et note ce qui reste à reprendre. |
| `RAPPORT_ERREUR` | Conserve une trace de chaque erreur et écris la correction associée. |
| `CONCENTRATION` | Travaille par séquences courtes sans notification, puis vérifie le résultat. |
| `RYTHME` | Répartis le travail sur plusieurs jours plutôt que sur une seule séance. |

Correspondances de repli : `CALCUL` → vérifier chaque ligne ; `METHODE` → écrire les étapes avant de commencer ; `REDACTION` → rédiger une justification complète ; `CONSIGNE` → repérer le verbe d’action et les données ; `RAPIDITE` → réserver un temps final de vérification.

Repli par niveau de domaine : `LACUNE` → reprendre le cours puis un exercice simple ; `FRAGILE` → refaire un exercice sans support puis vérifier ; `ACQUIS` → entretenir l’acquis par un exercice régulier ; `NON_EVALUE` → réaliser un exercice court pour faire le point. Le niveau référencé rend chaque conseil traçable.

### Plan annuel

- les trois priorités de l’élève alimentent dans l’ordre les trois premières périodes ;
- la quatrième période réactive et vérifie ces trois priorités ;
- les jalons génériques sont du texte statique du modèle ;
- les échéances personnelles viennent uniquement de l’orientation et conservent une date seulement si `dateVerifiee` vaut `true` ;
- le point d’étape Nexus reste vide en mode manuel, sauf si une valeur factuelle a été ajoutée et relue dans le brouillon.

Les phrases exactes, accords et variantes singulier/pluriel sont des entrées de `manual_rules.yaml`; les tests snapshots constituent l’oracle. Une modification des règles change leur version et invalide l’idempotence du brouillon.

## 10. Adaptateur Claude facultatif

Le contrat fournisseur reçoit la projection de phase suivante : classe, voie, spécialités et option ; orientation ; diagnostics et domaines ; axes de travail ; feuille de route ; suivi de stage uniquement pour `SORTIE`. Le prénom, l’établissement, les contacts et les identifiants locaux ne sont jamais envoyés. Les textes utilisent « l’élève » ou le tutoiement ; le prénom est ajouté localement par le modèle PDF.

Avant l’appel, le prénom connu est remplacé par le jeton `ELEVE` dans tous les champs libres. La préparation de charge utile refuse une adresse email, une URL, un préfixe `mailto:`/`tel:` ou une séquence téléphonique de huit chiffres ou plus détectée dans ces champs. Le rapport local indique le pointeur concerné sans recopier la donnée sensible.

L’adaptateur doit renvoyer le même schéma que le mode manuel. Il :

- impose une sortie JSON structurée ;
- utilise `temperature: 0` ;
- interdit les diagnostics psychologisants, étiquettes, promesses et chiffres absents ;
- exige des références de preuve ;
- conserve la provenance de la génération.

`ANTHROPIC_API_KEY` et `PARCOURS360_CLAUDE_MODEL` sont requis uniquement pour `--provider claude`; aucun modèle implicite n’est choisi. Le délai est de 45 secondes et le budget de sortie de 6 000 jetons. Deux requêtes au maximum sont autorisées : une requête initiale, puis une seule nouvelle tentative après 2 secondes pour un délai dépassé, un statut 429/5xx ou une réponse qui échoue au schéma. La deuxième réponse invalide arrête la commande avec le code `3`. Aucun résultat partiel n’est fusionné ou publié.

Une erreur fournisseur ne déclenche aucun repli silencieux. L’opérateur choisit explicitement de relancer ou d’utiliser `--provider manual`. Les tests utilisent un transport factice et n’accèdent jamais au réseau.

## 11. Erreurs bloquantes

`release` rend d’abord tous les fichiers de la phase dans un répertoire temporaire, exécute l’audit complet, puis renomme atomiquement ce répertoire vers `delivery/releases/<release-id>/` et remplace atomiquement `delivery/manifest.json`. Une tentative en échec supprime seulement son répertoire temporaire ; le manifeste et toutes les releases précédentes restent inchangés.

Le manifeste possède `current.INITIAL` et `current.SORTIE`, chacun nul ou égal à un `releaseId`. Chaque release enregistre sa phase, les hashes source et brouillon, la date de diffusion, l’empreinte du moteur et la liste des fichiers avec leur SHA-256. Une publication ne remplace que le pointeur de sa phase ; le bilan initial et les trois documents de sortie restent donc découvrables ensemble. Les anciennes releases restent versionnées mais ne sont jamais sélectionnées implicitement.

Les textes personnalisés et le texte extrait des PDF sont normalisés en minuscules Unicode avant contrôle. Les expressions bloquantes sont :

- `paresseux`, `fainéant`, `incapable`, `inapte`, `instable` ;
- `TDAH`, `dyslexique`, `dyslexie`, `dépressif`, `dépression`, `anxieux`, `diagnostic psychologique` ;
- `réussite garantie`, `résultat garanti`, `mention garantie`, `réussira`, `fera forcément`, `échec certain`, `100 %` ;
- `taux de réussite`, `à valider`, `note interne`, `TBD` ;
- toute forme de `120 DT/h` ou `120 TND/h`.

Dans un `EvidenceText`, tout nombre en chiffres doit soit apparaître comme valeur scalaire dans une référence compatible, soit correspondre à un `derivedNumbers` recalculé. Les nombres structurels du document, comme les cinq séances ou les trois priorités, sont émis uniquement par le modèle statique. Le validateur n’affirme pas comprendre toute la sémantique d’une phrase libre : la relecture humaine reste responsable de sa fidélité aux preuves.

La chaîne ne publie rien en cas de :

- JSON invalide ou version inconnue ;
- incohérence entre domaines initiaux et finaux ;
- référence absente, catégorie de preuve incompatible ou nombre dynamique non sourcé ;
- texte interdit ou chiffre non sourcé ;
- approbation absente, hash source périmé ou hash brouillon périmé ;
- logo ou police manquants ;
- métadonnées, langue, liens ou polices non conformes ;
- pagination hors bornes ou empreinte de rendu inconnue ;
- PDF dépassant 2 Mo.

## 12. Tests et critères d’acceptation

La suite couvre :

- schéma JSON, normalisation et règles métier ;
- génération manuelle déterministe ;
- adaptateur Claude avec faux serveur, sans appel réseau réel ;
- garde-fous rédactionnels ;
- checksum et cycle de relecture ;
- production HTML/PDF ;
- métadonnées, polices, liens, poids et texte extrait ;
- scénarios limites : quatre matières, six domaines, absences, niveaux non évalués, textes et noms aux longueurs maximales ;
- snapshots visuels rasterisés des quatre modèles et des scénarios limites.

Les fixtures canoniques sont : `minimal-initial.json`, `sortie-multi-evaluation.json`, `sortie-avec-absence.json`, `sortie-repli-conseils.json`, `sortie-quatre-matieres.json` et `longueurs-maximales.json`. Elles couvrent notamment deux évaluations d’un même domaine, ainsi qu’un seul axe de travail renseigné, aucune erreur et des domaines non évalués. Elles prouvent que la séance au numéro le plus élevé alimente le radar final et que le repli des conseils conserve des preuves compatibles.

Les dépendances Python sont verrouillées et l’empreinte de rendu enregistre les versions de WeasyPrint, Pango et Poppler ainsi que les hashes du CSS, des logos et des polices. Les références visuelles sont produites dans le même conteneur Linux fixé que la CI. La comparaison à 100 DPI utilise un seuil SSIM de `0.995`; une référence ne peut être remplacée que par la commande explicite de mise à jour des baselines, suivie d’une revue du diff d’images.

Le test visuel de référence est un gate de développement et de CI, pas un calcul dépendant de la machine de l’opérateur à chaque diffusion. À l’exécution, `release` exige une empreinte de rendu connue, rasterise les pages et vérifie les marges, pages blanches, dimensions A4 et bornes de pagination. Cette séparation évite qu’une différence d’anticrénelage bloque arbitrairement une famille.

La V0 est acceptée si :

1. un dossier anonymisé valide génère hors ligne le bilan initial brouillon puis les trois brouillons de sortie ;
2. les deux approbations nominatives génèrent un PDF initial puis trois PDF de sortie diffusables ;
3. une modification de la projection source ou du brouillon invalide la diffusion de la phase concernée ;
4. les niveaux manquants restent « Non évalué » ;
5. toute recommandation est traçable à une observation ;
6. les PDF passent l’ensemble des audits automatisés et visuels.

## 13. Passage à la V1

Les structures de `source.json`, `draft.<phase>.json` et `review.<phase>.json` sont conçues pour être mappées vers les modèles applicatifs existants ou leurs extensions : profil élève, diagnostics, évaluations de séance, bilans et statut de relecture. La V1 remplacera le stockage fichier par Prisma et les commandes par des écrans et jobs, sans modifier les règles métier du domaine.
