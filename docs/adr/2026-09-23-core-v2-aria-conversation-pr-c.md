# PR C — Conversation ARIA native Core v2

## Date

2026-09-23

## Contexte

PR #318 est fusionnée sur `main` (`33844c0879fbd8297f5daa0fb935578c633cac35`).
PR C démarre depuis ce commit sur `feat/core-v2-aria-conversation`.

## Décisions

- Les conversations Core v2 utilisent des modèles Prisma dédiés et des clés
  étrangères vers les seuls `User`/`Student` Core v2.
- L’autorisation conversationnelle est construite par un adapter Core v2 :
  sujet = soi-même, inscription Core v2 courante, scopes et tier issus du
  contexte d’entitlement canonique partagé.
- La vérification de scope de cours est centralisée dans
  `lib/aria/kernel/entitlements.ts`; aucun second classement de tiers n’est
  introduit.
- Les routes et l’exécution Conversation Foundation seront branchées sur ces
  modèles dans les incréments suivants. Aucun appel réel provider ou
  déploiement n’est effectué à ce stade.

## Migration plan

1. `0019_core_v2_aria_conversation` : tables et contraintes natives Core v2.
2. Adapter repository Core v2 implémentant les ports Conversation Foundation.
3. Routes `/api/v2/aria/**` : chat, historique, annulation et feedback.
4. Recovery/watchdog et wiring RAG/provider, puis client authority-aware.
5. Tests unitaires, Core v2 DB/E2E et qualification intégrée avant toute
   release ou migration de preview.

## Vérifications de cet incrément

- `prisma validate` sur le schéma Core v2.
- Test unitaire de l’adapter d’autorisation Core v2.
- Génération locale du client Prisma Core v2 (artefact gitignored).

## Risques restants

- Le repository et les transports Core v2 ne sont pas encore branchés.
- Le chat Core v2 ne doit pas être exposé avant le wiring complet et les E2E.
- La migration doit être répétée sur une base Core v2 disposable avant toute
  qualification intégrée.
