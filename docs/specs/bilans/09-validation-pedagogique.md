# Validation pédagogique d'un pack de bilan

## Objet

Cette procédure conditionne toute mise en service d'un pack. Un pack `DRAFT` peut être testé techniquement, mais il ne peut jamais atteindre le gateway métier ni être publié.

## Personne habilitée

La validation est réalisée par un enseignant nommé de la discipline concernée. La trace de revue mentionne son identité professionnelle et sa qualification dans la discipline.

## Périmètre de la revue

L'enseignant examine individuellement chaque item, sa formulation, sa réponse attendue, chacun de ses distracteurs et son explication. Il relit également chaque prompt d'agent, les règles de restitution par audience et les critères de validation automatique.

## Signature

La signature durable vit exclusivement dans le registre versionné
`data/bilans/reviews/<slug>.review.yaml`. La source YAML éditoriale ne contient jamais de
bloc `review` et le pack JSON généré n'est jamais édité à la main.

Le registre contient exactement :

- `schemaVersion: 1` ;
- le `slug` et la `packVersion` signés ;
- le SHA-256 de la source YAML dans `sourceChecksum` ;
- les SHA-256 des cinq prompts, indexés par rôle dans `promptChecksums` ;
- `validatedBy`, qui est exclusivement l'identifiant d'un `CoachProfile` réel ;
- `validatedAt`, au format ISO-8601 ;
- `qualification`, qui décrit la qualification professionnelle du relecteur.

L'adresse email sert uniquement à résoudre le `CoachProfile` au moment de la commande de
signature. Elle n'est jamais écrite dans le registre. La validation porte sur une version
déterminée du pack et sur les contenus exacts de sa source et de ses cinq prompts.

### Transition normative

Le convertisseur produit `status: VALIDATED` et renseigne `review.validatedBy` ainsi que
`review.validatedAt` uniquement lorsque toutes les conditions suivantes sont vraies :

1. la banque passe les règles V1 à V14 et toutes ses références CPS sont valides ;
2. le registre du slug existe et respecte le schéma ci-dessus ;
3. son `validatedBy` désigne encore un `CoachProfile` existant ;
4. son `slug` et sa `packVersion` correspondent à la source courante ;
5. `sourceChecksum` correspond exactement au YAML courant ;
6. chacun des cinq `promptChecksums` correspond au prompt courant.

Cette transition `DRAFT -> VALIDATED` est une dérivation, jamais une activation. Elle
n'active aucun feature flag, n'ouvre aucune passation et ne publie aucun rapport.

## Révocation automatique

Toute modification d'un item, d'un distracteur, d'une explication, d'un prompt ou d'un
checksum invalide immédiatement la signature. Au contrôle ou à la génération suivante, le
pack retombe en `DRAFT` et ses champs `review.*` redeviennent nuls. Le registre invalide
reste une trace d'audit mais ne produit jamais une signature active ; une nouvelle version
et une nouvelle signature sont nécessaires.

### Frontière de version

La règle de révocation commence à la première signature pédagogique. Avant cette signature,
les packs `entree-terminale-maths-v1` et `maths-terminale-bilan-v1` sont encore en construction : l'enrichissement de leurs prompts
fait partie de leur version initiale et ne crée pas une version 2.

À partir de la signature d'Alaeddine BEN RHOUMA, toute modification d'un item, d'une option,
d'un prompt ou d'un checksum impose une version 2. Tant que la nouvelle version n'est pas
signée, le pack dérivé reste `DRAFT` avec `review.validatedBy` et `review.validatedAt` nuls.
Un pack signé ne peut jamais être modifié silencieusement en conservant sa validation.

## Trace conservée

La preuve comprend le registre de signature, le pack signé qui en est dérivé et le paquet
de revue aveugle issu de la recette technique. La revue d'un pack ne remplace pas la
validation humaine de chaque rapport avant publication.

## Limite de la recette mock

La recette mock atteste le câblage, le déterminisme, le passage des validateurs V1 à V7 et
l'absence d'appel réseau. Elle ne consomme pas le contenu rédactionnel des prompts et ne
mesure donc aucune qualité pédagogique. Le constat « zéro violation sur soixante rapports »
est une preuve de conformité technique, jamais une preuve de qualité des bilans.

Au moment de la première signature du pack, aucune sortie issue d'un fournisseur réel n'a
encore été vue. Une validation complète de la qualité rédactionnelle ne devient possible
qu'après activation contrôlée d'un fournisseur réel. La première exécution réelle doit être
relue intégralement par un humain sur les vingt FactSheets et les trois audiences avant
toute mise en service. Aucun résultat de cette exécution ne peut être publié directement.

## Procédure de relecture

Cette procédure est destinée au responsable pédagogique. Le seul fichier à modifier est :

`data/bilans/banks/maths-terminale-bilan-v1.draft-metadata.yaml`

Ne modifiez ni le pack JSON, ni les prompts, ni les champs `review.*`.

### 1. Récupérer la branche de relecture

Dans le dépôt local, exécutez :

```bash
git fetch origin
git switch --track origin/review/maths-terminale-v1-metadata
```

Si la branche existe déjà sur votre poste :

```bash
git fetch origin
git switch review/maths-terminale-v1-metadata
git pull --ff-only
```

### 2. Remplir le formulaire

Ouvrez uniquement :

`data/bilans/banks/maths-terminale-bilan-v1.draft-metadata.yaml`

Pour chaque item, renseignez `nodeCpsId`, `difficulty`, `targetTimeSec`, `shortCorrection`
et la justification de chacun des trois distracteurs. Ne modifiez pas les identifiants,
les énoncés, les options ni les réponses correctes.

En cas de doute, laissez le champ vide et signalez l'identifiant de l'item. Ne remplissez
jamais au jugé. Si un distracteur ne correspond à aucune erreur réelle observable, écrivez
`A REMPLACER` dans sa justification : l'item restera volontairement incomplet.

### 3. Mesurer l'avancement

Depuis la racine du dépôt, copiez cette commande telle quelle :

```bash
./node_modules/.bin/tsx scripts/bilans/check-pack-completeness.ts --source yaml data/bilans/banks/maths-terminale-bilan-v1.draft-metadata.yaml
```

Au début, la première ligne est :

```text
PACK_COMPLETENESS=0/38
```

Après vingt-trois items complets :

```text
PACK_COMPLETENESS=23/38
```

Quand le formulaire est entièrement complété :

```text
PACK_COMPLETENESS=38/38
```

Tant que le compteur n'atteint pas `38/38`, les lignes suivantes indiquent précisément
les champs qui restent à traiter. Un résultat différent de `50/50` est un état d'avancement,
pas une autorisation à valider le pack.

### 4. Livrer la relecture

Vérifiez d'abord que seul le formulaire a changé :

```bash
git status --short
```

La seule ligne attendue est :

```text
 M data/bilans/banks/maths-terminale-bilan-v1.draft-metadata.yaml
```

Puis livrez le formulaire :

```bash
git add -- data/bilans/banks/maths-terminale-bilan-v1.draft-metadata.yaml
git commit -m "docs(bilans): compléter les métadonnées pédagogiques Maths Terminale"
git push origin review/maths-terminale-v1-metadata
```

Transmettez ensuite le SHA du commit à Nexus. La fusion dans le pack, la génération du
paquet de relecture et la signature sont réalisées séparément. Remplir le YAML ne signe
pas le pack et ne le rend pas publiable.

## Deux banques, deux usages

### Positionnement d’entrée en Terminale

`data/bilans/banks/entree-terminale-maths-v1.yaml` est la source éditoriale des dix-huit
items portant exclusivement sur neuf prérequis de Première. Le pack JSON généré porte le
même slug, reste `DRAFT` et annonce vingt-cinq minutes pour mille cent soixante secondes
de temps cible cumulé. Il sert au stage de pré-rentrée et aux élèves entrant en Terminale.

Les cinq prompts propres à cet usage vivent sous
`content/bilans/prompts/entree-terminale-maths-v1/`. Leur duplication est volontaire :
les exemples pédagogiques pourront diverger de ceux d’un bilan de fin d’année.

### Bilan de fin de Terminale

`data/bilans/banks/maths-terminale-bilan-v1.json` contient trente-huit items du programme
de Terminale. Ce pack s’adresse aux candidats libres et aux élèves en cours ou en fin
d’année. Il reste `DRAFT` et non chargeable tant que
`data/bilans/banks/maths-terminale-bilan-v1.draft-metadata.yaml` n’est pas complet.

Les quatre anciens items hors programme et les huit prérequis de Première ne figurent
plus dans ce pack.

### Huit prérequis réservés à une future version 2

Les huit items transférés sont conservés, sans métadonnées inventées, dans
`data/bilans/banks/entree-terminale-maths-probabilites.draft-metadata.yaml`.
Ils ne font pas partie du pack v1 de dix-huit items. Une fois entièrement complétés et
revus, ils pourront entrer dans `entree-terminale-maths-v2`.

| Ancien identifiant | Nouvel identifiant |
|---|---|
| MATH-ANA-01 | ETL-MAT-PRQ-01 |
| MATH-PROB-01 | ETL-MAT-PRQ-02 |
| MATH-PROB-02 | ETL-MAT-PRQ-03 |
| MATH-PROB-03 | ETL-MAT-PRQ-04 |
| MATH-PROB-04 | ETL-MAT-PRQ-05 |
| MATH-PROB-07 | ETL-MAT-PRQ-06 |
| MATH-PROB-09 | ETL-MAT-PRQ-07 |
| MATH-PROB-11 | ETL-MAT-PRQ-08 |

La correspondance est contractuelle : elle permet d’interpréter tout résultat historique
portant l’ancien identifiant. Les énoncés, options et réponses correctes sont conservés.
## Vague 1 — quinze banques actives

La vague 1 est décrite par `data/bilans/banks/wave1.manifest.json`. Elle porte quinze
banques d'entrée, de la Quatrième à la Terminale, et six disciplines. Chaque entrée lie une
source YAML, un catalogue CPS, cinq prompts et un pack JSON. Le batch n'explore jamais
`_archive/` et refuse qu'un chemin archivé apparaisse dans le manifest.

Conversion et validation complètes, sans modifier les sources :

```bash
./node_modules/.bin/tsx scripts/bilans/convert-bank-batch.ts \
  --manifest data/bilans/banks/wave1.manifest.json --write
```

Le batch charge les quinze banques avant toute écriture, exécute V1 à V14, vérifie
l'unicité globale, résout les catalogues, lie les prompts par SHA-256, puis écrit les packs
seulement si le lot entier est valide. Une erreur produit le slug, la règle et le chemin du
champ fautif ; aucun sous-ensemble de packs n'est alors écrit.

Tableau de bord pédagogique :

```bash
./node_modules/.bin/tsx scripts/bilans/check-pack-completeness.ts \
  --all --manifest data/bilans/banks/wave1.manifest.json
```

Les deux brouillons historiques sont affichés séparément et ne comptent ni dans les quinze
banques actives ni dans les 270 identifiants attendus.

Les catalogues décrivent le niveau d'origine du prérequis et le niveau d'entrée visé. Le
segment disciplinaire peut être transversal : la banque Philosophie utilise explicitement
les prérequis `1re.francais.*`, conformément à la décision du 2026-08-02. Cela ne vaut pas
autorisation générale d'inventer un rapprochement ; tout lien interdisciplinaire doit être
versionné, documenté et validé humainement.
