# ADR — Dette tracée : `RECONDUCTION_AUTOMATIQUE_CONFIRMEE` et P3 avant API/wizard

**STATUS = CLOSED (2026-08-26, recâblage mission §3).** Les deux gates sont fermées en code, migrées et
testées avant toute API/wizard public — voir §"Statut de suivi" pour les SHA et fichiers exacts.

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

## Statut de suivi — CLOSED

- [x] **Gate 1** — `ReconductionAudit` (`lib/exams/parcours.ts`), champ optionnel additif
  `ConservedNoteInput.reconductionAudit`. `lib/exams/carte.ts::resolveConservedLine` exige
  `reconductionAudit?.statutVerification === 'VERIFIEE'` avant de résoudre `RECONDUCTION_AUTOMATIQUE_
  CONFIRMEE` — tout le reste (absent/NON_VERIFIEE/REFUSEE) fail-close comme INDETERMINE. Nouveau code de
  validation `NOTE_RECONDUCTION_NON_VERIFIEE` (WARNING, bloquant) dans `lib/exams/profile-validation.ts`.
  Aucune migration Prisma nécessaire : `notesConservees` était déjà `Json?`, le champ s'ajoute dans la
  forme JSON existante.
- [x] **Gate 2** — `P3EligibiliteAudit[]` (`lib/exams/parcours.ts`), nouveau champ
  `ProfilCandidatInput.p3EligibiliteAudit` + colonne Prisma `ProfilCandidat.p3EligibiliteAudit Json?`
  (migration `20260826100000_add_p3_eligibilite_audit`). `deriveEligibilityAnswersFromAudit()` est
  désormais la SEULE façon de produire un `EligibilityAnswers` pour `checkSameSessionEligibility` côté
  pipeline (`lib/quotes/pipeline.ts`) — un motif ne devient `true` que si `decision === 'CONFIRMEE'` par
  un staff ; `faitsDeclares` seul ne suffit jamais, y compris pour les conditions `autoCheckable` (aucune
  vérification automatique réelle n'existe dans ce système aujourd'hui).
- Les deux gates sont fermées **avant** le câblage de l'API de profil publique et du wizard (aucun des
  deux n'existe encore) — la fermeture anticipée évite qu'elles soient oubliées une fois ce câblage
  commencé.
- Normalisation (`lib/exams/normalize.ts`) : `p3EligibiliteAudit`/`notesConservees[].reconductionAudit`
  restent strictement staff-only (`StaffCandidateInputExtension`) — un formulaire public ne peut jamais
  les soumettre directement.
- Tests : `__tests__/lib/exams/carte.test.ts` (3 cas), `__tests__/lib/exams/parcours.test.ts` (3 cas),
  `__tests__/lib/exams/profile-validation.test.ts` (2 cas), golden files mis à jour
  (`__tests__/lib/quotes/pipeline.golden.test.ts`).
