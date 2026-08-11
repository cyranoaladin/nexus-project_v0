# Bilan de pré-rentrée — trouvabilité et guidage

## Date

9 août 2026

## Contexte

Audit demandé avant correction, sans déploiement, depuis `origin/main` après les PR #111, #112 et #113. Le candidat libre reste dark et le LLM reste désactivé.

## Problèmes observés

### Pages publiques

- `https://nexusreussite.academy/` répond 200. Le CTA « Demander un bilan gratuit » de `app/HomePageClient.tsx` mène à `/bilan-gratuit`; aucun CTA visible ne nomme le bilan de pré-rentrée ni la passation en ligne.
- `https://nexusreussite.academy/stages/pre-rentree-2026` répond 200. Les CTA de `app/stages/pre-rentree-2026/page.tsx` mènent au planning, à WhatsApp ou au téléphone; aucun ne mène au diagnostic.
- Le bouton global « Bilan gratuit » mène à `https://nexusreussite.academy/bilan-gratuit`.
- `/bilan-gratuit` juxtapose deux intentions dans un vocabulaire ambigu : le formulaire principal crée un espace parent et un premier enfant, tandis que `ConseillerCard` est un formulaire de rappel commercial.

### Parcours parent et élève

- `app/dashboard/parent/page.tsx` expose le bouton générique « Ajouter un Enfant », mais aucun état vide guidé « Ajouter votre enfant ».
- `app/dashboard/parent/add-child-dialog.tsx` conserve le lien après création, permet de le copier et d'ajouter plusieurs enfants. La consigne explicite demandée n'est toutefois pas présente mot pour mot.
- `components/dashboard/parent/ChildCard.tsx` permet de régénérer un lien, mais ce lien n'est pas copiable depuis une visite ultérieure et n'est pas accompagné de la consigne de remise à l'enfant.
- Après activation et connexion, un élève arrive sur `/dashboard/eleve`. La sélection de matière existe à `/bilan-gratuit/assessment`, puis la passation canonique s'enchaîne, mais le dashboard élève ne contient aucun lien vers cette route.
- La vérification navigateur après la première correction a mis au jour un défaut d'intégration de #109 : après un ajout réussi, `refreshDashboardData()` repassait tout le dashboard en chargement. La boîte de dialogue était démontée et le lien d'activation disparaissait avant d'être lu, alors que son test isolé restait vert.

### Saisie papier assistante

- `app/dashboard/assistante/bilans/saisie-papier/page.tsx` permet de rechercher/sélectionner un élève ou de créer un foyer, puis de choisir un pack.
- `app/dashboard/assistante/bilans/saisie-papier/family-form.tsx` crée un foyer et un ou plusieurs enfants; les erreurs sont affichées dans la page.
- `components/bilans/PaperEntryGrid.tsx` indique les réponses et certitudes manquantes, mais l'écran n'affiche pas un fil commun en cinq étapes. Le libellé final « Enregistrer la copie et lancer le bilan » ne distingue pas clairement la validation de la saisie du traitement ultérieur du rapport.
- La route et l'API sont fermées aux rôles parent, élève et coach. Le garde accepte `ASSISTANTE` et `ADMIN`; la convention globale du middleware ADMIN reste inchangée.
- `lib/bilans/api/paper-entry.ts` pose `SAISIE_PAPIER`, le saisisseur et la date directement à l'INSERT. Le scoring canonique n'a pas besoin d'être modifié.

## Décisions prises

- Afficher côte à côte « Passer le bilan de pré-rentrée » et « Être rappelé par un conseiller » sur l'accueil et la page de stage.
- Faire pointer le premier CTA sur le formulaire de création d'espace (`/bilan-gratuit?parcours=diagnostic#demande-bilan`) et le second sur le formulaire de rappel déjà présent (`/bilan-gratuit?parcours=conseiller#rappel-conseiller`).
- Ajouter un état vide parent explicite, conserver le parcours multi-enfants de #109 et rendre le lien d'activation copiable également depuis la fiche enfant.
- Après activation élève, conserver l'étape de connexion mais lui fournir un retour sûr vers `/bilan-gratuit/assessment`; ajouter aussi un accès durable depuis le dashboard élève.
- Ajouter un fil assistante en cinq étapes sans modifier le moteur, l'API de scoring, le middleware ADMIN ni les surfaces candidat libre.

## Fichiers modifiés

- CTA publics et ancres : `components/marketing/PreRentreeDiagnosticCtas.tsx`, `app/HomePageClient.tsx`, `app/stages/pre-rentree-2026/page.tsx`, `app/bilan-gratuit/BilanStrategiqueClient.tsx`.
- Guidage parent : `components/dashboard/BilanGratuitBanner.tsx`, `components/dashboard/parent/ParentChildrenEmptyState.tsx`, `components/dashboard/parent/ChildCard.tsx`, `app/dashboard/parent/page.tsx`, `app/dashboard/parent/add-child-dialog.tsx`.
- Guidage élève : `lib/services/student-activation.service.ts`, `components/dashboard/eleve/PreRentreeAssessmentCard.tsx`, `app/dashboard/eleve/page.tsx`.
- Saisie assistante : `components/bilans/PaperEntryWorkflowSteps.tsx`, `components/bilans/PaperEntryGrid.tsx`, `app/dashboard/assistante/bilans/saisie-papier/page.tsx`.
- Contrats et tests : fichiers correspondants sous `__tests__/` et scénarios publics sous `e2e/`.

## Tests exécutés

- Audit Playwright production desktop et mobile de `/`, `/stages/pre-rentree-2026` et `/bilan-gratuit`.
- Baseline Jest complète : 747 suites vertes; une suite préexistante dépendait de `NEXTAUTH_URL`. La même suite est verte avec `NEXTAUTH_URL=http://localhost:3000`, sans charger de `.env`.
- Cycle TDD ciblé : les nouveaux contrats CTA, parent, élève, assistante et contrôle d'accès ont d'abord échoué, puis sont passés après implémentation.
- Test d'intégration parent ajouté après la découverte navigateur : il prouve que l'écran et la boîte de succès restent montés pendant le rafraîchissement silencieux.
- Suite Jest complète finale sans filtre : 754 suites, 8 420 tests et 7 snapshots verts après le correctif d'intégration.
- `npm run lint`, `npm run typecheck` et `npm run check:e2e-syntax` sont verts. Le lint ne remonte que les avertissements candidat libre préexistants, hors périmètre et non modifiés.
- `npm run build` est vert avec environnement local synthétique, LLM désactivé et candidat libre désactivé : 91 pages générées, traces valides, artefact standalone valide et aucun fichier runtime résiduel.
- Playwright local réel sur PostgreSQL E2E jetable : public desktop/mobile, parent sans enfant, ajout enfant, activation élève, sélection de matière, accès refusé parent/élève et workflow assistante. Aucune erreur navigateur.
- Le workflow documentaire a reproduit l'OOM V8 déjà observé sur `main` après #111 et #112 pendant `tsc --noEmit`, après 160 tests Python et 404 tests pré-rentrée verts. Son heap Node passe de la limite par défaut de 2 Go à 4 Go; aucun contrôle n'est désactivé ou allégé.

## Résultats

- `/` et `/stages/pre-rentree-2026` affichent côte à côte les CTA distincts. Le diagnostic cible `/bilan-gratuit?parcours=diagnostic#demande-bilan`; le rappel cible `/bilan-gratuit?parcours=conseiller#rappel-conseiller`. Les deux formulaires existants restent présents et répondent 200.
- L'état parent vide explique l'enchaînement et expose « Ajouter votre enfant ». Après ajout, le lien personnel reste visible pendant le rafraîchissement, est copiable, porte la consigne exacte et laisse « Ajouter un autre enfant » disponible.
- L'activation élève redirige vers la connexion avec `callbackUrl=/bilan-gratuit/assessment`. La sélection `2de · Mathématiques` est ensuite visible; un accès durable existe aussi dans le dashboard élève.
- L'écran assistante affiche les cinq étapes, les boutons « Choisir cet enfant » et « Choisir cette matière », le compteur de réponses et « Valider la saisie papier ».
- Le navigateur confirme que parent et élève ne restent jamais sur `/dashboard/assistante/bilans/saisie-papier`. Les tests serveur verrouillent aussi le `notFound()` hors staff.
- La provenance `SAISIE_PAPIER` reste posée à l'INSERT par `lib/bilans/api/paper-entry.ts`; le moteur de scoring n'est pas modifié.

### Captures locales

- CTA accueil : `/tmp/nexus-pr-guidage-captures/home-cta-desktop.png` et `/tmp/nexus-pr-guidage-captures/home-mobile.png`.
- CTA stage : `/tmp/nexus-pr-guidage-captures/stages-cta-desktop.png` et `/tmp/nexus-pr-guidage-captures/stages-pre-rentree-mobile.png`.
- Guidage parent : `/tmp/nexus-pr-guidage-captures/parent-empty-guidance-desktop.png` et `/tmp/nexus-pr-guidage-captures/parent-child-activation-link-desktop.png`.
- Sélection élève : `/tmp/nexus-pr-guidage-captures/student-assessment-selection-desktop.png`.
- Saisie assistante : `/tmp/nexus-pr-guidage-captures/assistante-paper-workflow-step-1-desktop.png`, `assistante-paper-workflow-step-3-desktop.png` et `assistante-paper-workflow-step-4-desktop.png` dans le même dossier.
- Relevés : `/tmp/nexus-pr-guidage-captures/public-verification.json` et `/tmp/nexus-pr-guidage-captures/authenticated-verification.json`.

## Risques restants

- La convention globale qui redirige les ADMIN hors de `/dashboard/assistante/*` reste une question de périmètre dashboard.
- Le libellé global « Bilan gratuit » continue de désigner la page mixte `/bilan-gratuit`; sur les deux surfaces demandées, l'ambiguïté est levée par les deux libellés explicites. Une éventuelle harmonisation de toute la navigation relève d'un chantier éditorial global.

## Rollback

PR applicative sans migration : revert du commit de la PR. Aucun déploiement n'est réalisé dans cette mission.
