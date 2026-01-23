# Session Booking Logic — Nexus Réussite

**Dernière mise à jour :** 21 janvier 2026

## 1) Modèles utilisés (actuels)
- `CoachAvailability` : disponibilité coach (récurrente + dates spécifiques)
- `SessionBooking` : session réservée (statuts, horaires, crédits)
- `SessionNotification` : notifications liées à une session
- `SessionReminder` : rappels planifiés

## 2) Flux de réservation (actuel)
1. Parent/élève sélectionne un coach et un créneau
2. API `POST /api/sessions/book`
3. Vérifications :
   - rôle (`PARENT` ou `ELEVE`)
   - disponibilité coach
   - conflits coach/élève
   - crédits suffisants
4. Création `SessionBooking`
5. Débit crédits via `CreditTransaction` (type `USAGE`)
6. Notifications + rappels planifiés

## 3) API principales
- `GET /api/coaches/available`
- `GET/POST /api/coaches/availability`
- `POST /api/sessions/book`
- `POST /api/sessions/cancel`
- `POST /api/sessions/video` (JOIN/LEAVE)

## 4) Points techniques notables
- Les conflits horaires sont vérifiés côté API.
- Les rappels sont créés mais l’envoi effectif est actuellement un stub (log).
- Le modèle `Session` existe encore dans le schéma mais la logique active utilise `SessionBooking`.

