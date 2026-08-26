# Résolution — SVC_TUTORAT_COMPRESSION (mission "vers un produit complet" §2)

## Décision

**Retiré du catalogue actif**, historique documentaire conservé (ce document + l'historique git de
`data/pricing.canonical.json`, où l'entrée a existé du commit `a259f57dc` [Lot 5 catalogue] jusqu'à son
retrait dans ce commit).

## Pourquoi cette issue plutôt que les 4 autres proposées

| Issue envisagée | Écartée parce que |
|---|---|
| Définir précisément le service | Aucune source — ni brief produit, ni brief tarifaire, ni description fonctionnelle n'existe nulle part dans le dépôt. Inventer une définition ici serait fabriquer un besoin, explicitement interdit par la mission. |
| Fusionner avec un service existant | Fusionner suppose de savoir ce que « tutorat de compression » recouvre pour juger sa proximité avec un service existant (Pilotage ? Bacs blancs ? ARIA ?) — impossible sans définition. |
| Classer comme inclusion non facturée | Même obstacle : inclure un concept dans un pack suppose de savoir ce qu'il couvre. |
| Déprécier | La dépréciation suppose un service déjà utilisé qu'on planifie de retirer — celui-ci n'a jamais été utilisé (aucun code ne le référence, aucun devis n'a jamais pu le sélectionner puisque `pricingRuleId: null` l'a toujours rendu non chiffrable). |
| **Retirer du catalogue actif, historique conservé** | **Retenue** — la seule issue qui ne suppose aucune connaissance du concept. Si un besoin réel apparaît un jour, il repart d'un brief produit, pas d'une résurrection d'une entrée jamais définie. |

## Ce qui a changé techniquement

- `data/pricing.canonical.json → candidat_individuel_catalogue.services` : l'entrée `SVC_TUTORAT_COMPRESSION`
  a été supprimée.
- `__tests__/lib/quotes/catalogue-schema.test.ts` : le test de décompte passe de « 11 modules + 3 services =
  14 » à **« 11 modules + 2 services = 13 »**, avec un commentaire explicite renvoyant à ce document (jamais
  un changement de chiffre silencieux). Nouveau test ajouté : `SVC_TUTORAT_COMPRESSION` est absent du
  catalogue, aussi bien côté `services` que côté `modules`.
- Le dossier décisionnel des 14 éléments (`dossier-decisionnel-14-elements.md`) reflète le retrait : 13
  éléments restent à arbitrer commercialement, le 14ᵉ est classé « retiré », pas « en attente ».

## Garanties du moteur — vérifiées, pas seulement énoncées

Un concept non défini/retiré :

- **N'apparaît jamais dans un devis client** — vérifié : `catalogue.services` ne contient plus l'entrée, et
  aucune fonction de sélection (`lib/quotes/catalogue.ts`) ne peut retourner un module/service absent du
  catalogue chargé.
- **Ne bloque aucun profil sans raison** — vérifié par recherche exhaustive avant le retrait : aucun fichier
  sous `lib/` ou `app/` ne référence la chaîne `TUTORAT_COMPRESSION` ou `SVC_TUTORAT_COMPRESSION` — son
  retrait ne peut donc changer le comportement d'aucune résolution de carte, de sélection catalogue ou de
  validation.
- **N'est jamais sélectionné automatiquement** — l'entrée n'a jamais eu de `pricingRuleId` (toujours `null`)
  ; combiné à l'absence de toute logique de sélection par défaut dans `lib/quotes/catalogue.ts`, elle
  n'aurait de toute façon jamais pu être choisie automatiquement même avant son retrait.
- **Ne peut pas être activée par une configuration incomplète** — il n'existe aucun chemin de configuration
  (BusinessConfig, feature flag, ou autre) qui contrôle l'inclusion d'un service dans
  `candidat_individuel_catalogue` : le catalogue est un fichier JSON statique validé par Zod au chargement
  (`lib/quotes/catalogue-schema.ts`), jamais une liste modifiable dynamiquement. Aucune configuration,
  complète ou non, ne peut donc faire réapparaître cette entrée.

## Le besoin métier P3 reste réel — retirer le service ne le résout pas (contrôle explicite demandé)

Retirer `SVC_TUTORAT_COMPRESSION` répond à « ce concept-là n'est pas défini », pas à « le besoin qui a motivé
son évocation initiale n'existe pas ». Le cas concret est P3 (dérogation même session, article 3 de l'arrêté
du 16 juillet 2018) : un candidat qui couvre en une session le contenu normalement réparti sur deux années —
cycle dense, charge élevée, besoin plausible de suivi individualisé renforcé.

**Vérification directe du moteur (pas une supposition)** : `lib/quotes/priority.ts::scoreSubjects` utilise
`monthsRemaining` uniquement pour `urgencyFactor` — qui influence l'**ordre de priorité** des matières dans
la sélection sous contrainte budgétaire. `lib/quotes/pricing.ts::volumeForSubject` — la fonction qui fixe le
volume horaire réel (0/4/8/12 h/mois) — ne dépend que du palier de diagnostic et du caractère fondamental de
la matière, **jamais** de `monthsRemaining`. Rien dans le pipeline ne majore automatiquement le volume horaire
pour un rythme P3 compressé, et rien ne réduit non plus `monthsRemaining` automatiquement pour un profil P3
(c'est une valeur fournie par l'appelant, sans dérivation depuis le parcours).

**Classement parmi les 6 issues proposées par la mission** : ni « modalité de livraison », ni « multiplicateur
de volume », ni « module individuel », ni « inclusion Pilotage renforcé » ne peuvent être **implémentés**
aujourd'hui sans inventer un facteur de majoration non sourcé (quel multiplicateur ? quelle courbe de charge ?
aucune donnée ne répond à cette question dans le dépôt). La seule issue qui ne fabrique rien est **« politique
de recommandation »**, mais au sens minimal et honnête : **signaler l'écart plutôt que le combler
silencieusement**. C'est ce qui a été implémenté (ce commit) :

- `lib/exams/carte.ts::genererCarteExamen` ajoute désormais un avertissement explicite à
  `avertissementsGeneraux` pour tout parcours `P3_LIBRE_1AN_DEROGATION` : le rythme est compressé, le moteur
  ne majore rien automatiquement, un accompagnement renforcé doit être arbitré explicitement avec la famille.
  Cet avertissement se propage sans changement d'interface dans `CandidateQuotePipelineResult.carte` (déjà
  affiché par `CandidatIndividuelWorkspace.tsx` et `PublicWizardPreview.tsx`, qui rendent tous deux
  `carte.avertissementsGeneraux` — aucune UI nouvelle nécessaire).
- Testé explicitement : `__tests__/lib/exams/carte.test.ts` (l'avertissement apparaît pour P3, jamais pour un
  P1 nominal) et `__tests__/lib/quotes/pipeline.test.ts` (l'avertissement survit jusqu'au résultat du
  pipeline, quel que soit le statut atteint).

**Ce qui reste un vrai gap technique, nommé plutôt que masqué** : aucun calcul réel de « charge » ni de
« volume réalisable » n'existe pour P3 — l'avertissement signale l'absence de calcul, il ne le remplace pas.
Si la direction souhaite un jour un vrai multiplicateur de volume ou un module de suivi renforcé chiffré pour
P3, cela suppose une hypothèse de charge sourcée (combien d'heures supplémentaires par semaine pour rattraper
une année en compression ?) — hors périmètre de ce lot, à traiter comme un brief produit à part entière, pas
comme une extension silencieuse de `volumeForSubject`.
