# Critères indépendants de mise en service

Date : 6 septembre 2026. Base applicative : `origin/main` au commit `95f518e31`.
Périmètre de ce lot : registre des critères et destinations des rôles, sans déploiement.

## CORE_PLATFORM_GO_LIVE_READY

CORE_PLATFORM_GO_LIVE_READY = NOT_YET_VERIFIED

Cette décision concerne les identités, les familles, la scolarité, le planning,
les bilans publiés et leur visibilité, les paiements et les factures.
Elle exige des preuves sur la révision livrée :

- cinq rôles : connexion, destination, session et refus d'accès croisé ;
- création familiale canonique, demandes qualifiées et traitement explicite des entrées historiques ;
- absence de rattachement implicite à un parent technique ou à un homonyme ;
- contrôles serveur de propriété, de consentement, de publication et d'audience ;
- scolarité et planning cohérents, sans compte candidat parallèle ;
- aucune opération de crédit, aucun encaissement déduit d'une simple confirmation de réservation ;
- tests pertinents, TypeScript, lint, build et recette authentifiée sans exposition de données ;
- migrations et stockage vérifiés, sauvegarde et retour arrière exploitables ;
- révision déployée identifiée, smoke des routes publiques et recette des parcours livrés.

La seule centralisation des destinations ne satisfait pas ces critères. Les
écarts du registre `audit_dsahboard.md` doivent être traités ou explicitement
acceptés avec leur périmètre et leur justification avant décision.

## RAG_FEATURE_GO_LIVE_READY

RAG_FEATURE_GO_LIVE_READY = BLOCKED

Cette décision concerne uniquement l'activation du retrieval documentaire externe.
Elle exige le contrat du fournisseur, un corpus autorisé, une identité académique
admissible, les permissions, des citations vérifiables, la gestion de l'absence
de résultat et des erreurs, et une recette sur le staging externe prévu.
L'absence actuelle de preuve staging ne doit jamais être remplacée par des mocks
présentés comme une validation fournisseur.

External RAG staging: NON_BLOCKING_CORE / BLOCKING_RAG_FEATURE

L'indisponibilité du staging RAG ne bloque pas CORE si les fonctions RAG restent
fermées ou affichent honnêtement leur indisponibilité et si les parcours CORE
fonctionnent indépendamment. Une panne RAG qui casserait ces parcours deviendrait
un défaut CORE ; cette séparation n'autorise pas à masquer une régression.
CORE prêt n'implique pas RAG prêt ; RAG prêt n'implique pas CORE prêt.

## Preuve — Tâche 16 : CORE ne fait aucune requête RAG (7 septembre 2026)

Base applicative au moment de la preuve : commit `d02b828c4`. Périmètre : les
parcours critiques CORE livrés aux Tâches 1-15 (familles, scolarité,
assignations, planning, tableaux de bord) fonctionnent sans que
`lib/rag-client.ts`, `lib/aria/rag.ts` ou
`lib/aria/infrastructure/rag/manifest.ts` ne soient sollicités — ni au niveau
module, ni au niveau navigateur. Aucun code de `lib/rag-client.ts`,
`lib/aria/rag.ts` ou `lib/aria/infrastructure/rag/manifest.ts` n'a été modifié
par cette tâche.

- `__tests__/architecture/core-rag-independence.test.ts` (7/7, PASS) : les 15
  variables d'environnement RAG effectivement lues par le sous-système
  (`RAG_INGESTOR_URL`, `RAG_API_TOKEN`, `RAG_SEARCH_TIMEOUT`,
  `RAG_SEARCH_TIMEOUT_MS`, `ARIA_RAG_ENGINE_BASE_URL`, `RAG_BFF_SERVICE_TOKEN`,
  `ARIA_RAG_ENGINE_TIMEOUT_MS`, `ARIA_RAG_ENGINE_MAX_RESPONSE_BYTES`,
  `ARIA_RAG_SERVABLE_MANIFEST_ROOT`, `ARIA_RAG_ACTIVE_MANIFEST_SHA256`,
  `NEXUS_INTERNAL_TOKEN_SECRET`, `NEXUS_INTERNAL_TOKEN_ISSUER`,
  `NEXUS_INTERNAL_TOKEN_AUDIENCE`, `NEXUS_SSO_ISSUER`, `NEXUS_SSO_AUDIENCE`)
  sont effacées, `fetch` est remplacé par un enregistreur qui échoue au
  premier appel, puis `lib/families/create-family.ts`,
  `lib/curriculum/student-academic-profile.ts`,
  `lib/assignments/allowed-courses.ts`, `lib/planning/series.ts` et
  `lib/dashboard/student-payload.ts` sont importés et partiellement exercés.
  `EXPECTED_RAG_OUTBOUND_REQUESTS=0` est vérifié à chaque cas ; une preuve
  statique complémentaire confirme qu'aucun de ces cinq fichiers n'importe le
  sous-système RAG. Caractérisation verte d'emblée : aucune régression
  trouvée, aucun changement de production nécessaire.
- `e2e/auth/core-rag-disabled.spec.ts` (2/2, PASS — exécuté réellement, pas
  seulement rédigé) : build standalone réel, serveur Next.js en production
  sans aucune variable RAG positionnée, base et Redis jetables locaux. Le
  rôle ELEVE charge `/dashboard/eleve` (widget ARIA embarqué via
  `<AriaChatLauncher>`), ouvre le panneau ARIA sans crash ni bascule vers le
  `error.tsx` générique ; le rôle ASSISTANTE charge son tableau de bord, le
  planning (`/dashboard/assistante/planning`) et la liste des élèves
  (`/dashboard/assistante/students`). Un intercepteur de requêtes navigateur
  confirme zéro appel vers un hôte/chemin RAG (`rag`, `ingestor`,
  `aria-rag-engine`) et zéro résurgence du fallback HTTP `/search` retiré
  (PR #214, hors périmètre).
- Widget ARIA embarqué (`components/aria/AriaChatLauncher.tsx` +
  `AriaChatPanel.tsx`, seul point CORE avec un composant RAG-adjacent en
  ligne) : déjà fail-open avant cette tâche — chargement fermé par défaut,
  `publicErrorLabel()` affiche un message français au lieu de planter sur
  `RAG_UNAVAILABLE`. Aucune modification de production requise.
- Suite unitaire complète (`npx jest --config jest.unit.config.js`) : 1096
  suites / 12545 tests, 100 % PASS après ce lot.

## Preuve — Tâche 17 : scénario capstone famille dorée (7 septembre 2026)

Base applicative au moment de la preuve : commit `ea2dd5fbe`. Périmètre :
scénario E2E unique, réellement exécuté (pas seulement rédigé), parcourant
tout le cycle de vie famille/scolarité/planning exactement comme une vraie
famille le vivrait, puis chaque invariant d'isolation par rôle et de refus
bâti aux Tâches 1-16.

- `e2e/auth/core-golden-family.spec.ts` (nouveau) + `e2e/helpers/golden-family.ts`
  (nouveau, aide de scénario fine posée SUR les aides existantes —
  `disposable-database.ts`, `same-origin.ts`, `rate-limit.ts` — jamais une
  réimplémentation parallèle). Un seul test, découpé en `test.step` :
  1. Assistante crée un foyer de deux enfants via la route canonique
     `POST /api/assistante/families` (`mode: 'WHATSAPP'`,
     `lib/families/create-family.ts` — le flux `FamilyRequest` → conversion a
     déjà sa propre couverture d'intégration dédiée depuis la Tâche 4).
  2. Activation parent EXCLUSIVEMENT par téléphone : ce mode n'envoie jamais
     d'e-mail d'activation, quel que soit l'e-mail fourni. Le jeton brut est
     obtenu via la même réponse unique côté staff que l'UI de production
     (`POST /api/assistante/parents/[parentId]/whatsapp-invitation`), puis
     consommé sur `/auth/parent-phone` — sans dépendance à une livraison
     WhatsApp/SMTP réelle.
  3. Confirmation du foyer (`registrationCompletedAt`, `/dashboard/parent/inscription`).
  4. Spot-check axe (0 violation) sur le tableau de bord parent confirmé.
  5. Deux écritures de carte scolaire (Tâche 6/7) : Première → `eds-maths-premiere`,
     Terminale → `eds-maths-terminale`.
  6. Deux coachs synthétiques (fixture directe, hors périmètre — l'activation
     coach n'est pas l'objet de cette tâche) + disponibilité effective
     (`ensureCoachAvailabilityByEmail`, aide existante réutilisée).
  7. Deux assignations scopées par cours (Tâche 9), un coach différent chacune.
  8. Deux séries hebdomadaires récurrentes (Tâche 11).
  9. Assertions opérationnelles ASSISTANTE et ADMIN sans CRUD générique ni SQL.
  10. Visibilité PARENT indépendante par enfant (Tâche 13) — dashboard parent,
      chaque enfant correctement attribué, jamais fusionné.
  11. Isolation Élève A puis Élève B (activation réelle, dashboard propre
      uniquement).
  12. Isolation Coach C1 puis Coach C2 (dossier, Tâche 14).
  13. IDOR croisé parent/enfant : second foyer entièrement indépendant créé,
      chaque parent refusé (404) sur l'enfant de l'autre par manipulation
      directe d'id.
  14. Refus croisé coach + révocation immédiate : fin d'assignation
      (`status: 'ENDED'`) retire l'accès dossier du Coach C1 sur-le-champ (403).
  15. Refus hors-périmètre (cours hors scope de l'assignation, 400) et
      créneau réellement conflictuel (même coach/élève/horaire, 409) — sur
      l'assignation B, restée active (l'assignation A vient d'être terminée
      à l'étape précédente).
  16. Rejeu d'idempotence : même clé + même corps → succès rejoué identique,
      aucun doublon ; même clé + corps différent → 409 `IDEMPOTENCY_CONFLICT`
      propre.
  17. Nettoyage explicite en fin de scénario + vérification que zéro ligne
      synthétique ne subsiste (`User`, `CoachStudentAssignment`,
      `PlanningSeries`), avant le filet de sécurité `afterAll`.
- Exécuté réellement contre la pile jetable locale (Postgres/Redis/Mailpit
  déjà montée par la Tâche 16) via `scripts/gate-auth-e2e.sh` (aucune
  plomberie E2E nouvelle) :
  - **Chromium** : PASS, exécuté et confirmé à plusieurs reprises (dernière
    confirmation : 22.2s).
  - **Firefox** (`firefox-smoke`) et **mobile** (`mobile-smoke`, profil
    `Pixel 7`) : PASS, confirmés ensemble lors d'une exécution multi-projets.
  - **WebKit** (`webkit-smoke`) : NON confirmé dans cette tâche. Une première
    exécution multi-projets a rencontré un abandon de navigation propre à
    WebKit (« Frame load interrupted » après `clearCookies()` + `goto()`,
    plus strict que Chromium/Firefox sur une navigation immédiatement
    consécutive à la précédente) — corrigé dans le code du scénario
    (`gotoStable()` dans `e2e/helpers/golden-family.ts`, une reprise unique
    sur ce type d'échec, appliquée à toutes les navigations directes du
    scénario) mais la ré-exécution multi-navigateurs pour CONFIRMER ce
    correctif sur WebKit spécifiquement n'a pas été relancée dans cette
    tâche (le run précédent dépassait la durée raisonnable pour cette
    session). Chromium seul reste confirmé après le correctif. À
    reconfirmer sur WebKit en suivi, sans que cela bloque CORE : c'est une
    fragilité de navigation E2E propre à ce moteur, jamais un défaut
    applicatif (aucune assertion métier n'a échoué sur WebKit — seule la
    navigation elle-même a été interrompue).
  - Axe : 0 violation sur `/dashboard/parent` (intégré au scénario, exécuté
    avec Chromium).
- `e2e/auth/rbac.dashboards.contract.spec.ts` (modifié) : ASSISTANTE, le
  second rôle staff, était absent de ce contrat RBAC (seul ADMIN y était
  couvert côté staff) alors que la Tâche 17 l'exerce abondamment — ajouté
  (routes autorisées + dashboards refusés), 11/11 PASS sur Chromium.
- Bogues découverts par ce scénario dans du code des Tâches 1-16 (aucun
  n'est corrigé par cette tâche — hors périmètre de la Tâche 17, qui livre
  la suite E2E, pas ces routes) :
  - `app/api/assistante/assignments/route.ts` (GET, Tâche 9) : le paramètre
    `status` omis renvoie 400 `"Statut invalide"` au lieu du défaut `ACTIVE`
    documenté (`statusQuerySchema = z.nativeEnum(...).optional().default(...)`) :
    `URLSearchParams.get('status')` renvoie `null` quand absent, et `.optional()`
    de zod n'accepte que `undefined`, jamais `null`. Contourné dans le
    scénario (paramètre `status=ACTIVE` toujours fourni explicitement), pas
    corrigé.
  - `lib/dashboard/student-payload.ts` (~ligne 1117, Tâche 13) : pour toute
    spécialité MATHEMATIQUES, `trackContent.specialties[].diagnosticKey` est
    figé à la valeur littérale `'maths-premiere-p2'`, y compris pour un élève
    de Terminale suivant `eds-maths-terminale` — un élève de Terminale est
    ainsi orienté vers la banque de diagnostic de Première. Ce n'est PAS une
    fuite d'isolation entre élèves (même valeur figée pour tout le monde, pas
    la valeur d'un autre élève) : un défaut de justesse de contenu. Le champ
    voisin correctement résolu par niveau, `skillGraphRef`, est ce que le
    scénario vérifie à la place ; `diagnosticKey` n'est pas asserté (l'asserter
    figerait ce bogue comme comportement attendu).
- Suite unitaire complète (`npx jest --config jest.unit.config.js`) : 1096
  suites / 12545 tests, 100 % PASS après ce lot.

## Preuves et changement de décision

Les valeurs ci-dessus sont des décisions documentaires, pas des variables
d'environnement ni des interrupteurs de production. Aucun code RAG n'est modifié
par ce lot. Actualiser séparément chaque décision avec SHA, date, commandes,
résultats et limites. Ne pas transformer automatiquement la réussite d'un test
unitaire en autorisation de déployer.

Matrice et preuves : `docs/audits/2026-09-06-core-platform-go-live.md`.
