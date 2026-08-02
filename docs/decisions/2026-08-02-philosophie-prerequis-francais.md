# ADR pédagogique — Prérequis de français pour l'entrée en philosophie

## Date et statut

- Date : 2026-08-02
- Statut : Acceptée
- Décideur : Nexus Réussite

## Constat

Un élève entrant en Terminale n'a encore suivi aucun enseignement de philosophie. Une
banque prétendant mesurer des acquis disciplinaires de philosophie produirait donc un faux
diagnostic. Les capacités effectivement mobilisables à la rentrée sont l'analyse d'un texte,
la distinction entre thèse, argument et exemple, la définition d'une notion, la cohérence
du raisonnement et la rédaction d'un paragraphe argumenté.

## Décision

La banque `entree-terminale-philosophie-v1` conserve la matière `PHILOSOPHIE`, mais ses
`nodeCpsId` sont résolus dans le catalogue transversal
`data/bilans/cps/1re-francais-vers-terminale.v1.yaml`. Aucun catalogue artificiel de
philosophie n'est créé.

V2 valide l'existence du nœud et son niveau cible. Elle n'impose pas que le segment
disciplinaire du nœud soit identique à la matière de la banque. Cette règle est générique :
une relation interdisciplinaire n'est autorisée que si elle est explicite, versionnée et
documentée par son catalogue ; aucune exception liée à un slug n'existe dans le code.

## Conséquences

- Les faits et profils restent attribués aux neuf prérequis réellement évalués.
- La restitution conserve l'audience et la matière du pack Philosophie.
- Toute évolution de ces nœuds relève d'une nouvelle validation pédagogique humaine.
- Le test de vague prouve que la relation `PHILOSOPHIE` → `1re.francais.*` est acceptée.
