# Contrat de sources de vérité et de non-hardcoding — Pré-rentrée 2026

## Statut

**APPROVED — contrat normatif accepté par OWNER-016 et OWNER-017 le 11 juillet 2026.**

L'acceptation autorise la conception physique. Les prix approuvés ne sont pas encore présents dans le catalogue et restent non publiables avant les [gates financières](pre-rentree-2026-activation-gates.md).

## Principes

1. Une donnée possède une source d'autorité explicite par phase de son cycle de vie.
2. Une copie historique versionnée n'est pas une seconde autorité : elle est un snapshot immuable avec version/checksum.
3. Le client n'est jamais fiable pour prix, capacité, statut, identité liée ou permission.
4. Le template crée l'état ; il ne le pilote plus après upsert.
5. Les valeurs dérivables sont calculées par un service unique.
6. Une donnée absente ferme l'action concernée ; aucun fallback silencieux vers une ancienne campagne.

## Sources de vérité

### Catalogue et tarifs

**Autorité :** `data/pricing.canonical.json`.

**Accès serveur :** getters/services de `lib/pricing.ts`.

**Accès client Pré-rentrée :** DTO serveur calculé, jamais import direct du JSON. La projection pricing générée existante peut rester utilisée par les surfaces historiques qui en dépendent, sans devenir la source PR26.
**Écriture :** processus catalogue versionné, review métier et tests de plancher/échéancier.

Les montants de `Stage`, `StageReservation`, `Payment`, `InvoiceItem` et devis sont des snapshots opérationnels/historiques. Ils ne définissent pas le prix courant.

`BusinessConfig` constitue aujourd'hui une capacité d'override des règles pricing. OWNER-016 fige pour la Pré-rentrée :

- aucun override runtime ne peut modifier un prix produit ;
- les règles effectives utilisées au calcul sont résolues par un service unique ;
- la version et le checksum des règles sont enregistrés dans le devis ;
- les overrides génériques doivent exclure explicitement les produits Pré-rentrée ; une modification contractuelle passe uniquement par le catalogue et son processus de publication ;
- l'interface ne peut annoncer « source canonique » tout en utilisant silencieusement un override DB.

`BusinessConfig` peut porter les feature flags et options opérationnelles non contractuelles autorisées. Il ne peut redéfinir prix, acompte, remise, dates, horaires, durée, capacité, seuil, codes produits, matières, niveaux ou règles académiques. Tout conflit échoue explicitement.

### Données opérationnelles

**Autorité après création :** base de données.

Elle porte édition, modules activés, variantes, cohortes ouvertes, ressources, séances, demandes, inscriptions, capacités snapshot, liste d'attente, paiements, présences, documents, communications et audit.

Le frontend ne déduit jamais qu'une cohorte existe depuis un module de template ou un prix de catalogue.

### Gabarit de campagne

**Recommandation :** fichier versionné déclaratif + upsert idempotent + DB opérationnelle.

Contrat approuvé :

- fichier futur `data/stages/pre-rentree-2026.template.json` ;
- schéma Zod et type TypeScript dans un loader serveur ;
- `templateId`, `templateVersion`, `schemaVersion` et checksum SHA-256 ;
- identifiants naturels stables pour édition, modules et séances ;
- transaction d'upsert ;
- contraintes uniques empêchant double édition/séance ;
- mode dry-run affichant créations/mises à jour/refus ;
- refus si une donnée opérationnelle modifiée diverge sans stratégie explicite ;
- aucun import depuis `app/**` ou `components/**`.

Identifiants approuvés par OWNER-009 : édition `PRE_RENTREE_2026`, packs `PRE2026_PACK_1` à `PRE2026_PACK_4`, modules selon `PRE2026_{LEVEL}_{SUBJECT}_{VARIANT}`. Le registre exhaustif des segments est une sortie de conception physique ; aucun segment ne doit être inventé localement avant cette validation.

Après le premier upsert réussi, la base est l'autorité. Une nouvelle version de template produit une migration déclarative contrôlée, jamais une réinitialisation.

### Contenus éditoriaux

**Recommandation :** configuration typée versionnée pour les libellés/copies stables, combinée aux données DB pour les faits opérationnels.

Les titres publics de modules, explications de parcours, FAQ et modèles de messages partagent des clés de contenu. Les dates, horaires, places, enseignants et tarifs ne sont pas du contenu : ils viennent des services métier.

Un CMS n'est pas recommandé pour cette édition avant qu'un workflow de validation, version et rollback existe. Des fichiers typés sont plus auditables à court terme.

## Contrat de non-hardcoding

| Catégorie | Source canonique | Type/contrat futur | Service de lecture/calcul | Validation et tests | Donnée absente |
|---|---|---|---|---|---|
| Dates d'édition | DB issue du template | `CivilDate`, `StageEditionDTO` | `StageEditionQuery` | Zod + bornes + jours ouvrés | Édition non publiable |
| Horaires/blocs | DB issue du template | `StageBlockCode`, instant ISO + timezone | `StageScheduleService` | 120 min, transitions, collisions | Séance/cohorte non confirmable |
| Fuseau | DB/template | union IANA validée | `StageTimeService` | `Africa/Tunis` attendu pour PR26 | Refus, jamais fuseau navigateur |
| Durée séance | Dérivée `end-start` | `DurationMinutes` | `StageScheduleService` | exactement 120 pour PR26 | Refus |
| Nombre séances | Dérivé des séances actives | entier | `StageMetricsService` | 5/module, 60 socle | État incomplet |
| Volume horaire | Dérivé des durées | minutes/heures | `StageMetricsService` | 10 h/matière, 40 h max | Prix/confirmation bloqués |
| Capacité max/min | Snapshot DB issu des règles validées | `CohortCapacityPolicy` | `CohortCapacityService` | 3 ≤ effectif ≤ 5 | Cohorte non ouvrable |
| Prix | Pricing canonique | `ProductCode`, `MoneyMillimes` | `StagePricingService` | plancher, version, checksum | Pas de paiement, pas d'ancien prix |
| Acompte/solde | Dérivés du prix/règles | `PaymentSchedule` | `computeDeposit`/service Stage | somme exacte, arrondi | Paiement bloqué |
| Remises | Pricing canonique + décision enregistrée | `DiscountCode`, règle | service pricing unique | non-cumul, cap, plancher | aucune remise implicite |
| Identifiants module | DB/template, transmis par DTO | branded IDs/codes | query service | format + existence édition | 400/404 sobre |
| Identifiants cohorte | DB uniquement | branded ID | query service | scope édition/module | aucune création implicite |
| Salles/équipements | DB opérationnelle | `RoomDTO`, requirements | `ResourcePlanningService` | capacité/équipement/collision | cohorte non confirmable |
| Enseignants/habilitations | DB opérationnelle | `TeacherAssignmentDTO` | `ResourcePlanningService` | rôle, habilitation, charge | cohorte non confirmable |
| Matières/niveaux | Catalogue pédagogique typé + module DB | unions TypeScript/enum DB | `StageModuleService` | matrice PR26 | refus du module inconnu |
| Voies/EDS/options | règles pédagogiques versionnées | unions discriminées | `AcademicQualificationService` | invariants Terminale/Première | arbitrage requis |
| Statuts | Domaine partagé | unions/enums + machine d'état | services de commande | transitions autorisées | refus, jamais fallback String |
| Libellés partagés | contenu typé | clés de traduction/contenu | `StageContentService` | toutes les clés au build | surface non publiée |
| Places disponibles | dérivé des enrollments/holds | entier | `CohortCapacityService` transactionnel | concurrence/dernière place | afficher indisponible |
| Statut complet | dérivé capacité/holds | booléen | même service | pas de booléen persisté | indisponible |
| Charges enseignant/élève | dérivées des séances/inscriptions | minutes | `PlanningValidator` | plafonds 360/240 | conflit explicite |
| Jours de présence | dérivé `StageAttendance` | compteur | `AttendanceService` | une présence/élève/séance | « non renseigné », pas absent |

## Types obligatoires

- unions discriminées pour `LEGACY_STAGE` vs `EDITION_V2` ;
- branded types pour `EditionId`, `ModuleId`, `CohortId`, `ApplicationId` ;
- `MoneyMillimes` entier aux frontières financières ;
- `CivilDate` distinct d'un instant ISO ;
- `IanaTimeZone` validé ;
- `StagePlanningStatus` et `StageApplicationStatus` partagés ;
- `TerminaleAcademicProfile` avec `specialties` et `mathOption` séparés ;
- DTO par audience, jamais type Prisma sérialisé directement.
- codes d'édition, pack et module validés par un registre central typé, jamais par comparaison de chaînes locale.

## Services uniques

| Service conceptuel | Responsabilité exclusive |
|---|---|
| `StagePricingService` | Résoudre produit, pack, remise, acompte, solde, snapshot |
| `StageScheduleService` | Construire/formatter dates et blocs dans le fuseau édition |
| `PlanningValidator` | Collisions, charges, salles, équipements, week-end |
| `CohortCapacityService` | Holds, places, seuil, dernière place, attente |
| `AcademicQualificationService` | Parcours, EDS, options et compatibilités |
| `StageIdentityLinkService` | Liaison demande ↔ responsable ↔ élève vérifiés |
| `StageCommandService` | Transitions transactionnelles et audit |
| `StageQueryService` | DTO publics et dashboards selon audience |
| `StageCommunicationService` | Templates, outbox, idempotence, journal |

Les noms sont conceptuels et pourront être adaptés, mais une responsabilité ne doit pas être dupliquée.

## Valeurs dérivées et exceptions

### Toujours dérivées

- nombre de séances et matières ;
- volume horaire et durée réelle ;
- total pack, acompte, solde ;
- places restantes et état complet ;
- charge enseignant/élève ;
- jours/ratio de présence.

### Snapshots justifiés

- prix/devis accepté, pour preuve contractuelle ;
- capacité/seuil appliqués à une cohorte, pour préserver la règle au moment de l'ouverture ;
- version/checksum template, pricing et compatibilité ;
- libellé de facture et identité client au moment d'émission ;
- message envoyé et version de template, pour audit.

Un snapshot est immuable, daté et relié à sa version. Il ne remplace jamais le catalogue courant.

### Données explicitement stockées même si partiellement dérivables

- début/fin civile d'édition : engagement commercial pouvant inclure jours sans séance ;
- statut de workflow : résultat d'une décision/transition, pas simple calcul ;
- présence par séance : fait observé ;
- affectation enseignant/salle : décision opérationnelle.

## Politique d'absence et d'erreur

- **Prix absent :** pas de devis/paiement ; message « tarif non disponible », alerte admin.
- **Cohorte absente :** demande possible seulement si produit autorise « groupe en constitution » ; aucune confirmation.
- **Enseignant/salle absent :** statut de ressource requis, pas de fallback générique.
- **Timezone absent :** validation bloquante.
- **Variante inconnue :** `ARBITRAGE_PEDAGOGIQUE_REQUIS`.
- **Contenu manquant :** build/seed en échec ; ne pas afficher une ancienne copie.
- **Version/checksum différent :** dry-run et arbitrage, jamais écrasement automatique.
- **Service DB indisponible :** état d'erreur sobre ; ne pas servir le template comme vérité de secours.

## Règles frontend/backend

- Les composants reçoivent uniquement des DTO.
- Les routes ne contiennent aucune table de prix, horaire, statut ou libellé partagé.
- Les dashboards n'implémentent pas de transitions métier localement.
- Le serveur recalcule tout prix et toute disponibilité à la soumission.
- Les erreurs ne renvoient ni PII, ni stack, ni chemin, ni token.
- Les dates s'affichent avec `timeZone: edition.timeZone`.
- Aucune constante métier locale n'est admise sans commentaire d'exception et test.

## Guards automatisés attendus

- scan AST/grep renforcé des prix, dates, codes modules, statuts et horaires dans `app/`/`components/` ;
- test interdisant l'import du template par une entrée client ;
- test de synchronisation pricing client généré ;
- test d'exhaustivité des labels/enums ;
- test checksum template ↔ seed DB en environnement de test ;
- test interdisant `new Date(...).toLocale...` sans timezone dans le domaine Stage V2 ;
- test interdisant les montants client dans les commandes de paiement Stage.

## Références

- [Décisions métier](pre-rentree-2026-business-decisions.md)
- [Carte d'impact](pre-rentree-2026-system-impact-map.md)
- [Matrice de tests](pre-rentree-2026-test-matrix.md)
- [Décisions owner](../decisions/pre-rentree-2026-owner-approval.md)
- [Gates d'activation](pre-rentree-2026-activation-gates.md)
- [Audit de dérive de main](../audits/2026-07-pre-rentree-main-drift-audit.md)
