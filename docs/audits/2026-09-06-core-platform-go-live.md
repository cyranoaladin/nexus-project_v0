# Socle plateforme — destinations et critères de mise en service

## Date et périmètre

6 septembre 2026. Branche `feat/core-go-live-family-academic-planning-20260906`,
base `origin/main` = `95f518e3112636a2d01c6feea06e261150efd446` (`95f518e31`).
Ce lot ne prouve aucun nouvel état de production. Les observations de production
antérieures dans `audit_dsahboard.md` restent des observations datées.
Les critères indépendants sont définis dans `CORE_GO_LIVE_GATE.md`.

## Décision et source canonique

`lib/auth/role-destinations.ts` définit les cinq destinations, consommées par
`auth.config.ts`, `middleware.ts`, `app/dashboard/page.tsx`,
`app/auth/signin/SignInForm.tsx` et `app/access-required/page.tsx`. Ce module ne confère
aucune permission API. Les guards, les autorisations métier, la révocation de
session et les règles de propriété restent inchangés. Le fallback UI des rôles
inconnus est désormais uniformément `/auth/signin`, y compris avec un callback ;
les callbacks internes des rôles reconnus sont conservés.

## Matrice par rôle : contrat actuel à préserver

### ADMIN

- Connexion : email et mot de passe via Credentials ; session valide et non révoquée.
- Destination : `/dashboard/admin`.
- Routes : utilisateurs, analytics, abonnements, activités, stages, facturation, documents ; direction `/admin/directeur`.
- APIs : `/api/admin/users`, `/api/admin/dashboard`, `/api/admin/invoices`, `/api/admin/stages` ; certaines APIs staff acceptent également ADMIN.
- Données : gouvernance, comptes, factures et indicateurs autorisés par les endpoints.
- Mutations : administration et supervision selon le contrôle propre à chaque route.
- Interdit : contourner les validations, restaurer des crédits actifs ou déduire une permission de la seule destination. Les quatre autres préfixes de dashboards redirigent ; l'exception candidat ci-dessous reste spécifique.

### ASSISTANTE

- Connexion : email et mot de passe ; session valide.
- Destination : `/dashboard/assistante`.
- Routes : bilans, élèves, planning, assignations, coaches, abonnements, paiements, facturation, devis, stages, documents.
- APIs : `/api/assistante/families`, `/api/assistante/students`, `/api/assistante/parents/[parentId]/whatsapp-invitation`, `/api/assistante/dashboard` ; opérations de finance soumises aux guards de leurs routes.
- Données : dossiers familiaux et suivi opérationnel nécessaires au rôle.
- Mutations : création/rattachement explicite, préparation d'invitation, traitement et publication autorisés, paiement/facture ; aucun solde de crédits.
- Interdit : dashboard admin, configuration réservée admin et autres dashboards de rôle ; aucun contournement du consentement pour servir une audience famille.

### COACH

- Connexion : email et mot de passe ; session valide.
- Destination : `/dashboard/coach`.
- Routes : élèves, séances, disponibilités, bilans, stages, NPC.
- APIs : `/api/coach/dashboard`, `/api/coach/students/[studentId]/dossier`, `/api/coach/sessions/[sessionId]/report` et documents/notes/rapports associés.
- Données : élèves dont l'accès est accordé par le contrôle d'affectation ; certains accès conservent le fallback d'une séance confirmée ou terminée.
- Mutations : comptes rendus, notes, documents et actions pédagogiques autorisées.
- Interdit : dossiers hors périmètre, gouvernance admin et espaces parent/élève/assistante. La durée du fallback historique reste un écart distinct, non corrigé ici.

### PARENT

- Connexion : téléphone canonique d'un unique parent VERIFIED avec preuve téléphone, ou email ; mot de passe, activation et absence de fusion requis.
- Destination : `/dashboard/parent`.
- Routes : inscription, enfants, abonnements, paiement, factures, stages, ressources, NPC.
- APIs : `/api/parent/dashboard`, `/api/parent/registration`, `/api/parent/children/[studentId]/bilans`, `/api/parent/children/[studentId]/canonical-consent`, `/api/invoices/[id]/pdf` dans le périmètre autorisé.
- Données : son foyer et les restitutions publiées accessibles selon le lien parent, son consentement et l'audience ; ses données commerciales autorisées.
- Mutations : confirmation du dossier, consentement explicite, demandes/paiements autorisés. L'ajout direct d'enfant historique reste un écart du chantier familial.
- Interdit : autres foyers, documents internes Nexus, dashboards staff et élève ; rattachement structurel seul insuffisant pour ouvrir un bilan canonique.

### ELEVE

- Connexion : identifiant email/identifiant élève et mot de passe ; activation et absence de fusion requises.
- Destination : `/dashboard/eleve`.
- Routes : séances, programme, ressources, stages, documents, automatismes, mes-bilans et NPC ; ARIA selon disponibilité et droits.
- APIs : `/api/student/dashboard`, `/api/student/bilans/[publicShareId]`, `/api/student/documents`, `/api/student/sessions` et actions pédagogiques autorisées.
- Données : ses données, ses ressources autorisées et sa restitution publiée ; un candidat individuel reste ELEVE.
- Mutations : passations, progression et actions pédagogiques dans son périmètre.
- Interdit : autre élève, audience parents/interne, comptes/finance staff, quatre autres dashboards.

## Exceptions et limites des contrôles

- `/dashboard` et `/dashboard/trajectoire` conservent leur traitement partagé authentifié.
- Le middleware conserve l'exception ADMIN vers `/dashboard/assistante/students/[studentId]/candidat` ; les gardes de page restent en place.
- `auth.config.ts` et le middleware n'appliquent pas toutes les mêmes exceptions aujourd'hui : la centralisation des destinations ne change pas ce comportement. La revue du chemin complet reste nécessaire pour toute exception.
- Les règles Planning Studio et les en-têtes de sécurité ne sont pas modifiés.
- Les tests de ce lot vérifient le contrat de navigation et des réponses vides lors des refus. Ils ne remplacent pas une recette navigateur ni des tests IDOR des APIs métier.

## TDD et vérifications

RED : `npm test -- --runInBand __tests__/architecture/core-go-live-gates.test.ts __tests__/auth/five-role-dashboard-isolation.test.ts`.
Échec observé : module canonique absent, registre des critères absent et imports non centralisés ; deux suites en échec. Log local : `/tmp/nexus-core-task1-red.log`.

GREEN : mêmes suites après création des sources et remplacement minimal des cartes.
Les 20 couples de rôles distincts doivent rediriger vers la destination de l'acteur
sans corps de données ; les cinq destinations et refus anonymes sont vérifiés.
Commande GREEN et régression : `npm test -- --runInBand __tests__/architecture/core-go-live-gates.test.ts __tests__/auth/five-role-dashboard-isolation.test.ts __tests__/middleware/assistant-candidate-access.test.ts __tests__/middleware/security-headers.test.ts __tests__/lib/credentials-authorize.test.ts __tests__/lib/session-revocation.test.ts`.
Résultat : 6 suites, 84 tests réussis. Log local : `/tmp/nexus-core-task1-green.log`.

Lint ciblé sur les six fichiers TypeScript/TSX : zéro erreur ; deux avertissements
`no-explicit-any` préexistants dans les gardes sont conservés.
`git diff --check` : réussi. Typecheck global `npx tsc --noEmit` : réussi (exit 0, aucun diagnostic), log `/tmp/nexus-core-task1-tsc.log`.
Aucun build ni test navigateur supplémentaire n'est revendiqué pour ce lot borné.

## Risques et retour arrière

Les autres entrées de création familiale, les contrôles HTTP et la confirmation
de stage restent hors de ce lot. Ni CORE ni RAG n'est déclaré prêt par cette seule
modification. Aucun déploiement, migration ou envoi externe n'est effectué.
Retour arrière : revert du commit de ce lot ; aucun changement de données à annuler.


### Complément de revue qualité — consommateurs UI

RED complémentaire : `npm test -- --runInBand __tests__/architecture/core-go-live-gates.test.ts __tests__/auth/role-destination-consumers.test.tsx`.
Sept échecs attendus : cartes non centralisées et fallbacks incorrects (rôle inconnu/absent, callback inconnu). Log `/tmp/nexus-core-task1-amend-red.log`.

GREEN complémentaire : les six suites précédentes, plus `__tests__/auth/role-destination-consumers.test.tsx` et `__tests__/app/parent-phone-auth-ui.test.tsx` : **8 suites, 103 tests réussis**. Log `/tmp/nexus-core-task1-amend-green.log`.
Le lint des neuf fichiers de code/tests concernés reste sans erreur, avec les deux avertissements préexistants. Les cas UI testent les cinq destinations et les rôles absents/inconnus ; le scénario parent préserve son callback d'inscription.

Typecheck global complémentaire `npx tsc --noEmit` : exit 0, aucun diagnostic (`/tmp/nexus-core-task1-amend-tsc.log`). Diff check : réussi.
