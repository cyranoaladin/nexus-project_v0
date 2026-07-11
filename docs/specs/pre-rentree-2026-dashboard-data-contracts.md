# Pré-rentrée 2026 — contrats de données dashboards

## Coexistence V1/V2

Les navigations affichent des éléments discriminés :

```ts
type StageSummary =
  | { domain: "LEGACY_STAGE"; legacyStageId: string; /* DTO legacy inchangé */ }
  | { domain: "EDITION_V2"; editionId: string; editionCode: string; /* DTO V2 */ };
```

Les query services adaptent V1 ou V2 ; aucun composant ne joint directement leurs modèles, ne transforme un ancien format en module 10 h ni ne réécrit une réservation historique. Flags distincts `public`, `api`, `dashboards` ; dashboards V1 continuent si le flag V2 est coupé.

## Dashboard administrateur

| Écran futur | DTO/source | Autorisation | États vides/erreurs | Historique/archivage |
|---|---|---|---|---|
| Éditions | résumé `AdminEditionOperationsV2Dto` | admin/grant édition | aucune édition, template non matérialisé, flag off | V1 listé séparément ; archives filtrables |
| Modules/variantes | modules/règles | admin ou pédagogie lecture | règle absente = blocage visible | versions de règle conservées |
| Cohortes/capacité | cohorts, `available` dérivé, holds/waitlist agrégés | admin/staff selon permission | DRAFT, FORMING, ressource manquante, full dérivé | terminaux et motifs visibles |
| Planning/conflits | `ScheduleV2Dto` + conflits | admin/logistique | salle/enseignant non affecté, contrainte DB traduite | remplacements/annulations visibles |
| Ressources | `RoomInventoryV2Dto`, enseignants/qualifications | admin/logistique/pédagogie selon colonne | inventaire non vérifié, équipement absent | périodes de validité |
| Demandes/propositions | application/proposal DTO admin | assistant/admin | aucune demande, qualification requise | retrait/rejet conservés |
| Inscriptions/affectations | enrollment + assignment | assistant/admin | non affecté, hold expiré, waitlist | transferts et annulations |
| Finance | payment/refund/invoice DTO | finance/admin uniquement | non payé, réconciliation, remboursement | snapshots et preuves conservés |
| Communications | communication status/template | assistant/admin, finance seulement sa finalité | queue vide, échec/dead-letter | historique multicanal cohérent |
| Arbitrages | pedagogy DTO | pédagogie/admin | aucun conflit ; conflits ouverts | supersessions et décisions |
| Audit | audit DTO paginé | permission audit/admin | filtre vide | append-only, metadata redacted |

Toute action dangereuse demande confirmation, motif, version attendue et permission ; aucun bouton ne déduit la permission du fait que l'écran est visible.

## Dashboard responsable pédagogique

| Écran | Données | Actions | Interdictions |
|---|---|---|---|
| Variantes/compatibilités | codes, objectifs, règles/version | proposer/approuver règle | aucun prix/paiement |
| Arbitrages | demande pédagogique minimisée, impact | décider/justifier/clôturer | aucune fusion silencieuse |
| Cohortes/groupes | variantes, seuils, effectifs agrégés, validations | validation pédagogique, demande dédoublement | pas de remboursement |
| Enseignants/programmes | qualifications, disponibilités nécessaires, modules | affecter/valider pédagogique | pas de coordonnées privées inutiles |
| Bilans | rapports et états de publication | relire/publier/retirer | contenus parent/élève cloisonnés |

DTO : `PedagogicalOperationsV2Dto@1`. Grant actif par édition. État vide explicite pour règles non validées, enseignant manquant et arbitrage ouvert. Les données financières sont absentes du type, pas seulement masquées en CSS.

## Dashboard coach

| Écran | DTO/champs | Autorisation | État vide |
|---|---|---|---|
| Mes cohortes | `CoachCohortV2Dto` résumé | teacher assignment actif | aucune cohorte affectée |
| Planning | séances, salle, module, statut | cohorte/séance affectée | séance annulée/remplacée |
| Liste élèves | prénom/nom, variante et besoins strictement utiles | affectation + assignment élève actif | cohorte sans affectation confirmée |
| Présences | attendance par séance | séance de sa cohorte et période | `UNKNOWN` explicite |
| Supports | documents audience COACH/COHORT | document policy | aucun support |
| Bilans | contenus coach/interne selon droit | assignment + report scope | brouillon absent/non publié |

Jamais : paiement, facture, remboursement, email/téléphone parent, relation familiale, communication financière. Un coach qui perd son affectation perd immédiatement les lectures futures ; l'audit historique reste staff.

## Dashboard parent

| Écran | DTO/champs | Autorisation | États |
|---|---|---|---|
| Enfants | identités liées, relation/droits visibles | relation `VERIFIED` active | relation à vérifier/expirée sans données enfant |
| Pré-rentrée | modules, variantes publiques, inscription/affectation | relation + droit pédagogique | demande reçue, groupe en constitution, confirmé, waitlist, annulé |
| Planning | date locale, heure, salle, enseignant, statut | relation + assignment | planning indisponible/ressource en attente |
| Paiements | total/acompte/solde dérivé, paiements/remboursements/facture | droit financier de relation | initiation, réconciliation, remboursement |
| Documents/communications | audiences parent, templates/statuts | relation + droit correspondant | document/communication absent |
| Bilans | contenu parent publié | relation + droit pédagogique | bilan en préparation |

DTO : `ParentStageV2Dto@1`, privé/no-store. Un parent avec plusieurs enfants choisit explicitement l'enfant ; l'ID est toujours re-filtré par la relation. Plusieurs responsables peuvent avoir des droits financiers différents.

## Dashboard élève

| Écran | DTO/champs | Autorisation | États |
|---|---|---|---|
| Mon planning | `StudentStageV2Dto` + `ScheduleV2Dto` | `Student.userId` propre | aucune inscription/séance annulée |
| Modules/supports/travail | labels, enseignant, documents audience STUDENT | élève propre/assignment | contenu non publié |
| Présences | statut propre | élève propre | non enregistré |
| Bilan | contenu élève publié | élève propre | en préparation/retiré |

Aucun montant, moyen de paiement, facture, remboursement ou coordonnée financière dans le DTO ou le cache. Cette politique est structurelle ; une évolution exige décision owner.

## Navigation et flags

- Une entrée « Pré-rentrée 2026 » apparaît seulement si le flag dashboards V2 est actif pour le rôle et si le query service retourne une portée.
- Les liens utilisent routes dashboard existantes ou futures centralisées, jamais le code produit comme chemin dispersé.
- Le flag public peut rester off alors que les écrans admin DRAFT sont actifs ; le flag API commande reste séparé.
- Une dépublication masque les surfaces publiques, pas l'accès contractuel parent/élève aux inscriptions existantes.

## Chargement, erreurs et accessibilité

Chaque écran définit skeleton, état vide, erreur réessayable, erreur de permission sans fuite et état de données indisponibles. Les statuts ne reposent pas uniquement sur une couleur. Pagination serveur pour listes, audit et communications ; aucune récupération intégrale des PII. Mobile 320/390 px et clavier font partie de la gate avant activation.

## Invalidation

- public : tags édition/module/cohorte/catalogue ;
- admin/pédagogie/coach/parent/élève : `no-store` par défaut, ou cache privé court explicitement revu ;
- événements outbox déclenchent invalidation ciblée après commit ;
- une modification de relation responsable ou affectation coach invalide immédiatement la portée concernée.

## Tests croisés

V1 seul, V2 seul, liste mixte, flags indépendants, archives ; parent multi-enfants/multi-responsables/droits ; coach change de cohorte ; finance absente coach/élève au niveau TypeScript et JSON ; IDOR par URL ; états vides ; navigation ; documents ; responsive/accessibilité ; aucune date rendue dans le fuseau navigateur.
