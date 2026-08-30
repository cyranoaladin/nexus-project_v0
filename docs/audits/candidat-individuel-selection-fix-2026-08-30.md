# Candidat individuel - correction de la selection eleve

## Date

2026-08-30

## Contexte

Le workspace staff pouvait afficher un eleve choisi sans disposer du couple metier complet `contactLeadId + studentId`. Le correctif reste limite au runtime candidat individuel deja deploye et ne modifie ni le schema Prisma, ni le pricing, ni le perimetre V1.

## Problemes observes

- Le texte saisi pour le responsable pouvait ressembler a une selection sans installer de `contactLeadId`.
- Le contrat de recherche eleve exposait un `id` ambigu entre `User.id` et `Student.id`.
- Le changement de responsable ou une reponse de recherche tardive pouvait laisser un etat derive obsolete.
- Le serveur acceptait deux identifiants existants sans verifier qu'ils appartenaient au meme foyer.

## Decisions prises

- Utiliser un DTO explicite avec `studentId`, `userId` et le rattachement canonique.
- Calculer l'etat du CTA avec un helper pur fail-closed.
- Annuler et ignorer les reponses de recherche obsoletes.
- Revalider le couple responsable/eleve cote serveur sous verrous PostgreSQL avant profil, devis, publication, lien famille et lecture tokenisee.
- Ne jamais relier silencieusement un eleve a un autre responsable.
- Conserver `ACTIVE_INTERNAL` et interdire tout etat public.

## Fichiers modifies

- Workspace candidat individuel et contrat API de recherche eleve.
- Helpers d'identite et vues staff.
- Routes profil/devis ainsi que gates de persistance et publication.
- Tests unitaires, composant, integration PostgreSQL et E2E Chromium.

## Tests executes

- TypeScript, lint, unitaires complets, DB et integration.
- Freeze V1 et securite PR180.
- Scanners source et artefact.
- Build Next.js standalone.
- Matrice E2E Chromium de navigation, identite, RBAC, effectifs, marge, devis, publication, lien famille, PDF et responsive.

## Resultats

Tous les gates obligatoires sont verts. Le schema et les migrations sont identiques a la release precedente.

## Risques restants

Une ecriture externe qui verrouillerait les tables d'identite dans un ordre inverse pourrait exceptionnellement provoquer un deadlock PostgreSQL. L'operation echoue alors sans incoherence; aucun retry automatique supplementaire n'a ete introduit dans ce bugfix.

## Rollback

Le rollback est applicatif: remettre atomiquement le symlink de production vers la release precedente immuable, puis redemarrer uniquement le processus web Nexus. Aucune restauration DB n'est attendue.
