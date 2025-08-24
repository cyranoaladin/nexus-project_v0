# Spécifications Fonctionnelles par Rôle et Module

## 1. Authentification & Rôles

Rôles Définis : ADMIN, ASSISTANTE, COACH, PARENT, ELEVE.
Processus d'Inscription : Formulaire de "Bilan Gratuit" unique qui crée le compte PARENT et le compte ELEVE et les lie.
Modèle Multi-Enfants : Le compte PARENT est unique. Le tableau de bord parent doit inclure un sélecteur d'enfant pour basculer entre les profils de chaque enfant inscrit. Chaque enfant a son propre abonnement et son propre solde de crédits.

## 2. Les Tableaux de Bord (Dashboards)

Dashboard Élève :
Vue centrale sur son Agenda (cours, ateliers).
Accès direct à la réservation de sessions et au chat ARIA.
Widget de gamification affichant ses derniers badges obtenus.
Dashboard Parent :
Sélecteur d'enfant en haut de page.
Vue des indicateurs clés de l'enfant sélectionné (temps passé, progrès).
Accès à l'agenda et aux rapports du coach de l'enfant sélectionné.
Section centralisée "Facturation & Abonnements" pour gérer les paiements, les abonnements de chaque enfant, et les packs de crédits partagés.
Dashboard Coach :
Vue sur son planning personnel (en ligne et présentiel).
Liste de "Mes Élèves" avec accès à leurs profils et à l'historique des sessions.
Interface pour rédiger et soumettre les comptes-rendus de session.
Dashboard Assistante (Cléa) :
Vue globale sur tous les agendas (élèves, coachs, salles).
Gestion des utilisateurs (création, modification).
Outil de remboursement manuel de crédit pour les exceptions.
Validation des paiements manuels (Wise).
Dashboard Admin :
Accès complet à toutes les données.
Gestion des contenus du site (CMS Headless).
Statistiques globales de la plateforme.

## 3. Module Agenda & Réservation

Vue Centralisée : L'agenda doit être le cœur de l'expérience, affichant cours en ligne, présentiel et ateliers.
Réservation Élève : Parcours de réservation fluide : choix matière -> modalité -> coach (optionnel) -> créneau. Le coût en crédits doit être affiché clairement.
Gestion Coach : Chaque coach doit pouvoir définir ses propres créneaux de disponibilité (en spécifiant en ligne/présentiel).
Prévention des Conflits : Le système doit empêcher les doubles réservations (un coach sur deux cours en même temps, une salle occupée deux fois).

## 4. Module de Communication & Visio

MVP de Lancement :
Un chat textuel asynchrone sécurisé est implémenté entre un coach et ses élèves.
Le chat doit permettre le partage de fichiers (images, PDF).
La narrative autour du chat doit encourager son usage pour des questions rapides et pousser vers ARIA pour une aide instantanée.
Visio-conférence :
Les sessions de cours en ligne se font via une solution intégrée (ex: Jitsi Meet auto-hébergé).
Lorsqu'un cours en ligne commence, un lien vers une salle de visio unique et sécurisée est généré et apparaît dans l'agenda de l'élève et du coach.
La visio s'ouvre directement dans l'interface de la plateforme (via un iframe) pour une expérience transparente.
