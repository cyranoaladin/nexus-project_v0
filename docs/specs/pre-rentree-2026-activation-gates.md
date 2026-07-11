# Pré-rentrée 2026 — gates d'activation

## Statut

- Date : 11 juillet 2026
- Phase : planification exécutable M0–M3
- Publication : **BLOCKED**
- Développement DRAFT : autorisable après conception physique et mission explicite
- Référence de décision : [OWNER-022](../decisions/pre-rentree-2026-owner-approval.md#owner-022--conditions-de-publication)

## Statuts

| Statut | Sens |
|---|---|
| `APPROVED` | preuve documentaire présente et décision enregistrée |
| `DESIGN_BASELINE_DEFINED` | contrat de conception arrêté, sans implémentation ni preuve de production |
| `IMPLEMENTATION_PLAN_DEFINED` | tâches, owners, tests et rollback arrêtés ; aucune implémentation prouvée |
| `VERIFIED_IN_TEST` | implémentation et preuves vertes en environnement isolé ; production non validée |
| `PENDING_EVIDENCE` | décision connue, preuve technique/opérationnelle absente |
| `OWNER_INPUT_REQUIRED` | donnée que seul le responsable peut fournir |
| `APPROVED_PENDING_LEGAL_TEXT_ALIGNMENT` | principe approuvé, texte contractuel non aligné |
| `IMPLEMENTED_ON_MAIN_PENDING_DEDICATED_REVIEW` | socle fusionné sur main, revue dédiée Pré-rentrée non encore exécutée |
| `BLOCKED` | condition bloquante en échec explicite |

Une gate `APPROVED` peut redevenir bloquante si son SHA, sa version, sa preuve ou la décision associée change.

## Gates de gouvernance et de baseline

| Identifiant | Propriétaire | Preuve attendue | Statut | Condition de blocage | Date de validation | Mécanisme concerné |
|---|---|---|---|---|---|---|
| `GATE-GOV-001` | `RESPONSABLE_NEXUS` | OWNER-001 à OWNER-022 enregistrées | `APPROVED` | décision manquante ou contradictoire | 2026-07-11 | registre owner/ADR |
| `GATE-BASE-001` | `SOL` | SHA `origin/main`, merge-base et diff documentés | `APPROVED` | baseline distante inconnue | 2026-07-11 | Git/worktree/audit de dérive |
| `GATE-ADR-001` | `RESPONSABLE_NEXUS` | ADR 005 reliée à OWNER-017/018 | `APPROVED` | source de vérité non acceptée | 2026-07-11 | architecture V2 |
| `GATE-CODES-001` | `SOL` + `TERRA` | registre exhaustif des segments `{LEVEL}/{SUBJECT}/{VARIANT}` | `PENDING_EVIDENCE` | code ambigu, dupliqué ou local | — | types/template/catalogue |
| `GATE-STATUS-001` | `SOL` | registre unique des états/transitions et mapping des anciens libellés | `PENDING_EVIDENCE` | statut local, double enum ou transition implicite | — | domaine/DB/DTO |

Les trois premières gates autorisent seulement la prochaine phase de **conception physique**. Elles n'autorisent aucune publication.

## Gates financières et commerciales

| Identifiant | Propriétaire | Preuve attendue | Statut | Condition de blocage | Date de validation | Mécanisme concerné |
|---|---|---|---|---|---|---|
| `GATE-FIN-001` | `RESPONSABLE_NEXUS` | coûts enseignant, salle, matériel, supports, admin, paiement/remboursement | `OWNER_INPUT_REQUIRED` | une valeur requise reste inconnue | — | unit economics |
| `GATE-FIN-002` | `RESPONSABLE_NEXUS` | marge brute et contributive cibles approuvées à 3/4/5 élèves | `OWNER_INPUT_REQUIRED` | marge cible absente ou seuil > 5 élèves | — | décision de publication |
| `GATE-PRICE-001` | `TERRA` | produits `PRE2026_PACK_1` à `PRE2026_PACK_4` dans le catalogue canonique et getters | `PENDING_EVIDENCE` | prix absent, divergent ou import JSON direct | — | pricing canonique |
| `GATE-PRICE-002` | `SOL` | recalcul serveur, plancher, remises non cumulables, prix client ignoré | `PENDING_EVIDENCE` | montant navigateur accepté ou plancher franchi | — | `StagePricingService`/API |
| `GATE-DEPOSIT-001` | `SOL` | acompte 30 %, arrondi canonique, solde exact, preuve liée à l'inscription | `PENDING_EVIDENCE` | constante frontend, paiement orphelin ou somme divergente | — | pricing/paiement/facture |
| `GATE-CANNIB-001` | `RESPONSABLE_NEXUS` | comparaison approuvée avec offres annuelles et règles de Carte Nexus | `OWNER_INPUT_REQUIRED` | offre saisonnière cannibalise ou remise ambiguë | — | catalogue/positionnement |

## Gates juridiques et remboursement

| Identifiant | Propriétaire | Preuve attendue | Statut | Condition de blocage | Date de validation | Mécanisme concerné |
|---|---|---|---|---|---|---|
| `GATE-LEGAL-001` | `RESPONSABLE_JURIDIQUE` | CGV : seuil, date du 10 août, remboursement par défaut, report écrit | `APPROVED_PENDING_LEGAL_TEXT_ALIGNMENT` | texte absent ou contradictoire | — | CGV/formulaire/devis |
| `GATE-LEGAL-002` | `RESPONSABLE_JURIDIQUE` | délai d'initiation du remboursement, recommandé ≤ 5 jours ouvrés | `APPROVED_PENDING_LEGAL_TEXT_ALIGNMENT` | délai non contractuel ou indéfini | — | remboursement/communication |
| `GATE-CONSENT-001` | `SOL` | preuve versionnée des modalités Stage et du traitement des données | `PENDING_EVIDENCE` | consentement absent, global ou non prouvable | — | demande/devis/audit |
| `GATE-RETENTION-001` | `RESPONSABLE_JURIDIQUE` | politique de rétention leads, inscriptions, finances, présences, documents | `OWNER_INPUT_REQUIRED` | conservation/suppression non définie | — | archivage/anonymisation |

## Gates pédagogiques

| Identifiant | Propriétaire | Preuve attendue | Statut | Condition de blocage | Date de validation | Mécanisme concerné |
|---|---|---|---|---|---|---|
| `GATE-PED-001` | `RESPONSABLE_PEDAGOGIQUE` | matrice versionnée des variantes et compatibilités | `PENDING_EVIDENCE` | fusion sans règle ou objectifs incompatibles | — | qualification/cohorte |
| `GATE-PED-002` | `RESPONSABLE_PEDAGOGIQUE` | règles Terminale `specialties`/`mathOption` et cas exceptionnels | `PENDING_EVIDENCE` | trois EDS ou combinaison incohérente acceptée | — | validation déclarative |
| `GATE-PED-003` | `RESPONSABLE_PEDAGOGIQUE` | terminologie Seconde/Première/Terminale relue | `PENDING_EVIDENCE` | présence de « EDS NSI Seconde », « EAF Terminale » ou d'un libellé ambigu | — | contenu/DTO/template |
| `GATE-PED-004` | `RESPONSABLE_PEDAGOGIQUE` | différenciation documentée pour chaque fusion autorisée | `PENDING_EVIDENCE` | tronc commun non justifié | — | version de compatibilité/audit |

## Gates enseignants, salles et équipements

| Identifiant | Propriétaire | Preuve attendue | Statut | Condition de blocage | Date de validation | Mécanisme concerné |
|---|---|---|---|---|---|---|
| `GATE-STAFF-001` | `RESPONSABLE_PEDAGOGIQUE` | enseignants nommés, qualifiés et affectés aux cohortes | `OWNER_INPUT_REQUIRED` | enseignant ou qualification absent | — | affectations/transition cohorte |
| `GATE-STAFF-002` | `RESPONSABLE_LOGISTIQUE` | disponibilités sur les cinq séances et charge ≤ 6 h/jour | `OWNER_INPUT_REQUIRED` | collision, retour ou surcharge | — | validateur planning |
| `GATE-ROOM-001` | `RESPONSABLE_LOGISTIQUE` | salles Mutuelleville, capacités et disponibilités | `OWNER_INPUT_REQUIRED` | salle absente, capacité < cohorte ou > 2 salles simultanées | — | ressources/planning |
| `GATE-NSI-001` | `RESPONSABLE_LOGISTIQUE` | postes, comptes, réseau, alimentation, logiciels, plan de secours | `OWNER_INPUT_REQUIRED` | inventaire ou test technique absent | — | requirements salle NSI/SNT |
| `GATE-PC-001` | `RESPONSABLE_PEDAGOGIQUE` | décision expérimental vs théorique/méthodologique | `OWNER_INPUT_REQUIRED` | modalité pédagogique non précisée | — | module Physique-Chimie |
| `GATE-PC-002` | `RESPONSABLE_LOGISTIQUE` | inventaire, consommables et sécurité si expérimental | `PENDING_EVIDENCE` | matériel requis non disponible/sécurisé | — | requirements/sécurité |

## Gates données, migration et intégration

| Identifiant | Propriétaire | Preuve attendue | Statut | Condition de blocage | Date de validation | Mécanisme concerné |
|---|---|---|---|---|---|---|
| `GATE-SCHEMA-001` | `SOL` | conception physique et [plan M1–M3](../plans/2026-07-pre-rentree-m0-m3-implementation-plan.md) revus, sans suppression V1 | `IMPLEMENTATION_PLAN_DEFINED` | surcharge V1, relation manquante ou opération destructive | 2026-07-11 (plan) | Prisma/SQL futur |
| `GATE-TEMPLATE-001` | `SOL` | template validé, versionné, checksum, 12 modules/60 séances | `PENDING_EVIDENCE` | divergence ou lecture frontend directe | — | loader/upsert |
| `GATE-UPSERT-001` | `SOL` | deuxième upsert = zéro création et mutation inattendue | `PENDING_EVIDENCE` | doublon édition/module/séance | — | transaction/contraintes uniques |
| `GATE-MIG-001` | `SOL` | migration additive testée sur base test et copie anonymisée | `PENDING_EVIDENCE` | perte/requalification V1 ou rollback impraticable | — | Prisma/SQL/backfill |
| `GATE-ARCHIVE-001` | `SOL` | archivage logique et protection contre hard delete en cascade | `PENDING_EVIDENCE` | suppression d'engagement, présence ou document | — | statuts/FK/service commande |
| `GATE-FLAG-001` | `SOL` | flags distincts API/public/dashboards, désactivés par défaut | `PENDING_EVIDENCE` | un flag modifie prix ou casse V1 | — | `BusinessConfig` allowlist |

## Gates sécurité, identité et paiement

| Identifiant | Propriétaire | Preuve attendue | Statut | Condition de blocage | Date de validation | Mécanisme concerné |
|---|---|---|---|---|---|---|
| `GATE-SEC-BASE-001` | `SOL` | [socle minimal V2 défini](../audits/2026-07-pre-rentree-security-baseline.md) + [réconciliation](../audits/2026-07-pre-rentree-current-main-security-reconciliation.md), SHA d'implémentation G-SEC/G-PAY, tests IDOR et audit de routes | `IMPLEMENTED_ON_MAIN_PENDING_DEDICATED_REVIEW` | bloque toute activation V2 ; socle fusionné mais revue dédiée Pré-rentrée non exécutée ; politiques parent M:N bloquées jusqu'à M3 | 2026-07-11 (réconciliation) | guards fail-closed, politiques ABAC, tests API |
| `GATE-RBAC-001` | `SOL` | matrice admin/parent/élève/coach/assistante, 401/403/404 et IDOR | `PENDING_EVIDENCE` | accès hors famille/cohorte/académie | — | guards/query scopes |
| `GATE-ID-001` | `SOL` | multi-responsables, vérification, révocation, fusion auditée | `PENDING_EVIDENCE` | liaison automatique par email/téléphone | — | identité/relations/audit |
| `GATE-CAPACITY-001` | `SOL` | tests transactionnels de cinquième/sixième place | `PENDING_EVIDENCE` | surcapacité ou double enrollment | — | verrou/Serializable/unique |
| `GATE-PAY-001` | `SOL` | paiement catalogue-first, idempotent, preuve et facture cohérentes | `PENDING_EVIDENCE` | statut payé sans transaction prouvée | — | payment/invoice/outbox |
| `GATE-PAY-002` | `SOL` | webhook fail-closed avec secret obligatoire et rejeu dédupliqué | `PENDING_EVIDENCE` | secret absent accepté ou double effet | — | ClicToPay/webhook |
| `GATE-PRIVACY-001` | `SOL` + `LUNA` | aucune PII mineur dans logs, Telegram, analytics ou erreurs | `PENDING_EVIDENCE` | payload/identité exposé | — | logs/outbox/analytics |

## Gates frontend, dashboards et qualité

| Identifiant | Propriétaire | Preuve attendue | Statut | Condition de blocage | Date de validation | Mécanisme concerné |
|---|---|---|---|---|---|---|
| `GATE-DTO-001` | `SOL` | DTO serveur publics et par rôle, `LEGACY_STAGE`/`EDITION_V2` | `PENDING_EVIDENCE` | Prisma/JSON direct ou finance exposée | — | query services/API |
| `GATE-DASH-001` | `LUNA` | quatre dashboards cohérents, finance limitée admin/parent | `PENDING_EVIDENCE` | divergence ou accès coach/élève financier | — | dashboards/RBAC |
| `GATE-PUBLIC-001` | `TERRA` | `/stages/pre-rentree-2026` et redirection `/pre-rentree` sous flag | `PENDING_EVIDENCE` | ancienne date, prix local ou route incohérente | — | Next routes/SEO |
| `GATE-NAV-001` | `TERRA` | accès en un clic depuis navbar, accueil, `/stages`, `/offres` | `PENDING_EVIDENCE` | lien cassé ou page activée trop tôt | — | navigation/feature flag |
| `GATE-A11Y-001` | `LUNA` | clavier, lecteur d'écran, labels, contrastes | `PENDING_EVIDENCE` | défaut bloquant WCAG ou formulaire non nommé | — | Playwright/axe |
| `GATE-MOBILE-001` | `LUNA` | 320 px, 390 px, tablette, desktop sans overflow | `PENDING_EVIDENCE` | CTA/formulaire/planning inutilisable | — | E2E responsive |
| `GATE-NRG-001` | `LUNA` + `SOL` | tests V1, formats historiques, auth, pricing annuel, dashboards | `PENDING_EVIDENCE` | une donnée ou surface V1 change de sens | — | non-régression |
| `GATE-TEST-001` | `LUNA` | matrice complète domaine/API/pricing/UI verte | `PENDING_EVIDENCE` | scénario P0 rouge/skippé | — | CI/test matrix |
| `GATE-PREVIEW-001` | `RESPONSABLE_NEXUS` | preview DRAFT relue et acceptée | `PENDING_EVIDENCE` | contenu, prix, planning ou CTA non approuvé | — | environnement preview |

## Gates communication, exploitation et rollback

| Identifiant | Propriétaire | Preuve attendue | Statut | Condition de blocage | Date de validation | Mécanisme concerné |
|---|---|---|---|---|---|---|
| `GATE-COMM-001` | `RESPONSABLE_NEXUS` | inventaire segmenté des familles anciennes dates | `OWNER_INPUT_REQUIRED` | famille engagée non identifiée | — | requête/audit admin |
| `GATE-COMM-002` | `RESPONSABLE_NEXUS` | message coordonné email/WhatsApp/dashboard/admin | `PENDING_EVIDENCE` | canal contradictoire ou droits incomplets | — | contenu/outbox/journal |
| `GATE-ROLLBACK-001` | `SOL` | désactivation API/public/dashboards répétée en test | `PENDING_EVIDENCE` | rollback exige suppression de données | — | flags/runbook |
| `GATE-BACKUP-001` | `SOL` | sauvegarde/restauration testée avant migration | `PENDING_EVIDENCE` | absence de restauration vérifiée | — | DB/runbook |
| `GATE-OBS-001` | `SOL` + `LUNA` | métriques erreurs, paiements, doublons, attentes, outbox | `PENDING_EVIDENCE` | incident non détectable ou logs avec PII | — | observabilité |
| `GATE-RELEASE-001` | `RESPONSABLE_NEXUS` | toutes gates publication approuvées et décision finale horodatée | `PENDING_EVIDENCE` | une gate requise n'est pas `APPROVED` | — | release record/flags |

## Règle de passage

### Gates d'implémentation M0–M3

| Identifiant | Preuve attendue | Statut | Bloque |
|---|---|---|---|
| `GATE-M0A-SECURITY-001` | [plan sécurité recadré M0A-R](../plans/pre-rentree-2026-m0a-security-implementation-plan.md), revue des hardenings G-SEC/G-PAY, fermeture des écarts, tests | `IMPLEMENTATION_PLAN_DEFINED` | toute route V2 jusqu'à `VERIFIED_IN_TEST` |
| `GATE-M0B-DB-001` | [capacité DB](../plans/pre-rentree-2026-m0b-database-capability-plan.md), preuves PG15/extension/fallback | `IMPLEMENTATION_PLAN_DEFINED` | M1 deploy et M2 |
| `GATE-M0C-TOOLCHAIN-001` | [plan Prisma](../plans/pre-rentree-2026-m0c-prisma-toolchain-plan.md), Node20/Prisma6.19.2/drift | `IMPLEMENTATION_PLAN_DEFINED` | création migration M1 |
| `GATE-M0D-TEST-001` | [environnement test](../plans/pre-rentree-2026-m0d-test-environment-plan.md), lanes fresh/V1 | `IMPLEMENTATION_PLAN_DEFINED` | validation M1–M3 |
| `GATE-M1-CORE-001` | 21 modèles, 19 enums, DDL additif | `IMPLEMENTATION_PLAN_DEFINED` | M2/M3 |
| `GATE-M2-INTEGRITY-001` | claim, checks, indexes, exclusions/concurrence | `IMPLEMENTATION_PLAN_DEFINED` | services de capacité/planning |
| `GATE-M3-GUARDIAN-001` | relation M:N, backfill candidat, policies/IDOR | `IMPLEMENTATION_PLAN_DEFINED` | inscription/lecture parent V2 |

Ces statuts prouvent seulement que le travail est planifié. Chaque ligne revient à `PENDING_EVIDENCE` si sa baseline ou son contrat change, puis passe à `VERIFIED_IN_TEST` uniquement avec SHA et sorties de tests.

1. La conception physique peut commencer avec `GATE-GOV-001`, `GATE-BASE-001` et `GATE-ADR-001` approuvées.
2. Une branche DRAFT peut être développée seulement dans une phase explicitement autorisée, flags désactivés.
3. Une cohorte ne passe à `CONFIRMED` que si les gates pédagogiques, ressources, capacité et identité qui la concernent sont approuvées.
4. Aucun paiement public n'est activé avant les gates pricing, acompte, juridique et paiement.
5. `GATE-RELEASE-001` ne peut devenir `APPROVED` par calcul automatique : le responsable Nexus signe la publication après revue des preuves.

## Rollback d'une gate

Toute preuve est référencée par SHA, version, date et propriétaire. Si le code, le catalogue, le template, les CGV ou les ressources changent, les gates dépendantes retournent à `PENDING_EVIDENCE` jusqu'à nouvelle validation.
