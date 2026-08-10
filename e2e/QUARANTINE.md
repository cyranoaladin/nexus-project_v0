# Registre des quarantaines E2E

## État au 10 août 2026

Les 51 quarantaines JavaScript inconditionnelles présentes sur `origin/main`
ont été supprimées. Aucune n'a été remplacée par un autre `skip`, un `fixme` ou
un focus. Le garde `npm run check:test-quarantines` analyse tous les fichiers
suivis et bloque désormais toute réintroduction.

Le nombre ci-dessous compte les marqueurs inconditionnels retirés, pas le
nombre de tests contenus dans un éventuel `describe.skip`.

| Fichier | Marqueurs | Sort appliqué |
| --- | ---: | --- |
| `__tests__/e2e/bilan-pdf.e2e.spec.ts` | 1 | Doublon Jest/Playwright supprimé ; le contrat PDF authentifié reste couvert dans la suite Playwright canonique. |
| `__tests__/e2e/nexus-2-0-smoke.spec.ts` | 2 | Authentification et soumission réactivées avec les identités partagées et le formulaire courant. |
| `e2e/auth/admin-dashboard-audit.spec.ts` | 1 | Course de déconnexion stabilisée par attente de navigation puis contrôle de session. |
| `e2e/auth/auth-and-booking.spec.ts` | 4 | Ancien parcours de réservation Parent remplacé par les frontières de rôles et le parcours Élève actuellement supportés. |
| `e2e/auth/bilan-gratuit-flow.spec.ts` | 1 | Contrat réécrit sur le tunnel mono-page courant. |
| `e2e/auth/bilan-pdf.e2e.spec.ts` | 2 | URL de connexion et accès PDF alignés sur les routes canoniques ; données synthétiques provisionnées. |
| `e2e/auth/booking.credits.spec.ts` | 1 | Réactivé sur base et rate-limit jetables ; débit puis remboursement vérifiés dans le ledger additif. |
| `e2e/auth/eaf-report-raja-smoke.spec.ts` | 1 | Dépendance à une personne nommée supprimée au profit d'une fixture coach jetable. |
| `e2e/auth/eleve-dashboard-audit.spec.ts` | 2 | Assertions obsolètes de solde remplacées par les rubriques et actions actuelles du cockpit. |
| `e2e/auth/entitlements.gating.spec.ts` | 1 | Réactivé grâce au seed Élève et aux helpers DB hermétiques. |
| `e2e/auth/forms-validation.contract.spec.ts` | 3 | Sélecteurs et retours d'erreur alignés sur les formulaires actuels, y compris la requête unique. |
| `e2e/auth/navigation-public.contract.spec.ts` | 1 | Contrat Contact réactivé sur le formulaire actuel. |
| `e2e/auth/nsi-pratique-2026.spec.ts` | 1 | Suite entière réactivée avec navigation bornée au menu NSI et attentes d'hydratation. |
| `e2e/auth/parcours-eleve-stmg-premiere.spec.ts` | 1 | Contrat aligné sur le parcours STMG actuellement rendu et seed STMG dédié. |
| `e2e/auth/parent-dashboard-audit.spec.ts` | 1 | Suite entière réactivée sur le dashboard courant, sans `data-testid` inexistant. |
| `e2e/auth/parent-dashboard.spec.ts` | 4 | Les quatre quarantaines sont levées dans une suite actuelle de 44 scénarios actifs (contre 39 scénarios effectivement actifs auparavant) : shell authentifié, trois enfants, rubriques, API/RBAC, résilience et mobile. |
| `e2e/auth/password-reset.spec.ts` | 1 | Sélecteur de soumission et preuve e-mail réactivés via SMTP jetable. |
| `e2e/auth/payments.invoice.documents.spec.ts` | 2 | Paiement, validation, facture et coffre-fort réactivés avec catalogue et CGV canoniques. |
| `e2e/auth/programme/maths-1ere-access.spec.ts` | 1 | Suite entière réactivée via la base URL injectée et les contrôles d'accès courants. |
| `e2e/auth/programme/maths-1ere-premium.spec.ts` | 1 | Suite entière réactivée sur le moteur Maths canonique. |
| `e2e/auth/programme/maths-1ere.spec.ts` | 1 | Suite entière réactivée sur la navigation Maths courante. |
| `e2e/auth/public-front-go-live.spec.ts` | 1 | Contrat Stages aligné sur le contenu public courant et contrôle d'absence des dates obsolètes conservé. |
| `e2e/auth/security.advanced.spec.ts` | 1 | Accès document réactivé avec une fixture de stockage jetable et preuve d'absence de fuite. |
| `e2e/auth/student-automatismes.spec.ts` | 1 | Parcours réactivé après sélection d'une réponse et validation serveur avant la question suivante. |
| `e2e/auth/student-journey.spec.ts` | 1 | Sept contrats actifs couvrent le redirect historique, le shell canonique, le rendu KaTeX, le gain XP réel et sa persistance, les routes/titres internes, la réhydratation et le fonctionnement hors ligne. |
| `e2e/auth/teacher-bilan-pdf.spec.ts` | 1 | Vue enseignant et action PDF réactivées sur le moteur Maths canonique. |
| `e2e/auth/test-all-pages.spec.ts` | 1 | Base URL locale codée en dur remplacée par celle de la stack jetable. |
| `e2e/auth/test-bilan-banner.spec.ts` | 1 | Réactivé avec les credentials E2E partagés. |
| `e2e/auth/test-dashboard-interactions.spec.ts` | 8 | Les huit rôles/interactions utilisent désormais la base URL et les identités partagées du seed. |
| `e2e/auth/test-real-login.spec.ts` | 3 | Les trois connexions réelles utilisent le helper canonique et vérifient la session Auth.js. |
| **Total** | **51** | **Aucune quarantaine inconditionnelle restante.** |

## Lanes externes exclues du gate hermétique

Deux fichiers opt-in, qui portent trois marqueurs conditionnels, ne sont pas
collectés par `playwright.config.e2e.ts` :

- `e2e/candidate-diagnostic.spec.ts` exige un état navigateur fourni pour un
  élève explicitement autorisé ; le diagnostic Candidat libre reste dark ;
- `e2e/real/coach-resource-student.spec.ts` exige un jeu d'identités de recette
  externe et, pour son contrôle IDOR inter-coachs, une seconde identité coach.

Cette exclusion n'est pas une dispense de test. Les contrats exécutables dans
la stack jetable sont couverts ci-dessous par les suites officielles ; le
reliquat strictement navigateur dispose d'une procédure manuelle bloquante.

### Diagnostic Candidat libre

| Contrat de la lane exclue | Couverture de remplacement | Statut |
| --- | --- | --- |
| La surface reste inaccessible tant que le produit est dark. | `__tests__/api/diagnostics/candidat-libre/feature-flag-dark.test.ts` vérifie le `404` fail-closed de toutes les routes avant auth, rate-limit ou Prisma ; `__tests__/app/dashboard/candidat-libre-pages-dark.test.tsx` vérifie les pages Élève et Parent. | Automatique, gate officiel. |
| L'ouverture d'un module respecte l'allowlist, le consentement et les prérequis. | `__tests__/api/diagnostics/candidat-libre/allowlist.test.ts`, `consent-gate.test.ts`, `__tests__/architecture/candidat-libre-consent-wiring.test.ts` et `__tests__/lib/diagnostics/candidat-libre/progression.test.ts`. | Automatique, gate officiel. |
| Un élève crée le dossier, confirme le premier item, déclenche l'autosauvegarde, ferme, recharge puis retrouve le brouillon. | La lane exclue est la seule preuve navigateur du diagnostic actif ; elle n'est pas remplacée par une assertion de nom voisin. La recette ci-dessous couvre ce reliquat. | Manuel structurel tant que le produit reste dark. |

Procédure de remplacement, exclusivement sur une stack jetable :

1. Provisionner un compte `ELEVE` majeur et isolé, relever son `Student.id`,
   puis enregistrer son consentement spécifique au diagnostic sur la version
   courante de la notice. Le parent ne consent pas à sa place. N'utiliser
   aucune donnée ni base de production.
2. Démarrer l'artefact avec `CANDIDATE_DIAGNOSTIC_ENABLED=true` et
   `CANDIDATE_DIAGNOSTIC_STUDENT_IDS` limité exactement à ce `Student.id`.
   Générer un `storageState` par une connexion réelle de cette identité.
3. Exécuter `e2e/candidate-diagnostic.spec.ts` avec
   `E2E_STUDENT_STORAGE_STATE` et la configuration Playwright générale
   (`playwright.config.ts`), car la configuration hermétique ignore
   volontairement ce fichier.
4. Observer en plus des assertions du spec : l'indicateur « Enregistré à »
   apparaît après la confirmation ; après fermeture, rechargement et
   réouverture du premier module, la confirmation est toujours cochée et le
   module est « En cours »/« Reprendre ». La lecture API doit retourner la même
   réponse, le même index et un statut `IN_PROGRESS`.
5. Éteindre le flag puis détruire la stack, le stockage et l'état navigateur.
   Tout écart bloque l'activation future du diagnostic ; il ne peut pas être
   accepté comme une simple limite de la quarantaine.

Pour #118, l'invariant effectivement livré est le mode dark, prouvé
automatiquement. La recette active ci-dessus devient obligatoire avant tout
futur feu vert d'ouverture du Candidat libre.

### Coach → ressource → élève

| Contrat de la lane exclue | Couverture de remplacement | Statut |
| --- | --- | --- |
| Un coach ne liste que ses élèves actifs. | `__tests__/api/coach-students.test.ts` (assigné/non assigné et statuts non actifs), `__tests__/rbac/coach-student-access.test.ts` et `e2e/npc/rbac.spec.ts` (identités et base jetables réelles). | Automatique, gate officiel. |
| Le dossier d'un élève assigné répond ; un élève non assigné est refusé. | `__tests__/api/coach-students.test.ts` et `__tests__/api/coach.students.dossier.route.test.ts`. | Automatique, gate officiel. |
| Un coach assigné crée une ressource avec le bon destinataire et le bon auteur. | `__tests__/api/documents-access.test.ts` couvre rôle, rattachement, validation et création. La vérification des clés persistées sur base réelle reste dans la recette ci-dessous. | Automatique + manuel. |
| L'élève destinataire liste/télécharge la ressource ; un autre élève ne la lit pas. | `__tests__/api/student.documents.route.test.ts`, `__tests__/api/student.dashboard.payload.test.ts` et `__tests__/api/student.documents.download.test.ts` couvrent le filtre par `userId`, le rendu dashboard et l'ownership indépendamment de `uploadedById`. | Automatique, gate officiel. |
| Un coach non assigné ne peut ni ouvrir le dossier ni lire les documents. | `__tests__/api/coach-students.test.ts`, `__tests__/api/coach.students.dossier.route.test.ts`, `__tests__/api/documents-access.test.ts` et `__tests__/api/documents-download.test.ts`. | Automatique, gate officiel. |
| Le parcours visuel complet ne produit ni erreur console, ni HTTP 5xx. | Les étapes 2 et 3 du spec exclu contiennent encore des TODO et ne prouvent pas aujourd'hui le dépôt ni l'affichage. La recette ci-dessous est donc la couverture honnête de ce reliquat, pas ce squelette Playwright. | Manuel structurel. |

Procédure de remplacement sur recette ou stack jetable, sans données métier
persistantes :

1. Provisionner deux coachs et deux élèves isolés, avec un seul rattachement
   actif entre le coach A et l'élève A. Le coach B et l'élève B sont les témoins
   négatifs.
2. Avec le coach A, vérifier que la liste et le dossier affichent l'élève A,
   jamais l'élève B ; l'accès direct au dossier B doit répondre `403` ou
   rediriger sans divulguer de données.
3. Créer une ressource à marqueur unique pour l'élève A par la surface
   supportée. Vérifier le succès, puis sur la base jetable uniquement :
   `user_documents.userId` vaut le `User.id` de l'élève A,
   `uploadedById` vaut le `User.id` du coach A et la visibilité attendue est
   enregistrée.
4. Avec l'élève A, vérifier présence, ouverture et téléchargement. Avec l'élève
   B, vérifier l'absence dans les listes et un `403`/`404` sur l'accès direct.
5. Avec le coach B, vérifier l'absence de l'élève A et le refus du dossier et de
   la ressource. Sur toute la séquence : aucun HTTP 5xx, aucune erreur console
   inattendue et aucune erreur Prisma.
6. Détruire la stack jetable. La checklist détaillée demeure
   `docs/qa/COACH_RESOURCE_STUDENT_E2E_CHECKLIST.md`. Tout écart est bloquant ;
   le squelette exclu ne vaut pas preuve tant que ses TODO subsistent.

Ces conditions décrivent des lanes externes, mais leurs contrats ne sont donc
pas laissés sans contrôle : frontières métier/RBAC automatiques et preuve
navigateur manuelle explicitement assignée. Aucun `skip` conditionnel ne
subsiste dans `e2e/auth`, la suite go-live officielle.

La configuration officielle collecte tous les fichiers `*.spec.ts` suivis sous
`__tests__/e2e` et `e2e`, à l'exception explicite des deux lanes externes
ci-dessus. Elle n'utilise ni retry ni liste fermée de fichiers fonctionnels.

Lors de cette collecte élargie, les anciennes attentes du configurateur
Pré-rentrée ont été portées vers les contrats actuellement publiés : sélecteur
de planning direct, cinq niveaux, dix-sept programmes, huit documents, conflits
horaires réels et demande de disponibilité non contractuelle. Le tunnel Bilan
reste volontairement fail-closed vis-à-vis d'un contexte campagne désactivé.
Ces scénarios sont actifs dans le gate officiel et ne constituent pas une
quarantaine.
