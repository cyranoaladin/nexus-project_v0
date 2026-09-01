# ADR — Modèle de facturation en cours d'année : `MID_YEAR_BILLING_MODEL = ANNUAL_CONTRACT`

**STATUS = CLOSED (2026-09-01, décision direction).** Une inscription candidat individuel commencée en
cours d'année reste un contrat annuel complet. Le nombre de mois restant avant les épreuves n'influence
que l'urgence/priorité pédagogique — jamais le prix, les volumes, le taux d'acompte ou le nombre
d'échéances.

> Le moteur `lib/quotes/priority.ts` acceptait déjà un paramètre `monthsRemaining` avant cette décision,
> utilisé uniquement pour pondérer l'ordre de priorité des matières (`urgencyFactor`). Le comportement
> était donc déjà conforme à la règle ci-dessous. Ce document fige la décision, verrouille le
> comportement par un test d'architecture, et désambiguïse le nom du champ dans le domaine canonique
> pour qu'aucune évolution future ne puisse le faire dériver vers une fonction de facturation.

---

## Gate 1 — Le devis personnalisé V1 reste un contrat annuel, quel que soit le mois d'inscription

### Problème

Rien dans le modèle ne distinguait explicitement « urgence pédagogique » (combien de temps reste-t-il
pour préparer l'épreuve) de « base de facturation » (sur combien de temps le contrat est-il étalé). Le
nom `monthsRemaining`, générique, aurait pu laisser croire aux futurs contributeurs qu'il s'agit d'une
durée contractuelle et l'entraîner par erreur vers une fonction de prorata.

### Exigence

Pour le devis personnalisé V1 :

| Élément | Valeur, invariante quel que soit le mois d'inscription |
|---|---|
| Acompte | 25 % du total annuel |
| Solde | 10 mensualités |
| Volumes contractuels annuels | ceux du plan optimisé, jamais réduits au prorata du temps restant |

Exemples de référence (R1/R2) :

- **R1** : total 10 440 TND, acompte 2 610 TND, 10 mensualités de 783 TND.
- **R2** : total 14 800 TND, acompte 3 700 TND, 10 mensualités de 1 110 TND.

**Règle absolue** : le nombre de mois restant avant les épreuves ne doit atteindre **aucune** fonction
d'échéancier ou de facturation (`computeSchedule`, `computeCandidatLibreSchedule`, ni aucun calcul de
`deposit`/`monthlyTotal`/`grandTotal`/`installments`). Il ne peut influencer que
`lib/quotes/priority.ts::scoreSubjects` (via `urgencyFactor`), c'est-à-dire l'ordre/priorité des
matières — jamais leur volume horaire (`lib/quotes/pricing.ts::volumeForSubject`), jamais le montant.

### Portée

S'applique au moteur canonique candidat-individuel (`lib/quotes/priority.ts`, `lib/quotes/pipeline.ts`,
`lib/quotes/recommendation.ts`). Ne s'applique pas à d'éventuels autres produits Nexus qui auraient une
logique de proration distincte et documentée séparément.

---

## Gate 2 — Désambiguïsation du nom dans le domaine canonique

### Problème

Le nom `monthsRemaining` est ambigu : il ne dit pas *pourquoi* la valeur existe (priorité pédagogique)
ni *ce qu'elle ne doit jamais faire* (changer l'échéancier commercial). Un champ nommé de façon neutre
est plus facile à mal utiliser dans une fonction future de facturation.

### Exigence

Le domaine canonique (`lib/quotes/priority.ts`, `lib/quotes/pipeline.ts`, `lib/quotes/recommendation.ts`)
nomme la valeur `pedagogicalUrgencyMonths`. La frontière HTTP publique
(`app/api/quotes/recommend/route.ts`), qui est un contrat public déjà en production, conserve le champ
`monthsRemaining` en entrée (compatibilité du wire format) mais le mappe localement vers
`pedagogicalUrgencyMonths` avant d'entrer dans le moteur canonique — isolant le nom ambigu hors du
moteur, comme prévu par la mission.

**Règle absolue** : `monthsRemaining` ne doit apparaître nulle part dans `lib/quotes/priority.ts`,
`lib/quotes/pipeline.ts` ou `lib/quotes/recommendation.ts`. Il ne subsiste que sur la frontière HTTP
publique, avec un mapping explicite et un commentaire citant cette ADR.

### Portée

Renommage pur (aucun changement de comportement). N'affecte pas le contrat HTTP public existant.

---

## Statut de suivi — CLOSED

- [x] **Gate 1** — comportement déjà conforme, verrouillé par un test de balayage comportemental
  (1/3/6/10 mois) prouvant `grandTotal`/`deposit`/`monthlyTotal`/`paymentPolicy` identiques pour chaque
  scénario, tout en prouvant que le signal d'urgence lui-même varie réellement (non-régression).
- [x] **Gate 2** — `monthsRemaining` renommé en `pedagogicalUrgencyMonths` dans
  `lib/quotes/priority.ts`, `lib/quotes/pipeline.ts`, `lib/quotes/recommendation.ts`. La route
  `app/api/quotes/recommend/route.ts` conserve `monthsRemaining` en entrée HTTP et mappe explicitement
  vers `pedagogicalUrgencyMonths`, avec référence à cette ADR.
- Tests : `__tests__/architecture/pedagogical-urgency-commercial-schedule-isolation.test.ts`
  (`PEDAGOGICAL_URGENCY_CANNOT_CHANGE_COMMERCIAL_SCHEDULE`).
