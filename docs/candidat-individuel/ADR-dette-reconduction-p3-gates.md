# ADR — Dette tracée : `RECONDUCTION_AUTOMATIQUE_CONFIRMEE` et P3 avant API/wizard

**STATUS = TRACKED_DEBT — GATE BLOQUANT avant toute API publique de profil et avant le wizard.**

> Deux anomalies restaient ouvertes à l'issue du correctif de complétude Lot 4 (commit `9b0738e19`,
> `docs/candidat-individuel/validation-codes.md` §"Anomalie ouverte"). Elles ne bloquent pas le
> catalogue de services (Lot 5) ni le moteur tarifaire interne, car aucun des deux n'est exposé à un
> candidat aujourd'hui — `lib/exams/` n'a ni API publique ni wizard. Ce document fige les deux
> extensions comme conditions obligatoires **avant** qu'une API de profil ou un wizard candidat
> n'existent, pour qu'elles ne soient pas oubliées une fois le catalogue/moteur en place.

---

## Gate 1 — Provenance et piste d'audit de `RECONDUCTION_AUTOMATIQUE_CONFIRMEE`

### Problème

`MecanismeNote.RECONDUCTION_AUTOMATIQUE_CONFIRMEE` (lib/exams/parcours.ts) est aujourd'hui un simple
literal qu'un appelant peut poser sans trace de qui l'a affirmé ni sur quelle base — contrairement à
`StatutDispenseDeclaree` (`DECLAREE`/`CONFIRMEE`/`REFUSEE`), qui distingue explicitement une déclaration
candidat d'une confirmation staff. Rien n'empêche aujourd'hui qu'une valeur
`RECONDUCTION_AUTOMATIQUE_CONFIRMEE` soit posée sans qu'un humain ait vérifié la condition « immédiat,
sans lacune » exigée par l'article D. 334-7-1 (texte intégral vérifié, commit `9b0738e19`).

### Exigence

Une extension du modèle (sur le même schéma additif/réversible que `dispensesDeclarees`, jamais un
remplacement destructif de `mecanisme`) doit porter, avant toute API publique ou wizard :

| Champ | Rôle |
|---|---|
| mécanisme déclaré par la famille | ce que le candidat/la famille affirme (jamais suffisant seul) |
| mécanisme vérifié par le personnel | booléen/statut distinct, posé uniquement par le staff |
| justificatif ou référence examinée | pointeur vers la pièce consultée (bulletin, relevé de notes session précédente) |
| identité du validateur | qui a confirmé — traçabilité nominative |
| date de validation | quand la confirmation a eu lieu |
| source réglementaire appliquée | référence à l'article D. 334-7-1 (ou D. 334-13 si finalement ce mécanisme-là s'applique) |
| session d'origine | session dont les notes sont reconduites |
| session cible | session pour laquelle la reconduction s'applique |

**Règle absolue** : une déclaration publique (candidat) ne doit **jamais** produire directement
`RECONDUCTION_AUTOMATIQUE_CONFIRMEE`. Le flux doit être : déclaration → statut intermédiaire type
`DECLAREE`/`NON_VERIFIEE` (fail-closed, `necessiteVerificationHumaine: true`, exactement comme
`DispenseDeclareeInput`) → confirmation staff avec les 8 champs ci-dessus → alors seulement
`RECONDUCTION_AUTOMATIQUE_CONFIRMEE`.

### Portée

Non implémenté dans ce lot (catalogue de services) — aucune API/wizard n'existe encore pour en avoir
besoin. **Doit être fait avant** que `app/api/*` expose un endpoint de profil candidat ou qu'un composant
wizard permette de déclarer un mécanisme de reconduction.

---

## Gate 2 — États P3 avant exposition publique

### Problème

`checkSameSessionEligibility` (lib/exams/catalog.ts) résout aujourd'hui 3 issues techniques
(`ELIGIBLE` / `NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH` / `ELIGIBILITY_REQUIRES_HUMAN_REVIEW`), exposées
depuis le correctif Lot 4 via `P3_ELIGIBLE_CONFIRMEE`/`P3_NON_ELIGIBLE`/`P3_ELIGIBILITE_INDETERMINEE`.
Ce triplet est correct pour un usage **interne/staff**, mais insuffisant pour une exposition publique :
il ne distingue pas une condition auto-déclarée par le candidat (non vérifiable par Nexus) d'une
condition confirmée par pièce, ni une décision humaine explicite d'un statut encore ouvert.

### Exigence

Avant toute exposition publique (wizard, API candidat), le modèle doit distinguer explicitement :

| État | Sens |
|---|---|
| éligibilité réglementaire calculable et confirmée | `checkSameSessionEligibility` résout `ELIGIBLE` sur des conditions `autoCheckable` uniquement — aucune saisie humaine requise |
| condition déclarée | le candidat affirme remplir une condition non auto-vérifiable (ex. situation familiale, raison médicale) |
| justificatif fourni | une pièce a été déposée à l'appui de la déclaration |
| justificatif validé | le staff a examiné et validé la pièce |
| décision humaine | un membre du staff tranche explicitement (accepte/refuse), avec identité + date, sur le même modèle que Gate 1 |
| éligibilité refusée | `NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH`, ou décision humaine défavorable |
| situation indéterminée | aucune des conditions ci-dessus n'est encore tranchée — fail-closed par défaut |

**Règle absolue** : ne jamais exposer au public un simple booléen ou un radio-bouton permettant à un
candidat de s'auto-déclarer éligible à P3 sans que ce parcours passe par le statut « condition déclarée »
et reste `necessiteVerificationHumaine: true` jusqu'à décision humaine explicite.

### Portée

Non implémenté dans ce lot. **Doit être fait avant** que `app/api/*` ou un wizard permette à un candidat
de renseigner directement les réponses de `EligibilityAnswers`.

---

## Statut de suivi

- [ ] Gate 1 — modèle `ReconductionAudit` (nom provisoire) conçu, migré, testé, wiré dans `carte.ts`.
- [ ] Gate 2 — modèle d'états P3 conçu, migré, testé, wiré dans `profile-validation.ts`.
- Les deux gates doivent être **fermés avant** le début du Lot « normalisation et API du profil »
  (§9 point 4 de la mission finale) et a fortiori avant le wizard public (point 5).
- Aucun des deux ne bloque le catalogue de services/modules (Lot 5, ce commit) ni le moteur tarifaire
  interne, car ni l'un ni l'autre n'expose `ProfilCandidat` à un candidat aujourd'hui.
