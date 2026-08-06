# AGENTS.bilans.md — contrat de travail Codex

Complément spécifique au chantier « Bilans diagnostiques ».
`AGENTS.md` à la racine du dépôt reste prioritaire en cas de contradiction.

## Périmètre autorisé

Codex peut créer et modifier :

```
lib/bilans/**
app/api/bilans/**
app/bilan-gratuit/**
components/bilans/**
data/bilans/**
content/bilans/**
prisma/schema.prisma            (ajout de modèles uniquement)
prisma/migrations/**            (migrations additives uniquement)
__tests__/bilans/**
docs/specs/bilans/**
docs/adr/**
```

Codex **ne modifie pas** : `data/pricing.canonical.json`, `lib/pricing.ts`,
`publication-decisions.owner.json`, les pages publiques critiques existantes,
la configuration Nginx / PM2, aucun fichier `.env`.

## Interdits absolus

1. **Aucun appel LLM** dans `lib/bilans/core/scoring.ts` ni dans le scoring déterministe.
   Le scoring doit être une fonction pure, reproductible, testable hors réseau. La narration
   LLM (`lib/bilans/llm/**`) est un chemin séparé, gaté par `OPENROUTER_API_KEY` et par la
   condition liée « revue coach redevient prérequis si le LLM est activé ».
2. **Aucune valeur d'affichage codée en dur**. Tarifs → getters de `lib/pricing.ts`.
   Seuils et barèmes → les constantes du pack (`lib/bilans/catalog/**`) uniquement.
3. **Aucune seconde source de vérité**. Les packs/bancs proviennent du catalogue canonique
   (`data/bilans/banks/**` + `lib/bilans/catalog/**`). Ne pas recopier de contenu ailleurs.
4. **Aucune promesse de résultat** dans un texte généré. Voir `data/bilans/lexique-interdit.json`.
5. **Aucun nom d'enseignant** dans une restitution destinée à l'élève ou au parent.
6. **Aucune action en production.** Pas de `prisma migrate deploy`, pas de SSH, pas de PM2.
   Les migrations sont produites en local et laissées non appliquées.
7. **Aucun endpoint public ne révèle l'existence d'un compte.** Réponse et latence identiques
   que l'e-mail existe ou non.

## Boucle de travail imposée

Pour chaque ticket du backlog :

1. Lire `AGENTS.md`, puis ce fichier, puis la spec du lot concerné.
2. Lister les fichiers touchés et lire leur état courant avant d'écrire.
3. Identifier la source de vérité de chaque valeur manipulée.
4. Faire **le plus petit changement qui corrige réellement** le point traité.
5. Écrire ou adapter les tests **dans le même commit**.
6. Exécuter dans l'ordre : `lint` → `typecheck` → `test` → `build`. Aucun échec masqué.
7. Produire le rapport factuel :

```
Résumé
Fichiers modifiés
Vérifications exécutées
Points de vigilance
Recommandation suivante
```

Pour un audit, le format est : `Verdict` / `Constats P0-P1-P2` / `Plan d'action`.

## Definition of Done par ticket

- [ ] Comportement conforme à la spec citée, section référencée dans le message de commit
- [ ] Tests unitaires couvrant les cas nominaux **et** les cas dégradés
- [ ] Cas dorés de `__tests__/bilans/fixtures/**` (le cas échéant) toujours verts
- [ ] `lint`, `typecheck`, `test`, `build` verts en local
- [ ] Aucune valeur d'affichage nouvelle hors source canonique
- [ ] Aucun terme du lexique interdit dans les chaînes ajoutées
- [ ] Rendu mobile vérifié si une page publique est touchée (pas de débordement horizontal)

## Convention de commits

```
feat(bilans): <quoi> — spec §<section>
fix(bilans): <quoi> — spec §<section>
test(bilans): <quoi>
docs(bilans): <quoi>
```

Un ticket = une branche `feat/bilans-<slug>`, rebasée sur `main`.
Aucune branche laissée non fusionnée plus de 5 jours (le dépôt en compte déjà 73 non fusionnées).
