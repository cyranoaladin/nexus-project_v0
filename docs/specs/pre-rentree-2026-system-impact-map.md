# Carte d'impact système — Pré-rentrée 2026

## Statut

Architecture cible proposée, non implémentée. À lire avec [l'ADR 005](../adr/005-pre-rentree-source-of-truth-and-application-integration.md).

## Vue d'ensemble cible

```text
pricing.canonical.json ──> PricingService ───────────────┐
                                                         │ composition serveur
template versionné ──> seed/upsert idempotent ──> DB ──> PublicStageQuery ──> DTO public
                                              │          Admin/Role queries ─> DTO RBAC
                                              └────────> audit/outbox/payment
```

Le template n'est jamais lu par le frontend. La base devient la vérité opérationnelle après l'upsert. Le service de pricing résout le prix côté serveur et produit un devis versionné ; le client ne transmet que des codes et choix.

## Frontières d'architecture

| Couche | Responsabilité | Source autorisée | Interdit |
|---|---|---|---|
| Catalogue/pricing | Produits, prix, règles commerciales | `data/pricing.canonical.json` via `lib/pricing.ts` | Prix client, montant local, import JSON direct |
| Template campagne | Définition initiale des 12 modules et 60 séances | Fichier versionné validé + schéma Zod | Lecture frontend, état d'inscription |
| Domaine Stage V2 | Invariants, états, ouverture, capacité, conflits | Services de domaine | Logique dans composants/routes |
| Opérations | Éditions, cohortes, séances, ressources, inscriptions | Base de données | Relecture dynamique du template comme vérité |
| Identité | Parent/élève/responsable vérifiés | `User`/profils/relations | Liaison par email non vérifié seul |
| Paiement | Devis, acompte, facture, remboursement | Services serveur + DB financière | `paymentStatus` manuel sans preuve |
| Contenu | Libellés et messages partagés | Configuration éditoriale typée | Copies divergentes par canal |
| Présentation | Rendu public et dashboards | DTO propres à chaque audience | Prisma/JSON/template dans le client |

## Cartographie base de données

### Agrégats historiques à préserver

- `Stage`, `StageSession`, `StageCoach`, `StageReservation`, `StageDocument`, `StageBilan`.
- Formats et réservations 9/12/15/18/20/30 h.
- Factures, paiements, bilans et documents existants.

Ils restent en lecture/maintenance V1 jusqu'à une migration historique distincte. Leur sens ne change pas.

### Agrégats futurs probables

Noms conceptuels, non validés comme noms Prisma :

- `StageEdition` : édition V2, période, fuseau, checksum/template, feature flag métier.
- `StageModule` : niveau × matière, libellé, semaine/bloc et produit.
- `StageVariant` : voie/EDS/option/parcours.
- `StageCohort` et `StageCohortVariant` : groupe réellement ouvert et compatibilité approuvée.
- `StageRoom` et `StageRoomRequirement` : salle/capacité/équipements.
- `StageTeacherAssignment` : cohorte, enseignant, habilitation.
- `StageCohortSession` : cinq occurrences datées.
- `StageApplication` : demande publique sans compte obligatoire.
- `StageApplicationChoice` : 1 à 4 modules et variantes.
- `StageEnrollment` : affectation confirmée d'un élève à une cohorte.
- `StudentGuardian` : plusieurs responsables avec rôle/autorité/état de vérification.
- `StageAttendance` : présence élève × séance.
- `StagePriceQuote` : snapshot du calcul et version catalogue.
- `StageAuditEvent` : journal append-only.
- `StageCommunication`/outbox : messages multicanaux idempotents.

Les noms et contraintes seront validés avant toute modification Prisma.

## Cartographie API existante et cible

| API existante | Usage actuel | Impact cible |
|---|---|---|
| `GET /api/stages` | Catalogue DB V1 public | Projection unifiée discriminée ou endpoint V2 séparé derrière flag |
| `GET /api/stages/[stageSlug]` | Détail V1 | DTO V1 conservé ; nouvelle édition via query service unifié |
| `POST /api/stages/[stageSlug]/inscrire` | Réservation globale | Ne pas étendre ; nouvelle demande multi-matières idempotente |
| `GET /api/stages/[slug]/reservations` | PII staff | Projection V1 conservée ; nouvelles demandes via API staff V2 |
| `POST .../confirm` | Crée/lie identité et marque paiement | Déprécier pour V2 ; commandes séparées de qualification, cohorte et paiement |
| `GET/POST .../bilans` | Bilans Stage V1 avec guard | Conserver ; scopes module/cohorte pour V2 |
| `/api/admin/stages/**` | CRUD global V1 | Ne pas casser ; nouveaux endpoints/contrats V2 |
| `/api/coach/stages` | Stages entiers du coach | V2 doit filtrer par cohorte et minimiser la PII |
| `/api/parent/stages` | Réservations des enfants par email | V2 par enrollment/student/guardian vérifié |
| `/api/student/stages` | Réservations par email + bilans | Remplacer dans V2 par Student.id et DTO personnel |
| `/api/eleve/stages` | Bilans Stage uniquement | Fusionner fonctionnellement dans le contrat dashboard, pas forcément supprimer immédiatement |
| `/api/payments/**` | Paiements génériques hors nouveau Stage | Ajouter produit/devis Stage côté serveur, jamais montant client |

### Commandes V2 recommandées

- créer une demande publique avec clé d'idempotence ;
- qualifier identité/parcours ;
- calculer/recalculer un devis serveur ;
- enregistrer/accepter un acompte ;
- affecter une ressource ;
- ouvrir/confirmer/annuler une cohorte ;
- inscrire/désinscrire un élève ;
- placer en liste d'attente ;
- enregistrer une présence ;
- publier un document/bilan ;
- déclencher une communication depuis outbox ;
- initier/valider un remboursement.

Chaque commande possède un guard, un schéma Zod, une transaction et un événement d'audit.

## Cartographie des dashboards

### Administrateur

**Réutiliser :** navigation, tables, dialogs, calendrier, factures, utilisateurs.

**Ajouter :** vue édition V2, modules, cohortes, conflits, ressources, seuils, décisions, paiements/remboursements, audit.
**Ne pas faire :** ajouter des champs V2 au formulaire global V1 ou permettre prix/capacité libres.

### Assistante

**Réutiliser :** liste, planning, fiches élève, notifications, paiement.

**Ajouter :** file de qualification, choix matières, statut par cohorte, actions contrôlées, communications.
**Risque :** le bouton « confirmer » actuel déclenche trop d'effets et ne doit pas être utilisé en V2.

### Coach

**Réutiliser :** calendrier, rapports, documents et présence des sessions comme patterns.

**Ajouter :** seulement ses cohortes, variantes, liste minimale d'élèves, présence, supports, bilan.
**Interdit :** email parent, prix, paiement, autres cohortes.

### Parent

**Réutiliser :** enfants, factures, ressources, bilans.

**Ajouter :** modules choisis, cohorte, calendrier, acompte/solde, communications et complétion de dossier.
**Guard :** relation responsable–élève vérifiée, pas `parentId` seul à terme.

### Élève

**Réutiliser :** carte Stage, ressources, bilans.

**Ajouter :** emploi du temps personnel, salle, enseignant, présence, travail.
**Masquer :** données financières et familiales non nécessaires.

## Cartographie frontend public

| Surface | État actuel | Impact futur |
|---|---|---|
| `/` | Repère Stage générique | CTA et édition active depuis DTO serveur |
| Navbar | Lien Stage générique | Aucun état métier local ; lien stable |
| `/stages` | Calendrier/prix JSON | Landing opérationnelle composée DB + pricing + contenu |
| `/offres` | Catalogue pricing | Ajouter produits validés sans modifier formats historiques |
| `/bilan-gratuit` | Crée parent+élève | Ne pas réutiliser comme demande Stage ; seulement CTA alternatif |
| `/stages/[slug]` | Fiche V1 DB | Projection discriminée V1/V2 |
| inscription | Formulaire global | Wizard niveau/parcours/matières/devis/demande |
| cartes/FAQ | Contenus dispersés | Contenu partagé typé et données opérationnelles |
| WhatsApp/email | Messages ad hoc | Templates versionnés + journal de communication |
| SEO | Metadata générique | dates/lieu/FAQ cohérents, JSON-LD depuis DTO serveur |
| analytics | GA global | événements métier sans PII |

## Cartographie du flux de données cible

### Consultation

1. Le serveur charge l'édition V2 visible depuis la base.
2. Il résout les produits depuis le pricing canonique.
3. Il compose un DTO public sans identifiants internes sensibles.
4. Le frontend affiche disponibilités dérivées et contenu partagé.
5. Si une source manque, le paiement/CTA concerné se ferme ; aucun fallback historique.

### Demande publique

1. Le client envoie codes publics de niveau/modules/variantes, contact légal et clé d'idempotence.
2. Le serveur recharge édition/modules depuis la base.
3. Il valide parcours, compatibilité et période.
4. Il calcule le devis depuis le catalogue, ignore tout montant client.
5. Une transaction crée demande, choix, snapshot devis et événement d'audit.
6. Une outbox planifie l'accusé de réception.

### Qualification et ouverture

1. Staff qualifie identité/parcours.
2. Le domaine agrège les demandes compatibles.
3. Le seuil ne crée pas automatiquement une cohorte.
4. Les ressources sont contrôlées sur les cinq séances.
5. Une transaction atomique ouvre cohorte, séances et affectations.

### Paiement

1. Le paiement référence le devis immuable et le parent vérifié.
2. Le serveur détermine montant/acompte/solde.
3. La validation financière crée facture et événement.
4. L'inscription devient confirmable seulement si les gates pédagogiques, logistiques et financiers sont satisfaits.

## Données sensibles et minimisation

| Audience | Données autorisées | Données interdites |
|---|---|---|
| Public | édition, modules, horaires, places agrégées | noms, emails, demandes individuelles |
| Parent | ses enfants, choix, paiement, messages | autres familles/cohortes nominatives |
| Élève | son planning, supports, présence, bilan | données financières familiales par défaut |
| Coach | ses cohortes, élèves affectés, besoins pédagogiques nécessaires | paiements, contacts familiaux non nécessaires |
| Assistante | qualification, logistique, paiement selon rôle | secrets/tokens/mots de passe |
| Admin | opérations et audit | secrets techniques, tokens bruts |

## Dépendances et ordre logique

1. Décisions métier et codes produits.
2. Contrat de sources de vérité et DTO.
3. Modèle additif + template/upsert + validateur.
4. Identité/guards et finance.
5. APIs V2 derrière feature flag.
6. Dashboards internes.
7. Frontend public.
8. Migration/requalification des leads.
9. Tests complets, dry run, validation owner.
10. Activation progressive ; aucune fusion/push automatique.

## Références

- [Audit système](../audits/2026-07-pre-rentree-system-impact-audit.md)
- [Sources de vérité](pre-rentree-2026-source-of-truth-contract.md)
- [Utilisateurs et dashboards](pre-rentree-2026-user-dashboard-integration.md)
- [Migration](pre-rentree-2026-migration-strategy.md)
- [Propriété des fichiers](pre-rentree-2026-file-ownership-map.md)
