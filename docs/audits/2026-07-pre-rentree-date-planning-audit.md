# Audit dates et planning — Pré-rentrée 2026

## Date

11 juillet 2026 — fuseau de référence `Africa/Tunis`.

## Verdict

**READY_FOR_BUSINESS_VALIDATION** pour la phase documentaire.

Le planning socle demandé est formellement faisable à 60 séances, 120 heures-cours, deux salles au maximum et trois ressources enseignantes, dont une ressource unique Mathématiques/NSI. Le produit actuel n'est en revanche **pas prêt à être implémenté ou commercialisé sous cette forme** : la production, le calendrier canonique, le calendrier client généré et plusieurs tests décrivent encore une pré-rentrée du 24 au 28 août 2026, en 15 heures et cinq demi-journées de 3 heures.

La présente phase n'a modifié aucun fichier applicatif, tarif, schéma Prisma ou contenu de production.

## Périmètre et méthode

Contrôles effectués :

- lecture de `AGENTS.md`, de l'état Git initial et du dernier commit ;
- recherche exhaustive dans les fichiers suivis et non suivis, hors `.git`, `.next` et `node_modules`, des libellés et dates demandés ;
- lecture de la source tarifaire/calendaire, de ses loaders, du générateur client, des tests et du modèle Prisma des stages ;
- lecture du rendu HTML réellement servi par `https://nexusreussite.academy/stages` ;
- vérification civile des jours du 17 au 28 août 2026 dans `Africa/Tunis` ;
- preuve arithmétique et contrôle des collisions du planning socle ;
- séparation stricte entre planning socle, variantes pédagogiques et cohortes conditionnelles.

État Git initial observé :

- branche : `g-sec/api-guards` ;
- commit : `11ac38cea728e5d4eba66ca2b549cfc080ec835f` (`fix(seed+storage): guard allows CI/compose hosts, predicate extracted, coach uses helper`) ;
- fichiers non suivis préexistants et préservés : `docs/audits/audit-nexus-reussite.md`, `docs/pedagogy/referentiel_scolaire_3e_terminale.md`, `rapport_audit_2_07_2026.md`.

## Référentiel temporel validé

| Élément | Valeur canonique |
|---|---|
| Début | lundi 17 août 2026 |
| Fin | vendredi 28 août 2026 |
| Week-end exclu | samedi 22 et dimanche 23 août 2026 |
| Semaine 1 | lundi 17 au vendredi 21 août 2026 |
| Semaine 2 | lundi 24 au vendredi 28 août 2026 |
| Fuseau | `Africa/Tunis` |
| Offset applicable | UTC+01:00 (`CET` dans la base IANA locale) |
| Jours d'enseignement | 10 |

Les six bornes calendaires ont été contrôlées avec la base IANA : le 17 et le 24 sont des lundis, le 21 et le 28 des vendredis, le 22 un samedi et le 23 un dimanche.

## Résumé exécutif des écarts

Le calendrier commercial actuel représente une édition générique `pre-rentree-2026` rattachée au format `intensif-renfort` : 15 heures, cinq demi-journées, du 24 au 28 août. La page publique reprend directement ces données et annonce en plus une unité de 3 heures, des matières génériques « Maths · NSI · Français (EAF) · Philo » et cinq élèves maximum.

Le nouveau produit est structurellement différent : deux semaines, 12 modules publics, 10 heures par matière, des séances de 2 heures, quatre matières dont Physique-Chimie à la place de Philosophie, des libellés dépendant du niveau et des variantes de parcours non automatiquement fusionnables. Il ne s'agit donc pas d'une simple correction de date.

Le modèle Prisma actuel ne représente qu'un `Stage`, des `StageSession` directement liées au stage, une capacité globale, des matières/niveaux sous forme de tableaux et une réservation au niveau du stage. Il ne possède ni module, ni variante, ni cohorte, ni salle structurée, ni choix de 1 à 4 matières, ni capacité par cohorte. Une refonte métier est nécessaire avant toute migration.

## Constats P0

### P0-1 — Date de début erronée dans la source servie en production

`data/pricing.canonical.json` contient :

- `date_start: 2026-08-24` au lieu de `2026-08-17` ;
- `date_end: 2026-08-28`, correcte ;
- `dates_display: Lun. 24 → ven. 28 août 2026`, obsolète.

`data/stage-calendar-client.json`, généré depuis cette source, répète la mauvaise date. Le 11 juillet 2026, `/stages` répondait HTTP 200 et son HTML de production affichait effectivement « Lun. 24 → ven. 28 août 2026 ».

### P0-2 — Format commercial incompatible avec le produit validé

L'entrée canonique associe la pré-rentrée à `intensif-renfort`, `INTENSIF 15 h`, cinq demi-journées et 15 heures. La page annonce « demi-journée de 3 h ». Le produit validé exige 5 séances × 2 h = 10 h **par matière**, avec un choix de 1 à 4 matières, soit 10 à 40 heures par élève.

Cette divergence interdit une migration par simple remplacement de `date_start`. Les tarifs du format 15 h ne doivent pas être appliqués automatiquement au nouveau module de 10 h ; la tarification reste une décision métier séparée.

### P0-3 — Catalogue de matières public erroné

La source et la page affichent « Maths, NSI, Français (EAF), Philo ». Pour la pré-rentrée 2026 :

- Physique-Chimie doit remplacer Philosophie ;
- en Seconde, « Initiation informatique, algorithmique et SNT » remplace toute présentation NSI/EDS ;
- « Français (EAF) » ne peut pas être un libellé global : l'EAF concerne la Première, avec voies générale et technologique distinctes ;
- en Terminale, le libellé requis est « Expression écrite, argumentation et maîtrise de l'oral » ;
- Mathématiques doit porter les parcours Première et Terminale sans fusion silencieuse.

### P0-4 — Le modèle de données ne garantit aucune contrainte centrale

Le schéma actuel ne permet pas de faire respecter structurellement :

- 3 à 5 élèves par cohorte ;
- 1 à 4 matières par réservation ;
- le rattachement d'une séance à un module et à une cohorte ;
- les variantes EDS, hors EDS, voies et options ;
- une salle comme ressource réservable ;
- l'unicité d'occupation enseignant, salle et cohorte ;
- le workflow explicite de dédoublement.

La capacité `Stage.capacity` vaut 12 par défaut et est globale, alors que la capacité validée est de 3 à 5 par cohorte. Une implémentation frontend seule créerait des promesses de places impossibles à garantir.

### P0-5 — Aucune matrice opérationnelle de 60 séances n'existe

Le seed E2E contient une seule séance fictive de 90 minutes le 24 août, à 09:00Z, pour un stage générique. Il ne constitue ni un planning de référence ni une preuve de collision. La matrice canonique à 60 séances est spécifiée dans `docs/specs/pre-rentree-2026-planning.md`.

## Constats P1

### P1-1 — Des tests figent l'ancien calendrier

`__tests__/lib/pricing-stage-calendar.test.ts` exige explicitement le 24–28 août, 15 heures, cinq demi-journées et la liste Maths/NSI/Français EAF/Philo. Sa fenêtre dite « officielle » commence également le 24 août. Ces assertions devront être remplacées par des invariants du nouveau produit, pas seulement réécrites avec deux nouvelles dates.

### P1-2 — `getNextStage` perd une édition dès son premier jour

Les loaders serveur et client filtrent les éditions avec `date_start >= aujourd'hui`. À partir du 18 août, la pré-rentrée en cours ne sera donc plus considérée comme le prochain stage, bien qu'elle continue jusqu'au 28. Le fichier client généré ne contient pas `date_end`, ce qui empêche de corriger proprement ce comportement côté client.

### P1-3 — Les dates/heures ne portent pas explicitement le fuseau métier

`Stage.startDate`, `Stage.endDate` et `StageSession.startAt/endAt` sont des `DateTime` sans champ de fuseau d'édition. Le seed E2E utilise des instants UTC qui ne correspondent pas aux blocs canoniques locaux. L'implémentation devra stocker les instants en UTC tout en conservant `Africa/Tunis` sur l'édition et en construisant chaque instant depuis l'heure civile tunisienne.

### P1-4 — La capacité commerciale est couplée entre matières

Le socle offre 60 places-matière au maximum (12 modules × 5), mais pas 60 places élèves garanties. Une famille prenant quatre matières consomme quatre places-matière. Le nombre d'élèves distincts dépend donc des packs choisis. Le formulaire devra vérifier chaque module et chaque variante avant confirmation.

### P1-5 — Les cohortes supplémentaires sont fortement contraintes

Les blocs B et C utilisent déjà les deux salles. Les enseignants du socle atteignent leur plafond de 6 heures par jour. Un dépassement de cinq élèves ou l'ouverture simultanée de variantes incompatibles ne peut jamais créer automatiquement un groupe. Il faut au minimum une ressource enseignante supplémentaire et, selon le module, un arbitrage de créneau ; certains cas n'ont aucune place résiduelle préservant tous les packs.

## Constats P2

### P2-1 — Documents historiques contradictoires

`rapport_audit_2_07_2026.md`, non suivi au début de cette mission, qualifie encore le 24–28 août et le format 15 h de cohérents. Il doit être marqué historique ou corrigé lors de la migration documentaire, sans écraser silencieusement son contexte d'audit.

### P2-2 — Prototypes statiques concurrents

`Nexus_Reussite_Accueil.html` et `data/Nexus_Reussite_Accueil.html` contiennent des contenus génériques de prérentrée et un message WhatsApp de pré-inscription. Ils ne portent pas la date erronée, mais devront être classés comme archives/prototypes ou synchronisés si encore publiés par un canal externe.

### P2-3 — Métadonnées trop génériques pour la nouvelle offre

`app/stages/page.tsx` et `app/stages/layout.tsx` parlent de stages de prérentrée sans dates ni structure. Elles ne sont pas factuellement fausses, mais la refonte devra présenter les deux semaines, les niveaux et le format par matière dans le titre, la description et les éventuelles données structurées.

## Inventaire des dates et contenus obsolètes

### Fichiers contenant une valeur directement obsolète

| Fichier | Occurrence | Traitement futur |
|---|---|---|
| `data/pricing.canonical.json` | 24–28 août, 15 h, 5 demi-journées, Maths/NSI/Français EAF/Philo | Migrer l'édition sans modifier un tarif avant validation commerciale. |
| `data/stage-calendar-client.json` | 24–28 août | Régénérer ; ne pas éditer comme source. |
| `__tests__/lib/pricing-stage-calendar.test.ts` | dates, heures, demi-journées, matières et fenêtre de vacances anciennes | Remplacer par les invariants 17–28, 10 jours, 12 modules et 60 séances. |
| `scripts/seed-e2e-db.ts` | stage 24–28, séance 24 août, publication 28 août | Créer une fixture représentative du socle, avec heures tunisiennes correctes. |
| `rapport_audit_2_07_2026.md` | affirmation « Pré-Rentrée du 24 au 28 août 2026 », format 15 h | Archiver ou annoter comme constat historique obsolète. |

### Fichiers dépendant de l'ancien contrat sans date littérale

| Fichier | Dépendance | Traitement futur |
|---|---|---|
| `app/stages/Stages2026Page.tsx` | unité 3 h, matières globales, rendu d'une seule carte/format | Refaire le rendu par semaines, niveaux, modules et disponibilité conditionnelle. |
| `app/stages/page.tsx` | charge le seul `stage_calendar` et un format tarifaire | Charger le modèle public de planning validé. |
| `lib/pricing.ts` | type calendaire monolithique et filtre sur `date_start` | Séparer calendrier commercial et planning opérationnel ; corriger l'édition en cours. |
| `lib/pricing-client.ts` | calendrier client sans date de fin | Exposer au minimum `date_end` ou un statut calculé. |
| `scripts/generate-pricing-client-data.js` | projection sans `date_end` | Générer le contrat client révisé. |
| `__tests__/lib/pricing-client-sync.test.ts` | synchronisation d'une projection minimale ancienne | Tester début, fin, fuseau et édition en cours. |
| `__tests__/lib/pricing-canonical-validator.test.ts` | validation superficielle des dates | Ajouter les invariants propres à l'édition 2026. |
| `__tests__/stages/sur-devis-display.test.tsx` | suppose une tarification par ancien format | Adapter après décision tarifaire, sans inventer de prix. |
| `e2e/auth/price-render-check.spec.ts` | associe chaque édition à un `stage_format` tarifé | Adapter après validation du nouveau modèle commercial. |
| `components/ui/diagnostic-form.tsx` | consomme `getNextStage` | Vérifier l'affichage pendant toute la période du stage. |
| `__tests__/components/diagnostic-form.test.tsx` | teste le passage Pré-rentrée/Toussaint | Ajouter les cas 17, 18, 23, 24 et 28 août en `Africa/Tunis`. |
| `app/stages/layout.tsx` | métadonnées génériques | Mettre à jour après validation des messages publics. |
| `__tests__/stages/stages-layout-metadata.test.ts` | contrat SEO générique | Tester les nouvelles métadonnées. |
| `e2e/auth/public-front-go-live.spec.ts` | smoke limité au H1/CTA | Ajouter dates, matières, niveaux, absence de « EAF » en Terminale et SNT en Seconde. |

### Canaux recherchés sans date obsolète trouvée

- messages WhatsApp applicatifs : aucun texte daté 24–28 trouvé ; les prototypes HTML contiennent un message générique à surveiller ;
- emails applicatifs : aucun template de campagne pré-rentrée daté trouvé ; les emails d'inscription reprennent les informations du `Stage` de base de données ;
- données structurées : aucune donnée structurée spécifique à `/stages` et à la pré-rentrée 2026 trouvée ;
- métadonnées : pas de date littérale, mais contrat descriptif à enrichir ;
- page de campagne dédiée datée : aucune trouvée dans le code actif ; le rapport historique évoque une campagne à lancer.

## Liste exacte des fichiers à modifier lors d'une phase ultérieure

Cette liste est divisée pour éviter de confondre correction certaine et choix d'architecture encore non validé.

### Lot 1 — correction calendaire et contrat public, certain

- `data/pricing.canonical.json`
- `data/stage-calendar-client.json` — généré uniquement
- `scripts/generate-pricing-client-data.js`
- `lib/pricing.ts`
- `lib/pricing-client.ts`
- `app/stages/page.tsx`
- `app/stages/Stages2026Page.tsx`
- `app/stages/layout.tsx`
- `components/ui/diagnostic-form.tsx`
- `__tests__/lib/pricing-stage-calendar.test.ts`
- `__tests__/lib/pricing-canonical-validator.test.ts`
- `__tests__/lib/pricing-client-sync.test.ts`
- `__tests__/components/diagnostic-form.test.tsx`
- `__tests__/stages/sur-devis-display.test.tsx`
- `__tests__/stages/stages-layout-metadata.test.ts`
- `e2e/auth/price-render-check.spec.ts`
- `e2e/auth/public-front-go-live.spec.ts`
- `scripts/seed-e2e-db.ts`

### Lot 2 — modèle opérationnel recommandé, après validation de l'ADR

- `prisma/schema.prisma`
- `lib/stages/public.ts`
- `lib/stages/admin-schemas.ts`
- `app/api/admin/stages/route.ts`
- `app/api/admin/stages/[stageId]/route.ts`
- `app/api/stages/[stageSlug]/inscrire/route.ts`
- `components/stages/StageInscriptionForm.tsx`
- `components/stages/WeeklyCalendar.tsx`
- `app/dashboard/admin/stages/page.tsx`
- `app/dashboard/assistante/stages/page.tsx`
- `app/dashboard/coach/stages/page.tsx`
- `__tests__/api/admin.stages.route.test.ts`
- `__tests__/api/stages/stages-list.test.ts`
- `__tests__/api/stages.reservations.access.test.ts`
- `__tests__/api/stages/confirm.test.ts`

Fichiers proposés à créer lors du lot 2, sous réserve de validation technique :

- `lib/stages/pre-rentree-2026.ts`
- `lib/stages/planning-validator.ts`
- `lib/stages/cohort-planning.ts`
- `__tests__/lib/stages/pre-rentree-2026.test.ts`
- `__tests__/lib/stages/planning-validator.test.ts`
- `__tests__/lib/stages/cohort-planning.test.ts`
- `e2e/stages/pre-rentree-2026.spec.ts`
- une migration Prisma nommée au moment de sa génération, jamais créée manuellement avant validation.

### Lot 3 — archives et communication

- `rapport_audit_2_07_2026.md` — si ce document non suivi est conservé ;
- `Nexus_Reussite_Accueil.html` — uniquement si le prototype reste diffusé ;
- `data/Nexus_Reussite_Accueil.html` — uniquement si le prototype reste diffusé.

`AGENTS.md` et `components/premium/HeroSection.tsx` contiennent des mentions génériques « prérentrée août 2026 » qui restent exactes ; aucune modification n'est requise à ce stade.

## Plan de migration des anciennes dates

1. Faire valider les décisions métier listées dans la spécification, en particulier tarification, modalités présentiel/en ligne et règles de qualification Terminale.
2. Geler les nouvelles inscriptions de l'édition `pre-rentree-2026` pendant la fenêtre de migration des données si des réservations réelles existent.
3. Exporter en lecture seule le stage, ses séances, réservations, paiements et messages déjà émis ; ne journaliser aucune PII dans le rapport.
4. Modifier l'entrée calendaire canonique : début 17 août, fin 28 août, deux semaines, sans changer de prix tant que le nouveau format commercial n'est pas validé.
5. Introduire le modèle opérationnel validé et migrer l'édition, les 12 modules, les cohortes socles, les trois ressources enseignantes, les deux salles et les 60 séances.
6. Requalifier chaque réservation existante vers niveau, 1 à 4 matières et variantes ; toute donnée insuffisante passe en `ARBITRAGE_PEDAGOGIQUE_REQUIS`, jamais dans une cohorte par défaut.
7. Régénérer `data/stage-calendar-client.json` depuis la source canonique.
8. Mettre à jour les pages, formulaires, WhatsApp et emails pour dériver dates/libellés du modèle ; supprimer toute copie littérale.
9. Exécuter les tests unitaires, API, Playwright, les contrôles de fuseau et les contrôles de collision.
10. Déployer uniquement sur demande explicite, vérifier le HTML de production et réouvrir les inscriptions après contrôle du nombre de places par cohorte.

## Critères de recette

- `/stages` répond 200 et affiche 17–28 août 2026, les deux semaines et le week-end exclu.
- La page n'affiche ni Philosophie pour cette édition, ni NSI comme EDS en Seconde, ni EAF en Terminale.
- Chaque niveau expose exactement quatre modules publics et permet 1 à 4 choix.
- Les 15 combinaisons de matières sont logistiquement acceptées pour chaque niveau.
- Une sélection de quatre matières affiche 40 heures au total et jamais plus de 4 heures par jour.
- Le planning contient exactement 60 séances socles de 2 heures, 12 modules et 120 heures-cours.
- Chaque module contient exactement cinq séances sur les cinq jours de sa semaine.
- Aucun enseignant ne dépasse 6 heures par jour ; Mathématiques et NSI utilisent la même ressource et jamais la même semaine.
- Le pic d'occupation est de deux salles ; aucune collision salle/enseignant/cohorte/niveau n'existe.
- Les variantes incompatibles ne sont jamais fusionnées automatiquement.
- À six demandes compatibles ou à deux variantes incompatibles au seuil, aucun second groupe n'est créé sans enseignant, créneau, salle et validation.
- Le stage reste visible comme édition en cours du 17 au 28 août, week-end compris.
- Toutes les heures sont affichées en `Africa/Tunis` et correspondent aux blocs A à D.
- Les tests vérifient les bornes 3 et 5 élèves ainsi que les statuts de dédoublement.

## Stratégie de rollback

Le rollback doit être préparé par lots :

- conserver un export des enregistrements de l'ancienne édition et l'identifiant `pre-rentree-2026` ;
- rendre les migrations de données idempotentes et conserver une table de correspondance ancien stage → nouvelle édition/modules/cohortes ;
- en cas d'échec applicatif, désactiver temporairement la pré-inscription (`isOpen = false`) plutôt que réafficher les anciennes dates ;
- revenir au code précédent sans restaurer le contenu public 24–28 août ; afficher à défaut « dates en cours de confirmation » n'est pas autorisé puisque les dates sont désormais non négociables ;
- ne supprimer les anciennes structures ou colonnes qu'après une période de coexistence, une comparaison des réservations et une sauvegarde validée ;
- vérifier après rollback qu'aucun paiement, choix de matière ou statut de liste d'attente n'a été perdu.

## Hypothèses retenues

- Les 60 séances désignent exclusivement le socle : 12 modules × 5 séances.
- Les variantes sont des qualifications pédagogiques, pas des groupes ouverts.
- Une cohorte supplémentaire ajoute cinq séances et dix heures-cours hors compteur socle.
- La contrainte « aucun creux autre que la pause déjeuner » s'applique aux enseignants et aux élèves suivant plusieurs modules le même jour.
- Le bloc C suit une pause déjeuner de 45 minutes après B ; A→B et C→D ont 15 minutes d'intercours.
- Les salles 1 et 2 sont situées au centre pédagogique de Mutuelleville ; les rendez-vous et la présence restent sur confirmation.
- La capacité minimale/maximale s'applique à chaque cohorte et non au stage global.
- La compatibilité logistique d'un pack ne vaut pas validation du parcours scolaire de l'élève.

## Points encore ambigus ou à valider

- tarification d'une matière de 10 heures et règles commerciales des packs 1 à 4 ;
- maintien ou remplacement de l'identifiant/format `intensif-renfort` ;
- présentiel uniquement à Mutuelleville ou possibilité réelle d'une cohorte en ligne ;
- statut public d'une cohorte à 0–2 demandes : préinscription en attente ou liste d'attente immédiatement ;
- règle commerciale pour un élève de Terminale demandant Maths, NSI et Physique-Chimie alors que seuls deux EDS sont normalement conservés ;
- possibilité pédagogique de construire un tronc commun explicite entre certaines variantes, après validation du responsable pédagogique ;
- identité et disponibilité réelles des enseignants, au-delà des rôles fonctionnels utilisés dans la spécification ;
- capacité physique exacte des deux salles, équipements NSI et conformité à cinq élèves plus un enseignant ;
- traitement des réservations ou communications déjà émises avec l'ancienne période ;
- choix final entre extension normalisée du modèle Prisma et source opérationnelle versionnée, l'ADR recommandant le modèle normalisé.

## Risques restants

- une validation tarifaire tardive peut bloquer la publication malgré un planning prêt ;
- les cohortes de parcours peuvent dépasser les quatre emplacements résiduels théoriques sur les deux semaines ;
- le partage d'un seul enseignant Mathématiques/NSI rend tout dédoublement de ces matières dépendant d'un second enseignant ;
- une campagne lancée avant migration pourrait continuer à diffuser le 24–28 août ;
- un simple changement de dates sans requalification des réservations masquerait les incompatibilités de parcours.

## Recommandation

Soumettre conjointement la spécification et l'ADR au responsable pédagogique, au responsable commercial et au responsable d'exploitation. Le statut est **READY_FOR_BUSINESS_VALIDATION**, mais explicitement **NOT_READY_FOR_IMPLEMENTATION** jusqu'à validation des décisions listées ci-dessus.
