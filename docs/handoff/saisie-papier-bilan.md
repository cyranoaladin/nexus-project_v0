# Handoff — saisie papier des bilans (session dédiée)

Point de reprise pour le seul développement restant du chantier « bilan
accessible ». Écrit le 8 août 2026, après livraison du chemin public (PR #109).

Le contexte : des élèves ont déjà passé le bilan **sur papier**. Leurs copies
sont récupérées. Il faut pouvoir en saisir les réponses côté staff, sans les
faire repasser, et obtenir le même bilan qu'une passation en ligne.

## À réutiliser — ne rien reconstruire

Tout le moteur existe et tourne en production. Le travail consiste à ajouter une
**entrée de saisie**, pas un second pipeline.

| Élément | Emplacement |
|---|---|
| Création d'un attempt | `createCanonicalAttempt` — `lib/bilans/passation/pilot-protocol.ts` |
| Enregistrement des réponses | `PATCH /api/bilans/attempts/[id]/answers` (`{revision, answers[]}`) |
| Soumission | `POST /api/bilans/attempts/[id]/submit` (`{revision}`) |
| Scoring déterministe | worker `SCORE_ATTEMPT` → `SCORED` → `REPORT_PENDING_REVIEW`, automatique |
| Picker de matière | `components/bilans/CanonicalAssessmentStart.tsx`, packs filtrés sur `student.gradeLevel` |
| Écran de passation | `components/bilans/CanonicalAssessmentRunner.tsx` |
| Validation et publication | `validateAndPublishReportAction` — `app/dashboard/assistante/bilans/actions.ts` |
| Activation parent | `lib/auth/parent-activation.ts` — mot de passe choisi par le parent |
| Ajout d'enfant | `app/dashboard/parent/add-child-dialog.tsx` + `POST /api/parent/children` |

Les réponses sont de la forme `{ itemId, optionId, confidence }`, la confiance
allant de 1 à 4. Les items d'un pack se lisent dans
`data/bilans/banks/<slug>.json`, sous `questionnaire.items[]`.

## Spécification

**Rôle** : assistante ou admin uniquement. Rien de cette interface ne doit être
atteignable par un parent ou un élève.

**Parcours**

1. Créer ou sélectionner le parent — adresse réelle, **activation en attente** :
   il posera son mot de passe lui-même, personne ne le fixe à sa place.
2. Ajouter le ou les enfants (prénom, niveau).
3. Choisir la matière — même picker, filtré sur le niveau — ce qui sélectionne
   le pack validé.
4. **Écran de saisie** : les items du pack, dans l'ordre. Par item, la réponse
   lue sur la copie (A/B/C/D) et, **si l'élève l'a cochée**, sa certitude (1-4).
   La certitude est **optionnelle** : beaucoup de copies papier ne la portent
   pas, et il ne faut surtout pas en inventer une.
5. Valider → attempt de provenance `SAISIE_PAPIER`, avec le saisisseur et la
   date dans l'audit pseudonyme → scoring déterministe → bilan plancher.
6. Validation assistante → publication, par le flux existant.

**Provenance.** C'est le point sur lequel il ne faut rien céder. Une saisie
papier doit être identifiable comme telle, pour toujours. Une passation en
ligne est faite par l'élève depuis sa session ; une saisie est faite par un
membre du staff qui recopie. Les deux produisent un bilan légitime, mais ce ne
sont pas les mêmes faits, et les confondre reviendrait à maquiller l'origine
d'une donnée.

## Le test qui compte

**Les mêmes réponses doivent produire le même score, en ligne et par saisie.**
S'il existe un écart, c'est que la saisie a introduit un chemin de calcul
parallèle — exactement ce qu'il faut éviter.

Écrire ce test en premier : un jeu de réponses connu, passé par les deux
chemins, et comparer les scores et profils obtenus.

Les autres cas à couvrir : provenance et saisisseur enregistrés ; certitude
absente gérée sans être inventée ; saisie inaccessible aux rôles non staff ;
non-régression de la passation en ligne.

## Points d'accroche

L'écran de saisie a sa place dans le tableau de bord assistante, à côté de la
revue des bilans (`app/dashboard/assistante/bilans/`). La route de saisie peut
suivre la forme des routes canoniques existantes sous `app/api/bilans/`.

La provenance demande un champ additif sur `canonical_assessment_attempts`.
**Attention** : cette table est protégée par des triggers append-only. Ajouter
une colonne est possible — c'est du DDL, pas une mutation de ligne — mais la
valeur devra être posée **à la création** de l'attempt, jamais par un `UPDATE`
ultérieur, qui serait rejeté.

## Livré

Le 8 août 2026, branche `feat/saisie-papier-bilan`.

| Élément | Emplacement |
|---|---|
| Route de saisie | `POST /api/bilans/saisie-papier` — `lib/bilans/api/paper-entry.ts` |
| Création du foyer | `POST /api/bilans/saisie-papier/famille` — `lib/bilans/saisie-papier/famille.ts` |
| Écran staff | `app/dashboard/assistante/bilans/saisie-papier/` + `components/bilans/PaperEntryGrid.tsx` |
| Garde de rôle | `lib/bilans/saisie-papier/access.ts` (ASSISTANTE, ADMIN — refus en 404) |
| Provenance | migration `20260808153000_add_canonical_attempt_provenance` |

Le moteur n'a pas été dupliqué. Les invariants de soumission ont été extraits
dans `lib/bilans/api/submission-core.ts` et la fusion des réponses dans
`lib/bilans/api/answer-merge.ts` : la passation en ligne et la saisie papier
les **importent tous les deux**. Un test d'architecture le vérifie, et vérifie
aussi qu'aucun fichier du pipeline de scoring ne mentionne la provenance.

Une seule modification de comportement ailleurs : `lib/bilans/worker/scoring.ts`
acceptait 1 à 4 et rejetait `null`. Le moteur de faits, lui, typait déjà
`Confidence = 1|2|3|4|null` et traitait `null` comme une absence de confiance.
L'adaptateur a été élargi pour laisser passer `null`. La passation en ligne ne
peut pas produire ce cas — sa validation d'entrée impose la certitude — donc
rien n'y change.

### Accès ADMIN : question ouverte de périmètre

Le garde et la route d'API acceptent
`ASSISTANTE` et `ADMIN`. Mais `middleware.ts` renvoie tout ADMIN de
`/dashboard/assistante/*` vers `/dashboard/admin` : en pratique l'écran n'est
ouvrable que par une assistante, un ADMIN ne passant que par l'API. C'est une
convention de plateforme partagée par toutes les pages assistante ; la lever se
déciderait pour l'ensemble du tableau de bord, pas au détour de cette
fonctionnalité.

### Durée de passation des copies papier

La durée de composition ne figure pas sur une copie. `startedAt` et
`submittedAt` d'un attempt saisi valent donc l'instant de la saisie, le moteur
en déduit une durée nulle et le snapshot brut porte `PASSATION_EXPRESS`. Ce
snapshot reste inchangé afin de conserver un moteur unique et la parité avec le
chemin en ligne. À la frontière de présentation/validation du rapport,
`lib/bilans/render/passation-presentation.ts` retire ce faux signal pour la
seule provenance `SAISIE_PAPIER` et affiche la mention neutre : « Durée non
mesurée — saisie papier. » Une passation en ligne réellement express conserve
son drapeau. La projection et la parité sont verrouillées par les tests unitaires
et PostgreSQL réel.

## Ce qui a été livré avant ce handoff

- PR #109 : chemin public, lien d'activation lisible, ajout d'enfants répétable.
- Le diagnostic lui-même était déjà live : 17 packs validés, scoring
  déterministe, rapport plancher, validation assistante, dashboard parent.
- 138 items du candidat libre validés par les relecteurs, enregistrement prêt
  mais non appliqué (attend une fenêtre).
