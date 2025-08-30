# Comptes et Scénarios de Test (Développement)

Mot de passe par défaut: password123

Rôles et comptes

- ADMIN
  - admin@nexus.com
- ASSISTANTE
  - assistante@nexus.com
- COACHS (exemples)
  - helios@nexus.com (Math/NSI)
  - zenon@nexus.com (Français/Philosophie)
  - newton@nexus.com (Physique)
  - coach\_<matiere>@nexus.com pour chaque valeur de l’enum Subject (créés automatiquement si manquants)
- PARENTS & ÉLÈVES (génériques)
  - parent-test-1@nexus.com … parent-test-5@nexus.com
  - eleve-test-1@nexus.com … eleve-test-5@nexus.com
- Parent “variations” avec 3 enfants couvrant plusieurs états d’abonnement/credits
  - parent.variations@nexus.com
  - Enfant A: enfantA@nexus.com — IMMERSION actif, ARIA (2 matières), 10 crédits
  - Enfant B: enfantB@nexus.com — HYBRIDE cancelled, 0 crédit
  - Enfant C: enfantC@nexus.com — ACCES_PLATEFORME expiré, ARIA 1 matière, demande de changement d’abonnement PENDING

Liens utiles

- Admin: /dashboard/admin
- Assistante: /dashboard/assistante
- Coach: /dashboard/coach
- Parent: /dashboard/parent
- Élève: /dashboard/eleve
- ARIA (élève): /aria

Seed et réinitialisation

- Reset + seed complet: npm run db:reset:full
- Seed uniquement: npm run seed:full
- Seed disponibilités coach (nécessite le site en cours d’exécution): npm run seed:avail

Démarrage/arrêt local

- Démarrer l’infra (DB + microservices): npm run dev:infra
- Démarrer le serveur Next en arrière-plan (et l’infra): npm run dev:bg
- Arrêter le serveur Next lancé en arrière-plan: npm run dev:stop
- Vérifier la santé: npm run health:check

Validation rapide

- Smoke tests (Chromium): npm run smoke
- Smoke multi-navigateurs: npm run smoke:all
