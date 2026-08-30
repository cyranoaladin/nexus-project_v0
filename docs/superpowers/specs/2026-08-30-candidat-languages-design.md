# Langues vivantes du candidat individuel

## Date

2026-08-30

## Contexte

Le profil candidat individuel ne permet actuellement que `ANGLAIS` et `ESPAGNOL` dans les champs LVA/LVB. Le besoin validé est de proposer Arabe, Anglais, Espagnol, Italien, Russe et Allemand dans les deux champs, sans permettre la même langue en LVA et LVB.

## Décisions

- Étendre l'enum Prisma `Subject` avec `ARABE`, `ITALIEN`, `RUSSE` et `ALLEMAND` via une migration PostgreSQL additive.
- Centraliser la liste des langues vivantes et leurs libellés français dans un helper partagé.
- Utiliser la même liste pour LVA et LVB.
- Refuser côté serveur toute valeur `Subject` qui n'est pas une langue vivante autorisée, afin qu'une matière comme Mathématiques ne puisse pas être envoyée comme LVA/LVB.
- Conserver une whitelist de spécialités séparée afin qu'une nouvelle langue ne devienne jamais une spécialité par effet de bord de l'enum global.
- Refuser une paire LVA/LVB identique dans l'interface et dans la validation métier serveur.
- Transporter et humaniser la langue concrète dans la carte d'examen, la proposition staff, la vue famille et le PDF, sans exposer l'enum brut.
- Ne pas inventer de domaines diagnostiques. Une langue sans diagnostic disponible reste `NON_EVALUE`.
- Le support demandé couvre la saisie, la persistance, la carte et les sorties humanisées. Une langue `NON_EVALUE` ne devient pas automatiquement une ligne commerciale; aucun besoin ni tarif n'est inventé.
- Ne modifier ni les prix, ni les modules V1/deferred, ni le pipeline `ACTIVE_INTERNAL`.

## Données et déploiement

La migration ajoute uniquement quatre valeurs à un enum PostgreSQL existant. Avant `prisma migrate deploy`, un dump `pg_dump -F c` doit être créé et validé avec `pg_restore --list`. Aucune colonne, ligne ou contrainte existante ne doit être supprimée ou réécrite.

Le retour immédiat à l'ancien binaire est sûr tant qu'aucun profil ne contient une nouvelle valeur. Avant tout rollback post-migration, compter les profils utilisant les quatre nouvelles valeurs. Si ce nombre est non nul, ne pas lancer l'ancien Prisma Client: appliquer un correctif forward compatible ou restaurer uniquement selon un runbook explicitement validé, sans perte silencieuse de données.

## Critères d'acceptation

- Les six langues sont proposées en LVA et LVB.
- Les choix distincts sont persistés et restitués avec le bon libellé.
- Un doublon LVA/LVB est bloqué avec un message français.
- Une matière non linguistique envoyée comme LVA/LVB est bloquée côté serveur.
- Une langue envoyée comme spécialité est bloquée côté serveur.
- `PORTUGAIS` est absent de l'UI et rejeté par le serveur.
- Les autres langues restent sans score si aucun domaine diagnostic réel n'existe.
- Les invariants V1, sécurité PR180, family link et PDF restent valides.
