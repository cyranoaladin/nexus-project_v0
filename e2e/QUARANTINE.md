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
| `e2e/auth/parent-dashboard.spec.ts` | 4 | Anciennes attentes de maquette remplacées par quatre contrats du dashboard Famille courant. |
| `e2e/auth/password-reset.spec.ts` | 1 | Sélecteur de soumission et preuve e-mail réactivés via SMTP jetable. |
| `e2e/auth/payments.invoice.documents.spec.ts` | 2 | Paiement, validation, facture et coffre-fort réactivés avec catalogue et CGV canoniques. |
| `e2e/auth/programme/maths-1ere-access.spec.ts` | 1 | Suite entière réactivée via la base URL injectée et les contrôles d'accès courants. |
| `e2e/auth/programme/maths-1ere-premium.spec.ts` | 1 | Suite entière réactivée sur le moteur Maths canonique. |
| `e2e/auth/programme/maths-1ere.spec.ts` | 1 | Suite entière réactivée sur la navigation Maths courante. |
| `e2e/auth/public-front-go-live.spec.ts` | 1 | Contrat Stages aligné sur le contenu public courant et contrôle d'absence des dates obsolètes conservé. |
| `e2e/auth/security.advanced.spec.ts` | 1 | Accès document réactivé avec une fixture de stockage jetable et preuve d'absence de fuite. |
| `e2e/auth/student-automatismes.spec.ts` | 1 | Parcours réactivé après sélection d'une réponse et validation serveur avant la question suivante. |
| `e2e/auth/student-journey.spec.ts` | 1 | Suite entière réactivée sur l'unique parcours Maths Première canonique. |
| `e2e/auth/teacher-bilan-pdf.spec.ts` | 1 | Vue enseignant et action PDF réactivées sur le moteur Maths canonique. |
| `e2e/auth/test-all-pages.spec.ts` | 1 | Base URL locale codée en dur remplacée par celle de la stack jetable. |
| `e2e/auth/test-bilan-banner.spec.ts` | 1 | Réactivé avec les credentials E2E partagés. |
| `e2e/auth/test-dashboard-interactions.spec.ts` | 8 | Les huit rôles/interactions utilisent désormais la base URL et les identités partagées du seed. |
| `e2e/auth/test-real-login.spec.ts` | 3 | Les trois connexions réelles utilisent le helper canonique et vérifient la session Auth.js. |
| **Total** | **51** | **Aucune quarantaine inconditionnelle restante.** |

## Skips conditionnels structurels hors gate hermétique

Trois tests opt-in restent conditionnels et ne sont pas collectés par
`playwright.config.e2e.ts` :

- `e2e/candidate-diagnostic.spec.ts` exige explicitement un état navigateur
  fourni pour un diagnostic Candidat libre réel ; ce lane reste dark et hors
  de cette PR ;
- `e2e/real/coach-resource-student.spec.ts` exige l'activation explicite du
  lane réel et, pour son contrôle IDOR inter-coachs, une seconde identité coach.

Ces conditions décrivent des lanes externes, ne masquent aucun test de la stack
éphémère et sont inspectées par le garde. Aucun `skip` conditionnel ne subsiste
dans `e2e/auth`, la suite go-live officielle.
