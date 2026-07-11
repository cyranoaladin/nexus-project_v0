# Pré-rentrée 2026 — carte de propriété des fichiers

## Statut et objectif

- Date : 11 juillet 2026
- Statut : **APPROVED comme contrat de propriété futur — aucune implémentation autorisée dans cette phase**
- Objet : permettre des lots Sol/Terra/Luna sans écriture concurrente, source dupliquée ni ordre de fusion implicite.

Cette carte ne donne aucune autorisation d'implémenter. Elle prépare le futur découpage. Les chemins marqués « futur » n'existent pas nécessairement et leurs noms devront être confirmés lors de la revue de conception.

Références : [ADR 005](../adr/005-pre-rentree-source-of-truth-and-application-integration.md), [décisions owner](../decisions/pre-rentree-2026-owner-approval.md), [audit de dérive](../audits/2026-07-pre-rentree-main-drift-audit.md), [contrat des sources](./pre-rentree-2026-source-of-truth-contract.md), [gates](./pre-rentree-2026-activation-gates.md) et [matrice de tests](./pre-rentree-2026-test-matrix.md).

## 1. Mandats

| Propriétaire | Mandat exclusif |
|---|---|
| **Sol** | architecture domaine, sécurité/RBAC, règles critiques, transactions, capacité, identité et revue xhigh de Prisma/SQL/paiement |
| **Terra** | implémentation infra/Prisma déléguée par lot sous revue Sol ; catalogue/pricing, contenu éditorial, frontend public, SEO, analytics et conversion |
| **Luna** | intégration des quatre dashboards, navigation authentifiée, accessibilité et recette E2E transverse |

« Propriétaire » signifie responsable de l'écriture et de la revue du périmètre, pas propriétaire de la décision métier. Toute décision reste soumise au responsable Nexus.

## 2. Règles d'écriture

1. Un fichier n'a qu'un propriétaire d'écriture par phase.
2. Un consommateur demande un contrat au propriétaire ; il ne modifie pas le producteur pour contourner un manque.
3. Aucun cherry-pick partiel de migration, de catalogue ou de DTO.
4. Aucun agent ne modifie `data/pricing.canonical.json`, `prisma/schema.prisma`, une migration ou un guard hors de son mandat.
5. Les fichiers historiques spécialisés (`eaf-stage-printemps`, `maths-premiere-stage-printemps`, `nsi-pratique-2026`) sont gelés sauf test de compatibilité explicitement justifié.
6. Le répertoire public et les dashboards ne lisent ni le template, ni Prisma, ni le JSON canonique directement.
7. Les conflits de fichiers transverses sont résolus séquentiellement par le propriétaire indiqué, jamais par deux branches en parallèle.

## 3. Phases et ordre de fusion

| Ordre | Phase | Condition d'entrée | Propriétaire principal |
|---:|---|---|---|
| 0 | décisions | OWNER-001 à OWNER-022 et ADR 005 acceptées | responsable Nexus |
| 1 | contrats commerciaux et domaine | catalogue, types, invariants et DTO approuvés | Terra puis Sol |
| 2 | stockage et services derrière flags | migration additive, upsert, API privées et tests | Sol |
| 3 | dashboards derrière flags | API stables et fixtures V1/V2 disponibles | Luna |
| 4 | frontend public derrière flag | API publique et catalogue publiables | Terra |
| 5 | recette transverse | tous les lots intégrés sur branche de recette | Luna |
| 6 | activation | gates G0 à G5 verts et décision de publication | responsable Nexus |

L'ordre « Terra puis Sol » de la phase 1 signifie : Terra publie les identifiants produits et règles via l'API de `lib/pricing.ts`; Sol ne code aucun prix et consomme ce contrat. La landing page Terra n'est fusionnée qu'en phase 4.

Toute future branche repart d'un `origin/main` fraîchement fetché. Sol traite d'abord `GATE-SEC-BASE-001` : les invariants de sécurité de `g-sec/api-guards` sont désormais fusionnés sur main (`b2ea32f0b`, `ac02f548b`). La revue dédiée Pré-rentrée (M0A-R) vérifiera leur adéquation aux exigences V2.

## 4. Carte Sol — domaine, données et API

| Fichier ou dossier | Phase | Droit d'écriture | Dépendances | Interdictions | Fusion |
|---|---:|---|---|---|---:|
| `prisma/schema.prisma` | 2 | Sol exclusif | ADR acceptée, revue données | aucune suppression/requalification V1 | 2 |
| `prisma/migrations/<future_additive_pr26>/` | 2 | Sol exclusif | sauvegarde/test, schéma revu | aucun SQL destructif, aucun backfill non idempotent | 2 |
| `data/stages/pre-rentree-2026.template.json` (futur) | 1 | Sol exclusif | planning validé, codes pricing Terra | ni prix, ni PII, ni lecture frontend | 1b |
| `lib/stages/pre-rentree/**` (futur) | 1-2 | Sol exclusif | types, Zod, ADR 004/005 | aucune constante métier locale non sourcée | 1b-2 |
| `lib/stages/admin-schemas.ts` | 2 | Sol exclusif | schémas V2 | ne pas assouplir V1 sans test | 2 |
| `lib/stages/capacity.ts` | 2 | Sol exclusif | transaction/capacité V2 | aucun `count` puis `create` non atomique | 2 |
| `lib/stages/inscription-schema.ts` | 2 | Sol exclusif | contrat public | collecte minimale, aucun prix client fiable | 2 |
| `lib/stages/public.ts` | 2 | Sol exclusif | composition DB/pricing/contenu | aucun accès direct JSON dans le routeur | 2 |
| `lib/auth/**`, `lib/rbac*`, guards associés | 2 | Sol exclusif ciblé | matrice RBAC/IDOR | aucune permission large pour débloquer l'UI | 2 |
| guards/date civile/documents/webhook identifiés par le drift | 1-2 | Sol exclusif ciblé | `GATE-SEC-BASE-001` | ne pas copier aveuglément depuis `11ac38c` | avant toute API V2 |
| `app/api/stages/**` | 2 | Sol exclusif | services V2 et DTO | aucune logique de prix/capacité locale | 2 |
| `app/api/admin/stages/**` | 2 | Sol exclusif | autorisations admin, audit | aucune mutation dangereuse sans transaction/audit | 2 |
| `app/api/coach/stages/route.ts` | 2 | Sol exclusif | affectations de cohorte | pas de finance/PII familiale superflue | 2 |
| `app/api/parent/stages/route.ts` | 2 | Sol exclusif | relations légales vérifiées | pas de recherche d'autorité par email seul | 2 |
| `app/api/student/stages/route.ts` | 2 | Sol exclusif | identité élève liée | pas de dépendance à l'email courant | 2 |
| `app/api/eleve/stages/route.ts` | 2 | Sol exclusif | décision de consolidation API | aucune seconde logique divergente | 2 |
| `app/api/*/dashboard/route.ts` | 2 | Sol exclusif pour DTO | contrats Luna | ne pas incorporer de rendu ou libellé UI | 2 |
| `app/api/payments/**`, `lib/payments/**` | 2 | Sol exclusif ciblé | produit canonique, devis accepté | pas de statut payé sans preuve financière | 2 |
| `app/api/invoices/**`, `lib/invoice/**` | 2 | Sol exclusif ciblé | écritures paiement, snapshot | ne pas recalculer facture historique | 2 |
| commande d'upsert PR26 (futur) | 2 | Sol exclusif | template, checksum, transaction | pas de seed général modifié sans nécessité | 2 |
| `scripts/seed-e2e-db.ts` ou équivalent | 2 | Sol exclusif ciblé | fixtures Luna définies | pas de données réelles | 2 |
| `__tests__/lib/stages/**` | 1-2 | Sol exclusif | invariants et services | ne pas recopier les règles commerciales | 1b-2 |
| `__tests__/api/stages/**`, `__tests__/api/admin.stages*` | 2 | Sol exclusif | routes V2 | pas de mocks masquant transactions/IDOR | 2 |
| tests pricing côté serveur de confiance | 2 | Sol, avec fixtures Terra | API pricing | aucun montant littéral hors cas approuvé | 2 |
| tests concurrence, idempotence, migration et RBAC | 2 | Sol exclusif | vraie base de test | aucun skip sur les scénarios P0 | 2 |

## 5. Carte Terra — pricing et expérience publique

| Fichier ou dossier | Phase | Droit d'écriture | Dépendances | Interdictions | Fusion |
|---|---:|---|---|---|---:|
| `data/pricing.canonical.json` | 1 | Terra exclusif, dans une phase future | OWNER-003, gates financières et mission explicite | aucune publication avant marge/coûts validés | 1a |
| `lib/pricing.ts` | 1 | Terra exclusif | JSON canonique | conserver l'encapsulation, aucun import client direct | 1a |
| `lib/pricing-client.ts` ou équivalent | 1 | Terra exclusif | getters publics minimaux | aucune règle de confiance financière client | 1a |
| `data/pricing-client-data.generated.json` | 1 | générateur Terra uniquement | catalogue validé | aucune édition manuelle | 1a |
| `data/stage-calendar-client.json` | 1/4 | Terra exclusif pour retrait/migration | service public V2 disponible | ne pas maintenir une seconde vérité PR26 | 4 |
| générateurs/validateurs pricing | 1 | Terra exclusif | schéma canonique | aucun bypass de plancher/arrondi | 1a |
| `app/stages/page.tsx`, `app/stages/layout.tsx` | 4 | Terra exclusif | API publique Sol | aucune date/prix/capacité locale | 4 |
| `app/stages/Stages2026Page.tsx` | 4 | Terra exclusif | contenu et DTO | pas de lecture template/DB/JSON directe | 4 |
| `app/stages/_components/**` | 4 | Terra exclusif | design system | aucun libellé métier partagé local | 4 |
| `app/stages/_data/content.ts` | 4 | Terra exclusif | contenu approuvé | aucun fait opérationnel ou tarif | 4 |
| `app/stages/_lib/business-config.ts` | 1/4 | Terra exclusif | décision `BusinessConfig` | aucune priorité silencieuse sur le canonique | 1a/4 |
| `app/stages/_lib/constants.ts` | 4 | Terra exclusif | contrat non-hardcoding | aucune constante métier PR26 | 4 |
| `app/stages/[stageSlug]/page.tsx` | 4 | Terra exclusif | vue publique Sol | préserver le rendu V1 discriminé | 4 |
| `app/stages/pre-rentree-2026/page.tsx` (futur) | 4 | Terra exclusif | DTO public Sol, gates publication | aucune date/prix/capacité locale | 4 |
| `app/pre-rentree/**` ou configuration de redirection (futur) | 4 | Terra exclusif | route canonique disponible | aucune seconde landing indépendante | 4 |
| `app/stages/[stageSlug]/inscription/page.tsx` | 4 | Terra exclusif | API demande Sol | pas de création de compte obligatoire | 4 |
| `components/stages/PublicStageCard.tsx` | 4 | Terra exclusif | DTO public | aucune date/prix de secours | 4 |
| `components/stages/StageInscriptionForm.tsx` | 4 | Terra exclusif | Zod/erreurs API | pas de PII en analytics ou URL | 4 |
| autres `components/stages/**` publics | 4 | Terra exclusif | contrats UI | ne pas modifier composants dashboard Luna | 4 |
| `app/offres/**` | 4 | Terra exclusif ciblé | getters pricing | aucune régression catalogue annuel | 4 |
| `app/page.tsx`, `app/HomePageClient.tsx` | 4 | Terra exclusif ciblé | publication PR26 | ne pas annoncer une cohorte non ouverte | 4 |
| `components/layout/CorporateNavbar.tsx` | 4 | Terra exclusif ciblé | navigation approuvée | pas de lien avant disponibilité | 4 |
| `components/sections/homepage/content.ts` | 4 | Terra exclusif ciblé | contenu éditorial | aucun ancien calendrier dupliqué | 4 |
| `app/bilan-gratuit/**` | 4 | Terra ciblé uniquement si CTA | décision de tunnel | ne pas refondre le domaine bilan dans ce lot | 4 |
| métadonnées/JSON-LD/analytics stages | 4 | Terra exclusif | composition serveur | aucune PII et aucune disponibilité inventée | 4 |
| `__tests__/lib/pricing-*`, `__tests__/pricing-*` | 1 | Terra exclusif | catalogue | tester plancher, arrondi, remises, génération | 1a |
| tests composants/pages publics stages/offres | 4 | Terra exclusif | fixtures DTO Sol | ne pas masquer les états absents/erreur | 4 |

## 6. Carte Luna — dashboards et recette transverse

| Fichier ou dossier | Phase | Droit d'écriture | Dépendances | Interdictions | Fusion |
|---|---:|---|---|---|---:|
| `app/dashboard/admin/stages/**` | 3 | Luna exclusif | API admin Sol | aucune mutation DB directe | 3 |
| `app/dashboard/assistante/stages/**` | 3 | Luna exclusif si rôle retenu | décision permissions | ne pas assimiler assistante à admin | 3 |
| `app/dashboard/coach/stages/**` | 3 | Luna exclusif | API coach Sol | pas de finance/données familiales inutiles | 3 |
| vues stage dans `app/dashboard/parent/**` (futur) | 3 | Luna exclusif | API parent Sol | aucune donnée d'une autre famille | 3 |
| vues stage dans `app/dashboard/eleve/**` | 3 | Luna exclusif | API élève Sol | finance selon décision produit uniquement | 3 |
| `components/dashboard/eleve/EleveStages.tsx` | 3 | Luna exclusif | DTO élève | ne pas reconstruire les statuts | 3 |
| composants stage parent/admin/coach (futurs) | 3 | Luna exclusif | DTO par rôle | aucune autorisation supposée côté UI | 3 |
| navigation authentifiée par rôle | 3 | Luna exclusif ciblé | routes disponibles | aucune entrée inaccessible ou rôle inventé | 3 |
| `components/stages/WeeklyCalendar.tsx` | 3 | Luna exclusif si partagé dashboards | heures/séances DTO | Terra utilise le contrat, n'édite pas ce fichier | 3 |
| `lib/dashboard/student-payload.ts` | 3 | lecture Luna, écriture Sol | demande de DTO documentée | Luna ne modifie pas la source API | 2 avant 3 |
| `__tests__/components/dashboard/**` | 3 | Luna exclusif | fixtures V1/V2 | aucune donnée métier littérale divergente | 3 |
| nouveaux tests dashboard admin/coach/parent/élève | 3 | Luna exclusif | API et RBAC Sol | aucun mock contournant l'isolation | 3 |
| `e2e/auth/*pre-rentree*` (futur) | 5 | Luna exclusif | environnement intégré | aucune donnée de production | 5 |
| `e2e/auth/accessibility-dashboards.spec.ts` | 5 | Luna exclusif ciblé | écrans stabilisés | ne pas affaiblir les contrôles existants | 5 |
| tests responsive 320/390/tablette stages | 5 | Luna exclusif | frontend Terra | pas de snapshots seuls comme preuve | 5 |
| tests de navigation/rôles/IDOR E2E | 5 | Luna, cas API P0 relus par Sol | fixtures multi-famille | aucun secret ou identifiant réel | 5 |
| rapport de recette et checklist rollback | 5 | Luna exclusif | gates complets | aucun « vert » sans sortie de commande | 5 |

## 7. Fichiers gelés ou à traiter comme historiques

| Périmètre | Règle |
|---|---|
| `app/api/coach/eaf-stage-printemps/**` et dashboards associés | pas de réécriture dans PR26 ; seulement tests de non-régression |
| `app/api/coach/maths-premiere-stage-printemps/**` et dashboards associés | même règle |
| `data/nsi-pratique-2026/**` et pages dédiées | campagne distincte, aucune réutilisation implicite comme template PR26 |
| pages/campagnes archivées et rapports historiques | inventaire puis correction ciblée des communications actives, jamais conversion de données |
| `Stage`, `StageSession`, `StageReservation` V1 | lecture historique stable ; aucune requalification automatique |
| factures, paiements, bilans et réservations historiques | immuables hors processus métier existant audité |

## 8. Contrats de passage entre propriétaires

| Producteur | Consommateur | Livrable obligatoire |
|---|---|---|
| Terra | Sol | codes produits, getter serveur, règles publiées, cas de test sans import JSON |
| Sol | Terra | DTO public versionné, états d'erreur, disponibilité et devis calculés serveur |
| Sol | Luna | DTO par rôle, matrice RBAC, fixtures V1/V2 et catalogue d'erreurs |
| Luna | Sol | écarts API/permissions reproduits par test, jamais correction directe de route |
| Luna | Terra | défauts responsive/a11y reproduits, jamais correction concurrente de composant |
| tous | responsable Nexus | résultat des gates et divergences, sans transformer une recommandation en décision |

Toute modification d'un contrat partagé incrémente sa version ou reste compatible, met à jour les tests consommateurs et est fusionnée avant les consommateurs.

## 9. Zones de conflit explicites

| Zone | Propriétaire final | Procédure |
|---|---|---|
| `BusinessConfig` contre catalogue | Terra pour le catalogue, Sol pour allowlist/fail-closed | OWNER-016 interdit tout override contractuel ; tests Sol avant consommation Terra |
| DTO dashboards dans routes API | Sol | Luna ouvre une demande de contrat/tests, pas une édition parallèle |
| calendrier partagé public/dashboard | Sol produit les données ; Luna possède le composant partagé ; Terra possède l'enveloppe publique | fusion Sol, puis Luna, puis Terra |
| redirection `/stages/[slug]` V1/V2 | Sol pour résolution, Terra pour rendu | DTO discriminé fusionné avant UI |
| événements analytics après inscription | Terra nomme l'événement ; Sol fournit un identifiant non personnel | revue sécurité commune, écriture Terra |
| navigation authentifiée | Luna | activation après disponibilité des routes, une seule PR de navigation |

## 10. Interdictions globales

- `git add .`, fusion ou push sans validation ;
- montant, date, heure, capacité, niveau, matière, statut ou libellé partagé codé localement ;
- import direct de `data/pricing.canonical.json` dans une route ou un composant ;
- lecture du template par le frontend ;
- seconde API calculant différemment le statut d'une cohorte ;
- écriture V1 et V2 pour une même édition ;
- fallback silencieux vers Printemps 2026 ou `intensif-renfort` ;
- modification destructive de Prisma ;
- accès coach/parent/élève élargi pour simplifier un écran ;
- ajout d'une cohorte sans enseignant, salle, capacité, équipement et validation.

## 11. Critère de fermeture d'un lot

Un propriétaire ne remet son lot que si :

- son diff reste dans les chemins attribués ;
- les contrats producteurs sont fusionnés avant ses consommateurs ;
- les tests de la [matrice](./pre-rentree-2026-test-matrix.md) correspondant au lot sont verts ;
- les parcours V1 concernés ont une preuve de non-régression ;
- les flags sont désactivés par défaut avant décision de publication ;
- le rollback du lot est documenté ;
- aucune condition de publication encore `PENDING_EVIDENCE`, `OWNER_INPUT_REQUIRED` ou `APPROVED_PENDING_LEGAL_TEXT_ALIGNMENT` n'a été traitée comme approuvée.

## 12. Ownership spécifique M0–M3

Le [plan branches/worktrees](../plans/pre-rentree-2026-m0-m3-branch-and-ownership-plan.md) précise les réservations de fichiers et prévaut pour M0–M3 :

| Lot | Writer | Reviewer | Fichiers réservés | Ordre |
|---|---|---|---|---:|
| M0A | Sol xhigh | Sol sécurité indépendant si disponible | guards/RBAC/authorization/tests sécurité | parallèle initial |
| M0B/M0C | Terra high | Sol xhigh | scripts DB, package/lock, Docker/CI outillage | avant M1 |
| M0D | Terra high | Sol | compose test/factories/Jest DB | avant validation M1 |
| M1 | Terra high | Sol xhigh | schema + migration core + tests M1 | premier writer Prisma |
| M2 | Sol xhigh ou Terra high | Sol obligatoire | schema claim + migration integrity + tests | après M1 |
| M3 | Terra high pour code, Sol xhigh pour règles | Sol sécurité | schema guardian + migration/scripts/policies/tests | après M1, backfill après M0A |

M2 et M3 peuvent préparer leurs tests en parallèle après M1, mais jamais écrire simultanément `prisma/schema.prisma` ou les migrations. Les worktrees futurs ne sont pas créés pendant la phase documentaire.
