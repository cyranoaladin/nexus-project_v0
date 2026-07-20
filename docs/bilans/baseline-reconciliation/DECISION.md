# Décision formelle B0

## Base recommandée

**`origin/main` figé au SHA `c90b142c88d69bdc600f3f848b44ca0317c00242`.**

## Justification

1. Le commit de production `1b8219b1` est son ancêtre à 41 commits.
2. Le HEAD local `db04d23f` est son ancêtre direct à 3 commits.
3. La base contient donc tous les correctifs des deux autres candidats.
4. Elle ajoute G-SEC, notamment un scope d'ownership sur generate/poll Bilan, et G-PAY.
5. Les 12 checks GitHub observés sont réussis, dont build, unit, integration, E2E, TypeScript, lint et security.
6. Son schéma Prisma et ses dépendances sont identiques à `db04d23f`; aucun conflit de baseline curriculum n'est introduit.
7. Utiliser la production ou le local ferait volontairement repartir d'un code plus ancien.

## Risques restants

- `POST /api/bilans` permet encore au coach de fournir un `studentId` non vérifié.
- Le correctif generate est prouvé par inspection et tests mockés, pas par PostgreSQL réel.
- Fire-and-forget, audience, NSP, scoring fail-open et email legacy restent ouverts.
- La production demeure sur le code vulnérable `1b8219b1`; B0 n'autorise pas son déploiement.
- Les inventaires backend/sécurité sont dépassés par les trois commits récents.
- Les migrations BusinessConfig post-production sont commitées, mais leur présence en DB production est inconnue.
- Le registre curriculum est seulement un overlay local snapshoté et ne doit pas être importé dans B1.

## Preuves à refaire avant ou pendant B1

1. inventaire des routes et matrice guard/ownership au SHA retenu ;
2. tests rouges de création Bilan coach A/élève B ;
3. test PostgreSQL réel generate/poll coach A/coach B ;
4. tests de projection mono-audience ;
5. bundle Assessment sans solutions ;
6. `DONT_KNOW` non pénalisé et scoring fail-closed ;
7. typecheck, tests ciblés, intégration et build dans le nouveau worktree ;
8. état des migrations sur environnement éphémère, sans interroger la production pendant B1 sauf autorisation.

## Commande du worktree

```bash
git -C ./nexus-project_v0 worktree add \
  ../nexus-project_v0-bilans-security \
  -b fix/bilans-security-ownership \
  c90b142c88d69bdc600f3f848b44ca0317c00242
```

## Verdict

**GO pour commencer B1** sur ce nouveau worktree, avec réaudit initial obligatoire et périmètre strict de sécurité existante.

**NO-GO** pour déployer, créer la base canonique Prisma, brancher curriculum/RAG/LLM/worker ou déclarer les P0 fermés avant les preuves listées.
