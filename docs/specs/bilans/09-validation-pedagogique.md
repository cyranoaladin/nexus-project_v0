# Validation pédagogique d'un pack de bilan

## Objet

Cette procédure conditionne toute mise en service d'un pack. Un pack `DRAFT` peut être testé techniquement, mais il ne peut jamais atteindre le gateway métier ni être publié.

## Personne habilitée

La validation est réalisée par un enseignant nommé de la discipline concernée. La trace de revue mentionne son identité professionnelle et sa qualification dans la discipline.

## Périmètre de la revue

L'enseignant examine individuellement chaque item, sa formulation, sa réponse attendue, chacun de ses distracteurs et son explication. Il relit également chaque prompt d'agent, les règles de restitution par audience et les critères de validation automatique.

## Signature

La validation renseigne `review.validatedBy`, `review.validatedAt` et porte sur une version déterminée du pack. Le pack signé conserve les chemins et checksums exacts de tous ses prompts.

## Révocation automatique

Toute modification d'un item, d'un distracteur, d'une explication, d'un prompt ou d'un checksum annule la validation. La version du pack est alors incrémentée, son statut revient à `DRAFT` et les champs de validation redeviennent nuls.

### Frontière de version

La règle de révocation commence à la première signature pédagogique. Avant cette signature,
le pack `maths-terminale-v1` est encore en construction : l'enrichissement de ses prompts
fait partie de sa version initiale et ne crée pas une version 2.

À partir de la signature d'Alaeddine BEN RHOUMA, toute modification d'un item, d'une option,
d'un prompt ou d'un checksum impose une version 2, remet le statut à `DRAFT` et annule
`review.validatedBy` ainsi que `review.validatedAt`. Un pack signé ne peut jamais être
modifié silencieusement en conservant son numéro ou sa validation.

## Trace conservée

La preuve comprend le pack signé et le paquet de revue aveugle issu de la recette technique. La revue d'un pack ne remplace pas la validation humaine de chaque rapport avant publication.

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

`data/bilans/banks/maths-terminale-v1.draft-metadata.yaml`

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

`data/bilans/banks/maths-terminale-v1.draft-metadata.yaml`

Pour chaque item, renseignez `nodeCpsId`, `difficulty`, `targetTimeSec`, `shortCorrection`
et la justification de chacun des trois distracteurs. Ne modifiez pas les identifiants,
les énoncés, les options ni les réponses correctes.

En cas de doute, laissez le champ vide et signalez l'identifiant de l'item. Ne remplissez
jamais au jugé. Si un distracteur ne correspond à aucune erreur réelle observable, écrivez
`A REMPLACER` dans sa justification : l'item restera volontairement incomplet.

### 3. Mesurer l'avancement

Depuis la racine du dépôt, copiez cette commande telle quelle :

```bash
./node_modules/.bin/tsx scripts/bilans/check-pack-completeness.ts --source yaml data/bilans/banks/maths-terminale-v1.draft-metadata.yaml
```

Au début, la première ligne est :

```text
PACK_COMPLETENESS=0/50
```

Après vingt-trois items complets :

```text
PACK_COMPLETENESS=23/50
```

Quand le formulaire est entièrement complété :

```text
PACK_COMPLETENESS=50/50
```

Tant que le compteur n'atteint pas `50/50`, les lignes suivantes indiquent précisément
les champs qui restent à traiter. Un résultat différent de `50/50` est un état d'avancement,
pas une autorisation à valider le pack.

### 4. Livrer la relecture

Vérifiez d'abord que seul le formulaire a changé :

```bash
git status --short
```

La seule ligne attendue est :

```text
 M data/bilans/banks/maths-terminale-v1.draft-metadata.yaml
```

Puis livrez le formulaire :

```bash
git add -- data/bilans/banks/maths-terminale-v1.draft-metadata.yaml
git commit -m "docs(bilans): compléter les métadonnées pédagogiques Maths Terminale"
git push origin review/maths-terminale-v1-metadata
```

Transmettez ensuite le SHA du commit à Nexus. La fusion dans le pack, la génération du
paquet de relecture et la signature sont réalisées séparément. Remplir le YAML ne signe
pas le pack et ne le rend pas publiable.
