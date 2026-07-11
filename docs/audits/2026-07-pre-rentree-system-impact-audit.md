# Audit d'impact système — Pré-rentrée 2026

## Statut

**READY_FOR_OWNER_DECISION** — audit documentaire du 11 juillet 2026, sans modification applicative, Prisma, tarifaire ou de production.

Ce document complète :

- [l'audit dates et planning](2026-07-pre-rentree-date-planning-audit.md) ;
- [la spécification des 60 séances](../specs/pre-rentree-2026-planning.md) ;
- [l'ADR 004 sur le modèle pédagogique](../adr/004-pre-rentree-modules-cohortes-seances-ressources.md).

Le socle contractuel audité va du `2026-08-17` au `2026-08-28` inclus, hors week-end, dans `Africa/Tunis` : 10 jours, 12 modules, 60 séances de 2 heures et 120 heures-cours cumulées. Les cohortes conditionnelles sont hors de ces 60 séances jusqu'à dotation et validation explicites.

Les issues de capacité ou d'incompatibilité doivent employer, selon le cas, `ARBITRAGE_PEDAGOGIQUE_REQUIS`, `SECOND_GROUPE_A_PLANIFIER`, `ENSEIGNANT_SUPPLEMENTAIRE_REQUIS`, `CRENEAU_SUPPLEMENTAIRE_REQUIS` ou `LISTE_ATTENTE`. Aucune de ces issues ne vaut ouverture automatique.

## Résumé exécutif

Le dépôt possède déjà un écosystème Stage exploitable pour les anciennes éditions : catalogue public en base, séances, affectations coach, réservations, documents et bilans. Cet écosystème ne peut toutefois pas porter la Pré-rentrée 2026 sans évolution additive : il modélise une capacité et un prix globaux, ne connaît ni module, ni variante, ni cohorte, ni salle structurée, ni présence de stage, ni sélection de 1 à 4 matières.

Les risques principaux ne sont pas seulement structurels :

1. `/stages` lit le calendrier JSON alors que `/stages/[slug]`, les API et les dashboards lisent la base ; deux réalités publiques coexistent.
2. La confirmation historique d'une réservation peut créer un élève rattaché au parent technique et marquer le paiement `COMPLETED` sans preuve de paiement.
3. Le modèle `Student.parentId` autorise plusieurs enfants par parent, mais un seul responsable légal par élève.
4. La capacité est contrôlée par un comptage non transactionnel au niveau du stage ; elle n'est pas sûre lors des dernières places et ne distingue pas les matières/parcours.
5. Une affectation `StageCoach` donne au coach une visibilité au niveau du stage entier, pas de ses seules cohortes.
6. Les prix de stage existent dans le JSON canonique, dans `Stage.priceAmount`, dans `StageReservation.price`, dans les factures et dans des catalogues UI historiques. Sans contrat de frontière, une nouvelle édition amplifierait les divergences.

La recommandation est une architecture additive, versionnée et à source opérationnelle unique par enregistrement, décrite dans [l'ADR 005](../adr/005-pre-rentree-source-of-truth-and-application-integration.md).

## Méthode et preuves

- Lecture de `prisma/schema.prisma`, des migrations Stage, des services, routes, dashboards et tests.
- Cartographie statique des guards, relations, sélecteurs Prisma et contrats Zod.
- Lecture de `data/pricing.canonical.json`, `lib/pricing.ts`, `lib/pricing-client.ts`, du générateur client et de `BusinessConfig`.
- Contrôle Playwright en lecture seule de la production aux largeurs 1440, 768, 390 et 320 px.
- Lecture de l'API publique de production `/api/stages`.
- Aucun accès direct ni aucune écriture en base de production.

## Constats de production

Au 11 juillet 2026 :

- `/stages` répond 200, possède un H1 unique et ne déborde pas horizontalement à 320 px ;
- la page affiche l'ancien début au 24 août, le format 15 h, « Français (EAF) » et « Philo » ;
- `/api/stages` répond 200 et expose `printemps-2026`, terminé en avril, encore `isOpen=true`, capacité globale 12 ;
- `/stages/printemps-2026` et son formulaire d'inscription répondent encore 200 ;
- le formulaire expose l'ancien tarif 350 TND et des groupes « 6 à 12 », en conflit avec le catalogue canonique actuel ;
- cinq champs visibles du formulaire historique ne possèdent ni `id`/`htmlFor`, ni nom accessible explicite ;
- le lien-logo de navigation n'a pas de nom accessible propre au lien, bien que son image possède un `alt`.

Ces constats sont des preuves de coexistence historique, pas une autorisation à réécrire les données anciennes.

## P0 — Bloquants avant implémentation

### P0-1 — Double projection publique JSON/base

`app/stages/page.tsx` charge `stage_calendar` depuis le pricing canonique. Les fiches, inscriptions et dashboards chargent `Stage` depuis Prisma. Une édition peut donc apparaître dans une surface et être absente ou différente dans l'autre. La Pré-rentrée ne doit pas être publiée avant l'existence d'un service de composition unique.

### P0-2 — Identité et responsable légal non fiables dans le flux Stage

Le formulaire collecte un email élève/contact et un email parent optionnel, mais `parentEmail` est concaténé dans `StageReservation.notes`. La confirmation recherche/crée le compte à partir de `reservation.email`. Si aucun parent exploitable n'existe, l'élève est rattaché à `SYSTEM_PARENT_EMAIL`. La réservation n'est pas systématiquement reliée au `Student` créé. Ce flux ne peut pas servir de base à des données de mineurs.

### P0-3 — Paiement Stage sans chaîne de preuve

La confirmation staff écrit `paymentStatus = COMPLETED` sans `Payment` ni `Invoice` vérifié. À l'inverse, le moteur de paiement sécurisé ne connaît pas les nouveaux produits Pré-rentrée. Il faut séparer confirmation pédagogique, confirmation de cohorte et paiement effectif.

### P0-4 — Capacité et dernière place non transactionnelles

Le flux public exécute successivement `count` puis `create`. Deux requêtes concurrentes peuvent obtenir la même dernière place. Le calcul se fait sur `Stage.capacity`, pas sur module/cohorte/variante. Le conflit d'unicité historique remonte potentiellement comme erreur 500.

### P0-5 — Modèle opérationnel incomplet

Aucun modèle ne porte module, variante, cohorte, salle, inscription par matière, présence de stage, arbitrage ou audit Stage. Une valeur factice dans les champs globaux historiques créerait une surcharge sémantique durable.

### P0-6 — Périmètre coach trop large pour le futur domaine

`StageCoach` affecte un coach au stage entier. `/api/coach/stages` retourne toutes les réservations confirmées du stage, y compris noms et emails. La Pré-rentrée exige une visibilité limitée aux cohortes effectivement affectées et aux seules données pédagogiques nécessaires.

### P0-7 — Un seul responsable légal par élève

`ParentProfile.children` est un-à-plusieurs et `Student.parentId` obligatoire. Un parent gère plusieurs enfants, mais un élève ne peut pas avoir plusieurs responsables. Toute future association multi-responsables nécessite une évolution additive et des guards fondés sur la relation, sans supprimer immédiatement `parentId`.

## P1 — Risques importants

- Les statuts `status` String et `richStatus` enum coexistent dans `StageReservation` et peuvent diverger.
- Les dashboards parent/élève retrouvent encore certaines réservations par email, ce qui casse après changement d'adresse ou utilisation de l'email parent.
- `Stage.priceAmount` et `StageReservation.price` utilisent Decimal/Float alors que la facturation canonique travaille en millimes entiers.
- Les routes de séance vérifient seulement `endAt > startAt` ; pas de collision coach/salle, limite quotidienne, durée, période ou fuseau.
- `CoachAvailability` porte des heures sous forme de chaînes et référence `User`, tandis que les séances de stage référencent `CoachProfile`.
- Aucune salle structurée ni aucun équipement n'existe.
- `StageBilan` est unique par stage/élève, donc incapable de produire un bilan par module si cela devient nécessaire.
- `StageDocument` connaît le stage et éventuellement une séance, mais pas la cohorte, le module ou une audience par inscription.
- Les notifications Stage utilisent email/Telegram ad hoc ; aucun outbox, journal multicanal ou clé d'idempotence de campagne n'existe.
- Le Telegram public contient actuellement nom et email d'un mineur/contact.
- Le moteur `getNextStage` filtre sur la date de début et perd une édition en cours.
- Le formatage des heures utilise souvent le fuseau implicite du navigateur.
- `BusinessConfig` peut surcharger les seuils, acomptes, remises et planchers issus du JSON ; la hiérarchie effective doit être figée pour la Pré-rentrée.
- Les API `/api/student/stages`, `/api/eleve/stages` et le payload agrégé du dashboard élève se recouvrent sans contrat unique.
- Le formulaire Stage public possède rate-limit et Zod strict, mais pas les mêmes protections de taille/CSRF/honeypot que le bilan gratuit.
- Le HTML des emails Stage est assemblé avec des données utilisateur sans helper d'échappement commun.

## P2 — Dette et consolidation

- Plusieurs composants `app/stages/_components` et une FAQ avec horaires historiques ne sont pas utilisés par la page active.
- Les métadonnées sont déclarées à la fois dans `app/stages/page.tsx` et `app/stages/layout.tsx`.
- Le dashboard admin permet de saisir manuellement prix, capacité, dates, matières et lieu.
- `app/dashboard/admin/facturation/page.tsx` contient un catalogue historique de montants et groupes codés en dur.
- Les analytics ne possèdent pas d'événements normalisés pour sélection de pack, qualification, attente et confirmation.
- Les tests Stage couvrent plusieurs guards, mais pas le workflow multi-matières, la concurrence réelle, le fuseau ni la compatibilité historique V1/V2.

## Cartographie des modèles existants

| Modèle | Rôle actuel et relations | Réutilisable | Insuffisances/risques | Migration future |
|---|---|---|---|---|
| `User` | Identité unique par email, rôle unique, profils parent/élève/coach | Authentification et rattachement vérifié | Un email ne peut porter deux rôles ; téléphone non unique/non vérifié | Non pour le cœur ; services de liaison à ajouter |
| `ParentProfile` | Profil d'un User PARENT, possède plusieurs `Student` | Parent principal et dashboards | Pas de co-responsable | Oui, relation additive responsable–élève |
| `Student` | Entité élève canonique, niveau, parcours, spécialités, parent obligatoire | Élève cible des inscriptions | `specialties` ne distingue pas option Maths ; parent unique | Oui, champs/relations additifs ou profil académique versionné |
| `CoachProfile` | Profil enseignant, matières JSON, séances et stages | Ressource enseignante | Qualification non typée par niveau ; `subjects` JSON | Probable, habilitations structurées |
| `CoachAvailability` | Disponibilités User récurrentes/spécifiques | Signal de disponibilité | Heures String, pas de fuseau/bloc, identité User vs CoachProfile | Adapter ou remplacer pour les cohortes |
| `Stage` | Édition historique globale | Conserver les anciens stages | Prix/capacité/niveaux/matières globaux | Ne pas réinterpréter ; compatibilité V1 |
| `StageSession` | Séance datée du Stage, coach et lieu texte | Historique et documents | Pas de module/cohorte/salle/contrainte | Nouveau modèle ou relation additive V2 |
| `StageCoach` | Affectation coach au Stage | Historique | Périmètre trop large | Affectation future au niveau cohorte |
| `StageReservation` | Lead/réservation globale, statut legacy+riche, snapshot prix | Historique, piste de reprise | Identités en texte/email, notes semi-structurées, pas de matières | Nouveau flux V2 ; backfill contrôlé seulement |
| `StageDocument` | Document stage/séance public ou privé | Stockage et métadonnées | Pas d'audience cohorte/module | Relations d'audience additives |
| `StageBilan` | Bilan unique stage/élève/coach | Historique | Pas de module ; contenu interne dans même agrégat | Adapter vers Bilan canonique ou nouvelle portée |
| `Bilan` | Modèle pédagogique canonique, peut référencer un Stage | Fortement réutilisable | Portée module/cohorte absente | Relation additive à l'inscription/module si décidée |
| `SessionBooking` | Séances unitaires, présence, notifications, exclusion coach | Référence de patterns | Mauvaise unité métier pour un groupe Stage | Ne pas surcharger ; réutiliser les patterns |
| `SessionReport` | Rapport et présence d'une SessionBooking | Référence UX/validation | Non relié à StageSession | Nouveau relevé de présence de cohorte |
| `Payment` | Paiement utilisateur, idempotence externe, preuve CGV | Oui via lien explicite | Float TND ; aucun lien Stage V2 | Lien/junction et snapshot produit nécessaires |
| `ClicToPayTransaction` | Transaction prestataire | Réutilisable lorsque activée | Initialisation encore 501 | Aucun contournement manuel |
| `Invoice`/`InvoiceItem` | Montants en millimes, bénéficiaire, événements | Oui, modèle financier préféré | Items manuels possibles ; pas de lien inscription direct | Lien à commande/inscription et codes produit |
| `Entitlement` | Droits issus des lignes de facture | Éventuellement pour ressources numériques | Registre stage limité à anciens codes Maths/NSI | Nouveaux codes seulement si droit numérique requis |
| `Notification` | Notification staff générique sans FK User | Partiellement | Types String, données JSON, pas d'idempotence | Préférer outbox/journal dédié |
| `SessionNotification` | Notification idempotente d'une SessionBooking | Pattern utile | Incompatible StageSession | Reproduire le pattern, pas la relation |
| `CoachStudentAssignment` | Autorise le coach sur un élève | Utile pour suivi hors stage | Ne limite pas à une cohorte | L'affectation de cohorte reste obligatoire |
| `BusinessConfig`/`Audit` | Overrides runtime versionnés | Gouvernance existante | Peut contredire le catalogue versionné | Exclure les prix Pré-rentrée ou publier explicitement |

## Authentification et autorisations

### Points solides

- Guards centralisés `requireAuth`, `requireRole`, `requireAnyRole`.
- Politique RBAC déclarative et helpers d'ownership parent/coach/élève.
- Tests IDOR des bilans et tests de projection sans tokens/mots de passe.
- Inscription publique stricte : Zod `.strict()`, rate-limit, réponse minimale, prix ignoré côté client.
- Paiement par virement catalogue-first pour les produits qu'il connaît.

### Gaps pour la Pré-rentrée

- Les guards parent reposent sur `Student.parentId`, donc ne reconnaissent pas plusieurs responsables.
- Le coach est autorisé par stage et non par cohorte.
- L'association par email remplace encore une relation d'inscription dans plusieurs lectures.
- La confirmation réservation/identité/paiement n'est pas une transaction de domaine cohérente.
- Aucun audit Stage append-only ne consigne qui a qualifié, fusionné, affecté, déplacé, remboursé ou communiqué.
- Aucun rôle ne doit obtenir implicitement une permission parce qu'il connaît un identifiant ; toutes les nouvelles routes `[id]` devront filtrer dans la requête.

## Dashboards

| Surface | Existant | Manques Pré-rentrée | Risque de régression |
|---|---|---|---|
| Admin | CRUD Stage global, séances, coachs, bilans, KPI estimé | Éditions V2, modules, cohortes, salles, conflits, capacités, paiements, arbitrages, audit | La modification des DTO V1 casserait la page monolithique |
| Assistante | Liste des stages, réservations, confirmation, calendrier global | Qualification famille, variantes, seuil, communication, remboursement, dédoublement | Le bouton confirmer utilise le flux identité/paiement fragile |
| Coach | Stages affectés, séances, tous les confirmés, bilans | Seulement ses cohortes, présence, supports, parcours nécessaires | Une réutilisation de `StageCoach` exposerait d'autres cohortes |
| Parent | Enfants, réservations par email, séances/documents, bilans publiés | Choix par enfant, statut par module/cohorte, acompte/solde, communication | Email synthétique élève et parent technique masquent des réservations |
| Élève | Payload agrégé stages, page dédiée bilans, fiche simple | Emploi du temps personnel, salle, enseignant, supports, présence, bilan module | Trois chemins de lecture Stage peuvent diverger |

## Frontend public

- **Accueil :** affiche un repère « Stage Intensif » issu du pricing client, mais sans édition opérationnelle.
- **Navbar :** lien `/stages` générique ; mise à jour éditoriale possible sans logique métier locale.
- **`/stages` :** calendrier JSON et prix de format ; n'utilise pas `/api/stages`.
- **`/offres` :** source pricing canonique, mais formats historiques et passes annuels doivent rester inchangés.
- **`/bilan-gratuit` :** flux public transactionnel, mais crée immédiatement parent et élève ; il ne doit pas être copié tel quel pour une demande Stage bas-friction.
- **Inscription Stage :** formulaire 3 étapes sur une édition DB historique, sans choix multi-matières/variantes.
- **Fiche Stage :** détail DB, capacité/prix globaux, programme de séances.
- **FAQ/WhatsApp :** contenus génériques ou historiques dispersés ; aucun journal de version de message.
- **SEO :** pas de données structurées spécifiques à la Pré-rentrée ; metadata doublonnée.
- **Responsive :** aucun débordement observé de 1440 à 320 px sur les pages testées.
- **Accessibilité :** H1 unique, mais labels de formulaire et nom accessible du lien-logo à corriger dans une future phase.
- **Analytics :** GA global existe ; aucun contrat d'événements Stage métier.

## Backend/API

### Réutilisable

- projections explicites des API staff ;
- validation Zod ;
- rate-limit public ;
- guards de rôles ;
- transaction sérialisable et idempotence déjà appliquées au paiement générique ;
- patterns de contrainte d'exclusion sur `SessionBooking` ;
- factures en millimes et événements append-only.

### À ne pas réutiliser sans correction

- `count` puis `create` pour réserver une place ;
- prix/capacité envoyés à l'admin puis persistés librement ;
- statut de paiement écrit par confirmation de réservation ;
- détection doublon uniquement par email ;
- notes texte pour stocker email parent et consentements ;
- emails/Telegram ad hoc sans outbox ;
- disponibilité dérivée d'une capacité globale ;
- séances créées sans validateur de planning.

## Tarification

Le catalogue canonique définit : groupe max 5, seuil Stage 3, plancher Stage 45 TND/h, acompte Stage 30 %, arrondi 10 TND et remises non cumulables plafonnées. `lib/pricing.ts` centralise les calculs et protège les composants client du JSON complet.

Deux écarts doivent être arbitrés :

1. `BusinessConfig` peut surcharger ces règles à l'exécution ; la Pré-rentrée doit pinner une version/checksum de règles ou interdire ces overrides.
2. `Stage.priceAmount`, la facturation admin historique et les produits de paiement constituent d'autres catalogues de fait. Les montants historiques restent des snapshots, mais aucun nouveau prix ne doit être créé depuis ces surfaces.

L'analyse financière des hypothèses 480/900/1350/1800 TND se trouve dans [les décisions métier](../specs/pre-rentree-2026-business-decisions.md).

## Anciens stages et compatibilité

Les formats 9, 12, 15, 18, 20 et 30 heures sont légitimes historiquement dans `stage_formats`. `intensif-renfort` reste un produit 15 h. La future Pré-rentrée ne doit :

- ni renommer ces identifiants ;
- ni recalculer leurs prix, acomptes ou factures ;
- ni convertir leurs capacités globales en capacité par cohorte ;
- ni réécrire leurs séances ou bilans ;
- ni modifier les réservations historiques à partir du nouveau formulaire.

Une lecture unifiée devra retourner un discriminant `LEGACY_STAGE` ou `EDITION_V2`. Une même édition métier ne pourra exister dans les deux sources. Le stage Printemps 2026 encore ouvert doit faire l'objet d'une décision d'exploitation séparée, pas d'une correction opportuniste dans cette mission.

## Recommandation

1. Valider les huit décisions métier.
2. Accepter l'ADR 005 et le contrat de sources de vérité.
3. Geler les frontières de fichiers/équipes.
4. Préparer une migration additive et un feature flag, sans toucher aux anciens stages.
5. N'autoriser l'implémentation qu'après fourniture du coût enseignant, des équipements et de la politique de remboursement.

## Références

- [Décisions métier](../specs/pre-rentree-2026-business-decisions.md)
- [Carte d'impact](../specs/pre-rentree-2026-system-impact-map.md)
- [Contrat de sources de vérité](../specs/pre-rentree-2026-source-of-truth-contract.md)
- [Intégration utilisateurs et dashboards](../specs/pre-rentree-2026-user-dashboard-integration.md)
- [Stratégie de migration](../specs/pre-rentree-2026-migration-strategy.md)
- [Matrice de tests](../specs/pre-rentree-2026-test-matrix.md)
- [Carte de propriété des fichiers](../specs/pre-rentree-2026-file-ownership-map.md)
