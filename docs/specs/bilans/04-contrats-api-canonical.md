# SPEC-04 - Contrats API Canonical pour la passation des bilans

## Statut

**RATIFIEE PAR NEXUS - A84.0**

- Date : 2026-08-02
- Perimetre : passation en ligne, calcul de la FactSheet, rendu deterministe, revue et publication
- Remplace : `04-contrats-api.md` du kit, annule par `NOTE-02`
- Architecture : modeles Canonical et ADR-0013

Cette specification ne constitue pas une autorisation d'ouvrir des routes publiques. Les six routes decrites ci-dessous restent derriere un feature flag par pack, desactive par defaut.

## 1. Objectif d'aout 2026

Le chemin d'aout est strictement deterministe :

1. l'eleve authentifie demarre une passation rattachee a son `Student` ;
2. il repond aux items et declare sa confiance pour chaque reponse ;
3. la soumission atomique declenche un unique travail de scoring ;
4. `computeScoringV2` et `computeFacts` sont composes par `buildFactSheet` ;
5. `buildDeterministicReport` produit les trois audiences depuis la seule FactSheet ;
6. le rapport reste en attente de revue ;
7. un coach le valide ou le rejette ;
8. seul un rapport valide peut atteindre `PUBLISHED`.

Le chemin d'aout n'appelle aucun agent, aucun LLM, aucun fournisseur externe et aucun RAG. Les agents existants restent desactives par configuration jusqu'a une decision ulterieure.

## 2. Perimetre ferme

Le contrat public contient exactement six routes :

| Methode | Route | Responsabilite unique |
|---|---|---|
| `POST` | `/api/bilans/attempts` | Creer une passation authentifiee |
| `GET` | `/api/bilans/attempts/[id]` | Lire le questionnaire expurge et permute |
| `PATCH` | `/api/bilans/attempts/[id]/answers` | Sauvegarder les reponses de facon idempotente |
| `POST` | `/api/bilans/attempts/[id]/submit` | Soumettre atomiquement et creer un seul job de scoring |
| `GET` | `/api/bilans/attempts/[id]/status` | Lire l'etat Canonical de la passation |
| `GET` | `/api/bilans/attempts/[id]/report` | Lire un rapport publie selon l'audience autorisee |

Aucune autre route publique n'est creee dans cette mission. La revue et la publication sont des operations internes du service Canonical, exposees au staff par un mecanisme d'administration distinct qui n'elargit pas ce contrat public.

## 3. Invariants communs

### 3.1 Authentification et rattachement

- Toute route exige une session serveur valide.
- La creation d'une passation est reservee, dans le perimetre d'aout, a un utilisateur eleve disposant d'une relation `Student` active.
- Le serveur resout le `Student` depuis l'identite de session. Le client ne fournit ni `studentId`, ni e-mail de rattachement.
- Aucun rapprochement par e-mail n'est permis, meme en repli.
- Le fallback legacy de `lib/security/ownership.ts` n'est pas repris.
- Un parent ne peut consulter un rapport que par une relation `ParentStudentLink` verifiee.
- Un membre du staff ne recoit l'audience Nexus que si son role l'autorise explicitement.

### 3.2 Non-divulgation et refus d'acces

- Une ressource absente et une ressource inaccessible produisent toutes deux `404`.
- Le serveur ne renvoie jamais `403` sur ces routes.
- Les reponses ne contiennent aucune PII inutile.
- Les journaux ne contiennent ni nom, ni e-mail, ni reponse d'eleve, ni contenu d'item.
- Les identifiants techniques peuvent etre journalises avec un code d'erreur et une duree.

### 3.3 Feature flag par pack

- Chaque pack possede un flag d'activation propre.
- La valeur par defaut est desactivee, y compris si la configuration est absente ou invalide.
- Un pack non valide pedagogiquement ne peut pas etre active.
- Un pack desactive est traite comme indisponible et produit `404`, sans reveler son existence.
- L'activation d'un pack ne vaut pas activation des autres packs.
- Le flag ne contourne ni le chargeur `ValidatedPack`, ni les controles de rattachement, ni la revue avant publication.

### 3.4 Provenance immuable

La passation conserve au minimum :

- le slug et la version du pack ;
- le checksum du pack ;
- la version du moteur ;
- la politique de scoring ;
- la version du catalogue CPS ;
- le seed genere par le serveur ;
- les horodatages de debut et d'expiration.

Ces valeurs sont scellees a la creation. Une modification ulterieure du pack ne change jamais une passation existante.

### 3.5 Erreurs communes

| Code | Sens |
|---|---|
| `400` | Requete syntaxiquement invalide |
| `401` | Session absente ou invalide |
| `404` | Ressource absente, inaccessible, pack desactive ou audience non autorisee |
| `409` | Etat incompatible, revision obsolete ou soumission deja effectuee |
| `422` | Donnees structurellement valides mais incompatibles avec le pack |
| `500` | Echec interne journalise sans detail sensible cote client |

## 4. Contrat des reponses d'eleve

Une reponse sauvegardee porte :

```ts
type AttemptAnswerInput = {
  itemId: string;
  optionId: string | null;
  confidence: 1 | 2 | 3 | 4 | null;
};
```

Regles :

- l'echelle de confiance est `1`, `2`, `3` ou `4`, sans valeur mediane ;
- toute reponse selectionnee exige une confiance de `1` a `4` ;
- une question explicitement non traitee porte `optionId: null` et `confidence: null` ;
- le serveur verifie que l'item et l'option appartiennent au snapshot du pack ;
- la confiance n'est jamais reconstruite apres coup ;
- sans confiance, aucun item repondu ne peut etre soumis ;
- le client ne calcule jamais la correction, le score ou le profil.

La confiance est indispensable a `ERREUR_CONFIANTE`. Une passation qui la perd ne satisfait pas le contrat metier.

## 5. `POST /api/bilans/attempts`

### 5.1 Entree

```json
{
  "packSlug": "entree-terminale-maths-v1"
}
```

Le corps ne contient aucun `studentId`, e-mail, seed, statut ou champ de revue.

### 5.2 Traitement

Dans une transaction, le serveur :

1. authentifie la session ;
2. resout le `Student` depuis cette session ;
3. charge un `ValidatedPack` ;
4. verifie le feature flag du pack ;
5. genere un seed cryptographiquement sur ;
6. cree un `CanonicalAssessmentAttempt` en `DRAFT` ;
7. scelle la provenance et les horodatages ;
8. retourne l'identifiant et l'etat initial.

La creation accepte une cle d'idempotence persistée dans une table ou des colonnes dédiées. Une contrainte unique porte sur `(userId, route, key)` et chaque enregistrement possède un TTL borné. La meme cle, pour le meme utilisateur et la meme route, retourne la réponse mémorisée tant que le TTL reste valide et que la première transaction a abouti. Si la transaction initiale a échoué ou a été annulée, aucune réponse n'est mémorisée et le rejeu est autorisé à exécuter une nouvelle transaction.

### 5.3 Sortie

```json
{
  "attemptId": "...",
  "status": "DRAFT",
  "startedAt": "...",
  "expiresAt": "..."
}
```

Le seed n'est pas un contrat client et n'est pas retourne.

## 6. `GET /api/bilans/attempts/[id]`

### 6.1 Traitement

- Le serveur controle le proprietaire avant de charger le questionnaire.
- La passation doit etre en `DRAFT` et non expiree.
- Une passation `DRAFT` expirée produit toujours `404` sur ce `GET`.
- La même passation expirée produit `409 ATTEMPT_EXPIRED` sur `PATCH /answers` et sur `POST /submit`.
- Aucun autre code ou comportement d'expiration n'est autorisé pour ces trois routes.
- Le pack est relu selon la provenance scellee de la passation.
- Les options sont permutees a l'affichage par la fonction deterministe fondee sur le seed persistant et l'identifiant de l'item.
- Le pack stocke reste immuable.

### 6.2 Sortie expurgee

La reponse contient uniquement les informations necessaires a l'affichage et a la reprise :

```ts
type PublicAttempt = {
  attemptId: string;
  pack: { slug: string; version: number; title: string };
  status: "DRAFT";
  revision: number;
  expiresAt: string;
  items: Array<{
    id: string;
    prompt: string;
    options: Array<{ id: string; label: string }>;
    savedAnswer: { optionId: string | null; confidence: 1 | 2 | 3 | 4 | null };
  }>;
};
```

Ne sont jamais serialises :

- `correct`, `isCorrect`, `correctAnswer` ou toute cle equivalente ;
- `distractorRationale` ;
- `shortCorrection`, `explanation` ou contenu de correction ;
- poids, profils, regles de scoring et sorties attendues ;
- checksums internes et metadata de revue.

### 6.3 Preuve de non-divulgation

Le fixture de pack injecte les sentinelles exactes `__CORRECT__` dans les champs de réponse et `__RATIONALE__` dans les rationales interdites. Le test bloquant inspecte recursivement la reponse apres serialisation JSON et le bundle client produit pour la page de passation. Il parcourt tous les objets et tableaux, puis refuse :

1. toute cle appartenant a la denylist des reponses, rationales, corrections et scoring ;
2. toute occurrence de `__CORRECT__` ou `__RATIONALE__` dans le JSON sérialisé ;
3. toute occurrence de `__CORRECT__` ou `__RATIONALE__` dans le bundle client ;
4. toute reapparition de ces donnees dans un objet imbrique, une option ou une metadata.

Une simple assertion sur des champs de premier niveau ne satisfait pas ce contrat.

## 7. `PATCH /api/bilans/attempts/[id]/answers`

### 7.1 Entree

```json
{
  "revision": 4,
  "answers": [
    { "itemId": "...", "optionId": "...", "confidence": 3 }
  ]
}
```

### 7.2 Semantique

- La sauvegarde est partielle et remplace la valeur courante des seuls items fournis.
- Elle est idempotente par cle de requete et par revision attendue.
- La clé est persistée dans une table ou des colonnes dédiées avec unicité `(userId, route, key)` et TTL borné.
- Une transaction aboutie mémorise la réponse rejouable ; une transaction échouée ou annulée ne mémorise aucune réponse et autorise un nouvel essai avec la même clé.
- Une meme requete rejouee ne cree aucun doublon et ne change pas deux fois la revision.
- Une revision obsolete produit `409` et retourne la revision serveur, sans ecraser une sauvegarde plus recente.
- Seule une passation `DRAFT`, non expiree et appartenant a l'eleve peut etre modifiee.
- Aucun scoring et aucune correction ne sont executes pendant la sauvegarde.
- La sortie contient la nouvelle revision et les identifiants des items sauvegardes, jamais leur correction.

Cette route permet la sauvegarde automatique et la reprise apres interruption.

## 8. `POST /api/bilans/attempts/[id]/submit`

### 8.1 Entree

```json
{
  "revision": 12
}
```

La requete porte une cle d'idempotence persistée dans une table ou des colonnes dédiées, soumise à l'unicité `(userId, route, key)` et à un TTL borné. Une transaction aboutie mémorise la réponse de soumission ; une transaction échouée ou annulée ne mémorise aucune réponse et le rejeu de la même clé est autorisé.

### 8.2 Transaction atomique

Le serveur exécute explicitement `SELECT ... FOR UPDATE` sur la ligne de `CanonicalAssessmentAttempt`, puis, sous ce verrou et dans la même transaction :

1. controle le proprietaire, l'expiration, l'etat `DRAFT` et la revision ;
2. verifie que chaque item possede une reponse explicite et que chaque reponse selectionnee possede une confiance ;
3. scelle les reponses ;
4. transitionne `DRAFT` vers `SUBMITTED` ;
5. renseigne `submittedAt` ;
6. insere exactement un `JobOutbox` de scoring, protege par une contrainte d'unicite.

Une seconde soumission ne cree jamais de second job. Elle retourne le resultat idempotent si la cle correspond, sinon `409`.

### 8.3 Traitement interne d'aout

Le consommateur du job execute uniquement :

1. `computeScoringV2` ;
2. `computeFacts` ;
3. `buildFactSheet(scoringV2, facts)` ;
4. la persistance du `ScoreSnapshot` et des preuves ;
5. `buildDeterministicReport(factSheet)` pour les audiences `ELEVE`, `PARENTS` et `NEXUS` ;
6. la validation structurelle des artefacts ;
7. la creation d'une revision en `REPORT_PENDING_REVIEW`.

Ni agent, ni gateway LLM, ni RAG ne peut etre appele sur ce chemin. Un echec de calcul ou de rendu reste un echec explicite ; il ne devient jamais `COMPLETED`, `COACH_VALIDATED` ou `PUBLISHED`.

## 9. `GET /api/bilans/attempts/[id]/status`

La route retourne uniquement l'etat necessaire au suivi :

```json
{
  "attemptId": "...",
  "status": "SUBMITTED",
  "reportStatus": "REPORT_PENDING_REVIEW",
  "updatedAt": "..."
}
```

Regles :

- aucun score, profil, contenu de rapport ou detail interne n'est retourne ;
- les etats exposes proviennent des enregistrements Canonical, sans traduction legacy ;
- l'absence de rapport est explicite par `reportStatus: null` ;
- une ressource appartenant a un autre utilisateur produit `404`.

## 10. `GET /api/bilans/attempts/[id]/report`

### 10.1 Condition de lecture

La route ne retourne un contenu que si le rapport est `PUBLISHED` et si sa revision publiee ne porte aucune `validationFailures`.

Tout autre etat produit `404`. L'existence d'un rapport en attente ou rejete n'est pas revelee au public.

### 10.2 Controle d'audience

- un eleve proprietaire recoit exclusivement l'artefact `ELEVE` ;
- un parent relie par un `ParentStudentLink` verifie recoit exclusivement l'artefact `PARENTS` ;
- un coach ou administrateur explicitement autorise recoit l'artefact `NEXUS` ;
- aucun parametre client ne permet de choisir ou d'elever l'audience ;
- toute audience non autorisee produit `404`.

Les artefacts `ELEVE` et `PARENTS` ne contiennent aucun score brut, conformement a la SPEC-05.

## 11. Cycle de revue et publication

Le service interne applique exclusivement le cycle suivant :

```text
REPORT_PENDING_REVIEW -> COACH_VALIDATED -> PUBLISHED
REPORT_PENDING_REVIEW -> COACH_REJECTED
```

Invariants :

- toute revision nouvellement rendue entre en `REPORT_PENDING_REVIEW` ;
- `validationFailures[]` non vide interdit `PUBLISHED`, y compris apres une action de coach ;
- la validation conserve l'identite du reviewer et l'horodatage ;
- le rejet conserve son motif ;
- la publication pointe vers une revision immuable ;
- aucune publication automatique n'existe ;
- aucun endpoint public de ce contrat ne peut valider ou publier.

L'interface de revue staff et ses mutations internes doivent reutiliser `report-service` et la machine a etats Canonical. Elles ne doivent jamais ecrire directement un statut Prisma.

## 12. Nouveau runner de passation

Le runner legacy n'est pas reutilise. Le nouveau runner :

- charge exclusivement le DTO expurge de la route `GET` ;
- n'importe jamais une banque ou un pack dans un composant client ;
- affiche une question ou un lot borne ;
- utilise l'ordre d'options fourni par le serveur ;
- demande la confiance `1` a `4` apres chaque choix ;
- sauvegarde automatiquement par `PATCH` ;
- gere la revision optimiste et les conflits sans perte silencieuse ;
- restaure les reponses sauvegardees apres rechargement ;
- affiche l'expiration de la passation ;
- ne calcule ni score, ni correction, ni profil dans le navigateur ;
- rend la soumission irreversible explicite avant confirmation.

## 13. Migration additive prealable

Une migration separee, produite mais non appliquee en production sans autorisation, doit :

- ajouter le seed persistant de la passation ;
- ajouter `startedAt` ;
- ajouter `expiresAt` ;
- aligner le statut par defaut du modele sur `DRAFT`, premier etat de la machine Canonical ;
- conserver toutes les tables, colonnes et lignes legacy ;
- etre eprouvee sur une copie isolee de production selon A40 et A82.

Le protocole d'epreuve exige un `pg_dump` de production en lecture seule, un conteneur jetable utilisant exactement l'image pgvector de production, aucune exposition reseau autre que la boucle locale, puis la suppression constatee du dump et du conteneur sous 48 heures.

## 14. Plan de tests bloquants

### 14.1 Authentification et ownership

- session absente : `401` ;
- tentative d'acces a la passation d'un tiers : `404` ;
- tentative parent sans lien verifie : `404` ;
- aucun chemin ne rattache un `Student` par e-mail ;
- le client ne peut pas imposer un `studentId`.

### 14.2 Confidentialite du questionnaire

- inspection recursive du JSON serialise sans cle ni valeur de correction ;
- absence de `distractorRationale`, y compris imbrique ;
- absence de correction courte, explication et metadata de scoring ;
- aucun import de pack ou banque depuis un composant client ;
- analyse du bundle client sans marqueur de reponse sentinelle.

### 14.3 Passation

- meme seed et meme item : meme ordre ;
- seeds distincts : ordres distincts sur le jeu de preuve ;
- la bonne option conserve son identite apres permutation ;
- confiance refusee hors `1..4` ;
- reponse selectionnee sans confiance refusee ;
- sauvegarde rejouee strictement idempotente ;
- reprise apres rechargement sans perte ;
- conflit de revision explicite.

### 14.4 Soumission et traitement

- transition atomique `DRAFT -> SUBMITTED` ;
- deux soumissions concurrentes creent un seul job ;
- `buildFactSheet` est le seul point de sortie des moteurs ;
- aucun agent, LLM, RAG ou appel reseau sur le chemin d'aout ;
- echec de scoring ou rendu : jamais de faux succes ;
- rendu exclusivement fonde sur la FactSheet ;
- aucun domaine evalue absent du rendu.

### 14.5 Revue et publication

- un rapport en attente, rejete ou non valide retourne `404` ;
- seul `PUBLISHED` est lisible ;
- `validationFailures[]` non vide bloque la publication a toutes les couches ;
- chaque role ne recoit que son audience ;
- aucun score brut dans les audiences `ELEVE` et `PARENTS`.

### 14.6 Feature flags

- configuration absente : pack desactive ;
- activation d'un pack n'active aucun autre pack ;
- pack DRAFT : activation impossible ;
- desactivation restauree : aucune nouvelle passation, lectures deja publiees traitees selon la politique de rollback.

## 15. Criteres d'ouverture d'un pack

Un feature flag ne peut etre active que si :

- le pack est complet et signe par un responsable pedagogique habilite ;
- les checksums des prompts et du pack sont valides ;
- la migration additive a ete eprouvee sur une copie isolee puis autorisee separement ;
- les six routes et le nouveau runner ont passe leurs tests de securite ;
- le pipeline deterministe complet est vert sans variable LLM ;
- le cycle de revue staff est operationnel ;
- le rollback par desactivation du flag a ete repete ;
- aucune route legacy exposant les reponses n'est accessible pour ce pack.

## 16. Hors perimetre

- activation d'un fournisseur LLM ;
- agents de narration ;
- RAG et ingestion documentaire ;
- rattachement par e-mail ;
- passation anonyme ;
- publication automatique ;
- migration ou suppression du legacy ;
- nouvelle route au-dela des six contrats ci-dessus ;
- application d'une migration en production.

## 17. Estimation revisee sans agents

| Lot | Effort estime |
|---|---:|
| Migration additive et repetition sur copie isolee | 0,5 a 1 jour |
| Services Canonical, ownership, feature flags et six routes | 2 a 2,5 jours |
| Nouveau runner, autosauvegarde, reprise et confiance | 2 a 2,5 jours |
| Integration scoring, FactSheet, rendu deterministe et outbox | 1 a 1,5 jour |
| Interface interne de revue et cycle jusqu'a `PUBLISHED` | 1 a 1,5 jour |
| Tests de securite, concurrence, E2E et gates | 1 jour |
| **Total** | **7,5 a 10 jours** |

Cette estimation suppose que les briques Canonical, `buildFactSheet`, `buildDeterministicReport` et la machine de revue restent reutilisables sans refonte. La borne basse est compatible avec le 17 aout uniquement si la specification, la migration locale et le pack pedagogique sont arbitres sans attente. La marge calendrier reste faible ; le nouveau runner et les tests de non-divulgation ne doivent pas etre compresses.
