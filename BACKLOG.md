# Backlog technique - Nexus Reussite
# Mis a jour le 28 mai 2026 apres go-live EAM

## Differe - apres examens (post 8 juin 2026)

### B1 - Renommage route NSI
- Route actuelle : `/dashboard/eleve/nsi-pratique-2026`
- Route cible : `/dashboard/eleve/nsi-pratique`
- Raison du report : examen imminent, risque de casser des liens bookmarkes.
- Actions :
  1. Creer `app/dashboard/eleve/nsi-pratique/page.tsx`.
  2. Ajouter un redirect permanent dans `next.config.js`.
  3. Mettre a jour tous les liens internes.

### B2 - Integration ClicToPay
- Warning PM2 connu : `CLICTOPAY_API_KEY` absente.
- Impact : paiement ClicToPay non pleinement operationnel.
- Action : ajouter la cle dans `.env.production` et verifier le tunnel paiement.

### B3 - Dashboard assistante : visibilite EAM
- Actuellement : progression EAM non exposee dans le dashboard assistante.
- Action : creer un endpoint d'agregats inspire de `/api/coach/students/eam-summary`.
- Impact : suivi operationnel de la preparation EAM.

### B4 - Dashboard parent : resume EAM
- A evaluer : pertinence d'afficher le pourcentage EAM aux parents.
- Action possible : ajouter une section "Preparation a l'epreuve" dans la vue enfant.

### B5 - Test mobile authentifie
- Non realise en local faute de session eleve disponible.
- Action : ajouter un test CI authentifie a 375px pour verifier overflow et touch targets.

### B6 - Endpoint de progression globale
- Cible : `/api/student/progress-summary`.
- Agregats : EAM + NSI + Automatismes.
- Impact : un seul appel cockpit, meilleure coherence de chargement.

### B7 - Badges `StudentBadge`
- Table presente en DB, affichage cockpit non integre.
- Action : afficher les badges recents et micro-celebrations.

## Connu et accepte

### K1 - Server Action stale error
- Message : `Failed to find Server Action X`.
- Cause : onglets utilisateurs ouverts sur une ancienne version pendant un reload.
- Resolution : auto-resolution a la prochaine visite.

### K2 - DB user documentaire
- Le container utilise `nexus_admin`.
- Certaines notes initiales mentionnaient `nexus_user`.
- Etat actuel : `nexus_admin` est confirme comme utilisateur effectif.

### K3 - Table utilisateurs
- Le schema DB prod expose la table `users` en minuscule.
- Les health checks doivent interroger `users`, pas `"User"`.
