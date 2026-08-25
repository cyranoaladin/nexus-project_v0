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
