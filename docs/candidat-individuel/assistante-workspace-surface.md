# Surface assistante — candidat individuel (mission recâblage §5)

**Statut : interne, ADMIN/ASSISTANTE uniquement, derrière le feature flag.** Aucune famille n'y accède ;
aucune polish visuelle publique n'a été recherchée — c'est un outil de travail.

## Chemin réel

- Page : `app/dashboard/assistante/candidat-individuel/page.tsx` (garde de rôle serveur, identique au
  pattern `app/dashboard/assistante/devis/page.tsx`, + lecture serveur de `isActiveForInternalStaff()`
  pour décider quoi afficher — premier appelant de cette fonction en dehors de son propre test unitaire).
- UI : `components/dashboard/assistante/CandidatIndividuelWorkspace.tsx` (`'use client'`).
- API, toutes gardées par `lib/quotes/candidat-individuel-guard.server.ts::requireInternalPipelineAccess()`
  (rôle ADMIN/ASSISTANTE **et** `pricing.candidatIndividuelPipeline.state >= ACTIVE_INTERNAL` — tant que le
  flag reste OFF, par défaut, chaque route répond 403, y compris pour un ADMIN) :
  - `POST /api/assistante/candidat-individuel/profils` — créer un brouillon.
  - `GET /api/assistante/candidat-individuel/profils` — lister/reprendre.
  - `GET/PATCH /api/assistante/candidat-individuel/profils/:id` — reprendre / enregistrer.
  - `POST /api/assistante/candidat-individuel/profils/:id/review` — demander une revue.
  - `POST /api/assistante/candidat-individuel/profils/:id/revision` — créer une révision.
  - `POST /api/assistante/candidat-individuel/profils/:id/quote` — créer un brouillon de `Quote` depuis une
    simulation READY (mission "vers un produit complet" §4, voir section dédiée ci-dessous).
  - `POST /api/assistante/candidat-individuel/simulate` — lancer une simulation (pure, sans écriture).
- Ajouté à la liste blanche explicite du garde-fou architecture (mission §2/§3) :
  `__tests__/architecture/lot5-catalogue-adapter-boundary.test.ts` — trois points d'entrée sanctionnés,
  consciemment, jamais silencieusement.

## Persistance — nouvelle, pas une reprise de code existant

`ProfilCandidat` existait comme modèle Prisma depuis un lot antérieur mais **aucun code applicatif n'écrivait
jamais une ligne** (confirmé par recherche exhaustive avant ce lot — seul un fixture de test en créait une).
`lib/quotes/profil-candidat.server.ts` est donc une nouvelle couche de persistance, pas un branchement sur
quelque chose qui existait déjà :

- Un brouillon ne peut être enregistré qu'une fois ses 4 champs d'identité obligatoires (level, modalite,
  specialite1, specialite2) résolus en codes valides — les colonnes Prisma correspondantes sont non
  nullables ; ce n'est pas une contrainte ajoutée par ce lot, c'est déjà comment le modèle a été conçu. Une
  saisie incomplète reste côté client (état React) jusqu'à ce seuil.
- Aucune valeur non reconnue n'est jamais devinée : `unresolvedFields`/`missingRequiredFields` sont retournés
  explicitement (422), jamais un enregistrement partiel silencieux.

## « Demander une revue » / « Créer une révision » — portée délibérément choisie

Ni l'un ni l'autre n'existait nulle part avant ce lot (confirmé par recherche : `HUMAN_REVIEW_REQUIRED`/
`DIRECTION_APPROVAL_REQUIRED` restent des statuts de résultat de simulation, jamais un état persisté ; le
modèle `Quote` porte déjà des colonnes de chaîne de révision — `previousRevisionId`/`supersededBy`/
`revisionNumber` — mais totalement non câblées, aucun code n'écrit dedans).

Décision prise pour ce lot : ajouter ces deux concepts **au niveau `ProfilCandidat`**, pas `Quote` :

- **Demander une revue** : marqueur posé par un staff (`reviewRequestedAt`/`reviewRequestedByUserId`/
  `reviewNote`), jamais dérivé automatiquement d'un statut de pipeline — une revue humaine réelle reste un
  acte humain explicite, pas une conséquence automatique d'un `HUMAN_REVIEW_REQUIRED`.
- **Créer une révision** : nouvelle ligne `ProfilCandidat`, mêmes faits déclarés, état de revue remis à zéro,
  liée par `previousProfilId` (même schéma que celui déjà réservé sur `Quote`, appliqué ici pour la première
  fois). Ne mute jamais la ligne d'origine.

**Pourquoi pas sur `Quote` directement** : `Quote` est le modèle partagé avec le moteur legacy, déjà en
production, déjà couvert par des tests réels (`createQuote`, `transitionQuoteStatus`...). Câbler la chaîne de
révision `Quote` maintenant aurait ajouté un risque réel à un chemin d'écriture partagé et testé, pour un
bénéfice hors périmètre de ce lot (aucune activation publique n'est prévue). Router la révision au niveau
`ProfilCandidat` — qui n'avait aucun code, donc aucun risque de régression — obtient le même bénéfice pour
l'usage interne demandé, à risque near-zéro sur le reste du système. Câbler la chaîne `Quote` reste une
extension possible plus tard, quand un vrai besoin de « devis provisoire → devis définitif » avec historique
apparaîtra (hors périmètre §5).

## Distinctions affichées (mission §5/§3, explicite)

Le panneau de résultat étiquette chaque statut de pipeline sans jamais laisser un statut ambigu :

| Statut pipeline | Étiquette affichée | Distinction |
|---|---|---|
| `READY` | Estimation (simulation) | Non contractuelle. Un **brouillon de devis** peut être créé (§4 ci-dessous) — reste provisoire, envoi/acceptation bloqués. |
| `HUMAN_REVIEW_REQUIRED` | Revue réglementaire requise | Blocage réglementaire. |
| `NOT_ELIGIBLE` | Non éligible | Blocage réglementaire. |
| `DIRECTION_APPROVAL_REQUIRED` | Arbitrage direction requis | Blocage commercial (mission §7/§8). |
| `UNPRICED` | Non tarifable | Blocage commercial. |
| `INVALID` | Entrée invalide | Saisie, pas encore une décision réglementaire. |
| (après création) | Devis brouillon | `Quote` persisté, `regulatoryMaturity=LEGACY_ESTIMATE_UNVERIFIED` — envoi/acceptation interdits par le garde-fou existant, inchangé. |

## §4 — Création d'un brouillon `Quote` depuis la simulation (mission "vers un produit complet" §4)

`POST /api/assistante/candidat-individuel/profils/:id/quote` referme le premier tronçon du cycle
`Profil → Quote` demandé en §3 (PDF/lien signé restent hors périmètre de ce commit — voir plus bas).

**Réutilisation, pas duplication** : `lib/quotes/persistence.server.ts::createQuote` (fonction partagée avec
le moteur legacy, déjà en production, déjà testée) a été étendue de façon strictement additive
(`profilId?`/`snapshotCarte?`/`snapshotRegles?`, tous optionnels — un appelant existant qui ne les fournit
pas obtient exactement le comportement d'avant ce commit, vérifié par la suite `quote-persistence.test.ts`
inchangée, 16/16 toujours verte). La nouvelle route ne réimplémente ni la tarification, ni la marge, ni la
persistance : elle **rejoue le pipeline côté serveur** depuis le `ProfilCandidat` persisté (jamais un
résultat fourni par le client), calcule la marge via `lib/quotes/margin.server.ts::computeMargin` (le même
moteur de marge déjà utilisé par `/api/quotes/margin`), puis appelle `createQuote` inchangé dans son
comportement de fond.

Conditions vérifiées, dans l'ordre :

1. Rôle ADMIN/ASSISTANTE + flag `ACTIVE_INTERNAL` (`requireInternalPipelineAccess`, identique aux autres
   routes de ce workspace).
2. `ProfilCandidat` persisté (404 sinon).
3. Pipeline rejoué côté serveur — seul un statut `READY` permet de continuer (422 avec le statut réel sinon,
   jamais un brouillon créé sur un profil non prêt).
4. Marge calculée sur les lignes du scénario demandé ; si `BLOCKED` sans `marginOverride.reason` explicite,
   422 — aucun contournement silencieux.
5. `createQuote` appelé avec `profilId`, `snapshotCarte` (validation + carte), `snapshotRegles` (politique de
   coût + résultat de marge + override éventuel, horodaté et attribué) — **jamais exposés à un chemin
   public** (vérifié : aucune route publique ni `pdf-adapter.ts` ne lit ces colonnes).
6. `regulatoryMaturity` n'est **jamais** positionné par cette route — il garde son défaut de colonne
   (`LEGACY_ESTIMATE_UNVERIFIED`). Conséquence directe : `lib/quotes/emission-guard.ts` (inchangé) continue
   de bloquer l'envoi/l'acceptation de tout brouillon créé ici, exactement comme demandé par la mission
   (« l'état doit rester provisoire ») — sans qu'une nouvelle logique de blocage ait dû être écrite ou
   puisse être oubliée.
7. Déduplication : `idempotencyKey` fourni par l'appelant, même mécanisme transactionnel déjà éprouvé par
   `createQuote` — aucune nouvelle logique de doublon inventée.
8. Audit : `createQuote` écrit déjà une ligne `QuoteAuditLog` (action `CREATED`) — inchangé, réutilisé.

Testé par `__tests__/database/candidat-individuel-quote-creation.test.ts` (Postgres réel) : flag OFF bloque
même un rôle valide ; profil non-READY rejeté sans écriture ; profil READY produit un brouillon dont
`assertQuoteCanBeSent` (le vrai garde-fou) rejette bien l'envoi ; ré-soumission avec la même
`idempotencyKey` ne crée jamais un second `Quote` ; 404/400 sur profil manquant/tier malformé.

## Ce que ce lot NE fait TOUJOURS PAS

- Ne promeut jamais un brouillon en `CARTE_VALIDATED_DEFINITIVE` — cette étape (revue explicite staff avant
  émission définitive) reste une extension future distincte, hors périmètre de §4.
- Ne câble pas la chaîne de révision `Quote` (`previousRevisionId`/`supersededBy`) — reste réservée, non
  utilisée, comme avant ce lot (la révision côté `ProfilCandidat` couvre le besoin interne demandé).
- Ne génère pas encore d'aperçu PDF ni de lien signé depuis ce workspace (mission §3/§13 — reste à faire).
- Ne construit pas d'éditeur dynamique pour `notesConservees`/`dispensesDeclarees`/`p3EligibiliteAudit` —
  saisie JSON brute dans un `Textarea`, validée côté serveur par Zod avant tout appel pipeline. Justifié :
  outil interne, structures staff-only déjà complexes, pas de public visé.
- N'active rien : `pricing.candidatIndividuelPipeline.state` reste `OFF` par défaut — cette surface existe
  en code, prête, mais chaque route répond 403 tant que la direction n'a pas activé `ACTIVE_INTERNAL` dans un
  environnement réel (hors périmètre de cette session, mission §12 : "ne pas demander à la direction de
  modifier un environnement").
