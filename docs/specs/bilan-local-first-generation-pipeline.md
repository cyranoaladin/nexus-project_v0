# Chaîne local-first de génération des bilans

## Statut et périmètre

Spécification C1.3, 31 juillet 2026. Elle définit des contrats de fichiers et
des fixtures synthétiques hors réseau. Elle ne raccorde ni Prisma, ni worker,
ni route, ni `report-service`, ni donnée réelle.

## Principe

Le calcul et les décisions restent locaux. Une future LLM intervient uniquement
sur un contexte déjà réduit, expurgé et autorisé pour rédiger un JSON
structuré. Sa sortie demeure un brouillon non publiable tant que le grounding
local et la revue humaine ne sont pas terminés.

```text
entrée normalisée
  → score et compétences déterministes
  → preuves autorisées
  → contexte minimal par audience
  → rédaction structurée LLM
  → grounding local
  → revue humaine
  → révision approuvée
```

## Fichiers logiques

| Étape | Fichier | Autorité |
| ---: | --- | --- |
| 00 | `00_assessment_input.normalized.json` | entrée normalisée locale |
| 10 | `10_score_snapshot.json` | scoring déterministe |
| 20 | `20_evidence_snapshot.json` | preuves et compétences autorisées |
| 30 | `30_report_context.parent.json` | projection parent expurgée |
| 31 | `31_report_context.student.json` | projection élève expurgée |
| 32 | `32_report_context.nexus.json` | projection équipe, accès interne |
| 40 | `40_llm_draft.json` | brouillon structuré, jamais publication |
| 50 | `50_grounding_validation.json` | contrôles locaux des faits et références |
| 60 | `60_human_review.json` | décision et identité du relecteur |
| 70 | `70_approved_revision.json` | révision explicitement approuvée |

Chaque fichier porte au minimum :

```json
{
  "schemaVersion": "<version explicite>",
  "sourceSha": "<SHA de provenance>",
  "inputChecksum": "<SHA-256 canonique>",
  "createdAt": "<date ISO-8601>",
  "audience": "PARENT|STUDENT|NEXUS",
  "classification": "<classification explicite>",
  "piiStatus": "<état de minimisation>"
}
```

Une étape ne modifie jamais le fichier précédent. Elle produit un nouveau
document lié par checksum. Les fichiers sont des contrats d'échange ou des
preuves reproductibles, pas des sources éditoriales concurrentes.

## Responsabilités locales

Restent exclusivement locaux :

- normalisation et validation des réponses ;
- correction humaine des réponses libres ;
- scoring, calibration et `scoreEcho` ;
- compétences, priorités et `evidenceRefs` ;
- sélection des recommandations autorisées ;
- redaction PII et détection des données non fiables ;
- séparation parent, élève et Nexus ;
- validation Zod et JSON Schema ;
- grounding des compétences, scores et preuves ;
- rendu HTML/PDF, revue, approbation et publication.

La LLM ne reçoit ni clé de correction, ni questionnaire complet lorsqu'un
snapshot suffit, ni document PDF brut, ni commentaire réservé à une autre
audience.

## Contrat local implémenté

La source exécutable est :

`lib/bilans/local-first/contracts.ts`

Elle expose :

- un schéma Zod strict des fixtures synthétiques ;
- son JSON Schema dérivé ;
- un constructeur déterministe de contexte par audience ;
- un schéma Zod strict du contexte ;
- son JSON Schema dérivé ;
- la validation des checksums, scores, compétences et références ;
- la redaction locale des emails et téléphones synthétiques ;
- le retrait d'une instruction de prompt injectée ;
- le blocage des termes médicaux ou promesses interdites.

Les schémas JSON sont dérivés des schémas Zod. Ils ne constituent pas une
seconde source éditoriale.

## Séparation des audiences

- `PARENT` : faits et recommandations publiables pour le parent.
- `STUDENT` : faits et recommandations adaptés à l'élève, sans notes internes.
- `NEXUS` : mêmes faits canoniques avec notes internes autorisées.

`internalNotes` est refusé dans les contextes parent et élève. Toute référence
de preuve doit appartenir au snapshot courant. Le contexte n'accepte aucun
champ supplémentaire.

## Données non fiables et PII

Les textes libres sont classés `EVIDENCE_DATA_UNTRUSTED`. Avant un futur
transport :

- les emails sont remplacés par `[REDACTED_EMAIL]` ;
- les numéros tunisiens sont remplacés par `[REDACTED_PHONE]` ;
- une instruction synthétique de prompt injection est remplacée par
  `[PROMPT_INJECTION_REDACTED]` ;
- la longueur de chaque preuve est bornée à 500 caractères ;
- aucun nom, identifiant DB, date de naissance ou adresse n'est prévu par le
  schéma.

Une détection ne doit jamais être présentée comme une garantie juridique
d'anonymisation. C2 devra conserver une validation défensive avant tout appel.

## Grounding

Avant toute revue :

- `scoreEcho` doit être identique au score déterministe ;
- le pourcentage est recalculé localement ;
- chaque compétence doit exister ;
- chaque `evidenceRef` doit appartenir au contexte courant ;
- une compétence non mesurée reste explicitement non mesurée ;
- les recommandations doivent référencer au moins une preuve autorisée ;
- une donnée Nexus ne peut apparaître dans une autre audience ;
- les affirmations médicales, notes prédites et garanties sont refusées.

Une sortie invalide ne peut progresser vers les étapes 60 ou 70.

## Fixtures synthétiques

`content/bilans/benchmarks/synthetic-v1/` contient douze profils :

- quatre simples ;
- quatre intermédiaires ;
- quatre complexes.

Ils couvrent scores faible, moyen et élevé, compétence non mesurée, preuves
multiples, priorité forte, injection de prompt, fausse PII, contradiction
apparente et absence de difficulté majeure. Les checksums sont vérifiés en
test. Ces fichiers ne contiennent aucune donnée de production et ne sont
envoyés à aucun modèle dans C1.3.

## Réseau et benchmark

`BENCHMARK_CALL_COUNT=0` tant que le preflight réel Sonnet + Terra ne passe pas
sur le SHA exact de la branche. Les tests ordinaires utilisent uniquement des
fixtures locales et ne possèdent aucun chemin d'appel OpenRouter.

## Rollback

La chaîne n'a aucun état persistant ni activation. Le rollback consiste à ne
pas fusionner les contrats et fixtures. Aucun score, bilan existant ou donnée
historique n'est modifié.
