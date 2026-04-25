# Plan de Refonte des Dashboards Nexus Réussite

Ce document résume le plan d'exécution pour la refonte complète des dashboards, visant à supporter explicitement les filières **Première EDS** et **Première STMG**.

## 1. Objectifs
- **Unification** : Une seule URL `/dashboard/eleve` pour tout le parcours pédagogique.
- **Différenciation** : Expérience distincte entre EDS et STMG (programmes, barèmes, composants).
- **Persistence** : Progression (chapitres, exercices) sauvegardée en base de données et synchronisée.
- **RAG Contextuel** : Appels RAG systématiques pour les remédiations et fiches flash.
- **Dashboards Rôles** : Vues enrichies pour Parents (multi-enfants) et Coachs (cohorte + alertes).

## 2. Structure du Travail (Phases)
- **Phase 1** : Schéma de données (Prisma) pour `gradeLevel`, `academicTrack`, `specialties`.
- **Phase 2** : Définitions diagnostiques et Skill Graphs pour la Première STMG.
- **Phase 3** : APIs Dashboard et Persistence de progression (track-aware).
- **Phase 4** : Dashboard Élève Unifié (Sections & Onglets).
- **Phase 5** : Dashboard Parent (Vue famille + Drill-down).
- **Phase 6** : Dashboard Coach (Cohorte + Dossier élève + Notes).
- **Phase 7** : Hygiène, Charte Graphique (Tokens) et Accessibilité.
- **Phase 8** : Tests E2E exhaustifs et Déploiement.

## 3. Contraintes Techniques
- Next.js 15.5, Prisma 6, Tailwind (Tokens uniquement).
- Pas de hardcoding pédagogique.
- Persistence systématique en DB (PostgreSQL).
- RAG via FastAPI Ingestor.

---
*Dernière mise à jour : 25 Avril 2026*
