# Finalisation « classe d'entrée » — Pré-rentrée 2026

## Décision approuvée

Les codes internes `SECONDE`, `PREMIERE` et `TERMINALE` restent stables. Dans le périmètre Pré-rentrée 2026, ils désignent exclusivement la classe d'entrée à la rentrée 2026-2027 : Troisième vers Seconde, Seconde vers Première et Première vers Terminale.

## Architecture

Le manifeste reste la source des labels publics et expose « Entrée en… ». Les DTO conservent la propriété technique `level` pour la compatibilité planning/modules, documentée comme code de classe d'entrée ; aucun second code concurrent n'est ajouté. Les analytics exposent exclusivement `entry_level`. Le bilan et WhatsApp utilisent le label public résolu par le DTO.

Les contenus pédagogiques sont corrigés dans `content/pre-rentree-2026/modules.json`. Les titres et prérequis décrivent la transition réelle, sans supposer que la classe cible a déjà été suivie.

## Ressources et sécurité

Le manifeste déclare exactement les trois rôles pédagogiques non nominatifs et leur périmètre matière. Les tests dérivent les 60 séances du planning et verrouillent la distribution 30/15/15, les charges 60/30/30 heures, les deux salles et l'absence de collision.

Next.js est qualifié séparément et monté de `15.5.12` à `15.5.18` exactement, sans autre dépendance directe ni `npm audit fix`.

## Validation

Le TDD couvre les labels publics, le bilan, WhatsApp, `entry_level`, les transitions pédagogiques, les ressources, les packs, les 45 configurations, le rendu et les contrôles structurels. La qualification finale comprend Node canonique, installation propre, tests globaux sans skip, E2E, build standalone, smokes, captures et audit runtime.
