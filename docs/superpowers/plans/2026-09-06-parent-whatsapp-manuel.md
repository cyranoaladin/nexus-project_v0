# Invitations WhatsApp manuelles Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** permettre à l’assistante d’envoyer les invitations depuis son application actuelle.

**Architecture:** réutiliser l’identité canonique et le helper WhatsApp, séparer création idempotente et préparation du lien ponctuel.

**Tech Stack:** Next.js, Prisma/PostgreSQL, Jest, Playwright.

---

## Lot backend

- [x] Écrire les tests RED du mode manuel et de la route staff.
- [x] Ajouter lib/whatsapp/delivery-mode.ts et la route app/api/assistante/parents/[parentId]/whatsapp-invitation/route.ts.
- [x] Adapter lib/families/create-family.ts sans persistance du jeton dans l’idempotence.
- [x] Adapter app/api/auth/parent-phone/recovery/route.ts pour orienter la récupération manuelle.
- [x] Rejouer les tests ciblés avec npm test -- --runInBand et les invariants du mode automatique.

## Lot interface

- [x] Écrire les tests RED du composant ParentWhatsAppInvitation et du parcours après création.
- [x] Réutiliser ce composant dans FamilyForm et la fiche étudiant/parent ; exposer le mode via l’API détail.
- [x] Adapter les trois écrans consommateurs de récupération (connexion, oubli, lien parent).
- [x] Vérifier erreurs, expiration, renouvellement et absence de faux statut envoyé.

## Intégration

- [x] Revue croisée du contrat, des permissions et du modèle de confiance staff.
- [x] Tests ciblés, TypeScript, lint, build et recette navigateur locale.
- [x] Documenter résultats et limites, intégrer les fichiers autorisés sans toucher aux autres instances ni déployer.
